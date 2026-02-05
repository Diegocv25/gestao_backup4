import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { competenciaToDate, formatBRL, safeNumber, toFimDateExclusivo, toInicioDate } from "@/pages/relatorios/relatorios-utils";
import { useToast } from "@/hooks/use-toast";

import { DespesaEditableRow, type DespesaRow, type FormaPagamento } from "@/pages/relatorios/despesas/DespesaEditableRow";
import { SalariosPagosCard } from "@/pages/relatorios/despesas/SalariosPagosCard";

export default function RelatoriosDespesas({
  competencia,
  onChangeCompetencia,
  inicio,
  fim,
}: {
  competencia: string;
  onChangeCompetencia: (v: string) => void;
  inicio: string;
  fim: string;
}) {
  const { data: salaoId } = useSalaoId();
  const qc = useQueryClient();
  const { toast } = useToast();

  const competenciaDate = useMemo(() => competenciaToDate(competencia), [competencia]);
  const inicioDate = useMemo(() => toInicioDate(inicio), [inicio]);
  const fimDateExclusivo = useMemo(() => toFimDateExclusivo(fim), [fim]);

  // Totais do período (para fechamento)
  const totaisPeriodoQuery = useQuery({
    queryKey: ["relatorios", "totais_periodo", { salaoId, inicio, fim }],
    enabled: !!salaoId && !!inicio && !!fim,
    queryFn: async () => {
      const [ag, comCalc, vendasProdutos] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("total_valor")
          .eq("salao_id", salaoId as string)
          .eq("status", "concluido")
          .gte("data_hora_inicio", inicioDate.toISOString())
          .lt("data_hora_inicio", fimDateExclusivo.toISOString()),
        supabase
          .from("comissoes")
          .select("valor_calculado")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),
        supabase
          .from("vendas_produtos")
          .select("total_venda")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),
      ]);
      if (ag.error) throw ag.error;
      if (comCalc.error) throw comCalc.error;
      if (vendasProdutos.error) throw vendasProdutos.error;

      const receitaServicos = (ag.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_valor), 0);
      const receitaVendasProdutos = (vendasProdutos.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_venda), 0);
      const receitaBruta = receitaServicos + receitaVendasProdutos;
      const comissoesCalc = (comCalc.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.valor_calculado), 0);
      const receitaLiquida = receitaBruta - comissoesCalc;

      return { receitaBruta, receitaLiquida };
    },
  });

  // Salários fixos (automático): soma de funcionários ativos que recebem salário fixo
  const salariosFixosQuery = useQuery({
    queryKey: ["relatorios", "salarios_fixos", { salaoId }],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("salario_fixo_mensal")
        .eq("salao_id", salaoId as string)
        .eq("ativo", true)
        // Modelo simplificado: salário fixo é considerado quando salario_fixo_mensal > 0
        .gt("salario_fixo_mensal", 0);

      if (error) throw error;
      const total = (data ?? []).reduce((acc, r: any) => acc + safeNumber(r.salario_fixo_mensal), 0);
      return { total };
    },
  });

  const despesasQuery = useQuery({
    queryKey: ["relatorios", "despesas_variaveis", { salaoId, competencia }],
    enabled: !!salaoId && !!competencia,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas_variaveis")
        .select("id,descricao,valor,pago_em,forma_pagamento")
        .eq("salao_id", salaoId as string)
        .eq("competencia", competenciaDate.toISOString().slice(0, 10))
        .order("created_at", { ascending: true });

      if (error) throw error;
      const rows: DespesaRow[] = (data ?? []).map((r: any) => ({
        id: String(r.id),
        descricao: String(r.descricao ?? ""),
        valor: safeNumber(r.valor),
        pago_em: r.pago_em ?? null,
        forma_pagamento: (r.forma_pagamento ?? null) as any,
      }));
      const total = rows.reduce((acc, r) => acc + safeNumber(r.valor), 0);
      return { rows, total };
    },
  });

  // (mantemos a tabela folha_salarial_mensal no banco, mas não usamos mais na UI)

  const inserirDespesa = useMutation({
    mutationFn: async (b: { descricao?: string; valor?: number }) => {
      const { error } = await supabase.from("despesas_variaveis").insert({
        salao_id: salaoId as string,
        competencia: competenciaDate.toISOString().slice(0, 10),
        descricao: b.descricao ?? "",
        valor: b.valor ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "despesas_variaveis"] });
    },
    onError: () => toast({ title: "Erro ao adicionar despesa", variant: "destructive" }),
  });

  const atualizarDespesa = useMutation({
    mutationFn: async (row: DespesaRow) => {
      const { error } = await supabase
        .from("despesas_variaveis")
        .update({ descricao: row.descricao, valor: row.valor })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "despesas_variaveis"] });
      toast({ title: "Despesa salva" });
    },
    onError: () => toast({ title: "Erro ao salvar despesa", variant: "destructive" }),
  });

  const removerDespesa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas_variaveis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "despesas_variaveis"] });
      toast({ title: "Despesa removida" });
    },
    onError: () => toast({ title: "Erro ao remover", variant: "destructive" }),
  });

  const marcarDespesaPaga = useMutation({
    mutationFn: async (b: { id: string; pago_em: string; forma_pagamento: FormaPagamento }) => {
      // coluna nova não está tipada no Database; usamos any no update.
      const { error } = await (supabase as any)
        .from("despesas_variaveis")
        .update({ pago_em: b.pago_em, forma_pagamento: b.forma_pagamento })
        .eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "despesas_variaveis"] });
      toast({ title: "Despesa marcada como paga" });
    },
    onError: (e: any) => toast({ title: "Erro ao marcar despesa", description: String(e?.message ?? ""), variant: "destructive" }),
  });

  const desmarcarDespesaPaga = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("despesas_variaveis").update({ pago_em: null, forma_pagamento: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["relatorios", "despesas_variaveis"] });
      toast({ title: "Pagamento removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover pagamento", description: String(e?.message ?? ""), variant: "destructive" }),
  });

  const lucroFinal = useMemo(() => {
    const receitaLiquida = totaisPeriodoQuery.data?.receitaLiquida ?? 0;
    const despesas = despesasQuery.data?.total ?? 0;
    const salariosFixos = salariosFixosQuery.data?.total ?? 0;
    return receitaLiquida - despesas - salariosFixos;
  }, [totaisPeriodoQuery.data, despesasQuery.data, salariosFixosQuery.data]);

  return (
    <section className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Despesas (competência)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Mês</div>
                <Input type="month" value={competencia} onChange={(e) => onChangeCompetencia(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Salários fixos (mês)</div>
                <Input value={formatBRL(salariosFixosQuery.data?.total ?? 0)} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lucro final</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">{formatBRL(lucroFinal)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              (Serviços + Produtos) − Comissões − Despesas − Salários (período)
            </div>
          </CardContent>
        </Card>
      </section>

      <SalariosPagosCard competencia={competencia} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Despesas variáveis (mês)</CardTitle>
            <div className="text-xs text-muted-foreground">Total: {formatBRL(despesasQuery.data?.total ?? 0)}</div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => inserirDespesa.mutate({})}
            disabled={!salaoId || inserirDespesa.isPending}
          >
            Adicionar despesa
          </Button>
        </CardHeader>
        <CardContent>
          {despesasQuery.isLoading ? <div className="text-xs text-muted-foreground">Carregando…</div> : null}
          {despesasQuery.error ? <div className="text-xs text-destructive">Erro ao carregar despesas.</div> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(despesasQuery.data?.rows ?? []).map((r) => (
                <DespesaEditableRow
                  key={r.id}
                  row={r}
                  onSave={(row) => atualizarDespesa.mutate(row)}
                  onDuplicate={() => inserirDespesa.mutate({ descricao: r.descricao, valor: r.valor })}
                  onDelete={() => removerDespesa.mutate(r.id)}
                  onMarkPaid={(b) => marcarDespesaPaga.mutate(b)}
                  onUnmarkPaid={(id) => desmarcarDespesaPaga.mutate(id)}
                />
              ))}

              {(despesasQuery.data?.rows ?? []).length === 0 && !despesasQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    Nenhuma despesa cadastrada para este mês.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

