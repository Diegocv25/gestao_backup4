 import { useState } from "react";
 import { useQuery } from "@tanstack/react-query";
 import { format } from "date-fns";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { Skeleton } from "@/components/ui/skeleton";
 import { supabase } from "@/integrations/supabase/client";
 import { useSalaoId } from "@/hooks/useSalaoId";
 
 interface RelatoriosProdutosProps {
   inicio: string;
   fim: string;
 }
 
 interface Movimentacao {
   id: string;
   tipo: string;
   quantidade: number;
   observacao: string | null;
   created_at: string;
   produto: { nome: string; unidade: string };
   funcionario: { nome: string } | null;
 }
 
 interface Venda {
   id: string;
   quantidade: number;
   preco_unitario: number;
   custo_unitario: number;
   total_venda: number;
   total_custo: number;
   lucro_bruto: number;
   comissao_funcionario: number;
   cliente_nome: string | null;
   forma_pagamento: string | null;
   created_at: string;
   produto: { nome: string; unidade: string };
   funcionario: { nome: string };
 }
 
 export default function RelatoriosProdutos({ inicio, fim }: RelatoriosProdutosProps) {
  const { data: salaoId } = useSalaoId();
 
   const movimentacoesQuery = useQuery({
     queryKey: ["movimentacoes-estoque-relatorio", salaoId, inicio, fim],
     queryFn: async () => {
       if (!salaoId) return [];
       const { data, error } = await supabase
         .from("movimentacoes_estoque")
         .select(`
           id,
           tipo,
           quantidade,
           observacao,
           created_at,
           produto:produtos(nome, unidade),
           funcionario:funcionarios(nome)
         `)
         .eq("salao_id", salaoId)
         .gte("created_at", `${inicio}T00:00:00`)
         .lte("created_at", `${fim}T23:59:59`)
         .order("created_at", { ascending: false });
 
       if (error) throw error;
       return data as Movimentacao[];
     },
     enabled: !!salaoId,
   });
 
   const vendasQuery = useQuery({
     queryKey: ["vendas-produtos-relatorio", salaoId, inicio, fim],
     queryFn: async () => {
       if (!salaoId) return [];
       const { data, error } = await supabase
         .from("vendas_produtos")
         .select(`
           id,
           quantidade,
           preco_unitario,
           custo_unitario,
           total_venda,
           total_custo,
           lucro_bruto,
           comissao_funcionario,
           cliente_nome,
           forma_pagamento,
           created_at,
           produto:produtos(nome, unidade),
           funcionario:funcionarios(nome)
         `)
         .eq("salao_id", salaoId)
         .gte("created_at", `${inicio}T00:00:00`)
         .lte("created_at", `${fim}T23:59:59`)
         .order("created_at", { ascending: false });

       if (error) throw error;

       const vendas = (data as Venda[]) || [];
       const ids = vendas.map((v) => v.id);
       if (ids.length === 0) return vendas;

       // Busca recebimentos por venda para exibir pagamento dividido corretamente
       const { data: recData, error: recErr } = await supabase
         .from("recebimentos")
         .select("venda_produto_id, forma, valor")
         .eq("salao_id", salaoId)
         .in("venda_produto_id", ids);
       if (recErr) throw recErr;

       const map = new Map<string, Array<{ forma: string; valor: number }>>();
       for (const r of recData || []) {
         const k = String((r as any).venda_produto_id);
         const arr = map.get(k) || [];
         arr.push({ forma: String((r as any).forma), valor: Number((r as any).valor ?? 0) });
         map.set(k, arr);
       }

       return vendas.map((v) => {
         const parts = map.get(String(v.id)) || [];
         if (parts.length <= 1) return v;
         const formas = Array.from(new Set(parts.map((p) => p.forma)));
         return {
           ...v,
           forma_pagamento: formas.join(" + "),
         };
       });
     },
     enabled: !!salaoId,
   });
 
   const isLoading = movimentacoesQuery.isLoading || vendasQuery.isLoading;
   const movimentacoes = movimentacoesQuery.data || [];
   const vendas = vendasQuery.data || [];
 
   const totalVendas = vendas.reduce((acc, v) => acc + Number(v.total_venda), 0);
   const totalComissoesProdutos = vendas.reduce((acc, v) => acc + Number(v.comissao_funcionario ?? 0), 0);
   const totalLucro = vendas.reduce((acc, v) => acc + (Number(v.lucro_bruto) - Number(v.comissao_funcionario ?? 0)), 0);
 
   function getTipoBadge(tipo: string) {
     const tipos: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
       entrada: { label: "Entrada", variant: "default" },
       "consumo_interno": { label: "Consumo", variant: "secondary" },
       venda: { label: "Venda", variant: "destructive" },
     };
     const config = tipos[tipo] || { label: tipo, variant: "default" as const };
     return <Badge variant={config.variant}>{config.label}</Badge>;
   }
 
   return (
     <div className="space-y-6">
       <Card>
         <CardHeader>
           <CardTitle>Movimentações de Estoque</CardTitle>
           <CardDescription>Entradas, consumos e baixas de produtos no período</CardDescription>
         </CardHeader>
         <CardContent>
           {isLoading ? (
             <div className="space-y-2">
               {[1, 2, 3].map((i) => (
                 <Skeleton key={i} className="h-12 w-full" />
               ))}
             </div>
           ) : movimentacoes.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação no período</p>
           ) : (
             <div className="rounded-md border overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Data/Hora</TableHead>
                     <TableHead>Tipo</TableHead>
                     <TableHead>Produto</TableHead>
                     <TableHead>Quantidade</TableHead>
                     <TableHead>Funcionário</TableHead>
                     <TableHead>Observação</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {movimentacoes.map((mov) => (
                     <TableRow key={mov.id}>
                       <TableCell className="whitespace-nowrap">
                         {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm")}
                       </TableCell>
                       <TableCell>{getTipoBadge(mov.tipo)}</TableCell>
                       <TableCell>{mov.produto.nome}</TableCell>
                       <TableCell>
                         {Number(mov.quantidade).toFixed(2)} {mov.produto.unidade}
                       </TableCell>
                       <TableCell>{mov.funcionario?.nome || "-"}</TableCell>
                       <TableCell className="text-muted-foreground">{mov.observacao || "-"}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           )}
         </CardContent>
       </Card>
 
       <Card>
         <CardHeader>
           <CardTitle>Vendas de Produtos</CardTitle>
           <CardDescription>
             Registro de vendas realizadas • Total: R$ {totalVendas.toFixed(2)} • Comissão funcionários: R$ {totalComissoesProdutos.toFixed(2)} • Lucro líquido: R$ {totalLucro.toFixed(2)}
           </CardDescription>
         </CardHeader>
         <CardContent>
           {isLoading ? (
             <div className="space-y-2">
               {[1, 2, 3].map((i) => (
                 <Skeleton key={i} className="h-12 w-full" />
               ))}
             </div>
           ) : vendas.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda no período</p>
           ) : (
             <div className="rounded-md border overflow-x-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Data/Hora</TableHead>
                     <TableHead>Produto</TableHead>
                     <TableHead>Quantidade</TableHead>
                     <TableHead>Preço Unit.</TableHead>
                     <TableHead>Total Venda</TableHead>
                     <TableHead>Comissão func.</TableHead>
                     <TableHead>Lucro líquido</TableHead>
                     <TableHead>Cliente</TableHead>
                     <TableHead>Funcionário</TableHead>
                     <TableHead>Pagamento</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {vendas.map((venda) => (
                     <TableRow key={venda.id}>
                       <TableCell className="whitespace-nowrap">
                         {format(new Date(venda.created_at), "dd/MM/yyyy HH:mm")}
                       </TableCell>
                       <TableCell>{venda.produto.nome}</TableCell>
                       <TableCell>
                         {Number(venda.quantidade).toFixed(2)} {venda.produto.unidade}
                       </TableCell>
                       <TableCell>R$ {Number(venda.preco_unitario).toFixed(2)}</TableCell>
                       <TableCell className="font-medium">R$ {Number(venda.total_venda).toFixed(2)}</TableCell>
                       <TableCell className="font-medium text-amber-600">
                         R$ {Number(venda.comissao_funcionario ?? 0).toFixed(2)}
                       </TableCell>
                       <TableCell className="font-medium text-primary">
                         R$ {(Number(venda.lucro_bruto) - Number(venda.comissao_funcionario ?? 0)).toFixed(2)}
                       </TableCell>
                       <TableCell>{venda.cliente_nome || "-"}</TableCell>
                       <TableCell>{venda.funcionario.nome}</TableCell>
                       <TableCell>{venda.forma_pagamento || "-"}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </div>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }