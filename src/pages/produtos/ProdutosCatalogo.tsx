 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { Plus, Pencil } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { supabase } from "@/integrations/supabase/client";
 import { useSalaoId } from "@/hooks/useSalaoId";
 import { toast } from "@/components/ui/use-toast";
 import { formatBRL } from "@/pages/relatorios/relatorios-utils";
 
 interface Produto {
   id: string;
   nome: string;
   categoria: string | null;
   unidade: string;
   preco_venda: number;
   custo_medio: number;
   estoque_atual: number;
   estoque_minimo: number;
   comissao_valor_fixo: number;
   ativo: boolean;
 }
 
 export function ProdutosCatalogo() {
   const { data: salaoId } = useSalaoId();
   const queryClient = useQueryClient();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [selectedUnidade, setSelectedUnidade] = useState<string>("un");
 
   const produtosQuery = useQuery({
     queryKey: ["produtos", salaoId],
     enabled: !!salaoId,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("produtos")
         .select("*")
         .eq("salao_id", salaoId as string)
         .order("nome");
       if (error) throw error;
       return data as Produto[];
     },
   });
 
   const saveMutation = useMutation({
     mutationFn: async (produto: Partial<Produto>) => {
       if (editingProduto) {
         const { error } = await supabase
           .from("produtos")
           .update(produto)
           .eq("id", editingProduto.id);
         if (error) throw error;
       } else {
        const insertData = {
          salao_id: salaoId as string,
          nome: produto.nome as string,
          categoria: produto.categoria,
          unidade: produto.unidade as string,
          preco_venda: produto.preco_venda as number,
          custo_medio: produto.custo_medio as number,
          estoque_atual: produto.estoque_atual as number,
          estoque_minimo: produto.estoque_minimo as number,
          comissao_valor_fixo: produto.comissao_valor_fixo as number,
          ativo: produto.ativo ?? true,
        };
        const { error } = await supabase.from("produtos").insert([insertData]);
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["produtos", salaoId] });
       setIsDialogOpen(false);
       setEditingProduto(null);
       toast({ title: editingProduto ? "Produto atualizado" : "Produto criado" });
     },
     onError: (error: any) => {
       toast({ title: "Erro", description: error.message, variant: "destructive" });
     },
   });
 
   function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
     e.preventDefault();
     const formData = new FormData(e.currentTarget);
     saveMutation.mutate({
       nome: formData.get("nome") as string,
      categoria: selectedCategoria || null,
      unidade: selectedUnidade,
       preco_venda: Number(formData.get("preco_venda")),
       custo_medio: Number(formData.get("custo_medio")),
      estoque_atual: Number(formData.get("estoque_atual")),
       estoque_minimo: Number(formData.get("estoque_minimo")),
       comissao_valor_fixo: Number(formData.get("comissao_valor_fixo") ?? 0),
       ativo: formData.get("ativo") === "on",
     });
   }
 
   function openDialog(produto: Produto | null) {
     setEditingProduto(produto);
    setSelectedCategoria(produto?.categoria || null);
    setSelectedUnidade(produto?.unidade || "un");
     setIsDialogOpen(true);
   }
 
   return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="text-lg">Catálogo de produtos</CardTitle>
         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogTrigger asChild>
             <Button size="sm" onClick={() => openDialog(null)}>
               <Plus className="mr-2 h-4 w-4" />
               Adicionar produto
             </Button>
           </DialogTrigger>
           <DialogContent className="max-w-2xl">
             <DialogHeader>
               <DialogTitle>{editingProduto ? "Editar produto" : "Novo produto"}</DialogTitle>
             </DialogHeader>
             <form onSubmit={handleSubmit} className="space-y-4">
               <div className="grid gap-4 sm:grid-cols-2">
                 <div className="space-y-2">
                   <Label htmlFor="nome">Nome *</Label>
                   <Input id="nome" name="nome" defaultValue={editingProduto?.nome} required />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="categoria">Categoria</Label>
                  <Select value={selectedCategoria || undefined} onValueChange={setSelectedCategoria}>
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumo estabelecimento">Consumo estabelecimento</SelectItem>
                      <SelectItem value="vendas para clientes">Vendas para clientes</SelectItem>
                    </SelectContent>
                  </Select>
                 </div>
                 <div className="space-y-2">
                  <Label htmlFor="unidade">Unidade de medida *</Label>
                  <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                    <SelectTrigger id="unidade">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Unidade (un)</SelectItem>
                      <SelectItem value="kg">Quilograma (kg)</SelectItem>
                      <SelectItem value="g">Grama (g)</SelectItem>
                      <SelectItem value="L">Litro (L)</SelectItem>
                      <SelectItem value="ml">Mililitro (ml)</SelectItem>
                      <SelectItem value="cx">Caixa (cx)</SelectItem>
                      <SelectItem value="pct">Pacote (pct)</SelectItem>
                      <SelectItem value="m">Metro (m)</SelectItem>
                    </SelectContent>
                  </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="preco_venda">Preço de venda (R$) *</Label>
                   <Input id="preco_venda" name="preco_venda" type="number" step="0.01" min="0" defaultValue={editingProduto?.preco_venda || 0} required />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="custo_medio">Custo médio (R$) *</Label>
                   <Input id="custo_medio" name="custo_medio" type="number" step="0.01" min="0" defaultValue={editingProduto?.custo_medio || 0} required />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="comissao_valor_fixo">Comissão fixa por venda (R$)</Label>
                   <Input
                     id="comissao_valor_fixo"
                     name="comissao_valor_fixo"
                     type="number"
                     step="0.01"
                     min="0"
                     defaultValue={editingProduto?.comissao_valor_fixo || 0}
                   />
                 </div>
                 <div className="space-y-2">
                  <Label htmlFor="estoque_atual">Estoque atual *</Label>
                  <Input id="estoque_atual" name="estoque_atual" type="number" step="0.01" min="0" defaultValue={editingProduto?.estoque_atual || 0} required />
                </div>
                <div className="space-y-2">
                   <Label htmlFor="estoque_minimo">Estoque mínimo *</Label>
                   <Input id="estoque_minimo" name="estoque_minimo" type="number" step="0.01" min="0" defaultValue={editingProduto?.estoque_minimo || 0} required />
                 </div>
               </div>
               <div className="flex items-center space-x-2">
                 <Switch id="ativo" name="ativo" defaultChecked={editingProduto?.ativo ?? true} />
                 <Label htmlFor="ativo">Produto ativo</Label>
               </div>
               <div className="flex justify-end gap-2">
                 <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                 <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
               </div>
             </form>
           </DialogContent>
         </Dialog>
       </CardHeader>
       <CardContent>
         {produtosQuery.isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
         {produtosQuery.error && <div className="text-sm text-destructive">Erro ao carregar produtos</div>}
         {produtosQuery.data && (
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Produto</TableHead>
                 <TableHead>Categoria</TableHead>
                 <TableHead>Unidade</TableHead>
                 <TableHead className="text-right">Preço venda</TableHead>
                 <TableHead className="text-right">Custo médio</TableHead>
                 <TableHead className="text-right">Comissão fixa</TableHead>
                 <TableHead className="text-right">Estoque atual</TableHead>
                 <TableHead className="text-right">Estoque mín.</TableHead>
                 <TableHead>Status</TableHead>
                 <TableHead></TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {produtosQuery.data.map((p) => (
                 <TableRow key={p.id}>
                   <TableCell className="font-medium">{p.nome}</TableCell>
                   <TableCell>{p.categoria || "—"}</TableCell>
                   <TableCell>{p.unidade}</TableCell>
                   <TableCell className="text-right">{formatBRL(p.preco_venda)}</TableCell>
                   <TableCell className="text-right">{formatBRL(p.custo_medio)}</TableCell>
                   <TableCell className="text-right">{formatBRL(p.comissao_valor_fixo ?? 0)}</TableCell>
                   <TableCell className="text-right">
                     <span className={p.estoque_atual <= p.estoque_minimo ? "text-destructive font-semibold" : ""}>
                       {p.estoque_atual}
                     </span>
                   </TableCell>
                   <TableCell className="text-right">{p.estoque_minimo}</TableCell>
                   <TableCell>
                     <Badge variant={p.ativo ? "default" : "secondary"}>
                       {p.ativo ? "Ativo" : "Inativo"}
                     </Badge>
                   </TableCell>
                   <TableCell>
                     <Button variant="ghost" size="sm" onClick={() => openDialog(p)}>
                       <Pencil className="h-4 w-4" />
                     </Button>
                   </TableCell>
                 </TableRow>
               ))}
               {produtosQuery.data.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                     Nenhum produto cadastrado
                   </TableCell>
                 </TableRow>
               )}
             </TableBody>
           </Table>
         )}
       </CardContent>
     </Card>
   );
 }