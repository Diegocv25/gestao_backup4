// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { buildCorsHeaders } from "../_shared/cors.ts";

function json(body: Record<string, unknown>, init: ResponseInit = {}, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...cors,
      ...(init.headers ?? {}),
    },
  });
}

function isProIA(sub: any) {
  const status = String(sub?.status ?? "").toLowerCase();
  const active = ["active", "trialing", "late_grace"].includes(status);
  if (!active) return false;
  const pid = String(sub?.product_id ?? "").toLowerCase();
  const pname = String(sub?.product_name ?? "").toLowerCase();
  return pid.includes("pro_ia") || (pname.includes("pro") && pname.includes("ia"));
}

serve(async (req) => {
  const { headers: corsHeaders, originAllowed } = buildCorsHeaders(req, { allowMethods: ["POST", "OPTIONS"], denyMode: "fallback-null" });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!originAllowed) return json({ ok: false, error: "origin_not_allowed" }, { status: 403 }, corsHeaders);
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 }, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const n8nIngestUrl = Deno.env.get("N8N_RAG_INGEST_URL") || "https://n8nfila-n8n-webhook.elzqmm.easypanel.host/webhook/retorno_html";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "missing_env" }, { status: 500 }, corsHeaders);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 }, corsHeaders);
  }

  const token = String(body?.onboarding_token ?? "").trim();
  if (!token) return json({ ok: false, error: "missing_onboarding_token" }, { status: 400 }, corsHeaders);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: tokenRow, error: tokenErr } = await admin
    .from("ia_onboarding_tokens")
    .select("token,salao_id,email,expires_at,used_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRow) return json({ ok: false, error: "invalid_token" }, { status: 403 }, corsHeaders);
  if (tokenRow.used_at) return json({ ok: false, error: "token_already_used" }, { status: 403 }, corsHeaders);
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) return json({ ok: false, error: "token_expired" }, { status: 403 }, corsHeaders);

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("status,product_id,product_name,updated_at")
    .eq("provider", "kiwify")
    .eq("customer_email", tokenRow.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!isProIA(subRow)) return json({ ok: false, error: "plan_not_allowed" }, { status: 403 }, corsHeaders);

  const payload = {
    ...body,
    salao_id: tokenRow.salao_id,
    _validated_by: "ia-onboarding-submit",
  };

  const n8nResp = await fetch(n8nIngestUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!n8nResp.ok) {
    return json({ ok: false, error: `n8n_ingest_failed_${n8nResp.status}` }, { status: 502 }, corsHeaders);
  }

  await admin.from("ia_onboarding_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);

  return json({ ok: true, salao_id: tokenRow.salao_id }, { status: 200 }, corsHeaders);
});
