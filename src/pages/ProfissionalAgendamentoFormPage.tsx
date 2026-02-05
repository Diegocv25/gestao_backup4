import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, format, getDay, startOfDay } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/auth/access-context";
import { buildAvailableSlots } from "@/lib/scheduling";

import { FormPageShell } from "@/components/layout/FormPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

type IdName = { id: string; nome: string };

type LoadedAgendamento = {
  id: string;
  cliente_id: string;
  funcionario_id: string;
  data_hora_inicio: string;
  total_duracao_minutos: number;
  total_valor: number;
  observacoes: string | null;
  status: "marcado" | "confirmado" | "concluido" | "cancelado";
  itens: Array<{ servico_id: string }>;
};

export default function ProfissionalAgendamentoFormPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [params] = useSearchParams();
  const { funcionarioId, salaoId } = useAccess();

  const initialDate = params.get("date");
  const [clienteId, setClienteId] = useState<string>("");
  const [servicoId, setServicoId] = useState<string>("");
  const [data, setData] = useState<string>(initialDate ?? format(new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const salaoConfigQuery = useQuery({
    queryKey: ["salao-config-prof"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saloes")
        .select("id,agendamento_antecedencia_modo,agendamento_antecedencia_horas")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const agendamentoQuery = useQuery({
    queryKey: ["agendamento-prof", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id,cliente_id,funcionario_id,data_hora_inicio,total_duracao_minutos,total_valor,observacoes,status,itens:agendamento_itens(servico_id)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Agendamento não encontrado.");
      return data as unknown as LoadedAgendamento;
    },
  });

  useEffect(() => {
    if (!agendamentoQuery.data) return;
    const a = agendamentoQuery.data;
    const dt = new Date(a.data_hora_inicio);
    setClienteId(a.cliente_id);
    setObservacoes(a.observacoes ?? "");
    setData(format(dt, "yyyy-MM-dd"));
    setHora(format(dt, "HH:mm"));
    const firstServico = a.itens?.[0]?.servico_id;
    if (firstServico) setServicoId(firstServico);
  }, [agendamentoQuery.data]);

  const clientesQuery = useQuery({
    queryKey: ["clientes-nomes"],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb.rpc("clientes_nomes_current_salao");
      if (error) throw error;
      return (data ?? []) as IdName[];
    },
  });

  const servicosQuery = useQuery({
    queryKey: ["servicos-prof", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      // lista serviços vinculados ao profissional
      const { data: links, error: linkErr } = await supabase
        .from("servicos_funcionarios")
        .select("servico_id")
        .eq("funcionario_id", funcionarioId as string);
      if (linkErr) throw linkErr;
      const ids = Array.from(new Set((links ?? []).map((l: any) => String(l.servico_id)).filter(Boolean)));
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("servicos")
        .select("id,nome,duracao_minutos,valor,ativo")
        .in("id", ids)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedServico = useMemo(() => {
    const s = (servicosQuery.data ?? []).find((x: any) => x.id === servicoId);
    if (!s) return null;
    return {
      id: s.id as string,
      nome: s.nome as string,
      duracao_minutos: Number(s.duracao_minutos),
      valor: Number(s.valor),
    };
  }, [servicosQuery.data, servicoId]);

  useEffect(() => {
    setHora("");
  }, [data, servicoId]);

  const slotsQuery = useQuery({
    queryKey: ["slots-prof", funcionarioId, data, selectedServico?.duracao_minutos],
    enabled: !!funcionarioId && !!data && !!selectedServico?.duracao_minutos,
    queryFn: async () => {
      const day = new Date(`${data}T00:00:00`);
      const dow = getDay(day);

      const { data: horario, error: horErr } = await supabase
        .from("horarios_funcionario")
        .select("inicio,fim,almoco_inicio,almoco_fim")
        .eq("funcionario_id", funcionarioId as string)
        .eq("dia_semana", dow)
        .maybeSingle();
      if (horErr) throw horErr;
      if (!horario) return [] as string[];

      const start = startOfDay(day);
      const next = addDays(start, 1);

      const { data: busy, error: busyErr } = await supabase
        .from("agendamentos")
        .select("data_hora_inicio,total_duracao_minutos,status")
        .eq("funcionario_id", funcionarioId as string)
        .gte("data_hora_inicio", start.toISOString())
        .lt("data_hora_inicio", next.toISOString())
        .neq("status", "cancelado");
      if (busyErr) throw busyErr;

      const busyMapped = (busy ?? []).map((b: any) => ({
        start: format(new Date(b.data_hora_inicio), "HH:mm"),
        durationMinutes: Number(b.total_duracao_minutos),
      }));

      if (isEdit && agendamentoQuery.data) {
        const selfStart = format(new Date(agendamentoQuery.data.data_hora_inicio), "HH:mm");
        const selfDuration = Number(agendamentoQuery.data.total_duracao_minutos);
        return buildAvailableSlots({
          workStart: String(horario.inicio),
          workEnd: String(horario.fim),
          lunchStart: (horario.almoco_inicio as any) ?? null,
          lunchEnd: (horario.almoco_fim as any) ?? null,
          slotStepMinutes: 30,
          serviceDurationMinutes: Number(selectedServico?.duracao_minutos ?? 0),
          busy: busyMapped.filter((b) => !(b.start === selfStart && b.durationMinutes === selfDuration)),
        });
      }

      return buildAvailableSlots({
        workStart: String(horario.inicio),
        workEnd: String(horario.fim),
        lunchStart: (horario.almoco_inicio as any) ?? null,
        lunchEnd: (horario.almoco_fim as any) ?? null,
        slotStepMinutes: 30,
        serviceDurationMinutes: Number(selectedServico?.duracao_minutos ?? 0),
        busy: busyMapped,
      });
    },
  });

  const policyMode = String(salaoConfigQuery.data?.agendamento_antecedencia_modo ?? "horas");
  const policyHours = Number(salaoConfigQuery.data?.agendamento_antecedencia_horas ?? 0);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const minDate = policyMode === "proximo_dia" ? tomorrowStr : todayStr;

  const filteredSlots = useMemo(() => {
    const slots = (slotsQuery.data ?? []) as string[];
    if (!data) return slots;

    const now = new Date();
    const safetyNow = new Date(now.getTime() + 60_000);

    const original = agendamentoQuery.data ? new Date(agendamentoQuery.data.data_hora_inicio) : null;
    const originalDay = original ? format(original, "yyyy-MM-dd") : null;
    const originalTime = original ? format(original, "HH:mm") : null;

    if (policyMode === "proximo_dia") {
      if (data < tomorrowStr) {
        if (isEdit && originalDay === data && originalTime && slots.includes(originalTime))
          return [originalTime, ...slots.filter((s) => s !== originalTime)];
        return [];
      }
      return slots;
    }

    if (data !== todayStr) return slots;

    const threshold = new Date(safetyNow.getTime() + Math.max(0, policyHours) * 60 * 60 * 1000);
    const out = slots.filter((t) => new Date(`${data}T${t}:00`) >= threshold);

    if (isEdit && originalDay === data && originalTime && slots.includes(originalTime) && !out.includes(originalTime)) {
      return [originalTime, ...out];
    }

    return out;
  }, [slotsQuery.data, data, policyMode, policyHours, todayStr, tomorrowStr, isEdit, agendamentoQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!funcionarioId) throw new Error("Seu usuário não está vinculado a um funcionário.");
      if (!salaoId) throw new Error("Salão não identificado para seu usuário.");
      if (!clienteId) throw new Error("Selecione um cliente.");
      if (!selectedServico) throw new Error("Selecione um serviço.");
      if (!data) throw new Error("Selecione a data.");
      if (!hora) throw new Error("Selecione um horário disponível.");

      const inicioLocal = new Date(`${data}T${hora}:00`);
      const original = agendamentoQuery.data ? new Date(agendamentoQuery.data.data_hora_inicio) : null;
      const originalSameDateTime = isEdit && original ? format(original, "yyyy-MM-dd") === data && format(original, "HH:mm") === hora : false;
      const shouldValidateDateTime = !isEdit || !originalSameDateTime;

      if (shouldValidateDateTime) {
        const now = new Date();
        const safetyNow = new Date(now.getTime() + 60_000);
        if (inicioLocal < safetyNow) throw new Error("Não é possível agendar em um horário que já passou.");

        if (policyMode === "proximo_dia") {
          const minDay = startOfDay(addDays(new Date(), 1));
          if (startOfDay(inicioLocal) < minDay) throw new Error("Este salão aceita agendamentos apenas a partir do próximo dia.");
        } else {
          const threshold = new Date(safetyNow.getTime() + Math.max(0, policyHours) * 60 * 60 * 1000);
          if (inicioLocal < threshold) throw new Error(`Respeite a antecedência mínima de ${Math.max(0, policyHours)} hora(s).`);
        }
      }

      if (!isEdit) {
        const { data: saved, error } = await supabase
          .from("agendamentos")
          .insert([
            {
              cliente_id: clienteId,
              funcionario_id: funcionarioId,
              salao_id: salaoId,
              data_hora_inicio: inicioLocal.toISOString(),
              total_duracao_minutos: selectedServico.duracao_minutos,
              total_valor: selectedServico.valor,
              status: "marcado",
              observacoes: observacoes.trim() || null,
            },
          ])
          .select("id")
          .maybeSingle();
        if (error) throw error;
        const agendamentoId = saved?.id;
        if (!agendamentoId) throw new Error("Falha ao salvar agendamento.");

        const { error: itemErr } = await supabase.from("agendamento_itens").insert({
          agendamento_id: agendamentoId,
          servico_id: selectedServico.id,
          duracao_minutos: selectedServico.duracao_minutos,
          valor: selectedServico.valor,
        });
        if (itemErr) throw itemErr;

        return agendamentoId;
      }

      const agendamentoId = String(id);
      const { error: updErr } = await supabase
        .from("agendamentos")
        .update({
          cliente_id: clienteId,
          funcionario_id: funcionarioId,
          data_hora_inicio: inicioLocal.toISOString(),
          total_duracao_minutos: selectedServico.duracao_minutos,
          total_valor: selectedServico.valor,
          observacoes: observacoes.trim() || null,
        })
        .eq("id", agendamentoId);
      if (updErr) throw updErr;

      const { error: delItemErr } = await supabase.from("agendamento_itens").delete().eq("agendamento_id", agendamentoId);
      if (delItemErr) throw delItemErr;

      const { error: itemErr } = await supabase.from("agendamento_itens").insert({
        agendamento_id: agendamentoId,
        servico_id: selectedServico.id,
        duracao_minutos: selectedServico.duracao_minutos,
        valor: selectedServico.valor,
      });
      if (itemErr) throw itemErr;

      return agendamentoId;
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["agendamentos-profissional"] }), qc.invalidateQueries({ queryKey: ["agendamento-prof"] })]);
      toast({ title: isEdit ? "Agendamento atualizado" : "Agendamento criado" });
      nav(`/profissional/agendamentos?date=${data}`);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <FormPageShell
      title={isEdit ? "Editar agendamento" : "Novo agendamento"}
      description="Selecione cliente, serviço e um horário realmente livre."
      actions={
        <>
          <Button variant="secondary" onClick={() => nav("/profissional/agendamentos")}>Voltar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      {!funcionarioId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso não configurado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Seu usuário ainda não está vinculado a um funcionário. Peça ao admin para vincular.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do agendamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder={clientesQuery.isLoading ? "Carregando…" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientesQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Serviço</Label>
                <Select value={servicoId} onValueChange={setServicoId}>
                  <SelectTrigger>
                    <SelectValue placeholder={servicosQuery.isLoading ? "Carregando…" : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(servicosQuery.data ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(servicosQuery.data ?? []).length === 0 && !servicosQuery.isLoading ? (
                  <div className="text-xs text-muted-foreground">Nenhum serviço vinculado ao seu perfil.</div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" min={minDate} value={data} onChange={(e) => setData(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Horário</Label>
                <Select value={hora} onValueChange={setHora} disabled={!funcionarioId || !selectedServico}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={!funcionarioId || !selectedServico ? "Selecione serviço" : slotsQuery.isLoading ? "Calculando…" : "Selecione"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(filteredSlots ?? []).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {funcionarioId && selectedServico && (slotsQuery.data ?? []).length === 0 && !slotsQuery.isLoading ? (
                  <div className="text-xs text-muted-foreground">Sem horários livres para você nesta data.</div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Duração (min)</Label>
                <Input value={selectedServico ? String(selectedServico.duracao_minutos) : "—"} readOnly />
              </div>

              <div className="grid gap-2">
                <Label>Valor (R$)</Label>
                <Input value={selectedServico ? Number(selectedServico.valor).toFixed(2) : "—"} readOnly />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Observações (opcional)</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={4} />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => nav("/profissional/agendamentos")}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending || (isEdit && agendamentoQuery.isLoading)}>
                {saveMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
