import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";

import { FormPageShell } from "@/components/layout/FormPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Link2, MoreVertical, Pencil, Trash2 } from "lucide-react";

type StatusFilter = "todos" | "marcado" | "confirmado" | "concluido" | "cancelado";
type FormaPagamento = "pix" | "dinheiro" | "cartao";

const statusLabel: Record<StatusFilter, string> = {
  todos: "Todos",
  marcado: "Pendentes",
  confirmado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const formaPagamentoLabel: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelado") return "destructive";
  if (status === "concluido") return "secondary";
  if (status === "confirmado") return "default";
  return "outline";
}

export default function AgendamentosPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: salaoId } = useSalaoId();
  const [params] = useSearchParams();

  const initial = params.get("date") ? new Date(`${params.get("date")}T00:00:00`) : new Date();

  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(initial));
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [pagamentoForma, setPagamentoForma] = useState<FormaPagamento | "">("");
  const [pagamentoAgendamento, setPagamentoAgendamento] = useState<any | null>(null);
  const [pagamentoDividido, setPagamentoDividido] = useState(false);
  const [pagamentoForma2, setPagamentoForma2] = useState<FormaPagamento | "">("");
  const [pagamentoValor1, setPagamentoValor1] = useState<string>("");
  const [pagamentoValor2, setPagamentoValor2] = useState<string>("");

  const [comissaoOpen, setComissaoOpen] = useState(false);
  const [comissaoForma, setComissaoForma] = useState<FormaPagamento | "">("");
  const [comissaoAgendamento, setComissaoAgendamento] = useState<any | null>(null);

  const salaoTokenQuery = useQuery({
    queryKey: ["salao-public-booking", salaoId],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saloes")
        .select("public_booking_token")
        .eq("id", salaoId as string)
        .maybeSingle();
      if (error) throw error;
      return data?.public_booking_token ?? null;
    },
  });

  const publicBookingLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const token = salaoTokenQuery.data;
    if (!token) return "";
    return `${window.location.origin}/cliente/${token}`;
  }, [salaoTokenQuery.data]);


  const monthStart = startOfMonth(selectedDay);
  const monthEnd = endOfMonth(selectedDay);

  const agendamentosQuery = useQuery({
    queryKey: ["agendamentos", format(monthStart, "yyyy-MM")],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id,cliente_id,data_hora_inicio,status,total_valor,total_duracao_minutos,observacoes,cliente:clientes(nome),funcionario:funcionarios(nome),itens:agendamento_itens(servico:servicos(nome)),comissao:comissoes(pago_em,valor_calculado),recebimento:recebimentos(forma,valor)",
        )
        .gte("data_hora_inicio", monthStart.toISOString())
        .lt("data_hora_inicio", addDays(monthEnd, 1).toISOString())
        .order("data_hora_inicio");
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const clienteIds = Array.from(new Set(rows.map((r) => String(r.cliente_id)).filter(Boolean)));
      if (clienteIds.length === 0) return rows;

      // Contagem total de cancelamentos por cliente (controle de "fura agenda").
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
      await qc.invalidateQueries({ queryKey: ["agendamentos"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });

  const concluirComPagamentoMutation = useMutation({
    mutationFn: async (vars: { agendamentoId: string; partes: Array<{ forma: FormaPagamento; valor: number }> }) => {
      if (!salaoId) throw new Error("Salão não cadastrado");

      const sb = supabase as any;

      // 1) Remove recebimentos existentes do agendamento (permite reprocessar / corrigir)
      const { error: delErr } = await sb.from("recebimentos").delete().eq("agendamento_id", vars.agendamentoId);
      if (delErr) throw delErr;

      // 2) Insere as partes do recebimento (pagamento único ou dividido)
      const payload = (vars.partes ?? []).map((p) => ({
        salao_id: salaoId,
        agendamento_id: vars.agendamentoId,
        forma: p.forma,
        valor: p.valor,
      }));

      if (payload.length === 0) throw new Error("Informe a forma de pagamento");

      const { error: insErr } = await sb.from("recebimentos").insert(payload);
      if (insErr) throw insErr;

      // 3) Marca como concluído
      const { error: stErr } = await sb.from("agendamentos").update({ status: "concluido" }).eq("id", vars.agendamentoId);
      if (stErr) throw stErr;
    },
    onSuccess: async () => {
      setPagamentoOpen(false);
      setPagamentoForma("");
      setPagamentoForma2("");
      setPagamentoDividido(false);
      setPagamentoValor1("");
      setPagamentoValor2("");
      setPagamentoAgendamento(null);
      await qc.invalidateQueries({ queryKey: ["agendamentos"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });

  const marcarComissaoPagaMutation = useMutation({
    mutationFn: async (vars: { agendamentoId: string; forma: FormaPagamento }) => {
      if (!vars.forma) throw new Error("Informe a forma de pagamento da comissão");
      const { error } = await supabase
        .from("comissoes")
        .update({ pago_em: new Date().toISOString(), forma_pagamento: vars.forma })
        .eq("agendamento_id", vars.agendamentoId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setComissaoOpen(false);
      setComissaoForma("");
      setComissaoAgendamento(null);
      await qc.invalidateQueries({ queryKey: ["agendamentos"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["relatorios"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (agendamentoId: string) => {
      // MVP: remove itens primeiro (evita FK)
      const { error: itErr } = await supabase.from("agendamento_itens").delete().eq("agendamento_id", agendamentoId);
      if (itErr) throw itErr;

      const { error } = await supabase.from("agendamentos").delete().eq("id", agendamentoId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDeleteId(null);
      await qc.invalidateQueries({ queryKey: ["agendamentos"] });
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
      title="Agendamentos"
      description="Calendário mensal, lista por dia e criação com horários inteligentes."
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

          {/* Em telas menores, o link fica dentro de um modal para não sumir/estourar layout */}
          <div className="lg:hidden">
            <Button type="button" variant="outline" disabled={!publicBookingLink} onClick={() => setLinkOpen(true)}>
              <Link2 className="mr-2 h-4 w-4" />
              Link clientes
            </Button>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Input
              readOnly
              value={publicBookingLink || (salaoTokenQuery.isLoading ? "Carregando link…" : "")}
              className="w-[360px]"
              aria-label="Link público para clientes"
            />

            <Button
              type="button"
              variant="outline"
              disabled={!publicBookingLink}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicBookingLink);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                } catch {
                  // sem clipboard (ambientes restritos)
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado" : "Copiar link"}
            </Button>

          </div>

          <Button onClick={() => nav(`/agendamentos/novo?date=${format(selectedDay, "yyyy-MM-dd")}`)}>Novo agendamento</Button>
        </>
      }
    >
      <Dialog
        open={pagamentoOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPagamentoOpen(false);
            setPagamentoForma("");
            setPagamentoAgendamento(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forma de pagamento</DialogTitle>
            <DialogDescription>
              Para concluir o agendamento, informe como o cliente pagou (Pix, Dinheiro ou Cartão).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">
                {pagamentoAgendamento
                  ? `${format(parseISO(String(pagamentoAgendamento.data_hora_inicio)), "dd/MM/yyyy HH:mm")} • ${(pagamentoAgendamento.cliente as any)?.nome ?? "Cliente"}`
                  : "Agendamento"}
              </div>
              <div className="text-xs text-muted-foreground">
                Valor: R$ {pagamentoAgendamento ? Number(pagamentoAgendamento.total_valor ?? 0).toFixed(2) : "0.00"}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Forma</Label>
              <Select value={pagamentoForma} onValueChange={(v) => setPagamentoForma(v as FormaPagamento)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(formaPagamentoLabel) as FormaPagamento[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {formaPagamentoLabel[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="pagamento_dividido"
                type="checkbox"
                checked={pagamentoDividido}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPagamentoDividido(on);
                  if (on) {
                    const total = pagamentoAgendamento ? Number(pagamentoAgendamento.total_valor ?? 0) : 0;
                    setPagamentoValor1(total ? total.toFixed(2) : "");
                    setPagamentoValor2("0.00");
                    setPagamentoForma2("");
                  } else {
                    setPagamentoForma2("");
                    setPagamentoValor1("");
                    setPagamentoValor2("");
                  }
                }}
              />
              <Label htmlFor="pagamento_dividido">Pagamento dividido</Label>
            </div>

            {pagamentoDividido ? (
              <div className="grid gap-3 rounded-md border p-3">
                <div className="grid gap-2">
                  <Label>Parte 1 — valor</Label>
                  <Input
                    value={pagamentoValor1}
                    onChange={(e) => setPagamentoValor1(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Parte 2 — forma</Label>
                  <Select value={pagamentoForma2} onValueChange={(v) => setPagamentoForma2(v as FormaPagamento)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(formaPagamentoLabel) as FormaPagamento[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {formaPagamentoLabel[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Parte 2 — valor</Label>
                  <Input
                    value={pagamentoValor2}
                    onChange={(e) => setPagamentoValor2(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  A soma das partes precisa bater com o total do agendamento.
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPagamentoOpen(false);
                  setPagamentoForma("");
                  setPagamentoAgendamento(null);
                }}
                disabled={concluirComPagamentoMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!pagamentoAgendamento) return;
                  if (!pagamentoForma) return;

                  const total = Number(pagamentoAgendamento.total_valor ?? 0);

                  if (!pagamentoDividido) {
                    concluirComPagamentoMutation.mutate({
                      agendamentoId: String(pagamentoAgendamento.id),
                      partes: [{ forma: pagamentoForma as FormaPagamento, valor: total }],
                    });
                    return;
                  }

                  // dividido
                  const v1 = Number(String(pagamentoValor1 || "0").replace(",", "."));
                  const v2 = Number(String(pagamentoValor2 || "0").replace(",", "."));
                  if (!pagamentoForma2) return;

                  // tolerância 1 centavo
                  if (Math.abs(v1 + v2 - total) > 0.01) return;

                  concluirComPagamentoMutation.mutate({
                    agendamentoId: String(pagamentoAgendamento.id),
                    partes: [
                      { forma: pagamentoForma as FormaPagamento, valor: v1 },
                      { forma: pagamentoForma2 as FormaPagamento, valor: v2 },
                    ],
                  });
                }}
                disabled={
                  !pagamentoAgendamento ||
                  !pagamentoForma ||
                  concluirComPagamentoMutation.isPending ||
                  (pagamentoDividido && (!pagamentoForma2 || !pagamentoValor1 || !pagamentoValor2))
                }
              >
                {concluirComPagamentoMutation.isPending ? "Salvando…" : "Concluir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={comissaoOpen}
        onOpenChange={(o) => {
          if (!o) {
            setComissaoOpen(false);
            setComissaoForma("");
            setComissaoAgendamento(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagamento da comissão</DialogTitle>
            <DialogDescription>
              Para marcar a comissão como paga, informe a forma de pagamento (Pix, Dinheiro ou Cartão).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-sm font-medium">
                {comissaoAgendamento
                  ? `${format(parseISO(String(comissaoAgendamento.data_hora_inicio)), "dd/MM/yyyy HH:mm")} • ${(comissaoAgendamento.funcionario as any)?.nome ?? "Profissional"}`
                  : "Comissão"}
              </div>
              <div className="text-xs text-muted-foreground">
                Use a forma de pagamento para registrar corretamente nos relatórios.
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Forma</Label>
              <Select value={comissaoForma} onValueChange={(v) => setComissaoForma(v as FormaPagamento)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(formaPagamentoLabel) as FormaPagamento[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {formaPagamentoLabel[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setComissaoOpen(false);
                  setComissaoForma("");
                  setComissaoAgendamento(null);
                }}
                disabled={marcarComissaoPagaMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!comissaoAgendamento) return;
                  if (!comissaoForma) return;
                  marcarComissaoPagaMutation.mutate({
                    agendamentoId: String(comissaoAgendamento.id),
                    forma: comissaoForma as FormaPagamento,
                  });
                }}
                disabled={!comissaoAgendamento || !comissaoForma || marcarComissaoPagaMutation.isPending}
              >
                {marcarComissaoPagaMutation.isPending ? "Salvando…" : "Marcar como paga"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link público para clientes</DialogTitle>
            <DialogDescription>
              Compartilhe este link com seus clientes para fazerem agendamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Input
              readOnly
              value={publicBookingLink || (salaoTokenQuery.isLoading ? "Carregando link…" : "")}
              aria-label="Link público para clientes"
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={!publicBookingLink}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicBookingLink);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  } catch {
                    // sem clipboard (ambientes restritos)
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copied ? "Copiado" : "Copiar link"}
              </Button>

            </div>
          </div>
        </DialogContent>
      </Dialog>


      {!salaoId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antes de começar</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cadastre o seu salão em <Button variant="link" className="px-0" onClick={() => nav("/configuracoes")}>Configurações</Button> para liberar os agendamentos.
          </CardContent>
        </Card>
      ) : null}

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

            <div className="mt-2 text-xs text-muted-foreground">Número abaixo do dia = quantidade de agendamentos (após filtro).</div>
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
              const comissaoRow = Array.isArray(a.comissao) ? a.comissao?.[0] : a.comissao;
              const comissaoPagaEm = comissaoRow?.pago_em ? String(comissaoRow.pago_em) : null;
              const recebimentoRow = Array.isArray(a.recebimento) ? a.recebimento?.[0] : a.recebimento;
              const pagamentoFormaRow = recebimentoRow?.forma ? (String(recebimentoRow.forma) as FormaPagamento) : null;

              return (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {format(parseISO(String(a.data_hora_inicio)), "HH:mm")} • {(a.cliente as any)?.nome ?? "Cliente"}
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

                      {currentStatus === "concluido" ? (
                        <Badge variant={comissaoPagaEm ? "secondary" : "outline"}>
                          {comissaoPagaEm ? "Comissão paga" : "Comissão pendente"}
                        </Badge>
                      ) : null}

                      {currentStatus === "concluido" ? (
                        <Badge variant={pagamentoFormaRow ? "secondary" : "outline"}>
                          {pagamentoFormaRow ? `Pagamento: ${formaPagamentoLabel[pagamentoFormaRow]}` : "Pagamento pendente"}
                        </Badge>
                      ) : null}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Ações">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => nav(`/agendamentos/${a.id}`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteId(String(a.id))}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

                          {currentStatus === "concluido" && !comissaoPagaEm ? (
                            <>
                              <DropdownMenuLabel>Comissão</DropdownMenuLabel>
                              <DropdownMenuItem
                                disabled={marcarComissaoPagaMutation.isPending}
                                onClick={() => {
                                  setComissaoAgendamento(a);
                                  setComissaoForma(pagamentoFormaRow ?? "");
                                  setComissaoOpen(true);
                                }}
                              >
                                Marcar comissão como paga
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : null}

                          <DropdownMenuLabel>Status</DropdownMenuLabel>
                          {(["confirmado", "concluido", "cancelado"] as const).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              disabled={
                                updateStatusMutation.isPending ||
                                concluirComPagamentoMutation.isPending ||
                                currentStatus === s
                              }
                              onClick={() => {
                                if (s === "concluido") {
                                  setPagamentoAgendamento(a);
                                  setPagamentoForma("");
                                  setPagamentoOpen(true);
                                  return;
                                }
                                updateStatusMutation.mutate({ id: String(a.id), status: s });
                              }}
                            >
                              Marcar como: {statusLabel[s]}
                            </DropdownMenuItem>
                          ))}

                          {currentStatus === "concluido" && !pagamentoFormaRow ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={concluirComPagamentoMutation.isPending}
                                onClick={() => {
                                  setPagamentoAgendamento(a);
                                  setPagamentoForma("");
                                  setPagamentoOpen(true);
                                }}
                              >
                                Definir forma de pagamento
                              </DropdownMenuItem>
                            </>
                          ) : null}
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
