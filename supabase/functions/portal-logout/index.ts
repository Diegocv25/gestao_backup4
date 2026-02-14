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
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const { headers: corsHeaders, originAllowed } = buildCorsHeaders(req, { denyMode: "strict" });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!originAllowed) {
    return new Response(JSON.stringify({ ok: false, error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const sb = getServiceClient();
    const token = getBearer(req) || getCookie(req, "portal_session");
    if (token) {
      const hash = await sha256Hex(token);
      await sb
        .from("portal_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_token_hash", hash);
    }

    return json(
      req,
      { ok: true },
      {
        headers: {
          "Set-Cookie": clearSessionCookie(),
        },
      },
    );
  } catch (e: any) {
    return json(
      req,
      { ok: false, error: String(e?.message ?? e) },
      {
        status: 500,
        headers: { "Set-Cookie": clearSessionCookie() },
      },
    );
  }
});
