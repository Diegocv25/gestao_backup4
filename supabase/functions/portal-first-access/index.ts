// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders, ...(init.headers ?? {}) },
    ...init,
  });
}

type Body = {
  token: string;
  email: string;
  password: string;
};

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
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

function isStrongPassword(pwd: string) {
  // espelha src/lib/password-policy.ts (server-side)
  if (pwd.length < 8 || pwd.length > 72) return false;
  if (!/[A-Z]/.test(pwd)) return false;
  if (!/[0-9]/.test(pwd)) return false;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false }, { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false }, { status: 500 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  // validações mínimas (sem vazar detalhes)
  if (!token || token.length > 200) return json({ ok: false }, { status: 400 });
  if (!email || email.length > 255 || !email.includes("@")) return json({ ok: false }, { status: 400 });
  if (!isStrongPassword(password)) return json({ ok: false }, { status: 400 });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // valida token do estabelecimento
  try {
    const { data, error } = await admin.rpc("portal_salao_by_token", { _token: token });
    if (error) throw error;
    const salao = (data ?? [])[0] as any;
    if (!salao?.id) return json({ ok: false }, { status: 400 });
  } catch {
    return json({ ok: false }, { status: 400 });
  }

  // cria ou atualiza senha global (anti-enumeração: resposta sempre igual)
  try {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      const msg = String(createErr.message ?? "").toLowerCase();
      // Supabase costuma retornar "User already registered"
      if (msg.includes("already") && msg.includes("registered")) {
        const userId = await findUserIdByEmail(admin, email);
        if (userId) {
          await admin.auth.admin.updateUserById(userId, { password });
        }
      }
      // qualquer erro: ainda assim não revelamos (retorna ok genérico)
      return json({ ok: true }, { status: 200 });
    }

    // usuário criado (não precisamos retornar id)
    void created;
    return json({ ok: true }, { status: 200 });
  } catch {
    return json({ ok: true }, { status: 200 });
  }
});
