// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders, ...(init.headers ?? {}) },
    ...init,
  });
}

type Body = {
  email: string;
  password: string;
};

function validatePassword(pwd: string) {
  if (pwd.length < 8) return "Mínimo 8 caracteres";
  if (pwd.length > 72) return "Senha muito longa";
  if (!/[A-Z]/.test(pwd)) return "Inclua ao menos 1 letra maiúscula";
  if (!/[0-9]/.test(pwd)) return "Inclua ao menos 1 número";
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "Missing Authorization header" }, { status: 401 });
  }
  const token = authHeader.replace(/bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "Missing Authorization token" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email) return json({ ok: false, error: "email é obrigatório" }, { status: 400 });
  const pwdError = validatePassword(password);
  if (pwdError) return json({ ok: false, error: pwdError }, { status: 400 });

  // Admin client (service role) – NÃO herdar JWT do usuário.
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // valida token do caller
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // apenas usuários com role admin (em qualquer tenant) podem criar novos logins de teste
  const { data: roles, error: rolesErr } = await admin.from("user_roles").select("role").eq("user_id", callerData.user.id);
  if (rolesErr) return json({ ok: false, error: rolesErr.message }, { status: 500 });
  const isAdmin = (roles ?? []).some((r: any) => r?.role === "admin");
  if (!isAdmin) return json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    const m = String(error.message ?? "");
    // se já existe, retorna ok (não atualiza senha por segurança)
    if (m.toLowerCase().includes("already") && m.toLowerCase().includes("registered")) {
      return json({ ok: true, already_exists: true });
    }
    return json({ ok: false, error: m }, { status: 400 });
  }

  return json({ ok: true, user_id: created.user?.id ?? null });
});
