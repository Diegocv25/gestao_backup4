import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { addDays, format, startOfDay } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";
import { useAvailableSlots } from "@/hooks/useAvailableSlots";

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

export default function AgendamentoFormPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [params] = useSearchParams();

  const { data: salaoId } = useSalaoId();

  const salaoConfigQuery = useQuery({
    queryKey: ["salao-config", salaoId],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saloes")
        .select("id,agendamento_antecedencia_modo,agendamento_antecedencia_horas")
        .eq("id", salaoId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const initialDate = params.get("date");

  const [clienteId, setClienteId] = useState<string>("");
  const [servicoId, setServicoId] = useState<string>("");
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [data, setData] = useState<string>(initialDate ?? format(new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const agendamentoQuery = useQuery({
    queryKey: ["agendamento", id],
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
    setFuncionarioId(a.funcionario_id);
    setObservacoes(a.observacoes ?? "");
    setData(format(dt, "yyyy-MM-dd"));
    setHora(format(dt, "HH:mm"));

    const firstServico = a.itens?.[0]?.servico_id;
    if (firstServico) setServicoId(firstServico);
  }, [agendamentoQuery.data]);

  const clientesQuery = useQuery({
    queryKey: ["clientes-basic"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id,nome").order("nome");
      if (error) throw error;
      return (data ?? []) as IdName[];
    },
  });

  const servicosQuery = useQuery({
    queryKey: ["servicos-ativos-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id,nome,duracao_minutos,valor,ativo")
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

  const profissionaisQuery = useQuery({
    queryKey: ["profissionais-por-servico", servicoId],
    enabled: !!servicoId,
    queryFn: async () => {
      const { data: links, error: linkErr } = await supabase
        .from("servicos_funcionarios")
        .select("funcionario_id")
        .eq("servico_id", servicoId);
      if (linkErr) throw linkErr;

      const ids = Array.from(new Set((links ?? []).map((l: any) => l.funcionario_id as string)));
      if (ids.length === 0) return [] as IdName[];

      const { data: fun, error: funErr } = await supabase
        .from("funcionarios")
        .select("id,nome,carga,ativo")
        .in("id", ids)
        .eq("ativo", true)
        .order("nome");
      if (funErr) throw funErr;

      return (fun ?? [])
        .filter((f: any) => (f.carga ?? "profissional") === "profissional")
        .map((f: any) => ({ id: f.id as string, nome: f.nome as string }));
    },
  });

  useEffect(() => {
    // se trocar serviço, precisa escolher profissional novamente
    setFuncionarioId("");
    setHora("");
  }, [servicoId]);

  useEffect(() => {
    // se trocar profissional ou data, recalcular hora
    setHora("");
  }, [funcionarioId, data]);

  const slotsQuery = useAvailableSlots({
    funcionarioId: funcionarioId || null,
    data: data || null,
    serviceDurationMinutes: selectedServico?.duracao_minutos ?? null,
    excludeAgendamentoId: isEdit && agendamentoQuery.data ? agendamentoQuery.data.id : null,
    usePortalRpc: false,
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
    const safetyNow = new Date(now.getTime() + 60_000); // 1 min de margem

    const original = agendamentoQuery.data ? new Date(agendamentoQuery.data.data_hora_inicio) : null;
    const originalDay = original ? format(original, "yyyy-MM-dd") : null;
    const originalTime = original ? format(original, "HH:mm") : null;

    // Modo: próximo dia -> bloqueia hoje e dias anteriores
    if (policyMode === "proximo_dia") {
      if (data < tomorrowStr) {
        // Em edição, deixa aparecer o horário original (mesmo que hoje)
        if (isEdit && originalDay === data && originalTime && slots.includes(originalTime)) return [originalTime, ...slots.filter((s) => s !== originalTime)];
        return [];
      }
      return slots;
    }

    // Modo: horas -> se for hoje, aplica agora + antecedência
    if (data !== todayStr) return slots;

    const threshold = new Date(safetyNow.getTime() + Math.max(0, policyHours) * 60 * 60 * 1000);

    const out = slots.filter((t) => new Date(`${data}T${t}:00`) >= threshold);

    // Em edição: mantém o horário original se ele existir
    if (isEdit && originalDay === data && originalTime && slots.includes(originalTime) && !out.includes(originalTime)) {
      return [originalTime, ...out];
    }

    return out;
  }, [slotsQuery.data, data, policyMode, policyHours, todayStr, tomorrowStr, isEdit, agendamentoQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!salaoId) throw new Error("Cadastre o salão em Configurações antes.");
      if (!clienteId) throw new Error("Selecione um cliente.");
      if (!selectedServico) throw new Error("Selecione um serviço.");
      if (!funcionarioId) throw new Error("Selecione um profissional.");
      if (!data) throw new Error("Selecione a data.");
      if (!hora) throw new Error("Selecione um horário disponível.");

      const inicioLocal = new Date(`${data}T${hora}:00`);

      const original = agendamentoQuery.data ? new Date(agendamentoQuery.data.data_hora_inicio) : null;
      const originalSameDateTime =
        isEdit && original
          ? format(original, "yyyy-MM-dd") === data && format(original, "HH:mm") === hora
          : false;

      const shouldValidateDateTime = !isEdit || !originalSameDateTime;

      if (shouldValidateDateTime) {
        const now = new Date();
        const safetyNow = new Date(now.getTime() + 60_000); // 1 min de margem

        // nunca permitir salvar no passado
        if (inicioLocal < safetyNow) {
          throw new Error("Não é possível agendar em um horário que já passou.");
        }

        // política de antecedência
        if (policyMode === "proximo_dia") {
          const minDay = startOfDay(addDays(new Date(), 1));
          if (startOfDay(inicioLocal) < minDay) {
            throw new Error("Este salão aceita agendamentos apenas a partir do próximo dia.");
          }
        } else {
          const threshold = new Date(safetyNow.getTime() + Math.max(0, policyHours) * 60 * 60 * 1000);
          if (inicioLocal < threshold) {
            throw new Error(`Respeite a antecedência mínima de ${Math.max(0, policyHours)} hora(s).`);
          }
        }
      }

      if (!isEdit) {
        const { data: saved, error } = await supabase
          .from("agendamentos")
          .insert({
            salao_id: salaoId,
            cliente_id: clienteId,
            funcionario_id: funcionarioId,
            data_hora_inicio: inicioLocal.toISOString(),
            total_duracao_minutos: selectedServico.duracao_minutos,
            total_valor: selectedServico.valor,
            status: "marcado",
            observacoes: observacoes.trim() || null,
          })
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

      // MVP: 1 serviço por agendamento -> reescreve itens
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
      await Promise.all([qc.invalidateQueries({ queryKey: ["agendamentos"] }), qc.invalidateQueries({ queryKey: ["agendamento"] })]);
      toast({ title: isEdit ? "Agendamento atualizado" : "Agendamento criado" });
      nav(`/agendamentos?date=${data}`);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <FormPageShell
      title={isEdit ? "Editar agendamento" : "Novo agendamento"}
      description="Selecione cliente, serviço, profissional e um horário realmente livre."
      actions={
        <>
          <Button variant="secondary" onClick={() => nav("/agendamentos")}>Voltar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      {!salaoId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Salão não cadastrado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vá em{" "}
            <Button variant="link" className="px-0" onClick={() => nav("/configuracoes")}>Configurações</Button>
            {" "}e cadastre o salão para liberar este formulário.
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
              </div>

              <div className="grid gap-2">
                <Label>Profissional</Label>
                <Select value={funcionarioId} onValueChange={setFuncionarioId} disabled={!servicoId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={!servicoId ? "Escolha um serviço" : profissionaisQuery.isLoading ? "Carregando…" : "Selecione"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(profissionaisQuery.data ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {servicoId && (profissionaisQuery.data ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum profissional vinculado a este serviço.</div>
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
                      placeholder={
                        !funcionarioId || !selectedServico
                          ? "Selecione serviço e profissional"
                          : slotsQuery.isLoading
                            ? "Calculando…"
                            : "Selecione"
                      }
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
                  <div className="text-xs text-muted-foreground">Sem horários livres para este profissional nesta data.</div>
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
              <Button type="button" variant="secondary" onClick={() => nav("/agendamentos")}>Cancelar</Button>
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
