import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { buildCorsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, init?: ResponseInit) {
  const { headers: corsHeaders, originAllowed } = buildCorsHeaders(req, { denyMode: "strict" });
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveSalaoByToken(sb: ReturnType<typeof getServiceClient>, token: string) {
  const trimmed = (token ?? "").trim();
  if (!trimmed) return null;
  const { data, error } = await sb.rpc("portal_salao_by_token", { _token: trimmed });
  if (error) throw error;
  const first = (data ?? [])[0] as { id: string; nome: string; agendamento_antecedencia_horas: number } | undefined;
  return first ?? null;
}

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") ?? "";
  const parts = cookie.split(";").map((p) => p.trim());
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

function getBearer(req: Request) {
  const x = req.headers.get("x-portal-session") ?? "";
  const xToken = x.trim();
  if (xToken) return xToken;

  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SessionRow = {
  id: string;
  salao_id: string;
  portal_account_id: string;
  expires_at: string;
  revoked_at: string | null;
};

async function requirePortalSession(sb: ReturnType<typeof getServiceClient>, req: Request, token: string) {
  const salao = await resolveSalaoByToken(sb, token);
  if (!salao) return { ok: false as const, status: 400, error: "link inválido" };

  const sessionToken = getBearer(req) || getCookie(req, "portal_session");
  if (!sessionToken) return { ok: false as const, status: 401, error: "unauthorized" };

  const tokenHash = await sha256Hex(sessionToken);
  const { data: sess, error: sessErr } = await sb
    .from("portal_sessions")
    .select("id,salao_id,portal_account_id,expires_at,revoked_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle();
  if (sessErr) throw sessErr;
  if (!sess) return { ok: false as const, status: 401, error: "unauthorized" };

  const row = sess as SessionRow;
  const expired = new Date(String(row.expires_at)).getTime() <= Date.now();
  const revoked = !!row.revoked_at;
  const mismatch = String(row.salao_id) !== String(salao.id);
  if (expired || revoked || mismatch) {
    await sb.from("portal_sessions").update({ revoked_at: row.revoked_at ?? new Date().toISOString() }).eq("id", row.id);
    return { ok: false as const, status: 401, error: "unauthorized" };
  }

  return { ok: true as const, salao, session: row };
}

function parseTimeToMinutes(value: string) {
  const [h, m] = value.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function minutesToTime(minutes: number) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function buildAvailableSlots(params: {
  workStart: string;
  workEnd: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  slotStepMinutes?: number;
  serviceDurationMinutes: number;
  busy: Array<{ start: string; durationMinutes: number }>;
}) {
  const step = params.slotStepMinutes ?? 30;
  const workStartM = parseTimeToMinutes(params.workStart);
  const workEndM = parseTimeToMinutes(params.workEnd);
  const lunchStartM = params.lunchStart ? parseTimeToMinutes(params.lunchStart) : null;
  const lunchEndM = params.lunchEnd ? parseTimeToMinutes(params.lunchEnd) : null;

  const serviceDur = params.serviceDurationMinutes;
  const busyRanges = params.busy.map((b) => {
    const s = parseTimeToMinutes(b.start);
    return { start: s, end: s + b.durationMinutes };
  });

  const slots: string[] = [];
  for (let start = workStartM; start + serviceDur <= workEndM; start += step) {
    const end = start + serviceDur;
    if (lunchStartM != null && lunchEndM != null && overlaps(start, end, lunchStartM, lunchEndM)) continue;
    if (busyRanges.some((r) => overlaps(start, end, r.start, r.end))) continue;
    slots.push(minutesToTime(start));
  }
  return slots;
}

function parseDia(dia: string) {
  // dia: YYYY-MM-DD
  const [y, m, d] = dia.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, servico_id, funcionario_id, dia, tz_offset_minutes } = (await req.json()) as {
      token?: string;
      servico_id?: string;
      funcionario_id?: string;
      dia?: string;
      tz_offset_minutes?: number;
    };

    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });
    if (!servico_id) return json(req, { ok: false, error: "servico_id obrigatório" }, { status: 400 });
    if (!funcionario_id) return json(req, { ok: false, error: "funcionario_id obrigatório" }, { status: 400 });
    if (!dia) return json(req, { ok: false, error: "dia obrigatório" }, { status: 400 });

    const parsed = parseDia(dia);
    if (!parsed) return json(req, { ok: false, error: "dia inválido" }, { status: 400 });

    const tzOffset = Number.isFinite(tz_offset_minutes) ? Number(tz_offset_minutes) : 0;

    const sb = getServiceClient();
    const auth = await requirePortalSession(sb, req, token);
    if (!auth.ok) return json(req, auth, { status: auth.status });

    const { data: servico, error: servErr } = await sb
      .from("servicos")
      .select("id,duracao_minutos")
      .eq("id", servico_id)
      .eq("salao_id", auth.salao.id)
      .eq("ativo", true)
      .maybeSingle();
    if (servErr) throw servErr;
    if (!servico) return json(req, { ok: false, error: "serviço não encontrado" }, { status: 404 });

    // Garante que profissional atende o serviço
    const { data: mapRow, error: mapErr } = await sb
      .from("servicos_funcionarios")
      .select("id")
      .eq("servico_id", servico_id)
      .eq("funcionario_id", funcionario_id)
      .maybeSingle();
    if (mapErr) throw mapErr;
    if (!mapRow) return json(req, { ok: false, error: "profissional não atende este serviço" }, { status: 400 });

    // Horário do profissional no dia da semana
    const weekday = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).getUTCDay();
    const diaSemana = weekday === 0 ? 0 : weekday; // 0=Dom

    const { data: hf, error: hfErr } = await sb
      .from("horarios_funcionario")
      .select("inicio,fim,almoco_inicio,almoco_fim")
      .eq("funcionario_id", funcionario_id)
      .eq("dia_semana", diaSemana)
      .maybeSingle();
    if (hfErr) throw hfErr;
    if (!hf) return json(req, { ok: true, slots: [] });

    // Janela UTC correspondente ao dia LOCAL do usuário
    const startUtcMs = Date.UTC(parsed.y, parsed.m - 1, parsed.d, 0, 0, 0) + tzOffset * 60 * 1000;
    const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;

    const { data: ags, error: agErr } = await sb
      .from("agendamentos")
      .select("data_hora_inicio,total_duracao_minutos,status")
      .eq("salao_id", auth.salao.id)
      .eq("funcionario_id", funcionario_id)
      .neq("status", "cancelado")
      .gte("data_hora_inicio", new Date(startUtcMs).toISOString())
      .lt("data_hora_inicio", new Date(endUtcMs).toISOString());
    if (agErr) throw agErr;

    const busy = (ags ?? []).map((a: any) => {
      const dt = new Date(String(a.data_hora_inicio));
      // Converte UTC -> "local" do usuário usando tzOffset
      const localMs = dt.getTime() - tzOffset * 60 * 1000;
      const local = new Date(localMs);
      const hh = String(local.getUTCHours()).padStart(2, "0");
      const mm = String(local.getUTCMinutes()).padStart(2, "0");
      return { start: `${hh}:${mm}`, durationMinutes: Number(a.total_duracao_minutos) };
    });

    let slots = buildAvailableSlots({
      workStart: String(hf.inicio),
      workEnd: String(hf.fim),
      lunchStart: hf.almoco_inicio ?? null,
      lunchEnd: hf.almoco_fim ?? null,
      slotStepMinutes: 30,
      serviceDurationMinutes: Number(servico.duracao_minutos),
      busy,
    });

    // Antecedência (em horas) - aplicada no horário LOCAL
    const minStartMsLocal = Date.now() - tzOffset * 60 * 1000 + Number(auth.salao.agendamento_antecedencia_horas ?? 0) * 60 * 60 * 1000;
    const minStartLocal = new Date(minStartMsLocal);
    const minMinutesLocal = minStartLocal.getUTCHours() * 60 + minStartLocal.getUTCMinutes();

    // Se o dia é "hoje" no fuso do usuário, filtra slots menores que min
    const todayLocal = new Date(Date.now() - tzOffset * 60 * 1000);
    const sameDay =
      todayLocal.getUTCFullYear() === parsed.y && todayLocal.getUTCMonth() + 1 === parsed.m && todayLocal.getUTCDate() === parsed.d;
    if (sameDay) {
      slots = slots.filter((t) => parseTimeToMinutes(t) >= minMinutesLocal);
    }

    return json(req, { ok: true, slots });
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
