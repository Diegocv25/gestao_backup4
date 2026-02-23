import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Bot, MessageCircle, Paperclip } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";
import { useAccess } from "@/auth/access-context";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { FormPageShell } from "@/components/layout/FormPageShell";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/ui/password-input";
import { strongPasswordSchema } from "@/lib/password-policy";
import { AvisosSemanaisCard } from "@/components/configuracoes/AvisosSemanaisCard";

type SalaoForm = {
  id?: string;
  nome: string;
  logo_url?: string | null;
  telefone?: string;
  endereco?: string;
  agendamento_antecedencia_modo: "horas" | "proximo_dia";
  agendamento_antecedencia_horas: number;
};

type DiaFuncionamentoForm = {
  id?: string;
  salao_id: string;
  dia_semana: number;
  fechado: boolean;
  abre_em: string;
  fecha_em: string;
  intervalo_inicio: string;
  intervalo_fim: string;
};

const diasLabel = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SUPPORT_WHATSAPP_URL = "https://wa.me/5548991015688";
const KIWIFY_CHECKOUTS = {
  profissional: "https://pay.kiwify.com.br/H5429N1",
  pro_ia: "https://pay.kiwify.com.br/Bru2N8Q",
} as const;

function onlyDigits(v: string) {
  return String(v ?? "").replace(/\D/g, "");
}

function jidToLocalPhone(v?: string | null) {
  if (!v) return "";
  let s = String(v).trim().replace(/@s\.whatsapp\.net$/i, "");
  s = onlyDigits(s);
  if (s.startsWith("55")) s = s.slice(2);
  // Se veio sem 9 (DD + 8), exibe com 9 para o usuário preencher no padrão local
  if (s.length === 10) s = `${s.slice(0, 2)}9${s.slice(2)}`;
  return s;
}

function localPhoneToJid(v?: string | null) {
  if (!v) return null;
  let s = onlyDigits(v);
  if (s.startsWith("55")) s = s.slice(2);
  // WhatsApp/Evolution costuma usar sem o 9 adicional (DD + 8)
  if (s.length === 11 && s[2] === "9") s = `${s.slice(0, 2)}${s.slice(3)}`;
  if (s.length !== 10) return null;
  return `55${s}@s.whatsapp.net`;
}

function defaultDia(salaoId: string, dia: number): DiaFuncionamentoForm {
  const fechado = dia === 0;
  return {
    salao_id: salaoId,
    dia_semana: dia,
    fechado,
    abre_em: fechado ? "" : "09:00",
    fecha_em: fechado ? "" : "18:00",
    intervalo_inicio: fechado ? "" : "12:00",
    intervalo_fim: fechado ? "" : "13:00",
  };
}

export default function ConfiguracoesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { role } = useAccess();

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const myRolesQuery = useQuery({
    queryKey: ["my-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.role) as string[];
    },
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from("subscriptions")
        .select("status,product_id,product_name,updated_at")
        .eq("provider", "kiwify")
        .eq("customer_email", String(user?.email ?? "").toLowerCase())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const salaoQuery = useQuery({
    queryKey: ["salao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saloes")
        .select("id,nome,logo_url,telefone,endereco,agendamento_antecedencia_modo,agendamento_antecedencia_horas")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const [form, setForm] = useState<SalaoForm>({
    nome: "",
    logo_url: null,
    telefone: "",
    endereco: "",
    agendamento_antecedencia_modo: "horas",
    agendamento_antecedencia_horas: 0,
  });

  useEffect(() => {
    if (!salaoQuery.data) return;
    setForm({
      id: salaoQuery.data.id,
      nome: salaoQuery.data.nome ?? "",
      logo_url: (salaoQuery.data as any).logo_url ?? null,
      telefone: jidToLocalPhone(salaoQuery.data.telefone),
      endereco: salaoQuery.data.endereco ?? "",
      agendamento_antecedencia_modo: (salaoQuery.data.agendamento_antecedencia_modo as any) ?? "horas",
      agendamento_antecedencia_horas: Number(salaoQuery.data.agendamento_antecedencia_horas ?? 0),
    });
  }, [salaoQuery.data]);

  const canManageLogo = useMemo(() => {
    const roles = myRolesQuery.data ?? [];
    return roles.includes("admin") || roles.includes("gerente");
  }, [myRolesQuery.data]);

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const salaoId = salaoQuery.data?.id;
      if (!salaoId) throw new Error("Salve o salão primeiro para anexar a logo");
      if (!canManageLogo) throw new Error("Sem permissão para alterar a logo");

      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const objectPath = `saloes/${salaoId}/logo.${ext}`;

      const { error: upErr } = await supabase.storage.from("estabelecimento-logos").upload(objectPath, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("estabelecimento-logos").getPublicUrl(objectPath);
      const publicUrl = data.publicUrl;
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      const { error: dbErr } = await supabase.from("saloes").update({ logo_url: urlWithBust }).eq("id", salaoId);
      if (dbErr) throw dbErr;

      return urlWithBust;
    },
    onSuccess: async (url) => {
      setForm((p) => ({ ...p, logo_url: url }));
      await qc.invalidateQueries({ queryKey: ["salao"] });
      toast({ title: "Logo atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      const salaoId = salaoQuery.data?.id;
      if (!salaoId) throw new Error("Salve o salão primeiro");
      if (!canManageLogo) throw new Error("Sem permissão para alterar a logo");

      const { error } = await supabase.from("saloes").update({ logo_url: null }).eq("id", salaoId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setForm((p) => ({ ...p, logo_url: null }));
      await qc.invalidateQueries({ queryKey: ["salao"] });
      toast({ title: "Logo removida" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const ensureDias = useMutation({
    mutationFn: async (salaoId: string) => {
      const { data: existing, error } = await supabase
        .from("dias_funcionamento")
        .select("id,dia_semana,fechado,abre_em,fecha_em,intervalo_inicio,intervalo_fim")
        .eq("salao_id", salaoId);
      if (error) throw error;

      const have = new Set((existing ?? []).map((r: any) => r.dia_semana));
      const missing = [0, 1, 2, 3, 4, 5, 6].filter((d) => !have.has(d));
      if (missing.length === 0) return;

      const rows = missing.map((dia) => {
        const d = defaultDia(salaoId, dia);
        return {
          salao_id: salaoId,
          dia_semana: dia,
          fechado: d.fechado,
          abre_em: d.fechado ? null : d.abre_em,
          fecha_em: d.fechado ? null : d.fecha_em,
          intervalo_inicio: d.fechado ? null : d.intervalo_inicio,
          intervalo_fim: d.fechado ? null : d.intervalo_fim,
        };
      });

      const { error: insErr } = await supabase.from("dias_funcionamento").insert(rows);
      if (insErr) throw insErr;
    },
  });

  const diasQuery = useQuery({
    queryKey: ["dias_funcionamento", salaoQuery.data?.id],
    enabled: !!salaoQuery.data?.id,
    queryFn: async () => {
      const salaoId = salaoQuery.data?.id as string;
      const { data, error } = await supabase
        .from("dias_funcionamento")
        .select("id,dia_semana,fechado,abre_em,fecha_em,intervalo_inicio,intervalo_fim")
        .eq("salao_id", salaoId)
        .order("dia_semana");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [dias, setDias] = useState<DiaFuncionamentoForm[]>([]);

  useEffect(() => {
    const salaoId = salaoQuery.data?.id;
    if (!salaoId) return;
    if (!diasQuery.data) return;

    const map = new Map<number, any>();
    (diasQuery.data ?? []).forEach((d: any) => map.set(d.dia_semana, d));

    const next = [0, 1, 2, 3, 4, 5, 6].map((dia) => {
      const base = defaultDia(salaoId, dia);
      const row = map.get(dia);
      if (!row) return base;
      return {
        id: row.id,
        salao_id: salaoId,
        dia_semana: dia,
        fechado: !!row.fechado,
        abre_em: row.abre_em ?? "",
        fecha_em: row.fecha_em ?? "",
        intervalo_inicio: row.intervalo_inicio ?? "",
        intervalo_fim: row.intervalo_fim ?? "",
      } as DiaFuncionamentoForm;
    });

    setDias(next);
  }, [diasQuery.data, salaoQuery.data?.id]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { salao: SalaoForm; dias: DiaFuncionamentoForm[] }) => {
      if (!payload.salao.nome.trim()) throw new Error("Informe o nome do salão");
      const telefoneJid = localPhoneToJid(payload.salao.telefone);
      if (String(payload.salao.telefone ?? "").trim() && !telefoneJid) {
        throw new Error("Telefone inválido. Use o formato (DD) 999999999");
      }

        const { data: saved, error } = await supabase
          .from("saloes")
          .upsert({
            id: payload.salao.id,
            nome: payload.salao.nome.trim(),
            telefone: telefoneJid || null,
            endereco: payload.salao.endereco?.trim() || null,
            agendamento_antecedencia_modo: payload.salao.agendamento_antecedencia_modo,
            agendamento_antecedencia_horas: Math.max(0, Number(payload.salao.agendamento_antecedencia_horas ?? 0)),
          })
          .select("id")
          .maybeSingle();
      if (error) throw error;
      const salaoId = saved?.id ?? payload.salao.id;
      if (!salaoId) throw new Error("Falha ao salvar salão");

      await ensureDias.mutateAsync(salaoId);

      // salva os dias de funcionamento (independente dos horários dos funcionários)
      const rows = payload.dias.map((d) => ({
        id: d.id,
        salao_id: salaoId,
        dia_semana: d.dia_semana,
        fechado: d.fechado,
        abre_em: d.fechado ? null : d.abre_em || null,
        fecha_em: d.fechado ? null : d.fecha_em || null,
        intervalo_inicio: d.fechado ? null : d.intervalo_inicio || null,
        intervalo_fim: d.fechado ? null : d.intervalo_fim || null,
      }));

      const { error: upErr } = await supabase.from("dias_funcionamento").upsert(rows);
      if (upErr) throw upErr;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["salao"] }),
        qc.invalidateQueries({ queryKey: ["salao-id"] }),
        qc.invalidateQueries({ queryKey: ["dias_funcionamento"] }),
      ]);
      toast({ title: "Configurações salvas" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const title = useMemo(() => (salaoQuery.data?.id ? "Configurações" : "Configurações (primeiro acesso)"), [salaoQuery.data?.id]);

  // Regra: funcionários não-admin só podem trocar a própria senha.
  // Exceção: role=null (onboarding) mantém acesso às configurações completas.
  const isStaffNonAdmin = role !== null && role !== "admin";

  const canEditDias = !!salaoQuery.data?.id;

  const currentPlanId = useMemo<"profissional" | "pro_ia">(() => {
    const s = subscriptionQuery.data as any;
    const pid = String(s?.product_id ?? "").toLowerCase();
    const pname = String(s?.product_name ?? "").toLowerCase();
    if (pid.includes("pro_ia") || pname.includes("pro") || pname.includes("ia")) return "pro_ia";
    return "profissional";
  }, [subscriptionQuery.data]);

  const checkoutCurrentPlan = KIWIFY_CHECKOUTS[currentPlanId];
  const checkoutUpgradePlan = currentPlanId === "profissional" ? KIWIFY_CHECKOUTS.pro_ia : KIWIFY_CHECKOUTS.profissional;
  const currentPlanLabel = currentPlanId === "pro_ia" ? "PRO + IA" : "Profissional";
  const upgradeLabel = currentPlanId === "profissional" ? "Upgrade para PRO + IA" : "Trocar para Profissional";

  const changePasswordSchema = useMemo(
    () =>
      z
        .object({
          current: z.string().min(1, "Informe a senha atual"),
          next: strongPasswordSchema,
          confirm: z.string().min(1, "Confirme a nova senha"),
        })
        .refine((v) => v.next === v.confirm, { message: "As senhas não conferem", path: ["confirm"] }),
    [],
  );

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("Seu usuário não possui email");

      const parsed = changePasswordSchema.safeParse(pwd);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Verifique os campos");

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: parsed.data.current,
      });
      if (signErr) throw new Error("Senha atual inválida");

      const { error: updErr } = await supabase.auth.updateUser({ password: parsed.data.next });
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast({ title: "Senha alterada" });
      setPwd({ current: "", next: "", confirm: "" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <FormPageShell
      title={title}
      description={
        isStaffNonAdmin
          ? "Altere sua senha de acesso."
          : "Cadastre as informações do salão e defina horários por dia (isso não altera os horários dos funcionários)."
      }
      actions={
        isStaffNonAdmin ? null : (
          <Button onClick={() => saveMutation.mutate({ salao: form, dias })} disabled={saveMutation.isPending || salaoQuery.isLoading}>
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        )
      }
    >
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segurança</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                changePasswordMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Senha atual</Label>
                  <PasswordInput value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
                </div>
                <div className="grid gap-2">
                  <Label>Nova senha</Label>
                  <PasswordInput value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} autoComplete="new-password" />
                </div>
                <div className="grid gap-2">
                  <Label>Confirmar nova senha</Label>
                  <PasswordInput value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Regra: mínimo 8 caracteres, 1 maiúscula e 1 número.</div>
              <div className="flex justify-end">
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? "Alterando…" : "Alterar senha"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!isStaffNonAdmin ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estabelecimento</CardTitle>
            </CardHeader>
            <CardContent>
              {salaoQuery.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : null}
              {salaoQuery.error ? <div className="text-sm text-destructive">Erro ao carregar.</div> : null}

              <form
                className="grid gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate({ salao: form, dias });
                }}
              >
                <div className="grid gap-2">
                  <Label>Logo do estabelecimento</Label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      {form.logo_url ? (
                        <img
                          src={form.logo_url}
                          alt={`Logo do estabelecimento ${form.nome || ""}`}
                          className="h-16 w-16 rounded-md object-contain border"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-md border bg-muted" aria-hidden="true" />
                      )}
                      <div className="text-xs text-muted-foreground">Recomendado: imagem quadrada (PNG/JPG), até ~1MB.</div>
                    </div>

                    <div className="flex flex-1 items-start justify-end gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!canManageLogo || !salaoQuery.data?.id || uploadLogoMutation.isPending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadLogoMutation.mutate(file);
                          // permite escolher o mesmo arquivo novamente
                          e.currentTarget.value = "";
                        }}
                      />

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={uploadLogoMutation.isPending || !canManageLogo || !salaoQuery.data?.id}
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-2"
                      >
                        <Paperclip className="h-4 w-4" />
                        {uploadLogoMutation.isPending ? "Enviando…" : "Anexar logo"}
                      </Button>

                      {form.logo_url ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={removeLogoMutation.isPending || !canManageLogo}
                          onClick={() => removeLogoMutation.mutate()}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {!canManageLogo ? (
                    <div className="text-xs text-muted-foreground">Somente Admin/Gerente pode alterar a logo.</div>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome do estabelecimento</Label>
                  <Input id="nome" value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tel">WhatsApp da instância (salvo como 55XXXXXXXXXX@s.whatsapp.net)</Label>
                  <div className="flex items-center rounded-md border bg-background">
                    <span className="border-r px-3 text-sm text-muted-foreground">55</span>
                    <Input
                      id="tel"
                      className="border-0 focus-visible:ring-0"
                      placeholder="(DD) 999999999"
                      value={form.telefone ?? ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          // No plano PRO+IA este número é utilizado pela instância do WhatsApp (secretária virtual)
                          telefone: onlyDigits(e.target.value).slice(0, 11),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="end">Endereço</Label>
                  <Input id="end" value={form.endereco ?? ""} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} />
                </div>
                <div className="grid gap-4 rounded-md border p-3">
                  <div className="text-sm font-medium">Política de antecedência</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Modo</Label>
                      <Select
                        value={form.agendamento_antecedencia_modo}
                        onValueChange={(v) => setForm((p) => ({ ...p, agendamento_antecedencia_modo: v as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="horas">Horas</SelectItem>
                          <SelectItem value="proximo_dia">Próximo dia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Horas (quando modo = Horas)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={String(form.agendamento_antecedencia_horas ?? 0)}
                        disabled={form.agendamento_antecedencia_modo !== "horas"}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            agendamento_antecedencia_horas: Math.max(0, Number(e.target.value || 0)),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    “Horas”: exige X horas de antecedência. “Próximo dia”: bloqueia agendamentos para hoje.
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="submit" disabled={saveMutation.isPending || salaoQuery.isLoading}>
                    {saveMutation.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Horários do salão</CardTitle>
            </CardHeader>
            <CardContent>
              {!canEditDias ? (
                <div className="text-sm text-muted-foreground">Salve o salão primeiro para liberar os horários.</div>
              ) : diasQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando horários…</div>
              ) : diasQuery.error ? (
                <div className="text-sm text-destructive">Erro ao carregar horários.</div>
              ) : (
                <div className="grid gap-2">
                  {dias.map((d, idx) => (
                    <div key={d.dia_semana} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-6 sm:items-center">
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Checkbox
                          checked={!d.fechado}
                          onCheckedChange={(v) =>
                            setDias((prev) => {
                              const next = [...prev];
                              const aberto = Boolean(v);
                              next[idx] = {
                                ...next[idx],
                                fechado: !aberto,
                                abre_em: aberto ? next[idx].abre_em || "09:00" : "",
                                fecha_em: aberto ? next[idx].fecha_em || "18:00" : "",
                                intervalo_inicio: aberto ? next[idx].intervalo_inicio || "12:00" : "",
                                intervalo_fim: aberto ? next[idx].intervalo_fim || "13:00" : "",
                              };
                              return next;
                            })
                          }
                        />
                        <div className="text-sm font-medium">{diasLabel[d.dia_semana]}</div>
                        <div className="text-xs text-muted-foreground">{d.fechado ? "Fechado" : "Aberto"}</div>
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">Abre</Label>
                        <Input
                          type="time"
                          value={d.abre_em}
                          disabled={d.fechado}
                          onChange={(e) =>
                            setDias((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], abre_em: e.target.value };
                              return next;
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">Fecha</Label>
                        <Input
                          type="time"
                          value={d.fecha_em}
                          disabled={d.fechado}
                          onChange={(e) =>
                            setDias((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], fecha_em: e.target.value };
                              return next;
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">Intervalo início</Label>
                        <Input
                          type="time"
                          value={d.intervalo_inicio}
                          disabled={d.fechado}
                          onChange={(e) =>
                            setDias((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], intervalo_inicio: e.target.value };
                              return next;
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-xs">Intervalo fim</Label>
                        <Input
                          type="time"
                          value={d.intervalo_fim}
                          disabled={d.fechado}
                          onChange={(e) =>
                            setDias((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], intervalo_fim: e.target.value };
                              return next;
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}

                  <div className="text-xs text-muted-foreground">
                    Dica: os horários dos funcionários são cadastrados no módulo Funcionários e podem ser diferentes dos horários do salão.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <AvisosSemanaisCard salaoId={salaoQuery.data?.id} />
        </>
      ) : null}

      {!isStaffNonAdmin ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Configuração da IA</p>
                <p className="text-xs text-muted-foreground">
                  {currentPlanId === "pro_ia"
                    ? "Seu plano atual inclui onboarding da IA no próprio sistema."
                    : "Disponível apenas no plano PRO + IA."}
                </p>
              </div>
              <Button asChild size="sm" disabled={currentPlanId !== "pro_ia"}>
                <Link to="/configuracoes/ia" aria-label="Abrir configuração da IA">
                  <Bot className="h-4 w-4" />
                  Configurar IA
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Pagamento da assinatura</p>
                <p className="text-xs text-muted-foreground">Plano atual: {currentPlanLabel}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild size="sm">
                  <a href={checkoutCurrentPlan} target="_blank" rel="noreferrer" aria-label="Pagar assinatura no checkout">
                    Pagar plano atual
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={checkoutUpgradePlan} target="_blank" rel="noreferrer" aria-label="Alterar plano no checkout">
                    {upgradeLabel}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Suporte Nexus Automações</p>
                <p className="text-xs text-muted-foreground">WhatsApp: (48) 99101-5688</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Falar com suporte no WhatsApp">
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp suporte
                </a>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </FormPageShell>
  );
}