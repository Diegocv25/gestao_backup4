// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { buildCorsHeaders } from "../_shared/cors.ts";

type JsonValue = Record<string, unknown>;

function json(body: JsonValue, init: ResponseInit = {}, cors: Record<string, string> = {}) {
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
  const { headers: corsHeaders, originAllowed } = buildCorsHeaders(req, { allowMethods: ["POST", "OPTIONS"] });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!originAllowed) return json({ ok: false, error: "origin_not_allowed" }, { status: 403 }, corsHeaders);
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 }, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const n8nFormUrl = Deno.env.get("N8N_RAG_FORM_URL") || "https://n8nfila-n8n-editor.elzqmm.easypanel.host/webhook/8f1f738c-8eb2-4ae2-8420-03cf583839df";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "missing_env" }, { status: 500 }, corsHeaders);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "missing_bearer" }, { status: 401 }, corsHeaders);
  }

  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ ok: false, error: "invalid_user" }, { status: 401 }, corsHeaders);
  }

  const user = userData.user;
  const email = String(user.email ?? "").toLowerCase();
  if (!email) return json({ ok: false, error: "missing_email" }, { status: 400 }, corsHeaders);

  const { data: roleRow, error: roleErr } = await admin
    .from("user_roles")
    .select("salao_id,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (roleErr || !roleRow?.salao_id) {
    return json({ ok: false, error: "tenant_not_found" }, { status: 403 }, corsHeaders);
  }

  const { data: subRow, error: subErr } = await admin
    .from("subscriptions")
    .select("status,product_id,product_name,updated_at")
    .eq("provider", "kiwify")
    .eq("customer_email", email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr || !isProIA(subRow)) {
    return json({ ok: false, error: "plan_not_allowed" }, { status: 403 }, corsHeaders);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString(); // 30 min

  const { error: tokenErr } = await admin.from("ia_onboarding_tokens").insert({
    token,
    user_id: user.id,
    salao_id: roleRow.salao_id,
    email,
    expires_at: expiresAt,
  });

  if (tokenErr) {
    return json({ ok: false, error: tokenErr.message }, { status: 500 }, corsHeaders);
  }

  const formUrl = `${n8nFormUrl}?onboarding_token=${encodeURIComponent(token)}&salao_id=${encodeURIComponent(roleRow.salao_id)}`;

  return json(
    {
      ok: true,
      salao_id: roleRow.salao_id,
      expires_at: expiresAt,
      form_url: formUrl,
    },
    { status: 200 },
    corsHeaders,
  );
});
