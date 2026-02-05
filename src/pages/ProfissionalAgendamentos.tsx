import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays, endOfMonth, format, isSameDay, parseISO, startOfDay, startOfMonth } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/auth/access-context";

import { FormPageShell } from "@/components/layout/FormPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";

type StatusFilter = "todos" | "marcado" | "confirmado" | "concluido" | "cancelado";

const statusLabel: Record<StatusFilter, string> = {
  todos: "Todos",
  marcado: "Pendentes",
  confirmado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelado") return "destructive";
  if (status === "concluido") return "secondary";
  if (status === "confirmado") return "default";
  return "outline";
}

export default function ProfissionalAgendamentosPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { funcionarioId } = useAccess();
  const [params] = useSearchParams();

  const initial = params.get("date") ? new Date(`${params.get("date")}T00:00:00`) : new Date();
  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(initial));
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const clientesNomesQuery = useQuery({
    queryKey: ["clientes-nomes"],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb.rpc("clientes_nomes_current_salao");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  const clienteNomeById = useMemo(() => {
    const map = new Map<string, string>();
    (clientesNomesQuery.data ?? []).forEach((c) => map.set(String(c.id), String(c.nome)));
    return map;
  }, [clientesNomesQuery.data]);

  const monthStart = startOfMonth(selectedDay);
  const monthEnd = endOfMonth(selectedDay);

  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos-profissional", format(monthStart, "yyyy-MM")],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id,cliente_id,data_hora_inicio,status,total_valor,total_duracao_minutos,observacoes,funcionario:funcionarios(nome),itens:agendamento_itens(servico:servicos(nome))",
        )
        .gte("data_hora_inicio", monthStart.toISOString())
        .lt("data_hora_inicio", addDays(monthEnd, 1).toISOString())
        .order("data_hora_inicio");
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const clienteIds = Array.from(new Set(rows.map((r) => String(r.cliente_id)).filter(Boolean)));
      if (clienteIds.length === 0) return rows;

      // Contagem total de cancelamentos por cliente (somente dentro do que o RLS permitir)
      const { data: cancels, error: cancErr } = await supabase
        .from("agendamentos")
        .select("cliente_id")
        .in("cliente_id", clienteIds)
        .eq("status", "cancelado");
      if (cancErr) throw cancErr;

      const cancelCountByCliente = new Map<string, number>();
      (cancels ?? []).forEach((r: any) => {
        const cId = String(r.cliente_id);
        cancelCountByCliente.set(cId, (cancelCountByCliente.get(cId) ?? 0) + 1);
      });

      return rows.map((r) => ({
        ...r,
        cliente_cancelamentos_count: cancelCountByCliente.get(String(r.cliente_id)) ?? 0,
      }));
    },
  });

  const filteredByStatus = useMemo(() => {
    const rows = agendamentosQuery.data ?? [];
    if (status === "todos") return rows;
    return rows.filter((r: any) => r.status === status);
  }, [agendamentosQuery.data, status]);

  const updateStatusMutation = useMutation({
    mutationFn: async (vars: { id: string; status: Exclude<StatusFilter, "todos"> }) => {
      const { error } = await supabase.from("agendamentos").update({ status: vars.status }).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agendamentos-profissional"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { error: itErr } = await supabase.from("agendamento_itens").delete().eq("agendamento_id", agendamentoId);
      if (itErr) throw itErr;

      const { error } = await supabase.from("agendamentos").delete().eq("id", agendamentoId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDeleteId(null);
      await qc.invalidateQueries({ queryKey: ["agendamentos-profissional"] });
    },
  });

  const dayList = useMemo(() => {
    return filteredByStatus.filter((r: any) => {
      const d = parseISO(String(r.data_hora_inicio));
      return isSameDay(d, selectedDay);
    });
  }, [filteredByStatus, selectedDay]);

  const daysWithCount = useMemo(() => {
    const map = new Map<string, number>();
    filteredByStatus.forEach((r: any) => {
      const key = format(parseISO(String(r.data_hora_inicio)), "yyyy-MM-dd");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [filteredByStatus]);

  return (
    <FormPageShell
      title="Meus agendamentos"
      description="Você pode criar, editar, excluir e atualizar status dos seus próprios atendimentos."
      actions={
        <>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(statusLabel) as StatusFilter[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {statusLabel[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => nav(`/profissional/agendamentos/novo?date=${format(selectedDay, "yyyy-MM-dd")}`)}>
            Novo agendamento
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Calendário</CardTitle>
          </CardHeader>
          <CardContent>
            {agendamentosQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
            {agendamentosQuery.error ? <div className="text-sm text-destructive">Erro ao carregar.</div> : null}

            <div className="rounded-md border p-2">
              <DayPicker
                mode="single"
                selected={selectedDay}
                onSelect={(d) => d && setSelectedDay(startOfDay(d))}
                month={selectedDay}
                onMonthChange={(m) => setSelectedDay(startOfDay(m))}
                showOutsideDays
                components={{
                  DayContent: (props) => {
                    const key = format(props.date, "yyyy-MM-dd");
                    const count = daysWithCount.get(key) ?? 0;
                    return (
                      <div className="flex flex-col items-center leading-none">
                        <div>{props.date.getDate()}</div>
                        {count > 0 ? <div className="mt-1 text-[10px] text-muted-foreground">{count}</div> : null}
                      </div>
                    );
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dia {format(selectedDay, "dd/MM/yyyy")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayList.map((a: any) => {
              const currentStatus = String(a.status) as Exclude<StatusFilter, "todos">;
              const servicoNome = (a.itens as any)?.[0]?.servico?.nome as string | undefined;
              const clienteNome = clienteNomeById.get(String(a.cliente_id)) ?? "Cliente";

              return (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {format(parseISO(String(a.data_hora_inicio)), "HH:mm")} • {clienteNome}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {(a.funcionario as any)?.nome ?? "Profissional"}
                        {servicoNome ? ` • ${servicoNome}` : ""} • {Number(a.total_duracao_minutos)} min • R$ {Number(a.total_valor).toFixed(2)}
                      </div>
                      {Number(a.cliente_cancelamentos_count ?? 0) > 0 ? (
                        <div className="mt-2">
                          <Badge variant="outline">Cancelamentos: {Number(a.cliente_cancelamentos_count)}</Badge>
                        </div>
                      ) : null}
                      {a.observacoes ? <div className="mt-2 text-sm text-muted-foreground">{a.observacoes}</div> : null}
                    </div>

                    <div className="flex items-start gap-2">
                      <Badge variant={statusBadgeVariant(String(a.status))}>
                        {statusLabel[(a.status as any) ?? "marcado"] ?? String(a.status)}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => nav(`/profissional/agendamentos/${a.id}`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteId(String(a.id))}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          {(["confirmado", "concluido", "cancelado"] as const).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              disabled={updateStatusMutation.isPending || currentStatus === s}
                              onClick={() => updateStatusMutation.mutate({ id: String(a.id), status: s })}
                            >
                              Marcar como: {statusLabel[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}

            {dayList.length === 0 && !agendamentosQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Nenhum agendamento neste dia.</div>
            ) : null}

            <AlertDialog open={!!deleteId} onOpenChange={(o) => (!o ? setDeleteId(null) : null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O agendamento e seus itens serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!deleteId || deleteMutation.isPending}
                    onClick={() => (deleteId ? deleteMutation.mutate(deleteId) : null)}
                  >
                    {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </FormPageShell>
  );
}
