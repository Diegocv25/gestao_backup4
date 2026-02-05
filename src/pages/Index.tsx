import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

function MetricCard({
  title,
  value
}: {
  title: string;
  value: string;
}) {
  return <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>;
}
type DashboardStatus = "marcado" | "confirmado" | "concluido" | "cancelado";
const statusLabel: Record<DashboardStatus, string> = {
  marcado: "Pendentes",
  confirmado: "Agendados",
  concluido: "Concluídos",
  cancelado: "Cancelados"
};
function statusBadgeVariant(status: DashboardStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelado") return "destructive";
  if (status === "concluido") return "secondary";
  if (status === "confirmado") return "default";
  return "outline";
}

const Index = () => {
  const {
    data: salaoId
  } = useSalaoId();
  const today = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(today), [today]);
  const todayEnd = useMemo(() => endOfDay(today), [today]);
  const monthStart = useMemo(() => startOfMonth(today), [today]);
  const monthEnd = useMemo(() => endOfMonth(today), [today]);
  const {
    data: dashboard,
    isLoading,
    error
  } = useQuery({
    queryKey: ["dashboard", {
      salaoId,
      month: format(today, "yyyy-MM"),
      day: format(today, "yyyy-MM-dd")
    }],
    enabled: !!salaoId,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [clientesCount, agendHojeCount, agendConcluidosMes, statusHoje, proximosAgendamentos] = await Promise.all([supabase.from("clientes").select("id", {
        count: "exact",
        head: true
      }).eq("salao_id", salaoId as string), supabase.from("agendamentos").select("id", {
        count: "exact",
        head: true
      }).eq("salao_id", salaoId as string).gte("data_hora_inicio", todayStart.toISOString()).lt("data_hora_inicio", new Date(todayEnd.getTime() + 1).toISOString()),
      // serviços realizados no mês = agendamentos concluídos no mês
      supabase.from("agendamentos").select("total_valor").eq("salao_id", salaoId as string).eq("status", "concluido").gte("data_hora_inicio", monthStart.toISOString()).lt("data_hora_inicio", new Date(monthEnd.getTime() + 1).toISOString()),
      // status (hoje)
      supabase.from("agendamentos").select("status").eq("salao_id", salaoId as string).gte("data_hora_inicio", todayStart.toISOString()).lt("data_hora_inicio", new Date(todayEnd.getTime() + 1).toISOString()),
      // próximos 5
      supabase.from("agendamentos").select("id,data_hora_inicio,status,total_valor,total_duracao_minutos,cliente:clientes(nome),funcionario:funcionarios(nome),itens:agendamento_itens(servico:servicos(nome))").eq("salao_id", salaoId as string).gte("data_hora_inicio", nowIso).order("data_hora_inicio").limit(5)]);
      if (clientesCount.error) throw clientesCount.error;
      if (agendHojeCount.error) throw agendHojeCount.error;
      if (agendConcluidosMes.error) throw agendConcluidosMes.error;
      if (statusHoje.error) throw statusHoje.error;
      if (proximosAgendamentos.error) throw proximosAgendamentos.error;
      const statusCounts = (statusHoje.data ?? []).reduce((acc: Record<DashboardStatus, number>, r: any) => {
        const s = String(r.status) as DashboardStatus;
        if (s in acc) acc[s] += 1;
        return acc;
      }, {
        marcado: 0,
        confirmado: 0,
        concluido: 0,
        cancelado: 0
      });
      return {
        clientesTotal: clientesCount.count ?? 0,
        agendamentosHoje: agendHojeCount.count ?? 0,
        servicosRealizadosMes: (agendConcluidosMes.data ?? []).length,
        statusCounts,
        proximosAgendamentos: proximosAgendamentos.data ?? []
      };
    }
  });
  return <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumo geral.</p>
      </header>

      {!salaoId ? <Card>
          <CardHeader>
            <CardTitle className="text-base">Antes de começar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cadastre o salão em Configurações para liberar o dashboard.</CardContent>
        </Card> : null}

      {error ? <div className="text-sm text-destructive">Erro ao carregar o dashboard.</div> : null}
      {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard title="Total de clientes" value={String(dashboard?.clientesTotal ?? "—")} />
        <MetricCard title="Agendamentos de hoje" value={String(dashboard?.agendamentosHoje ?? "—")} />
        <MetricCard title="Serviços realizados (mês)" value={String(dashboard?.servicosRealizadosMes ?? "—")} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos agendamentos (hoje)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(["marcado", "confirmado", "concluido", "cancelado"] as DashboardStatus[]).map(s => <Badge key={s} variant={statusBadgeVariant(s)}>
                  {statusLabel[s]}: {dashboard?.statusCounts?.[s] ?? "—"}
                </Badge>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard?.proximosAgendamentos ?? []).map((a: any) => {
                const servicoNome = (a.itens as any)?.[0]?.servico?.nome as string | undefined;
                const s = String(a.status) as DashboardStatus;
                return <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(String(a.data_hora_inicio)), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{(a.cliente as any)?.nome ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{servicoNome ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{(a.funcionario as any)?.nome ?? "—"}</TableCell>
                      <TableCell>
                        {s in statusLabel ? <Badge variant={statusBadgeVariant(s)}>{statusLabel[s]}</Badge> : <Badge variant="outline">{String(a.status)}</Badge>}
                      </TableCell>
                    </TableRow>;
              })}

                {(dashboard?.proximosAgendamentos ?? []).length === 0 && !isLoading ? <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Nenhum agendamento futuro.
                    </TableCell>
                  </TableRow> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>;
};
export default Index;