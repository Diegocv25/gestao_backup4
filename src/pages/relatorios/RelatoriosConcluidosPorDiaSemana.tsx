import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { toFimDateExclusivo, toInicioDate } from "@/pages/relatorios/relatorios-utils";

const diasOrder: Array<{ label: string; dow: number }> = [
  { label: "Seg", dow: 1 },
  { label: "Ter", dow: 2 },
  { label: "Qua", dow: 3 },
  { label: "Qui", dow: 4 },
  { label: "Sex", dow: 5 },
  { label: "Sáb", dow: 6 },
  { label: "Dom", dow: 0 },
];

export default function RelatoriosConcluidosPorDiaSemana({
  inicio,
  fim,
}: {
  inicio: string;
  fim: string;
}) {
  const { data: salaoId } = useSalaoId();

  const inicioDate = useMemo(() => toInicioDate(inicio), [inicio]);
  const fimDateExclusivo = useMemo(() => toFimDateExclusivo(fim), [fim]);

  const query = useQuery({
    queryKey: [
      "relatorios",
      "concluidos-dia-semana",
      { salaoId, inicio: inicioDate.toISOString(), fim: fimDateExclusivo.toISOString() },
    ],
    enabled: !!salaoId && !!inicio && !!fim,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("data_hora_inicio")
        .eq("salao_id", salaoId as string)
        .eq("status", "concluido")
        .gte("data_hora_inicio", inicioDate.toISOString())
        .lt("data_hora_inicio", fimDateExclusivo.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const base: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const r of query.data ?? []) {
      const iso = (r as any).data_hora_inicio as string | undefined;
      if (!iso) continue;
      const d = new Date(iso);
      const dow = d.getUTCDay();
      base[dow] = (base[dow] ?? 0) + 1;
    }
    return base;
  }, [query.data]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Concluídos por dia da semana</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {diasOrder.map((d) => (
            <Badge key={d.dow} variant="secondary" className="tabular-nums">
              {d.label}: {counts[d.dow] ?? 0}
            </Badge>
          ))}
        </div>

        {query.isLoading ? <div className="text-xs text-muted-foreground">Carregando…</div> : null}
        {query.error ? <div className="text-xs text-destructive">Erro ao carregar.</div> : null}
      </CardContent>
    </Card>
  );
}
