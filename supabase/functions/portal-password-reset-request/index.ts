import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";
import { getBaseUrl } from \"../_shared/base-url.ts\";

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

function base64Url(bytes: Uint8Array) {
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, email } = (await req.json()) as { token?: string; email?: string };
    if (!token || !token.trim()) return badRequest("token obrigatório");
    if (!email || !email.trim()) return badRequest("email obrigatório");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("Missing RESEND_API_KEY");

    const sb = getServiceClient();
    const salao = await resolveSalaoByToken(sb, token);
    // Anti-enumeração: mesmo retorno para token inválido
    if (!salao) return json({ ok: true });

    const emailNorm = normalizeEmail(email);
    const { data: acc, error: accErr } = await sb
      .from("portal_accounts")
      .select("id")
      .eq("salao_id", salao.id)
      .eq("email_normalized", emailNorm)
      .maybeSingle();
    if (accErr) throw accErr;

    // Sempre responder ok
    if (!acc) return json({ ok: true });

    const rawCode = randomToken(32);
    const codeHash = await sha256Hex(rawCode);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: insErr } = await sb.from("portal_password_resets").insert({
      salao_id: salao.id,
      email: email.trim(),
      reset_token_hash: codeHash,
      expires_at: expiresAt,
    });
    if (insErr) throw insErr;

    const authBase = getBaseUrl("auth").replace(/\/+$/, "");
    const resetUrl = `${authBase}/cliente/${encodeURIComponent(token.trim())}/resetar-senha?code=${encodeURIComponent(rawCode)}`;

    const emailPayload = {
      from: "Portal <onboarding@resend.dev>",
      to: [email.trim()],
      subject: `Redefinir senha - ${salao.nome}`,
      html: `
        <h2>Redefinição de senha</h2>
        <p>Você solicitou redefinir a senha do Portal do cliente do estabelecimento <strong>${salao.nome}</strong>.</p>
        <p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a></p>
        <p>Se você não solicitou, ignore este e-mail.</p>
        <p>Este link expira em 1 hora.</p>
      `,
    };

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Resend error: ${resp.status} ${text}`);
    }

    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
