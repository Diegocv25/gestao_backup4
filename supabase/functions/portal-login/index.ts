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

function fromBase64(str: string) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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

async function verifyPassword(password: string, stored: string) {
  // format: pbkdf2$sha256$<iter>$<salt_b64>$<hash_b64>
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iterations = Number(parts[2]);
  if (!Number.isFinite(iterations) || iterations < 10_000) return false;
  const salt = fromBase64(parts[3]);
  const expected = fromBase64(parts[4]);
  const actual = await pbkdf2Sha256(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
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

function clearSessionCookie() {
  return `portal_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`;
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
    const { token, email, password } = (await req.json()) as { token?: string; email?: string; password?: string };
    if (!token || !token.trim()) return json(req, { ok: false, error: "token obrigatório" }, { status: 400 });
    if (!email || !email.trim()) return json(req, { ok: false, error: "email obrigatório" }, { status: 400 });
    if (!password) return json(req, { ok: false, error: "senha obrigatória" }, { status: 400 });

    const sb = getServiceClient();
    const salao = await resolveSalaoByToken(sb, token);
    if (!salao) return json(req, { ok: false, error: "link inválido" }, { status: 400 });

    // Se houver cookie anterior, revoga (evita reuso indevido)
    const prev = getCookie(req, "portal_session");
    const prevHeader = getBearer(req);
    const prevToken = prevHeader || prev;
    if (prevToken) {
      const prevHash = await sha256Hex(prevToken);
      await sb
        .from("portal_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_token_hash", prevHash);
    }

    const emailNorm = normalizeEmail(email);
    const { data: acc, error: accErr } = await sb
      .from("portal_accounts")
      .select("id,password_hash")
      .eq("salao_id", salao.id)
      .eq("email_normalized", emailNorm)
      .maybeSingle();
    if (accErr) throw accErr;
    if (!acc) return json(req, { ok: false, error: "cadastro necessário" }, { status: 401 });

    const okPass = await verifyPassword(password, String(acc.password_hash));
    if (!okPass) return json(req, { ok: false, error: "senha inválida" }, { status: 401 });

    // Best-effort: vincula um cliente existente deste salão pelo email (sem criar cadastro automático)
    // Mantém isolamento por salão e reduz fricção quando o salão já tinha cliente pré-cadastrado.
    await sb
      .from("clientes")
      .update({ portal_account_id: acc.id })
      .eq("salao_id", salao.id)
      .ilike("email", emailNorm)
      .is("portal_account_id", null);

    const sessionToken = randomToken(32);
    const sessionHash = await sha256Hex(sessionToken);
    const maxAgeSeconds = 60 * 60 * 24 * 30; // 30 dias
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();

    const { error: insErr } = await sb.from("portal_sessions").insert({
      salao_id: salao.id,
      portal_account_id: acc.id,
      session_token_hash: sessionHash,
      expires_at: expiresAt,
    });
    if (insErr) throw insErr;

    return json(
      req,
      { ok: true, session_token: sessionToken },
      {
        headers: {
          "Set-Cookie": setSessionCookie(sessionToken, maxAgeSeconds),
        },
      },
    );
  } catch (e: any) {
    return json(req, { ok: false, error: String(e?.message ?? e) }, { status: 500, headers: { "Set-Cookie": clearSessionCookie() } });
  }
});
