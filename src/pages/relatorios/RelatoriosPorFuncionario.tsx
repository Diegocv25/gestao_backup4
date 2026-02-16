 import { useMemo, useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { useToast } from "@/hooks/use-toast";

import { formatBRL, safeNumber, toFimDateExclusivo, toInicioDate } from "@/pages/relatorios/relatorios-utils";

type Row = {
  funcionario: string;
  servicosRealizados: number;
  vendasProdutos: number;
  comissaoServicosPaga: number;
  comissaoServicosPendente: number;
  comissaoProdutos: number;
  receitaBruta: number;
  rendaSalao: number;
};

export default function RelatoriosPorFuncionario({ inicio, fim }: { inicio: string; fim: string }) {
  const { data: salaoId } = useSalaoId();
  const inicioDate = useMemo(() => toInicioDate(inicio), [inicio]);
  const fimDateExclusivo = useMemo(() => toFimDateExclusivo(fim), [fim]);

  const porFuncionarioQuery = useQuery({
    queryKey: ["relatorios", "por_funcionario", { salaoId, inicio, fim }],
    enabled: !!salaoId && !!inicio && !!fim,
    queryFn: async () => {
      const [funcs, ags, vendasProdutos, comCalc, comPagas, comPendentes] = await Promise.all([
        supabase.from("funcionarios").select("id,nome").eq("salao_id", salaoId as string),

        supabase
          .from("agendamentos")
          .select("id,funcionario_id,total_valor")
          .eq("salao_id", salaoId as string)
          .eq("status", "concluido")
          .gte("data_hora_inicio", inicioDate.toISOString())
          .lt("data_hora_inicio", fimDateExclusivo.toISOString()),

        supabase
          .from("vendas_produtos")
          .select("funcionario_id,total_venda,total_custo,comissao_funcionario")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("agendamento_id,funcionario_id,valor_calculado")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("funcionario_id,valor_calculado")
          .eq("salao_id", salaoId as string)
          .not("pago_em", "is", null)
          .gte("pago_em", inicioDate.toISOString())
          .lt("pago_em", fimDateExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("funcionario_id,valor_calculado")
          .eq("salao_id", salaoId as string)
          .is("pago_em", null)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),
      ]);

      const errors = [funcs.error, ags.error, vendasProdutos.error, comCalc.error, comPagas.error, comPendentes.error].filter(Boolean);
      if (errors.length) throw errors[0];

      const nomePorId = new Map<string, string>((funcs.data ?? []).map((f: any) => [String(f.id), String(f.nome ?? "(Sem nome)")]));

      const acc = new Map<string, Row>();
      const ensure = (funcId: string) => {
        const nome = nomePorId.get(funcId) ?? "(Sem nome)";
        const key = funcId;
        if (!acc.has(key)) {
          acc.set(key, {
            funcionario: nome,
            servicosRealizados: 0,
            vendasProdutos: 0,
            comissaoServicosPaga: 0,
            comissaoServicosPendente: 0,
            comissaoProdutos: 0,
            receitaBruta: 0,
            rendaSalao: 0,
          });
        }
        return acc.get(key)!;
      };

      const comCalcByAgendamento = new Map<string, number>();
      (comCalc.data ?? []).forEach((c: any) => {
        comCalcByAgendamento.set(String(c.agendamento_id), safeNumber(c.valor_calculado));
      });

      (ags.data ?? []).forEach((a: any) => {
        const funcId = String(a.funcionario_id);
        const r = ensure(funcId);
        r.servicosRealizados += 1;
        r.receitaBruta += safeNumber(a.total_valor);
        const comCalcValor = comCalcByAgendamento.get(String(a.id)) ?? 0;
        r.rendaSalao += safeNumber(a.total_valor) - comCalcValor;
      });

      (vendasProdutos.data ?? []).forEach((v: any) => {
        const funcId = String(v.funcionario_id);
        const r = ensure(funcId);
        r.vendasProdutos += 1;
        r.receitaBruta += safeNumber(v.total_venda);
        const custo = safeNumber(v.total_custo);
        const comissaoProduto = safeNumber(v.comissao_funcionario);
        r.comissaoProdutos += comissaoProduto;
        r.rendaSalao += safeNumber(v.total_venda) - custo - comissaoProduto;
      });

      (comPagas.data ?? []).forEach((c: any) => {
        const funcId = String(c.funcionario_id);
        const r = ensure(funcId);
        r.comissaoServicosPaga += safeNumber(c.valor_calculado);
      });

      (comPendentes.data ?? []).forEach((c: any) => {
        const funcId = String(c.funcionario_id);
        const r = ensure(funcId);
        r.comissaoServicosPendente += safeNumber(c.valor_calculado);
      });

      const rows = Array.from(acc.values())
        .filter((r) => r.servicosRealizados > 0 || r.vendasProdutos > 0 || r.comissaoServicosPaga > 0 || r.comissaoProdutos > 0 || r.receitaBruta > 0)
        .sort((a, b) => b.rendaSalao - a.rendaSalao);

      return { rows };
    },
  });

   // Estado para o filtro
   const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>("");
   const queryClient = useQueryClient();
   const { toast } = useToast();

   // Query para buscar funcionários
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
       return data || [];
     },
   });

   // Query para buscar comissões não pagas do funcionário selecionado
   const comissoesNaoPagasQuery = useQuery({
     queryKey: ["comissoes_nao_pagas", salaoId, funcionarioSelecionado, inicio, fim],
     enabled: !!salaoId && !!funcionarioSelecionado && !!inicio && !!fim,
     queryFn: async () => {
       const { data, error } = await supabase
         .from("comissoes")
         .select(`
           id,
           valor_calculado,
           created_at,
           agendamento_id,
           agendamentos (
             id,
             data_hora_inicio,
             total_valor,
             clientes (
               nome
             )
           )
         `)
         .eq("salao_id", salaoId as string)
         .eq("funcionario_id", funcionarioSelecionado)
         .is("pago_em", null)
         .gte("created_at", inicioDate.toISOString())
         .lt("created_at", fimDateExclusivo.toISOString())
         .order("created_at", { ascending: false });
       
       if (error) throw error;
       return data || [];
     },
   });

   // Mutation para marcar comissão como paga
   const marcarComoPagoMutation = useMutation({
     mutationFn: async (comissaoId: string) => {
       const { error } = await supabase
         .from("comissoes")
         .update({ pago_em: new Date().toISOString() })
         .eq("id", comissaoId);
       
       if (error) throw error;
     },
     onSuccess: () => {
       toast({
         title: "Comissão marcada como paga",
         description: "O pagamento foi registrado com sucesso.",
       });
       queryClient.invalidateQueries({ queryKey: ["comissoes_nao_pagas"] });
       queryClient.invalidateQueries({ queryKey: ["relatorios", "por_funcionario"] });
     },
     onError: (error) => {
       toast({
         title: "Erro ao marcar pagamento",
         description: error.message,
         variant: "destructive",
       });
     },
   });

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo por funcionário (período)</CardTitle>
        </CardHeader>
        <CardContent>
          {porFuncionarioQuery.isLoading ? <div className="text-xs text-muted-foreground">Carregando…</div> : null}
          {porFuncionarioQuery.error ? <div className="text-xs text-destructive">Erro ao carregar.</div> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-right">Serviços</TableHead>
                <TableHead className="text-right">Vendas prod.</TableHead>
                <TableHead className="text-right">Comissão serv. paga</TableHead>
                <TableHead className="text-right">Comissão serv. pendente</TableHead>
                <TableHead className="text-right">Comissão produtos</TableHead>
                <TableHead className="text-right">Receita bruta</TableHead>
                <TableHead className="text-right">Renda p/ salão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(porFuncionarioQuery.data?.rows ?? []).map((r) => (
                <TableRow key={r.funcionario}>
                  <TableCell className="max-w-[260px] truncate">{r.funcionario}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.servicosRealizados}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.vendasProdutos}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.comissaoServicosPaga)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.comissaoServicosPendente)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.comissaoProdutos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.receitaBruta)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatBRL(r.rendaSalao)}</TableCell>
                </TableRow>
              ))}

              {(porFuncionarioQuery.data?.rows ?? []).length === 0 && !porFuncionarioQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    Nenhum dado no período.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gerenciar comissões não pagas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Selecione o funcionário</label>
              <Select value={funcionarioSelecionado} onValueChange={setFuncionarioSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {(funcionariosQuery.data || []).map((func) => (
                    <SelectItem key={func.id} value={func.id}>
                      {func.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {funcionarioSelecionado && (
            <>
              {comissoesNaoPagasQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Carregando comissões...</div>
              )}
              
              {comissoesNaoPagasQuery.error && (
                <div className="text-xs text-destructive">Erro ao carregar comissões.</div>
              )}

              {comissoesNaoPagasQuery.data && comissoesNaoPagasQuery.data.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Valor do serviço</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoesNaoPagasQuery.data.map((comissao: any) => (
                        <TableRow key={comissao.id}>
                          <TableCell className="text-sm">
                            {comissao.agendamentos?.data_hora_inicio
                              ? format(new Date(comissao.agendamentos.data_hora_inicio), "dd/MM/yyyy HH:mm")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {comissao.agendamentos?.clientes?.nome || "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(comissao.agendamentos?.total_valor || 0)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatBRL(comissao.valor_calculado)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              Não paga
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => marcarComoPagoMutation.mutate(comissao.id)}
                              disabled={marcarComoPagoMutation.isPending}
                            >
                              Marcar como pago
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : comissoesNaoPagasQuery.data && comissoesNaoPagasQuery.data.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma comissão não paga encontrada no período selecionado.
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
