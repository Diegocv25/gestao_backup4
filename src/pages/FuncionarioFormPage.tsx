import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useSalaoId } from "@/hooks/useSalaoId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormPageShell } from "@/components/layout/FormPageShell";
import { useAccess } from "@/auth/access-context";
import { CreateStaffAccessDialog } from "@/components/funcionarios/CreateStaffAccessDialog";
import { ResetStaffPasswordDialog } from "@/components/funcionarios/ResetStaffPasswordDialog";

type DayRow = {
  dia_semana: number;
  trabalha: boolean;
  inicio: string;
  fim: string;
  almoco_inicio?: string;
  almoco_fim?: string;
};

type FuncForm = {
  id?: string;
  nome: string;
  cargo: "administrador" | "gerente" | "auxiliar" | "recepcionista" | "profissional";
  telefone?: string;
  email?: string;
  ativo: boolean;
  data_admissao?: string;
  data_inatividade?: string;
  salario_fixo_mensal: number;
  comissao_percentual: number;
  servicoIds: string[];
  dias: DayRow[];
};

const diasLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function defaultDias(): DayRow[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dia_semana: d,
    trabalha: d !== 0,
    inicio: "09:00",
    fim: "18:00",
    almoco_inicio: d === 0 ? "" : "12:00",
    almoco_fim: d === 0 ? "" : "13:00",
  }));
}

export default function FuncionarioFormPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { id } = useParams();
  const editingId = id && id !== "novo" ? id : null;

  const { data: salaoId } = useSalaoId();
  const { role } = useAccess();

  const [form, setForm] = useState<FuncForm>({
    nome: "",
    cargo: "profissional",
    telefone: "",
    email: "",
    ativo: true,
    data_admissao: new Date().toISOString().slice(0, 10),
    data_inatividade: "",
    salario_fixo_mensal: 0,
    comissao_percentual: 0,
    servicoIds: [],
    dias: defaultDias(),
  });

  const funcionarioQuery = useQuery({
    queryKey: ["funcionario", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select(
          "id,nome,carga,telefone,email,ativo,data_admissao,data_inatividade,recebe_salario_fixo,salario_fixo_mensal,comissao_tipo,comissao_percentual,comissao_valor_fixo,auth_user_id",
        )
        .eq("id", editingId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Funcionário não encontrado");
      return data;
    },
  });

  const horariosQuery = useQuery({
    queryKey: ["horarios_funcionario", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horarios_funcionario")
        .select("dia_semana,inicio,fim,almoco_inicio,almoco_fim")
        .eq("funcionario_id", editingId as string)
        .order("dia_semana");
      if (error) throw error;
      return data ?? [];
    },
  });

  const servicosQuery = useQuery({
    queryKey: ["servicos-ativos-basic", salaoId],
    enabled: !!salaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos")
        .select("id,nome,ativo")
        .eq("salao_id", salaoId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const funcionarioServicosQuery = useQuery({
    queryKey: ["funcionario-servicos", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos_funcionarios")
        .select("servico_id")
        .eq("funcionario_id", editingId as string);
      if (error) throw error;
      return (data ?? []).map((r: any) => String(r.servico_id));
    },
  });

  const diasFromDb = useMemo(() => {
    if (!editingId) return null;
    const map = new Map<number, any>();
    (horariosQuery.data ?? []).forEach((h: any) => map.set(h.dia_semana, h));
    return defaultDias().map((d) => {
      const found = map.get(d.dia_semana);
      if (!found) return { ...d, trabalha: false };
      return {
        dia_semana: d.dia_semana,
        trabalha: true,
        inicio: found.inicio,
        fim: found.fim,
        almoco_inicio: found.almoco_inicio ?? "",
        almoco_fim: found.almoco_fim ?? "",
      };
    });
  }, [editingId, horariosQuery.data]);

  useEffect(() => {
    if (!editingId) return;
    if (!funcionarioQuery.data) return;
    const f: any = funcionarioQuery.data;

    setForm({
      id: f.id,
      nome: f.nome,
      cargo: (f.carga as any) ?? "profissional",
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      ativo: !!f.ativo,
      data_admissao: f.data_admissao ?? "",
      data_inatividade: f.data_inatividade ?? "",
      salario_fixo_mensal: Number(f.salario_fixo_mensal ?? 0),
      comissao_percentual: Number(f.comissao_percentual ?? 0),
      servicoIds: funcionarioServicosQuery.data ?? [],
      dias: diasFromDb ?? defaultDias(),
    });
  }, [editingId, funcionarioQuery.data, diasFromDb, funcionarioServicosQuery.data]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: FuncForm) => {
      if (!salaoId) throw new Error("Cadastre o salão em Configurações antes.");

      const salario_fixo_mensal = Number(payload.salario_fixo_mensal ?? 0);
      const recebe_salario_fixo = salario_fixo_mensal > 0;
      const comissao_percentual = Number(payload.comissao_percentual ?? 0);

      const dataInatividade = payload.ativo
        ? null
        : payload.data_inatividade || new Date().toISOString().slice(0, 10);

      const { data: saved, error } = await supabase
        .from("funcionarios")
        .upsert({
          id: payload.id,
          salao_id: salaoId,
          nome: payload.nome.trim(),
          carga: payload.cargo,
          telefone: payload.telefone?.trim() || null,
          email: payload.email?.trim() || null,
          ativo: payload.ativo,
          data_admissao: payload.data_admissao || null,
          data_inatividade: dataInatividade,
          recebe_salario_fixo,
          salario_fixo_mensal,
          // Modelo simplificado: comissão é sempre percentual (0 quando vazio)
          comissao_tipo: "percentual",
          comissao_percentual: comissao_percentual > 0 ? comissao_percentual : null,
          comissao_valor_fixo: null,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;

      const funcionarioId = saved?.id ?? payload.id;
      if (!funcionarioId) throw new Error("Falha ao salvar funcionário.");

      await supabase.from("horarios_funcionario").delete().eq("funcionario_id", funcionarioId);

      const rows = payload.dias
        .filter((d) => d.trabalha)
        .map((d) => ({
          funcionario_id: funcionarioId,
          dia_semana: d.dia_semana,
          inicio: d.inicio,
          fim: d.fim,
          almoco_inicio: d.almoco_inicio || null,
          almoco_fim: d.almoco_fim || null,
        }));

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("horarios_funcionario").insert(rows);
        if (insErr) throw insErr;
      }

      // vínculos serviço <-> profissional (somente quando cargo = profissional)
      await supabase.from("servicos_funcionarios").delete().eq("funcionario_id", funcionarioId);
      if (payload.cargo === "profissional") {
        const ids = Array.from(new Set((payload.servicoIds ?? []).map((x) => String(x)).filter(Boolean)));
        if (ids.length > 0) {
          const links = ids.map((sid) => ({ funcionario_id: funcionarioId, servico_id: sid }));
          const { error: linkErr } = await supabase.from("servicos_funcionarios").insert(links);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["funcionarios"] }),
        qc.invalidateQueries({ queryKey: ["horarios_funcionario"] }),
      ]);
      toast({ title: "Funcionário salvo" });
      nav("/funcionarios");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const loading = funcionarioQuery.isLoading || horariosQuery.isLoading;

  return (
    <FormPageShell
      title={editingId ? "Editar funcionário" : "Novo funcionário"}
      actions={
        <>
          <Button variant="secondary" onClick={() => nav("/funcionarios")}>Voltar</Button>
          <Button
            onClick={() => {
              if (!form.nome.trim()) return toast({ title: "Informe o nome" });
              upsertMutation.mutate(form);
            }}
            disabled={upsertMutation.isPending || loading}
          >
            {upsertMutation.isPending ? "Salvando…" : "Salvar"}
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
            Vá em <Button variant="link" className="px-0" onClick={() => nav("/configuracoes")}>Configurações</Button> e cadastre o salão para liberar este formulário.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
          {funcionarioQuery.error ? <div className="text-sm text-destructive">{(funcionarioQuery.error as any).message}</div> : null}

          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.nome.trim()) return toast({ title: "Informe o nome" });
              upsertMutation.mutate(form);
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Cargo</Label>
                <Select value={form.cargo} onValueChange={(v) => setForm((p) => ({ ...p, cargo: v as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="auxiliar">Auxiliar</SelectItem>
                    <SelectItem value="recepcionista">Recepcionista</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.telefone ?? ""} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Data de admissão</Label>
                <Input
                  type="date"
                  value={form.data_admissao ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, data_admissao: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Data de inatividade</Label>
                <Input
                  type="date"
                  value={form.data_inatividade ?? ""}
                  disabled={form.ativo}
                  onChange={(e) => setForm((p) => ({ ...p, data_inatividade: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Status</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.ativo}
                    onCheckedChange={(v) =>
                      setForm((p) => {
                        const nextAtivo = Boolean(v);
                        return {
                          ...p,
                          ativo: nextAtivo,
                          data_inatividade: nextAtivo ? "" : p.data_inatividade || new Date().toISOString().slice(0, 10),
                        };
                      })
                    }
                  />
                  Ativo
                </label>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Salário fixo (R$ / mês)</Label>
                <Input
                  type="number"
                  value={form.salario_fixo_mensal}
                  onChange={(e) => setForm((p) => ({ ...p, salario_fixo_mensal: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label>Comissão (%)</Label>
                <Input
                  type="number"
                  value={form.comissao_percentual}
                  onChange={(e) => setForm((p) => ({ ...p, comissao_percentual: Number(e.target.value) }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Horários de trabalho</Label>
              <div className="grid gap-2 rounded-md border p-3">
                {form.dias.map((d, idx) => (
                  <div key={d.dia_semana} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-6 sm:items-center">
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Checkbox
                        checked={d.trabalha}
                        onCheckedChange={(v) =>
                          setForm((p) => {
                            const next = [...p.dias];
                            next[idx] = { ...next[idx], trabalha: Boolean(v) };
                            return { ...p, dias: next };
                          })
                        }
                      />
                      <div className="text-sm font-medium">{diasLabel[d.dia_semana]}</div>
                    </div>

                    <div className="grid gap-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        value={d.inicio}
                        disabled={!d.trabalha}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.dias];
                            next[idx] = { ...next[idx], inicio: e.target.value };
                            return { ...p, dias: next };
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-1">
                      <Label className="text-xs">Fim</Label>
                      <Input
                        type="time"
                        value={d.fim}
                        disabled={!d.trabalha}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.dias];
                            next[idx] = { ...next[idx], fim: e.target.value };
                            return { ...p, dias: next };
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-1">
                      <Label className="text-xs">Almoço início</Label>
                      <Input
                        type="time"
                        value={d.almoco_inicio ?? ""}
                        disabled={!d.trabalha}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.dias];
                            next[idx] = { ...next[idx], almoco_inicio: e.target.value };
                            return { ...p, dias: next };
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-1">
                      <Label className="text-xs">Almoço fim</Label>
                      <Input
                        type="time"
                        value={d.almoco_fim ?? ""}
                        disabled={!d.trabalha}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.dias];
                            next[idx] = { ...next[idx], almoco_fim: e.target.value };
                            return { ...p, dias: next };
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {form.cargo === "profissional" ? (
              <div className="grid gap-2">
                <Label>Serviços atendidos</Label>
                <div className="grid gap-2 rounded-md border p-3">
                  {servicosQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Carregando serviços…</div>
                  ) : (servicosQuery.data ?? []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum serviço ativo cadastrado.</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(servicosQuery.data ?? []).map((s: any) => {
                        const sid = String(s.id);
                        const checked = (form.servicoIds ?? []).includes(sid);
                        return (
                          <label key={sid} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                setForm((p) => {
                                  const next = new Set(p.servicoIds ?? []);
                                  if (Boolean(v)) next.add(sid);
                                  else next.delete(sid);
                                  return { ...p, servicoIds: Array.from(next) };
                                })
                              }
                            />
                            <span className="min-w-0 truncate">{String(s.nome)}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Esses serviços aparecem para o profissional na tela de “Novo agendamento”.
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => nav("/funcionarios")}>Cancelar</Button>
              <Button type="submit" disabled={upsertMutation.isPending || loading}>
                {upsertMutation.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editingId && salaoId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {funcionarioQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
            {funcionarioQuery.data ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  Status: {funcionarioQuery.data.auth_user_id ? "Acesso configurado" : "Sem acesso"}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {role === "admin" && !funcionarioQuery.data.auth_user_id ? (
                    <CreateStaffAccessDialog funcionarioId={editingId} defaultEmail={form.email} funcionarioCargo={form.cargo} />
                  ) : null}

                  {role === "admin" && !!funcionarioQuery.data.auth_user_id ? (
                    <CreateStaffAccessDialog
                      funcionarioId={editingId}
                      defaultEmail={form.email}
                      funcionarioCargo={form.cargo}
                      mode="update"
                    />
                  ) : null}

                  {(role === "admin" || role === "gerente") && !!funcionarioQuery.data.auth_user_id ? (
                    <ResetStaffPasswordDialog funcionarioId={editingId} loginEmail={form.email} />
                  ) : null}
                </div>
              </div>
            ) : null}

            {role !== "admin" && !funcionarioQuery.data?.auth_user_id ? (
              <div className="text-xs text-muted-foreground">Apenas Admin pode criar acesso.</div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </FormPageShell>
  );
}
