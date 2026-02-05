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
 
 interface BaixaRow {
   id: string;
   produto_id: string;
   quantidade: string;
   funcionario_id: string;
   observacao: string;
 }
 
 export function ProdutosEstoque() {
   const { data: salaoId } = useSalaoId();
   const queryClient = useQueryClient();
   const [rows, setRows] = useState<BaixaRow[]>([]);
 
   const produtosQuery = useQuery({
     queryKey: ["produtos", salaoId],
     enabled: !!salaoId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("produtos")
         .select("id, nome, estoque_atual")
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
     mutationFn: async (row: BaixaRow) => {
       const produto = produtosQuery.data?.find((p) => p.id === row.produto_id);
       if (!produto) throw new Error("Produto não encontrado");
 
       const quantidade = Number(row.quantidade);
       if (quantidade <= 0) throw new Error("Quantidade deve ser maior que zero");
       if (produto.estoque_atual < quantidade) {
         throw new Error(`Estoque insuficiente (disponível: ${produto.estoque_atual})`);
       }
 
       // Registra movimentação
       const { error: movError } = await supabase.from("movimentacoes_estoque").insert([
         {
           salao_id: salaoId,
           produto_id: row.produto_id,
           tipo: "saida_consumo",
           quantidade,
           funcionario_id: row.funcionario_id,
           observacao: row.observacao || null,
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
       toast({ title: "Baixa registrada com sucesso" });
     },
     onError: (error: any) => {
       toast({ title: "Erro", description: error.message, variant: "destructive" });
     },
   });
 
   function addRow() {
     setRows([...rows, { id: crypto.randomUUID(), produto_id: "", quantidade: "", funcionario_id: "", observacao: "" }]);
   }
 
   function duplicateRow(row: BaixaRow) {
     setRows([...rows, { ...row, id: crypto.randomUUID() }]);
   }
 
   function removeRow(id: string) {
     setRows(rows.filter((r) => r.id !== id));
   }
 
   function updateRow(id: string, field: keyof BaixaRow, value: string) {
     setRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
   }
 
   async function saveRow(row: BaixaRow) {
     if (!row.produto_id || !row.quantidade || !row.funcionario_id) {
       toast({ title: "Erro", description: "Preencha produto, quantidade e funcionário", variant: "destructive" });
       return;
     }
     await saveMutation.mutateAsync(row);
     removeRow(row.id);
   }
 
   return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="text-lg">Registrar baixas de estoque</CardTitle>
         <Button size="sm" onClick={addRow}>
           <Plus className="mr-2 h-4 w-4" />
           Adicionar baixa
         </Button>
       </CardHeader>
       <CardContent className="space-y-4">
         {rows.length === 0 && (
           <div className="text-sm text-muted-foreground">
             Nenhuma baixa em andamento. Clique em "Adicionar baixa" para começar.
           </div>
         )}
         {rows.map((row) => (
           <div key={row.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-12 items-end">
             <div className="space-y-1 sm:col-span-3">
               <label className="text-xs text-muted-foreground">Produto *</label>
               <Select value={row.produto_id} onValueChange={(v) => updateRow(row.id, "produto_id", v)}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione" />
                 </SelectTrigger>
                 <SelectContent>
                   {produtosQuery.data?.map((p) => (
                     <SelectItem key={p.id} value={p.id}>
                       {p.nome} (estoque: {p.estoque_atual})
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs text-muted-foreground">Quantidade *</label>
               <Input
                 type="number"
                 step="0.01"
                 min="0"
                 value={row.quantidade}
                 onChange={(e) => updateRow(row.id, "quantidade", e.target.value)}
               />
             </div>
 
             <div className="space-y-1 sm:col-span-3">
               <label className="text-xs text-muted-foreground">Funcionário *</label>
               <Select value={row.funcionario_id} onValueChange={(v) => updateRow(row.id, "funcionario_id", v)}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione" />
                 </SelectTrigger>
                 <SelectContent>
                   {funcionariosQuery.data?.map((f) => (
                     <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs text-muted-foreground">Observação</label>
               <Input
                 value={row.observacao}
                 onChange={(e) => updateRow(row.id, "observacao", e.target.value)}
               />
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