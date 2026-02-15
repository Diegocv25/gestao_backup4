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

serve(async (req) => {

  const { headers: corsHeaders, originAllowed } = buildCorsHeaders(req, { denyMode: "strict" });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!originAllowed) {
    return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { token, agendamento_id } = (await req.json()) as { token?: string; agendamento_id?: string };
    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });
    if (!agendamento_id) return json(req, { ok: false, error: "agendamento_id obrigatório" }, { status: 400 });

    const sb = getServiceClient();
    const auth = await requirePortalSession(sb, req, token);
    if (!auth.ok) return json(req, auth, { status: auth.status });

    const { data: cliente, error: cliErr } = await sb
      .from("clientes")
      .select("id,nome")
      .eq("salao_id", auth.salao.id)
      .eq("portal_account_id", auth.session.portal_account_id)
      .maybeSingle();
    if (cliErr) throw cliErr;
    if (!cliente) return json(req, { ok: false, error: "cadastro do cliente não encontrado" }, { status: 400 });

    const { data: ag, error: agErr } = await sb
      .from("agendamentos")
      .select(
        "id,data_hora_inicio,status,total_valor,total_duracao_minutos,funcionario:funcionarios(nome),itens:agendamento_itens(servico:servicos(nome))",
      )
      .eq("id", agendamento_id)
      .eq("salao_id", auth.salao.id)
      .eq("cliente_id", cliente.id)
      .maybeSingle();
    if (agErr) throw agErr;
    if (!ag) return json(req, { ok: false, error: "agendamento não encontrado" }, { status: 404 });

    return json(req, { ok: true, cliente, agendamento: ag });
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
