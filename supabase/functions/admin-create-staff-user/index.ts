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
  temporary_password: string;
  funcionario_id?: string;
};

type AppRole = "admin" | "gerente" | "recepcionista" | "profissional" | "staff";

function cargoToRole(cargo: string | null | undefined): AppRole | null {
  const c = String(cargo ?? "").trim().toLowerCase();
  if (!c) return null;
  if (c === "administrador") return "admin";
  if (c === "admin") return "admin";
  if (c === "gerente") return "gerente";
  if (c === "recepcionista") return "recepcionista";
  if (c === "profissional") return "profissional";
  // auxiliar (e qualquer outro) não tem acesso
  return null;
}

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  // Supabase Admin API não possui lookup direto por email em todas as versões.
  // Para MVP, fazemos paginação na listagem.
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = (data?.users ?? []).find((u: any) => String(u?.email ?? "").toLowerCase() === email);
    if (found?.id) return String(found.id);
    if ((data?.users ?? []).length < perPage) break;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const temporaryPassword = String(body.temporary_password ?? "");
  const funcionarioId = body.funcionario_id ? String(body.funcionario_id) : null;

  if (!email) return json({ error: "email is required" }, { status: 400 });
  if (!temporaryPassword || temporaryPassword.length < 6) return json({ error: "temporary_password must be at least 6 chars" }, { status: 400 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // valida caller
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData?.user) return json({ error: "Unauthorized" }, { status: 401 });
  const callerId = callerData.user.id;

  // Descobre tenant (salao_id) do caller e valida admin
  const { data: callerRoles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role,salao_id,created_at")
    .eq("user_id", callerId)
    .order("created_at", { ascending: true });
  if (rolesErr) return json({ error: rolesErr.message }, { status: 400 });

  const salaoId = callerRoles?.[0]?.salao_id as string | undefined;
  const isAdmin = (callerRoles ?? []).some((r: any) => r.role === "admin" && r.salao_id === salaoId);
  if (!salaoId || !isAdmin) return json({ error: "Forbidden" }, { status: 403 });

  // role vem do cadastro do funcionário (carga)
  if (!funcionarioId) return json({ error: "funcionario_id is required" }, { status: 400 });
  const { data: func, error: funcErr } = await admin
    .from("funcionarios")
    .select("id,carga,auth_user_id")
    .eq("id", funcionarioId)
    .eq("salao_id", salaoId)
    .maybeSingle();
  if (funcErr) return json({ error: funcErr.message }, { status: 400 });
  if (!func) return json({ error: "Funcionário não encontrado" }, { status: 404 });

  const desiredRole = cargoToRole(func.carga);
  if (!desiredRole) return json({ error: "Este cargo não possui acesso ao sistema" }, { status: 400 });

  // cria ou reaproveita usuário existente por email
  let userId: string | null = null;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password: temporaryPassword, email_confirm: true });
  if (createErr) {
    const msg = String(createErr.message ?? "");
    if (msg.toLowerCase().includes("already") && msg.toLowerCase().includes("registered")) {
      userId = await findUserIdByEmail(admin, email);
      if (!userId) return json({ error: "Usuário já existe, mas não foi possível localizá-lo para atualizar." }, { status: 400 });
      const { error: updPwdErr } = await admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
      if (updPwdErr) return json({ error: updPwdErr.message }, { status: 400 });
    } else {
      return json({ error: createErr.message }, { status: 400 });
    }
  } else {
    userId = created.user?.id ? String(created.user.id) : null;
  }
  if (!userId) return json({ error: "Failed to create/update user" }, { status: 500 });

  // role no tenant (mantém apenas 1 linha por user_id+salao_id)
  const { data: existingRoles, error: exRoleErr } = await admin
    .from("user_roles")
    .select("id,created_at")
    .eq("user_id", userId)
    .eq("salao_id", salaoId)
    .order("created_at", { ascending: true });
  if (exRoleErr) return json({ error: exRoleErr.message }, { status: 400 });

  const firstRoleId = existingRoles?.[0]?.id as string | undefined;
  if (firstRoleId) {
    const { error: updRoleErr } = await admin.from("user_roles").update({ role: desiredRole }).eq("id", firstRoleId);
    if (updRoleErr) return json({ error: updRoleErr.message }, { status: 400 });

    const extraIds = (existingRoles ?? []).slice(1).map((r: any) => r.id).filter(Boolean);
    if (extraIds.length) {
      const { error: delErr } = await admin.from("user_roles").delete().in("id", extraIds);
      if (delErr) return json({ error: delErr.message }, { status: 400 });
    }
  } else {
    const { error: insErr } = await admin.from("user_roles").insert({ user_id: userId, role: desiredRole, salao_id: salaoId });
    if (insErr) return json({ error: insErr.message }, { status: 400 });
  }

  // vincula no funcionario (se informado)
  if (funcionarioId) {
    const { error: updErr } = await admin
      .from("funcionarios")
      .update({ auth_user_id: userId })
      .eq("id", funcionarioId)
      .eq("salao_id", salaoId);
    if (updErr) return json({ error: updErr.message }, { status: 400 });
  }

  return json({ ok: true, user_id: userId });
});
