import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FinancialKpiCard } from "@/components/kpis/FinancialKpiCard";

import {
  changePercent,
  formatBRL,
  previousPeriodFromRange,
  safeNumber,
  toFimDateExclusivo,
  toInicioDate,
} from "@/pages/relatorios/relatorios-utils";

function MetricCompareCard({
  title,
  current,
  previous,
}: {
  title: string;
  current: number;
  previous: number;
}) {
  const pct = useMemo(() => changePercent(current, previous), [current, previous]);
  const label = useMemo(() => {
    if (!previous && !current) return "—";
    const abs = Math.abs(pct);
    const dir = pct >= 0 ? "↑" : "↓";
    return `${dir} ${abs.toFixed(1)}%`;
  }, [pct, previous, current]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{formatBRL(current)}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Anterior: {formatBRL(previous)}</span>
          <span className="tabular-nums">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RelatoriosComparativos({
  inicio,
  fim,
  onChangeInicio,
  onChangeFim,
}: {
  inicio: string;
  fim: string;
  onChangeInicio: (v: string) => void;
  onChangeFim: (v: string) => void;
}) {
  const { data: salaoId } = useSalaoId();

  const inicioDate = useMemo(() => toInicioDate(inicio), [inicio]);
  const fimDateExclusivo = useMemo(() => toFimDateExclusivo(fim), [fim]);
  const prev = useMemo(() => previousPeriodFromRange(inicio, fim), [inicio, fim]);

  const comparativosQuery = useQuery({
    queryKey: [
      "relatorios",
      "comparativos",
      {
        salaoId,
        inicio,
        fim,
        prevInicio: prev.prevInicio.toISOString(),
        prevFimExclusivo: prev.prevFimExclusivo.toISOString(),
      },
    ],
    enabled: !!salaoId && !!inicio && !!fim,
    queryFn: async () => {
      const [
        agAtual,
        agPrev,
        vendasProdutosAtual,
        vendasProdutosPrev,
        comCalcAtual,
        comCalcPrev,
        comPagasAtual,
        comPagasPrev,
      ] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("total_valor", { count: "exact" })
          .eq("salao_id", salaoId as string)
          .eq("status", "concluido")
          .gte("data_hora_inicio", inicioDate.toISOString())
          .lt("data_hora_inicio", fimDateExclusivo.toISOString()),

        supabase
          .from("agendamentos")
          .select("total_valor", { count: "exact" })
          .eq("salao_id", salaoId as string)
          .eq("status", "concluido")
          .gte("data_hora_inicio", prev.prevInicio.toISOString())
          .lt("data_hora_inicio", prev.prevFimExclusivo.toISOString()),

        supabase
          .from("vendas_produtos")
          .select("total_venda,total_custo,comissao_funcionario")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),

        supabase
          .from("vendas_produtos")
          .select("total_venda,total_custo,comissao_funcionario")
          .eq("salao_id", salaoId as string)
          .gte("created_at", prev.prevInicio.toISOString())
          .lt("created_at", prev.prevFimExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("valor_calculado")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("valor_calculado")
          .eq("salao_id", salaoId as string)
          .gte("created_at", prev.prevInicio.toISOString())
          .lt("created_at", prev.prevFimExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("valor_calculado")
          .eq("salao_id", salaoId as string)
          .not("pago_em", "is", null)
          .gte("pago_em", inicioDate.toISOString())
          .lt("pago_em", fimDateExclusivo.toISOString()),

        supabase
          .from("comissoes")
          .select("valor_calculado")
          .eq("salao_id", salaoId as string)
          .not("pago_em", "is", null)
          .gte("pago_em", prev.prevInicio.toISOString())
          .lt("pago_em", prev.prevFimExclusivo.toISOString()),


      ]);

      const errors = [
        agAtual.error,
        agPrev.error,
        vendasProdutosAtual.error,
        vendasProdutosPrev.error,
        comCalcAtual.error,
        comCalcPrev.error,
        comPagasAtual.error,
        comPagasPrev.error,
      ].filter(Boolean);
      if (errors.length) throw errors[0];

      const receitaServicosAtual = (agAtual.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_valor), 0);
      const receitaServicosPrev = (agPrev.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_valor), 0);
      const receitaVendasAtual = (vendasProdutosAtual.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_venda), 0);
      const receitaVendasPrev = (vendasProdutosPrev.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_venda), 0);

      const custoProdutosAtual = (vendasProdutosAtual.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_custo), 0);
      const custoProdutosPrev = (vendasProdutosPrev.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.total_custo), 0);

      const comissaoProdutosAtualSum = (vendasProdutosAtual.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.comissao_funcionario), 0);
      const comissaoProdutosPrevSum = (vendasProdutosPrev.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.comissao_funcionario), 0);

      const receitaBrutaAtual = receitaServicosAtual + receitaVendasAtual;
      const receitaBrutaPrev = receitaServicosPrev + receitaVendasPrev;

      const comissoesServicosAtual = (comCalcAtual.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.valor_calculado), 0);
      const comissoesServicosPrev = (comCalcPrev.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.valor_calculado), 0);

      const comissoesTotalAtual = comissoesServicosAtual + comissaoProdutosAtualSum;
      const comissoesTotalPrev = comissoesServicosPrev + comissaoProdutosPrevSum;

      // Resultado do período (antes de despesas/salários): Receita bruta - custos de produtos - comissões
      const resultadoAtual = receitaBrutaAtual - custoProdutosAtual - comissoesTotalAtual;
      const resultadoPrev = receitaBrutaPrev - custoProdutosPrev - comissoesTotalPrev;

      const comissoesServicosPagasAtual = (comPagasAtual.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.valor_calculado), 0);
      const comissoesServicosPagasPrev = (comPagasPrev.data ?? []).reduce((acc, r: any) => acc + safeNumber(r.valor_calculado), 0);

      return {
        receitaBrutaAtual,
        receitaBrutaPrev,
        custoProdutosAtual,
        custoProdutosPrev,
        comissoesTotalAtual,
        comissoesTotalPrev,
        comissoesServicosPagasAtual,
        comissoesServicosPagasPrev,
        resultadoAtual,
        resultadoPrev,
      };
    },
  });

  return (
    <section className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtro (período)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Início</div>
                <Input type="date" value={inicio} onChange={(e) => onChangeInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Fim</div>
                <Input type="date" value={fim} onChange={(e) => onChangeFim(e.target.value)} />
              </div>
            </div>
            {comparativosQuery.isLoading ? <div className="mt-2 text-xs text-muted-foreground">Carregando…</div> : null}
            {comparativosQuery.error ? <div className="mt-2 text-xs text-destructive">Erro ao carregar comparativos.</div> : null}
          </CardContent>
        </Card>

      </section>

      <section className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <FinancialKpiCard
          title="Receita bruta"
          value={formatBRL(comparativosQuery.data?.receitaBrutaAtual ?? 0)}
          subtitle={`Serviços + Produtos | Anterior: ${formatBRL(comparativosQuery.data?.receitaBrutaPrev ?? 0)}`}
        />

        <FinancialKpiCard
          title="Custos (produtos)"
          value={formatBRL(comparativosQuery.data?.custoProdutosAtual ?? 0)}
          subtitle={`Custo médio × quantidade | Anterior: ${formatBRL(comparativosQuery.data?.custoProdutosPrev ?? 0)}`}
        />

        <FinancialKpiCard
          title="Comissões"
          value={formatBRL(comparativosQuery.data?.comissoesTotalAtual ?? 0)}
          subtitle={`Serviços + Produtos | Anterior: ${formatBRL(comparativosQuery.data?.comissoesTotalPrev ?? 0)}`}
        />

        <FinancialKpiCard
          title="Resultado do período"
          value={formatBRL(comparativosQuery.data?.resultadoAtual ?? 0)}
          subtitle={`Receita − Custos − Comissões | Anterior: ${formatBRL(comparativosQuery.data?.resultadoPrev ?? 0)}`}
          highlight={true}
        />
      </section>
    </section>
  );
}
