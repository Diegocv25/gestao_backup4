import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FinancialKpiCard } from "@/components/kpis/FinancialKpiCard";

import { formatBRL, safeNumber, toFimDateExclusivo, toInicioDate } from "@/pages/relatorios/relatorios-utils";

type FormaPagamento = "pix" | "dinheiro" | "cartao" | "nao_informado";

const formaLabel: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  nao_informado: "Não informado",
};

function normalizeForma(value: unknown): FormaPagamento {
  const v = String(value ?? "")
    .trim()
    .toLowerCase()
    // remove acentos básicos (cartão -> cartao)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (v === "pix") return "pix";
  if (v === "dinheiro") return "dinheiro";
  if (v === "cartao" || v === "debito" || v === "credito") return "cartao";
  return "nao_informado";
}

function sumByForma(rows: Array<{ forma: FormaPagamento; valor: number }>) {
  const base: Record<FormaPagamento, number> = {
    pix: 0,
    dinheiro: 0,
    cartao: 0,
    nao_informado: 0,
  };
  for (const r of rows) base[r.forma] += safeNumber(r.valor);
  return base;
}

export default function RelatoriosFluxoCaixa({ inicio, fim }: { inicio: string; fim: string }) {
  const { data: salaoId } = useSalaoId();

  const inicioDate = useMemo(() => toInicioDate(inicio), [inicio]);
  const fimDateExclusivo = useMemo(() => toFimDateExclusivo(fim), [fim]);

  const fluxoQuery = useQuery({
    queryKey: ["relatorios", "fluxo_caixa", { salaoId, inicio, fim }],
    enabled: !!salaoId && !!inicio && !!fim,
    queryFn: async () => {
      const [rec, comissoesPagas, despesasPagas, salariosPagos] = await Promise.all([
        supabase
          .from("recebimentos")
          .select("forma,valor,created_at")
          .eq("salao_id", salaoId as string)
          .gte("created_at", inicioDate.toISOString())
          .lt("created_at", fimDateExclusivo.toISOString()),
        // comissoes: pagamento é por pago_em
        (supabase as any)
          .from("comissoes")
          .select("valor_calculado,pago_em,forma_pagamento")
          .eq("salao_id", salaoId as string)
          .not("pago_em", "is", null)
          .gte("pago_em", inicioDate.toISOString())
          .lt("pago_em", fimDateExclusivo.toISOString()),
        // despesas pagas: pago_em preenchido
        (supabase as any)
          .from("despesas_variaveis")
          .select("valor,pago_em,forma_pagamento")
          .eq("salao_id", salaoId as string)
          .not("pago_em", "is", null)
          .gte("pago_em", inicioDate.toISOString())
          .lt("pago_em", fimDateExclusivo.toISOString()),
        // salários pagos
        (supabase as any)
          .from("pagamentos_salarios")
          .select("valor,pago_em,forma_pagamento")
          .eq("salao_id", salaoId as string)
          .gte("pago_em", inicioDate.toISOString())
          .lt("pago_em", fimDateExclusivo.toISOString()),
      ]);

      if (rec.error) throw rec.error;
      if (comissoesPagas.error) throw comissoesPagas.error;
      if (despesasPagas.error) throw despesasPagas.error;
      if (salariosPagos.error) throw salariosPagos.error;

      const recebimentos = (rec.data ?? []).map((r: any) => ({
        forma: normalizeForma(r.forma),
        valor: safeNumber(r.valor),
      }));

      const sumReceb = sumByForma(recebimentos);

      const totalGeral = Object.values(sumReceb).reduce((a, b) => a + safeNumber(b), 0);

      const porForma: Record<FormaPagamento, number> = {
        pix: sumReceb.pix,
        dinheiro: sumReceb.dinheiro,
        cartao: sumReceb.cartao,
        nao_informado: sumReceb.nao_informado,
      };

      const retiradasComissoes = (comissoesPagas.data ?? []).map((r: any) => ({
        forma: normalizeForma(r.forma_pagamento),
        valor: safeNumber(r.valor_calculado),
      }));

      const retiradasDespesas = (despesasPagas.data ?? []).map((r: any) => ({
        forma: normalizeForma(r.forma_pagamento),
        valor: safeNumber(r.valor),
      }));

      const retiradasSalarios = (salariosPagos.data ?? []).map((r: any) => ({
        forma: normalizeForma(r.forma_pagamento),
        valor: safeNumber(r.valor),
      }));

      const sumRetCom = sumByForma(retiradasComissoes);
      const sumRetDesp = sumByForma(retiradasDespesas);
      const sumRetSal = sumByForma(retiradasSalarios);

      const retiradasPorForma: Record<FormaPagamento, number> = {
        pix: sumRetCom.pix + sumRetDesp.pix + sumRetSal.pix,
        dinheiro: sumRetCom.dinheiro + sumRetDesp.dinheiro + sumRetSal.dinheiro,
        cartao: sumRetCom.cartao + sumRetDesp.cartao + sumRetSal.cartao,
        nao_informado: sumRetCom.nao_informado + sumRetDesp.nao_informado + sumRetSal.nao_informado,
      };

      const totalRetiradas = Object.values(retiradasPorForma).reduce((a, b) => a + safeNumber(b), 0);

      return {
        recebimentos: { ...sumReceb, total: totalGeral },
        vendasProdutos: { pix: 0, dinheiro: 0, cartao: 0, nao_informado: 0, total: 0 },
        porForma,
        totalGeral,
        retiradas: {
          comissoes: sumRetCom,
          despesas: sumRetDesp,
          salarios: sumRetSal,
          porForma: retiradasPorForma,
          total: totalRetiradas,
        },
        saldoGeral: totalGeral - totalRetiradas,
      };
    },
  });

  const kpis = useMemo(() => {
    const data = fluxoQuery.data;
    return {
      entradas: data?.totalGeral ?? 0,
      retiradas: data?.retiradas.total ?? 0,
      saldo: data?.saldoGeral ?? 0,
    };
  }, [fluxoQuery.data]);

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Fluxo de caixa</h2>
        <p className="text-sm text-muted-foreground">Entradas (Serviços + Produtos) e retiradas (Comissões, Despesas pagas e Salários pagos) no período.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <FinancialKpiCard title="Entradas" value={formatBRL(kpis.entradas)} highlight />
        <FinancialKpiCard title="Retiradas" value={formatBRL(kpis.retiradas)} />
        <FinancialKpiCard title="Saldo" value={formatBRL(kpis.saldo)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
          <CardDescription>Separado por origem (Serviços vs Produtos) e forma de pagamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {fluxoQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : fluxoQuery.error ? (
            <p className="text-sm text-destructive">Erro ao carregar fluxo de caixa.</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Forma</TableHead>
                    <TableHead className="text-right">Serviços</TableHead>
                    <TableHead className="text-right">Produtos</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Retiradas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["pix", "dinheiro", "cartao", "nao_informado"] as FormaPagamento[]).map((forma) => (
                    // eslint-disable-next-line react/jsx-key
                    <TableRow key={forma}>
                      <TableCell className="font-medium">{formaLabel[forma]}</TableCell>
                      <TableCell className="text-right">{formatBRL(fluxoQuery.data?.recebimentos[forma] ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatBRL(fluxoQuery.data?.vendasProdutos[forma] ?? 0)}</TableCell>
                      <TableCell className="text-right font-medium">{formatBRL(fluxoQuery.data?.porForma[forma] ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatBRL(fluxoQuery.data?.retiradas.porForma[forma] ?? 0)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL((fluxoQuery.data?.porForma[forma] ?? 0) - (fluxoQuery.data?.retiradas.porForma[forma] ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}

                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(fluxoQuery.data?.recebimentos.total ?? 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(fluxoQuery.data?.vendasProdutos.total ?? 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(fluxoQuery.data?.totalGeral ?? 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(fluxoQuery.data?.retiradas.total ?? 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(fluxoQuery.data?.saldoGeral ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
