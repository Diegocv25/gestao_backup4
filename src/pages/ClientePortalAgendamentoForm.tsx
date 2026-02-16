import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { PortalShell } from "@/components/cliente-portal/PortalShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { usePortalSalaoByToken } from "@/hooks/usePortalSalaoByToken";
import {
  portalAgendamentoCancel,
  portalAgendamentoCreate,
  portalAgendamentoGet,
  portalAgendamentoUpdate,
  portalAvailableSlots,
  portalMe,
  portalProfissionalDias,
  portalProfissionaisByServico,
  portalServicosList,
} from "@/portal/portal-api";
import { Badge } from "@/components/ui/badge";

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ClientePortalAgendamentoFormPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { token, id } = useParams();
  const location = useLocation();
  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);
  const agendamentoId = id ? String(id) : null;
  const tzOffset = useMemo(() => new Date().getTimezoneOffset(), []);

  const isEditing = useMemo(() => !!agendamentoId && location.pathname.endsWith("/editar"), [agendamentoId, location.pathname]);
  const isFormMode = !agendamentoId || isEditing;

  const [servicoId, setServicoId] = useState<string>("");
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [dia, setDia] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState<string>("");

  const salaoQuery = usePortalSalaoByToken(tokenValue);
  const meQuery = useQuery({
    queryKey: ["portal-me", tokenValue],
    enabled: tokenValue.length > 0,
    queryFn: async () => portalMe(tokenValue),
    retry: false,
    staleTime: 1000 * 15,
  });

  const servicosQuery = useQuery({
    queryKey: ["portal-servicos", tokenValue],
    enabled: tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated && isFormMode,
    queryFn: async () => portalServicosList(tokenValue),
    retry: false,
    staleTime: 1000 * 30,
  });

  const profissionaisQuery = useQuery({
    queryKey: ["portal-profissionais", tokenValue, servicoId],
    enabled: tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated && !!servicoId && isFormMode,
    queryFn: async () => portalProfissionaisByServico({ token: tokenValue, servico_id: servicoId }),
    retry: false,
    staleTime: 1000 * 30,
  });

  const profissionalDiasQuery = useQuery({
    queryKey: ["portal-profissional-dias", tokenValue, funcionarioId],
    enabled: tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated && !!funcionarioId && isFormMode,
    queryFn: async () => portalProfissionalDias({ token: tokenValue, funcionario_id: funcionarioId }),
    retry: false,
    staleTime: 1000 * 60,
  });

  const diaIso = dia ? toIsoDate(dia) : "";
  const slotsQuery = useQuery({
    queryKey: ["portal-slots", tokenValue, servicoId, funcionarioId, diaIso],
    enabled:
      tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated && !!servicoId && !!funcionarioId && !!diaIso && isFormMode,
    queryFn: async () =>
      portalAvailableSlots({
        token: tokenValue,
        servico_id: servicoId,
        funcionario_id: funcionarioId,
        dia: diaIso,
        tz_offset_minutes: tzOffset,
      }),
    retry: false,
    staleTime: 1000 * 15,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!servicoId || !funcionarioId || !diaIso || !hora) throw new Error("Preencha serviço, profissional, dia e horário");
      return portalAgendamentoCreate({
        token: tokenValue,
        servico_id: servicoId,
        funcionario_id: funcionarioId,
        dia: diaIso,
        hora,
        tz_offset_minutes: tzOffset,
      });
    },
    onSuccess: async (data) => {
      if (!data?.ok || !data.agendamento_id) throw new Error(data?.error || "Falha ao criar agendamento");
      await qc.invalidateQueries({ queryKey: ["portal-agendamentos", tokenValue] });
      toast({ title: "Agendamento criado" });
      nav(`/cliente/${tokenValue}/agendamentos/${data.agendamento_id}`);
    },
    onError: (e: any) => {
      toast({ title: "Não foi possível agendar", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!agendamentoId) throw new Error("Agendamento inválido");
      if (!servicoId || !funcionarioId || !diaIso || !hora) throw new Error("Preencha serviço, profissional, dia e horário");
      return portalAgendamentoUpdate({
        token: tokenValue,
        agendamento_id: agendamentoId,
        servico_id: servicoId,
        funcionario_id: funcionarioId,
        dia: diaIso,
        hora,
        tz_offset_minutes: tzOffset,
      });
    },
    onSuccess: async (data) => {
      if (!data?.ok) throw new Error(data?.error || "Falha ao salvar alterações");
      await qc.invalidateQueries({ queryKey: ["portal-agendamentos", tokenValue] });
      await qc.invalidateQueries({ queryKey: ["portal-agendamento", tokenValue, agendamentoId] });
      toast({ title: "Agendamento atualizado" });
      nav(`/cliente/${tokenValue}/agendamentos/${agendamentoId}`, { replace: true });
    },
    onError: (e: any) => {
      toast({ title: "Não foi possível editar", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  const detailQuery = useQuery({
    queryKey: ["portal-agendamento", tokenValue, agendamentoId],
    enabled: tokenValue.length > 0 && !!(meQuery.data as any)?.authenticated && !!agendamentoId,
    queryFn: async () => portalAgendamentoGet({ token: tokenValue, agendamento_id: String(agendamentoId) }),
    retry: false,
    staleTime: 1000 * 15,
  });

  // Pré-preenche no modo edição
  useEffect(() => {
    if (!isEditing) return;
    if (detailQuery.isLoading || detailQuery.isError) return;
    const ag = (detailQuery.data as any)?.agendamento;
    if (!ag) return;
    const serv = ag?.itens?.[0]?.servico?.id ?? ag?.itens?.[0]?.servico_id;
    const func = ag?.funcionario?.id ?? ag?.funcionario_id;
    const dtUtc = ag?.data_hora_inicio ? new Date(String(ag.data_hora_inicio)) : null;
    if (!dtUtc || Number.isNaN(dtUtc.getTime())) return;

    // Converte UTC -> "local" do usuário usando tzOffset (mesma regra usada no backend)
    const localMs = dtUtc.getTime() - tzOffset * 60 * 1000;
    const local = new Date(localMs);
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const mm = String(local.getUTCMinutes()).padStart(2, "0");

    setServicoId((prev) => (prev ? prev : String(serv ?? "")));
    setFuncionarioId((prev) => (prev ? prev : String(func ?? "")));
    setDia((prev) => (prev ? prev : new Date(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())));
    setHora((prev) => (prev ? prev : `${hh}:${mm}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, detailQuery.data, detailQuery.isLoading, detailQuery.isError]);

  const minSelectableDate = useMemo(() => {
    const antecedenciaHoras = Number(salaoQuery.data?.agendamento_antecedencia_horas ?? 0);
    const minLocalMs = Date.now() - tzOffset * 60 * 1000 + antecedenciaHoras * 60 * 60 * 1000;
    const minLocal = new Date(minLocalMs);
    return new Date(minLocal.getUTCFullYear(), minLocal.getUTCMonth(), minLocal.getUTCDate());
  }, [salaoQuery.data?.agendamento_antecedencia_horas, tzOffset]);

  const dayLabels = useMemo(
    () => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    [],
  );

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!agendamentoId) throw new Error("Agendamento inválido");
      return portalAgendamentoCancel({ token: tokenValue, agendamento_id: agendamentoId });
    },
    onSuccess: async (data) => {
      if (!data?.ok) throw new Error(data?.error || "Falha ao cancelar");
      await qc.invalidateQueries({ queryKey: ["portal-agendamentos", tokenValue] });
      await qc.invalidateQueries({ queryKey: ["portal-agendamento", tokenValue, agendamentoId] });
      toast({ title: "Agendamento cancelado" });
    },
    onError: (e: any) => {
      toast({ title: "Não foi possível cancelar", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  return (
    <PortalShell
      title="Portal do Cliente"
      subtitle={salaoQuery.data?.nome}
      logoUrl={salaoQuery.data?.logo_url}
      onBack={() => nav(`/cliente/${tokenValue}/app`)}
      maxWidth="3xl"
    >
      {!tokenValue ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Link inválido.</CardContent>
        </Card>
      ) : salaoQuery.isLoading || meQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (meQuery.data as any)?.authenticated === false ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Faça login para continuar.</CardContent>
        </Card>
      ) : agendamentoId && !isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detailQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
            {detailQuery.isError ? <div className="text-sm text-destructive">Erro ao carregar agendamento.</div> : null}

            {!detailQuery.isLoading && !detailQuery.isError ? (
              <>
                <div className="text-sm">
                  <div className="font-medium">Data/Hora</div>
                  <div className="text-muted-foreground">{new Date((detailQuery.data as any)?.agendamento?.data_hora_inicio).toLocaleString()}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Serviço</div>
                  <div className="text-muted-foreground">{(detailQuery.data as any)?.agendamento?.itens?.[0]?.servico?.nome ?? "—"}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Profissional</div>
                  <div className="text-muted-foreground">{(detailQuery.data as any)?.agendamento?.funcionario?.nome ?? "—"}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium">Status</div>
                  <div className="text-muted-foreground">{String((detailQuery.data as any)?.agendamento?.status ?? "—")}</div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={() => nav(`/cliente/${tokenValue}/agendamentos`)}>
                    Voltar
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={String((detailQuery.data as any)?.agendamento?.status) === "cancelado"}
                    onClick={() => nav(`/cliente/${tokenValue}/agendamentos/${agendamentoId}/editar`)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={cancelMut.isPending || String((detailQuery.data as any)?.agendamento?.status) === "cancelado"}
                    onClick={() => cancelMut.mutate()}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isEditing ? "Editar agendamento" : "Agendar"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">Serviço</div>
                <Select
                  value={servicoId}
                  onValueChange={(v) => {
                    setServicoId(v);
                    setFuncionarioId("");
                    setDia(undefined);
                    setHora("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={servicosQuery.isLoading ? "Carregando…" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(servicosQuery.data?.servicos ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {servicosQuery.isError ? <div className="text-sm text-destructive">Erro ao carregar serviços.</div> : null}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Profissional</div>
                <Select
                  value={funcionarioId}
                  onValueChange={(v) => {
                    setFuncionarioId(v);
                    setDia(undefined);
                    setHora("");
                  }}
                  disabled={!servicoId || profissionaisQuery.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!servicoId ? "Selecione um serviço" : profissionaisQuery.isLoading ? "Carregando…" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(profissionaisQuery.data?.profissionais ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profissionaisQuery.isError ? <div className="text-sm text-destructive">Erro ao carregar profissionais.</div> : null}

                {!profissionaisQuery.isError && !!funcionarioId && (profissionalDiasQuery.data?.dias ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(profissionalDiasQuery.data?.dias ?? []).map((d) => (
                      <Badge key={d} variant="secondary" className="px-2 py-0 text-[11px]">
                        {dayLabels[d] ?? String(d)}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Dia</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" className="w-full justify-start" disabled={!funcionarioId}>
                      {dia ? dia.toLocaleDateString() : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dia}
                      onSelect={(d) => {
                        setDia(d);
                        setHora("");
                      }}
                      disabled={(date) => {
                        const cmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        return cmp < minSelectableDate;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Horário</div>
                <Select value={hora} onValueChange={setHora} disabled={!diaIso || slotsQuery.isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={!diaIso ? "Selecione o dia" : slotsQuery.isLoading ? "Carregando…" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(16rem,50vh)] overflow-y-auto">
                    {(slotsQuery.data?.slots ?? []).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {slotsQuery.isError ? <div className="text-sm text-destructive">Erro ao carregar horários.</div> : null}
                {!slotsQuery.isLoading && !slotsQuery.isError && diaIso && (slotsQuery.data?.slots ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum horário disponível neste dia.</div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                disabled={(isEditing ? updateMut.isPending : createMut.isPending) || !servicoId || !funcionarioId || !diaIso || !hora}
                onClick={() => (isEditing ? updateMut.mutate() : createMut.mutate())}
              >
                {isEditing ? "Salvar alterações" : "Confirmar agendamento"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PortalShell>
  );
}
