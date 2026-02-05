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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, email } = (await req.json()) as { token?: string; email?: string };
    if (!token || !token.trim()) return badRequest("token obrigatório");
    if (!email || !email.trim()) return badRequest("email obrigatório");

    const sb = getServiceClient();
    const salao = await resolveSalaoByToken(sb, token);
    if (!salao) return json({ ok: true, exists: false });

    const emailNorm = normalizeEmail(email);
    const { data, error } = await sb
      .from("portal_accounts")
      .select("id")
      .eq("salao_id", salao.id)
      .eq("email_normalized", emailNorm)
      .maybeSingle();
    if (error) throw error;

    return json({ ok: true, exists: !!data });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
});
