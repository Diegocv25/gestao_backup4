import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = /^(https:\/\/.*\.(lovable\.app|lovableproject\.com)|http:\/\/localhost(:\d+)?)$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://id-preview--2195ef19-036f-4926-9a8e-4b3085c4a170.lovable.app",
    Vary: "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-portal-session",
  };
}

function json(req: Request, data: unknown, init?: ResponseInit) {
  const corsHeaders = getCorsHeaders(req);
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
  const first = (data ?? [])[0] as { id: string; nome: string } | undefined;
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

function parseDia(dia: string) {
  const [y, m, d] = dia.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function parseHora(hora: string) {
  const [h, m] = hora.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const { token, servico_id, funcionario_id, dia, hora, tz_offset_minutes } = (await req.json()) as {
      token?: string;
      servico_id?: string;
      funcionario_id?: string;
      dia?: string;
      hora?: string;
      tz_offset_minutes?: number;
    };

    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });
    if (!servico_id) return json(req, { ok: false, error: "servico_id obrigatório" }, { status: 400 });
    if (!funcionario_id) return json(req, { ok: false, error: "funcionario_id obrigatório" }, { status: 400 });
    if (!dia) return json(req, { ok: false, error: "dia obrigatório" }, { status: 400 });
    if (!hora) return json(req, { ok: false, error: "hora obrigatório" }, { status: 400 });

    const diaP = parseDia(dia);
    const horaP = parseHora(hora);
    if (!diaP || !horaP) return json(req, { ok: false, error: "data/hora inválida" }, { status: 400 });

    const tzOffset = Number.isFinite(tz_offset_minutes) ? Number(tz_offset_minutes) : 0;
    const startUtcMs = Date.UTC(diaP.y, diaP.m - 1, diaP.d, horaP.h, horaP.m, 0) + tzOffset * 60 * 1000;
    const startUtcIso = new Date(startUtcMs).toISOString();

    const sb = getServiceClient();
    const auth = await requirePortalSession(sb, req, token);
    if (!auth.ok) return json(req, auth, { status: auth.status });

    const { data: cliente, error: cliErr } = await sb
      .from("clientes")
      .select("id")
      .eq("salao_id", auth.salao.id)
      .eq("portal_account_id", auth.session.portal_account_id)
      .maybeSingle();
    if (cliErr) throw cliErr;
    if (!cliente) return json(req, { ok: false, error: "cadastro do cliente não encontrado neste salão" }, { status: 400 });

    const { data: servico, error: servErr } = await sb
      .from("servicos")
      .select("id,nome,valor,duracao_minutos")
      .eq("id", servico_id)
      .eq("salao_id", auth.salao.id)
      .eq("ativo", true)
      .maybeSingle();
    if (servErr) throw servErr;
    if (!servico) return json(req, { ok: false, error: "serviço não encontrado" }, { status: 404 });

    // Confere se profissional atende serviço
    const { data: mapRow, error: mapErr } = await sb
      .from("servicos_funcionarios")
      .select("id")
      .eq("servico_id", servico_id)
      .eq("funcionario_id", funcionario_id)
      .maybeSingle();
    if (mapErr) throw mapErr;
    if (!mapRow) return json(req, { ok: false, error: "profissional não atende este serviço" }, { status: 400 });

    // Checa conflito (sobreposição)
    const dur = Number(servico.duracao_minutos);
    const endUtcMs = startUtcMs + dur * 60 * 1000;

    // Busca agendamentos do mesmo profissional no mesmo dia (janela ampla)
    const dayStartUtcMs = Date.UTC(diaP.y, diaP.m - 1, diaP.d, 0, 0, 0) + tzOffset * 60 * 1000;
    const dayEndUtcMs = dayStartUtcMs + 24 * 60 * 60 * 1000;

    const { data: ags, error: agErr } = await sb
      .from("agendamentos")
      .select("data_hora_inicio,total_duracao_minutos,status")
      .eq("salao_id", auth.salao.id)
      .eq("funcionario_id", funcionario_id)
      .neq("status", "cancelado")
      .gte("data_hora_inicio", new Date(dayStartUtcMs).toISOString())
      .lt("data_hora_inicio", new Date(dayEndUtcMs).toISOString());
    if (agErr) throw agErr;

    const hasConflict = (ags ?? []).some((a: any) => {
      const s = new Date(String(a.data_hora_inicio)).getTime();
      const e = s + Number(a.total_duracao_minutos) * 60 * 1000;
      return rangesOverlap(startUtcMs, endUtcMs, s, e);
    });

    if (hasConflict) {
      return json(req, { ok: false, error: "Este horário já está ocupado para este profissional." }, { status: 409 });
    }

    const totalValor = Number(servico.valor);

    const { data: created, error: insErr } = await sb
      .from("agendamentos")
      .insert({
        salao_id: auth.salao.id,
        cliente_id: cliente.id,
        funcionario_id,
        data_hora_inicio: startUtcIso,
        total_duracao_minutos: dur,
        total_valor: totalValor,
        status: "marcado",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { error: itemErr } = await sb.from("agendamento_itens").insert({
      agendamento_id: created.id,
      servico_id,
      duracao_minutos: dur,
      valor: totalValor,
    });
    if (itemErr) throw itemErr;

    return json(req, { ok: true, agendamento_id: created.id });
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
