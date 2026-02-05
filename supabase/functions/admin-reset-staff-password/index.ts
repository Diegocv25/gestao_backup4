// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

type Body = {
  funcionario_id?: string;
  temporary_password?: string;
};

function validatePassword(pwd: string) {
  if (pwd.length < 8) return "Mínimo 8 caracteres";
  if (pwd.length > 72) return "Senha muito longa";
  if (!/[A-Z]/.test(pwd)) return "Inclua ao menos 1 letra maiúscula";
  if (!/[0-9]/.test(pwd)) return "Inclua ao menos 1 número";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, { status: 405 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
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

  const funcionario_id = (body.funcionario_id ?? "").trim();
  const temporary_password = body.temporary_password ?? "";

  if (!funcionario_id) return json({ ok: false, error: "funcionario_id é obrigatório" }, { status: 400 });
  const pwdError = validatePassword(temporary_password);
  if (pwdError) return json({ ok: false, error: pwdError }, { status: 400 });

  // IMPORTANTE:
  // - Este client precisa usar SERVICE ROLE para poder resetar senha via Admin API
  // - NÃO podemos setar `global.headers.Authorization` com o JWT do usuário aqui,
  //   senão as chamadas Admin API herdam o JWT do usuário e retornam "User not allowed".
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // valida token do caller
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData?.user) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const callerId = authData.user.id;

  // descobre tenant + role do caller
  const { data: callerRoles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role,salao_id")
    .eq("user_id", callerId);

  if (rolesErr) return json({ ok: false, error: rolesErr.message }, { status: 500 });
  const allowed = (callerRoles ?? []).find((r: any) => r?.role === "admin" || r?.role === "gerente");
  if (!allowed?.salao_id) return json({ ok: false, error: "Forbidden" }, { status: 403 });

  const salaoId = allowed.salao_id as string;

  // busca funcionário no tenant
  const { data: func, error: funcErr } = await admin
    .from("funcionarios")
    .select("id,auth_user_id")
    .eq("id", funcionario_id)
    .eq("salao_id", salaoId)
    .maybeSingle();

  if (funcErr) return json({ ok: false, error: funcErr.message }, { status: 500 });
  if (!func) return json({ ok: false, error: "Funcionário não encontrado" }, { status: 404 });
  if (!func.auth_user_id) return json({ ok: false, error: "Funcionário não possui acesso configurado" }, { status: 400 });

  const { error: updErr } = await admin.auth.admin.updateUserById(func.auth_user_id as string, { password: temporary_password });
  if (updErr) return json({ ok: false, error: updErr.message }, { status: 500 });

  return json({ ok: true });
});
