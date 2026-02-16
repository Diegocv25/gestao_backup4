 import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { Plus, Save, Copy, Trash2 } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Input } from "@/components/ui/input";
 import { supabase } from "@/integrations/supabase/client";
 import { useSalaoId } from "@/hooks/useSalaoId";
 import { toast } from "@/components/ui/use-toast";
 
 interface VendaRow {
   id: string;
   produto_id: string;
   quantidade: string;
   preco_unitario: string;
   funcionario_id: string;
   cliente_nome: string;
   forma_pagamento: string;
 }
 
 export function ProdutosVendas() {
   const { data: salaoId } = useSalaoId();
   const queryClient = useQueryClient();
   const [rows, setRows] = useState<VendaRow[]>([]);
 
   const produtosQuery = useQuery({
     queryKey: ["produtos", salaoId],
     enabled: !!salaoId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("produtos")
         .select("id, nome, preco_venda, custo_medio, estoque_atual, comissao_valor_fixo")
         .eq("salao_id", salaoId as string)
         .eq("ativo", true)
         .order("nome");
       if (error) throw error;
       return data;
     },
   });
 
   const funcionariosQuery = useQuery({
     queryKey: ["funcionarios", salaoId],
     enabled: !!salaoId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("funcionarios")
         .select("id, nome")
         .eq("salao_id", salaoId as string)
         .eq("ativo", true)
         .order("nome");
       if (error) throw error;
       return data;
     },
   });
 
   const saveMutation = useMutation({
     mutationFn: async (row: VendaRow) => {
       const produto = produtosQuery.data?.find((p) => p.id === row.produto_id);
       if (!produto) throw new Error("Produto não encontrado");
 
       const quantidade = Number(row.quantidade);
       const precoUnitario = Number(row.preco_unitario);
       if (quantidade <= 0) throw new Error("Quantidade deve ser maior que zero");
       if (produto.estoque_atual < quantidade) {
         throw new Error(`Estoque insuficiente (disponível: ${produto.estoque_atual})`);
       }
 
       const totalVenda = quantidade * precoUnitario;
       const totalCusto = quantidade * produto.custo_medio;
       const lucroBruto = totalVenda - totalCusto;
       const comissaoFuncionario = quantidade * Number(produto.comissao_valor_fixo ?? 0);
 
       // Registra venda
       const { error: vendaError } = await supabase.from("vendas_produtos").insert([
         {
           salao_id: salaoId,
           produto_id: row.produto_id,
           quantidade,
           preco_unitario: precoUnitario,
           total_venda: totalVenda,
           custo_unitario: produto.custo_medio,
           total_custo: totalCusto,
           lucro_bruto: lucroBruto,
           comissao_funcionario: comissaoFuncionario,
           funcionario_id: row.funcionario_id,
           forma_pagamento: row.forma_pagamento || null,
           cliente_nome: row.cliente_nome || null,
         },
       ]);
       if (vendaError) throw vendaError;
 
       // Registra movimentação
       const { error: movError } = await supabase.from("movimentacoes_estoque").insert([
         {
           salao_id: salaoId,
           produto_id: row.produto_id,
           tipo: "saida_venda",
           quantidade,
           funcionario_id: row.funcionario_id,
         },
       ]);
       if (movError) throw movError;
 
       // Atualiza estoque
       const { error: updateError } = await supabase
         .from("produtos")
         .update({ estoque_atual: produto.estoque_atual - quantidade })
         .eq("id", row.produto_id);
       if (updateError) throw updateError;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["produtos", salaoId] });
       toast({ title: "Venda registrada com sucesso" });
     },
     onError: (error: any) => {
       toast({ title: "Erro", description: error.message, variant: "destructive" });
     },
   });
 
   function addRow() {
     setRows([
       ...rows,
       {
         id: crypto.randomUUID(),
         produto_id: "",
         quantidade: "",
         preco_unitario: "",
         funcionario_id: "",
         cliente_nome: "",
         forma_pagamento: "",
       },
     ]);
   }
 
   function duplicateRow(row: VendaRow) {
     setRows([...rows, { ...row, id: crypto.randomUUID() }]);
   }
 
   function removeRow(id: string) {
     setRows(rows.filter((r) => r.id !== id));
   }
 
   function updateRow(id: string, field: keyof VendaRow, value: string) {
     setRows(
       rows.map((r) => {
         if (r.id === id) {
           const updated = { ...r, [field]: value };
           // Auto-preencher preço de venda quando seleciona produto
           if (field === "produto_id" && value) {
             const produto = produtosQuery.data?.find((p) => p.id === value);
             if (produto && !r.preco_unitario) {
               updated.preco_unitario = String(produto.preco_venda);
             }
           }
           return updated;
         }
         return r;
       })
     );
   }
 
   async function saveRow(row: VendaRow) {
     if (!row.produto_id || !row.quantidade || !row.preco_unitario || !row.funcionario_id) {
       toast({
         title: "Erro",
         description: "Preencha produto, quantidade, preço e funcionário",
         variant: "destructive",
       });
       return;
     }
     await saveMutation.mutateAsync(row);
     removeRow(row.id);
   }
 
   return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="text-lg">Registrar vendas de produtos</CardTitle>
         <Button size="sm" onClick={addRow}>
           <Plus className="mr-2 h-4 w-4" />
           Adicionar venda
         </Button>
       </CardHeader>
       <CardContent className="space-y-4">
         {rows.length === 0 && (
           <div className="text-sm text-muted-foreground">
             Nenhuma venda em andamento. Clique em "Adicionar venda" para começar.
           </div>
         )}
         {rows.map((row) => (
           <div key={row.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-12 items-end">
             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs text-muted-foreground">Produto *</label>
               <Select value={row.produto_id} onValueChange={(v) => updateRow(row.id, "produto_id", v)}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione" />
                 </SelectTrigger>
                 <SelectContent>
                   {produtosQuery.data?.map((p) => (
                     <SelectItem key={p.id} value={p.id}>
                       {p.nome}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-1 sm:col-span-1">
               <label className="text-xs text-muted-foreground">Qtd. *</label>
               <Input
                 type="number"
                 step="0.01"
                 min="0"
                 value={row.quantidade}
                 onChange={(e) => updateRow(row.id, "quantidade", e.target.value)}
               />
             </div>
 
             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs text-muted-foreground">Preço unit. *</label>
               <Input
                 type="number"
                 step="0.01"
                 min="0"
                 value={row.preco_unitario}
                 onChange={(e) => updateRow(row.id, "preco_unitario", e.target.value)}
               />
             </div>
 
             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs text-muted-foreground">Funcionário *</label>
               <Select value={row.funcionario_id} onValueChange={(v) => updateRow(row.id, "funcionario_id", v)}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione" />
                 </SelectTrigger>
                 <SelectContent>
                   {funcionariosQuery.data?.map((f) => (
                     <SelectItem key={f.id} value={f.id}>
                       {f.nome}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs text-muted-foreground">Cliente</label>
               <Input value={row.cliente_nome} onChange={(e) => updateRow(row.id, "cliente_nome", e.target.value)} />
             </div>
 
             <div className="space-y-1 sm:col-span-1">
               <label className="text-xs text-muted-foreground">Pgto</label>
               <Select value={row.forma_pagamento} onValueChange={(v) => updateRow(row.id, "forma_pagamento", v)}>
                 <SelectTrigger>
                   <SelectValue placeholder="—" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="dinheiro">Dinheiro</SelectItem>
                   <SelectItem value="pix">PIX</SelectItem>
                   <SelectItem value="cartao">Cartão</SelectItem>
                 </SelectContent>
               </Select>
             </div>
 
             <div className="flex gap-2 sm:col-span-2">
               <Button size="sm" onClick={() => saveRow(row)} disabled={saveMutation.isPending}>
                 <Save className="h-4 w-4" />
               </Button>
               <Button size="sm" variant="outline" onClick={() => duplicateRow(row)}>
                 <Copy className="h-4 w-4" />
               </Button>
               <Button size="sm" variant="outline" onClick={() => removeRow(row.id)}>
                 <Trash2 className="h-4 w-4" />
               </Button>
             </div>
           </div>
         ))}
       </CardContent>
     </Card>
   );
 }