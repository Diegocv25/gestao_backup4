// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

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
  salao_nome?: string;
};

function validateEmail(email: string) {
  // validação simples (suficiente para bloquear entradas claramente inválidas)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pwd: string) {
  if (pwd.length < 8) return "Mínimo 8 caracteres";
  if (pwd.length > 72) return "Senha muito longa";
  if (!/[A-Z]/.test(pwd)) return "Inclua ao menos 1 letra maiúscula";
  if (!/[0-9]/.test(pwd)) return "Inclua ao menos 1 número";
  return null;
}

function cleanText(v: unknown, max = 120) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.slice(0, max);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const salaoNome = cleanText(body.salao_nome, 120);

  if (!email) return json({ ok: false, error: "email é obrigatório" }, { status: 400 });
  if (!validateEmail(email)) return json({ ok: false, error: "email inválido" }, { status: 400 });
  const pwdError = validatePassword(password);
  if (pwdError) return json({ ok: false, error: pwdError }, { status: 400 });

  // Admin client (service role) – bypass RLS e permite criar usuário no Auth.
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 1) cria usuário no Auth (email+senha)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    const m = String(createErr.message ?? "");
    // mensagem amigável para email já existente
    if (m.toLowerCase().includes("already") && m.toLowerCase().includes("registered")) {
      return json({ ok: false, code: "email_exists", error: "Este email já está cadastrado." }, { status: 409 });
    }
    return json({ ok: false, error: m }, { status: 400 });
  }

  const userId = created.user?.id;
  if (!userId) return json({ ok: false, error: "Falha ao criar usuário" }, { status: 500 });

  // 2) cria salão vinculado ao usuário (created_by_user_id)
  const salaoPayload: Record<string, any> = {
    nome: salaoNome || "Meu estabelecimento",
    created_by_user_id: userId,
  };

  const { data: salao, error: salaoErr } = await admin.from("saloes").insert([salaoPayload]).select("id").maybeSingle();
  if (salaoErr) return json({ ok: false, error: salaoErr.message }, { status: 400 });
  const salaoId = salao?.id;
  if (!salaoId) return json({ ok: false, error: "Falha ao criar salão" }, { status: 500 });

  // 3) atribui admin no tenant criado
  const { error: roleErr } = await admin.from("user_roles").insert([{ user_id: userId, role: "admin", salao_id: salaoId }]);
  if (roleErr) return json({ ok: false, error: roleErr.message }, { status: 400 });

  return json({ ok: true, user_id: userId, salao_id: salaoId });
});
