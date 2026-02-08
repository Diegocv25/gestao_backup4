import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = /^(https:\/\/.*\.(lovable\.app|lovableproject\.com)|http:\/\/localhost(:\d+)?)$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://id-preview--2195ef19-036f-4926-9a8e-4b3085c4a170.lovable.app",
    "Vary": "Origin",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });

    const sb = getServiceClient();
    const salao = await resolveSalaoByToken(sb, token);
    if (!salao) return json(req, { ok: false, error: "link inválido" }, { status: 400 });

    const sessionToken = getBearer(req) || getCookie(req, "portal_session");
    if (!sessionToken) return json(req, { ok: false, error: "unauthorized" }, { status: 401 });

    const tokenHash = await sha256Hex(sessionToken);
    const { data: sess, error: sessErr } = await sb
      .from("portal_sessions")
      .select("id,salao_id,portal_account_id,expires_at,revoked_at")
      .eq("session_token_hash", tokenHash)
      .maybeSingle();
    if (sessErr) throw sessErr;
    if (!sess) return json(req, { ok: false, error: "unauthorized" }, { status: 401 });

    const expired = new Date(String(sess.expires_at)).getTime() <= Date.now();
    const revoked = !!sess.revoked_at;
    const mismatch = String(sess.salao_id) !== String(salao.id);
    if (expired || revoked || mismatch) {
      await sb.from("portal_sessions").update({ revoked_at: sess.revoked_at ?? new Date().toISOString() }).eq("id", sess.id);
      return json(req, { ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { data: cliente, error: cliErr } = await sb
      .from("clientes")
      .select("id,nome")
      .eq("salao_id", salao.id)
      .eq("portal_account_id", sess.portal_account_id)
      .maybeSingle();
    if (cliErr) throw cliErr;

    if (!cliente) {
      return json(req, { ok: true, cliente: null, agendamentos: [] });
    }

    const { data: ags, error: agErr } = await sb
      .from("agendamentos")
      .select(
        "id,data_hora_inicio,status,total_valor,total_duracao_minutos,funcionario_id,itens:agendamento_itens(servico:servicos(nome))",
      )
      .eq("cliente_id", cliente.id)
      .order("data_hora_inicio", { ascending: false })
      .limit(100);
    if (agErr) throw agErr;

    return json(req, { ok: true, cliente, agendamentos: ags ?? [] });
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
