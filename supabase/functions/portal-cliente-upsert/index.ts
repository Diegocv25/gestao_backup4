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

function parseDataNascimento(value: string | undefined) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const parts = v.split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime()) || d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return iso;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!originAllowed) {
    return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { token, nome, telefone, data_nascimento } = (await req.json()) as {
      token?: string;
      nome?: string;
      telefone?: string;
      data_nascimento?: string;
    };

    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });
    if (!nome || !nome.trim()) return json(req, { ok: false, error: "nome obrigatório" }, { status: 400 });

    const sb = getServiceClient();
    const auth = await requirePortalSession(sb, req, token);
    if (!auth.ok) return json(req, auth, { status: auth.status });

    const { data: acc, error: accErr } = await sb
      .from("portal_accounts")
      .select("id,email")
      .eq("id", auth.session.portal_account_id)
      .maybeSingle();
    if (accErr) throw accErr;
    if (!acc) return json(req, { ok: false, error: "conta não encontrada" }, { status: 400 });

    const emailNorm = String(acc.email ?? "").trim();

    // Se já existe cliente vinculado a esta conta, atualiza; senão, cria.
    const { data: existing, error: exErr } = await sb
      .from("clientes")
      .select("id")
      .eq("salao_id", auth.salao.id)
      .eq("portal_account_id", auth.session.portal_account_id)
      .maybeSingle();
    if (exErr) throw exErr;

    // Premissas do cadastro (mesmo comportamento do backoffice): email único por salão.
    if (emailNorm) {
      let q = sb.from("clientes").select("id").eq("salao_id", auth.salao.id).ilike("email", emailNorm).limit(1);
      if (existing?.id) q = q.neq("id", existing.id);
      const { data: dup, error: dupErr } = await q.maybeSingle();
      if (dupErr) throw dupErr;
      if (dup) return json(req, { ok: false, error: "Já existe um cliente com este email neste salão." }, { status: 409 });
    }

    const birthIso = parseDataNascimento(data_nascimento);
    if (data_nascimento && data_nascimento.trim() && !birthIso) {
      return json(req, { ok: false, error: "data de nascimento inválida" }, { status: 400 });
    }

    const payload = {
      id: existing?.id,
      salao_id: auth.salao.id,
      portal_account_id: auth.session.portal_account_id,
      nome: nome.trim(),
      telefone: String(telefone ?? "").trim() || null,
      email: emailNorm || null,
      data_nascimento: birthIso,
    };

    const { data: saved, error: upErr } = await sb.from("clientes").upsert(payload).select("id").single();
    if (upErr) throw upErr;

    return json(req, { ok: true, cliente_id: saved.id });
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
