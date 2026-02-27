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
   pagamento_dividido?: boolean;
   forma_pagamento2?: string;
   valor1?: string;
   valor2?: string;
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
       const { data: vendaData, error: vendaError } = await supabase
         .from("vendas_produtos")
         .insert([
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
             // mantém por compatibilidade/visualização; o fluxo de caixa usa recebimentos
             forma_pagamento: row.forma_pagamento || null,
             cliente_nome: row.cliente_nome || null,
           },
         ])
         .select("id")
         .single();
       if (vendaError) throw vendaError;

       const vendaId = vendaData?.id;
       if (!vendaId) throw new Error("Não foi possível obter o ID da venda");

       // Recebimentos (permite pagamento dividido)
       const pagamentoDividido = !!row.pagamento_dividido;

       if (!row.forma_pagamento) throw new Error("Informe a forma de pagamento");

       if (!pagamentoDividido) {
         const { error: recErr } = await supabase.from("recebimentos").insert([
           {
             salao_id: salaoId,
             venda_produto_id: vendaId,
             forma: row.forma_pagamento,
             valor: totalVenda,
           },
         ]);
         if (recErr) throw recErr;
       } else {
         if (!row.forma_pagamento2) throw new Error("Informe a segunda forma de pagamento");
         const v1 = Number(String(row.valor1 || "0").replace(",", "."));
         const v2 = Number(String(row.valor2 || "0").replace(",", "."));
         if (Math.abs(v1 + v2 - totalVenda) > 0.01) {
           throw new Error("A soma do pagamento dividido precisa bater com o total da venda");
         }

         const { error: recErr } = await supabase.from("recebimentos").insert([
           {
             salao_id: salaoId,
             venda_produto_id: vendaId,
             forma: row.forma_pagamento,
             valor: v1,
           },
           {
             salao_id: salaoId,
             venda_produto_id: vendaId,
             forma: row.forma_pagamento2,
             valor: v2,
           },
         ]);
         if (recErr) throw recErr;
       }
 
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
         pagamento_dividido: false,
         forma_pagamento2: "",
         valor1: "",
         valor2: "",
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
           // Quando marcar pagamento dividido, sugerir valores
           if (field === "pagamento_dividido") {
             const on = value === "true";
             updated.pagamento_dividido = on;
             if (on) {
               const quantidade = Number(updated.quantidade || 0);
               const precoUnitario = Number(updated.preco_unitario || 0);
               const total = quantidade * precoUnitario;
               updated.valor1 = total ? total.toFixed(2) : "";
               updated.valor2 = "0.00";
               updated.forma_pagamento2 = "";
             } else {
               updated.valor1 = "";
               updated.valor2 = "";
               updated.forma_pagamento2 = "";
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

             <div className="flex items-center gap-2 sm:col-span-2">
               <input
                 type="checkbox"
                 checked={!!row.pagamento_dividido}
                 onChange={(e) => updateRow(row.id, "pagamento_dividido", e.target.checked ? "true" : "false")}
               />
               <label className="text-xs text-muted-foreground">Dividido</label>
             </div>

             {row.pagamento_dividido ? (
               <>
                 <div className="space-y-1 sm:col-span-2">
                   <label className="text-xs text-muted-foreground">Valor 1</label>
                   <Input value={row.valor1 || ""} onChange={(e) => updateRow(row.id, "valor1", e.target.value)} />
                 </div>

                 <div className="space-y-1 sm:col-span-1">
                   <label className="text-xs text-muted-foreground">Forma 2</label>
                   <Select value={row.forma_pagamento2 || ""} onValueChange={(v) => updateRow(row.id, "forma_pagamento2", v)}>
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

                 <div className="space-y-1 sm:col-span-2">
                   <label className="text-xs text-muted-foreground">Valor 2</label>
                   <Input value={row.valor2 || ""} onChange={(e) => updateRow(row.id, "valor2", e.target.value)} />
                 </div>
               </>
             ) : null}
 
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