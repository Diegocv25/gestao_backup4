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

function badRequest(message: string) {
  // placeholder: req será injetado pelo call site
  return { ok: false, error: message };
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveSalaoByToken(sb: ReturnType<typeof getServiceClient>, token: string) {
  const trimmed = (token ?? "").trim();
  if (!trimmed) return null;
  const { data, error } = await sb.rpc("portal_salao_by_token", { _token: trimmed });
  if (error) throw error;
  const first = (data ?? [])[0] as { id: string; nome: string } | undefined;
  return first ?? null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateStrongPassword(password: string) {
  if (typeof password !== "string") return "Senha inválida";
  if (password.length < 8) return "Mínimo 8 caracteres";
  if (password.length > 72) return "Senha muito longa";
  if (!/[A-Z]/.test(password)) return "Inclua ao menos 1 letra maiúscula";
  if (!/[0-9]/.test(password)) return "Inclua ao menos 1 número";
  return null;
}

function base64Url(bytes: Uint8Array) {
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64(bytes: Uint8Array) {
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(bin);
}

async function pbkdf2Sha256(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password: string) {
  const iterations = 100_000;
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2Sha256(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${base64(salt)}$${base64(hash)}`;
}

function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64Url(arr);
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function setSessionCookie(token: string, maxAgeSeconds: number) {
  return `portal_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=None`;
}

function getBearer(req: Request) {
  const x = req.headers.get("x-portal-session") ?? "";
  const xToken = x.trim();
  if (xToken) return xToken;

  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token, email, password, confirmPassword } = (await req.json()) as {
      token?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });
    if (!email || !email.trim()) return json(req, { ok: false, error: "email obrigatório" }, { status: 400 });
    if (!password) return json(req, { ok: false, error: "senha obrigatória" }, { status: 400 });
    if (password !== confirmPassword) return json(req, { ok: false, error: "as senhas não conferem" }, { status: 400 });
    const pwErr = validateStrongPassword(password);
    if (pwErr) return json(req, { ok: false, error: pwErr }, { status: 400 });

    const sb = getServiceClient();
    const salao = await resolveSalaoByToken(sb, token);
    if (!salao) return json(req, { ok: false, error: "link inválido" }, { status: 400 });

    const emailNorm = normalizeEmail(email);
    const { data: existing, error: exErr } = await sb
      .from("portal_accounts")
      .select("id")
      .eq("salao_id", salao.id)
      .eq("email_normalized", emailNorm)
      .maybeSingle();
    if (exErr) throw exErr;
    if (existing) return json(req, { ok: false, error: "conta já existe" }, { status: 409 });

    // Se houver sessão anterior (cookie/header), revoga
    const prev = getBearer(req);
    if (prev) {
      const prevHash = await sha256Hex(prev);
      await sb.from("portal_sessions").update({ revoked_at: new Date().toISOString() }).eq("session_token_hash", prevHash);
    }

    const passwordHash = await hashPassword(password);
    const { data: created, error: insErr } = await sb
      .from("portal_accounts")
      .insert({ salao_id: salao.id, email: email.trim(), password_hash: passwordHash })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // Best-effort: se já existir um cliente neste salão com o mesmo email, vincula ao portal_account.
    await sb
      .from("clientes")
      .update({ portal_account_id: created.id })
      .eq("salao_id", salao.id)
      .ilike("email", emailNorm)
      .is("portal_account_id", null);

    // Fase 1 do fluxo: criar conta NÃO autentica automaticamente.
    // O usuário deve voltar para a tela de login e entrar com email/senha.
    return json(req, { ok: true });
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
