import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...(init?.headers ?? {}) },
  });
}

function badRequest(message: string) {
  return json({ ok: false, error: message }, { status: 400 });
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

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, code, password, confirmPassword } = (await req.json()) as {
      token?: string;
      code?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token || !token.trim()) return badRequest("token obrigatório");
    if (!code || !code.trim()) return badRequest("code obrigatório");
    if (!password) return badRequest("senha obrigatória");
    if (password !== confirmPassword) return badRequest("as senhas não conferem");
    const pwErr = validateStrongPassword(password);
    if (pwErr) return badRequest(pwErr);

    const sb = getServiceClient();
    const salao = await resolveSalaoByToken(sb, token);
    if (!salao) return json({ ok: false, error: "link inválido" }, { status: 400 });

    const codeHash = await sha256Hex(code.trim());
    const { data: reset, error: rErr } = await sb
      .from("portal_password_resets")
      .select("id,salao_id,email,expires_at,used_at")
      .eq("salao_id", salao.id)
      .eq("reset_token_hash", codeHash)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!reset) return json({ ok: false, error: "código inválido" }, { status: 400 });
    if (reset.used_at) return json({ ok: false, error: "código já usado" }, { status: 400 });
    if (new Date(String(reset.expires_at)).getTime() <= Date.now()) return json({ ok: false, error: "código expirado" }, { status: 400 });

    const emailNorm = normalizeEmail(String(reset.email));
    const { data: acc, error: accErr } = await sb
      .from("portal_accounts")
      .select("id")
      .eq("salao_id", salao.id)
      .eq("email_normalized", emailNorm)
      .maybeSingle();
    if (accErr) throw accErr;
    if (!acc) return json({ ok: false, error: "conta não encontrada" }, { status: 400 });

    const newHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    const { error: upErr } = await sb
      .from("portal_accounts")
      .update({ password_hash: newHash, updated_at: nowIso })
      .eq("id", acc.id);
    if (upErr) throw upErr;

    const { error: usedErr } = await sb.from("portal_password_resets").update({ used_at: nowIso }).eq("id", reset.id);
    if (usedErr) throw usedErr;

    // Revoga sessões ativas daquele portal_account dentro do mesmo salão
    await sb
      .from("portal_sessions")
      .update({ revoked_at: nowIso })
      .eq("salao_id", salao.id)
      .eq("portal_account_id", acc.id)
      .is("revoked_at", null);

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
