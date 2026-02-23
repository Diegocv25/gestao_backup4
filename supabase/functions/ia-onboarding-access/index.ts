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
  // Formulário agora é servido pelo próprio front (Vercel) para evitar execuções no n8n a cada carregamento do iframe.
  // O n8n fica apenas no submit (ia-onboarding-submit → n8n ingest).
  const frontendBaseUrl = Deno.env.get("FRONTEND_BASE_URL") || req.headers.get("origin") || "https://gestaobackup4.vercel.app";

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

  // Reutiliza token ainda válido para evitar recarregar o iframe no meio do preenchimento.
  // (React Query / eventos de sessão podem re-chamar a edge function.)
  const nowIso = new Date().toISOString();
  const { data: existingTokenRow, error: existingTokenErr } = await admin
    .from("ia_onboarding_tokens")
    .select("token,expires_at")
    .eq("user_id", user.id)
    .eq("salao_id", roleRow.salao_id)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTokenErr) {
    return json({ ok: false, error: existingTokenErr.message }, { status: 500 }, corsHeaders);
  }

  const token = existingTokenRow?.token ?? crypto.randomUUID();
  // Aumenta a janela: o formulário diz 30–45 min, então 2h dá folga.
  const expiresAt = existingTokenRow?.expires_at ?? new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(); // 2h

  if (!existingTokenRow) {
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
  }

  const formUrl = `${frontendBaseUrl.replace(/\/$/, "")}/elisa-form-v2.html?onboarding_token=${encodeURIComponent(token)}&salao_id=${encodeURIComponent(roleRow.salao_id)}`;

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
