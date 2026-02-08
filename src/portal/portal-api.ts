const SUPABASE_URL = "https://idampxfbqakcdamqxgqe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkYW1weGZicWFrY2RhbXF4Z3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjIwMzMsImV4cCI6MjA4NTQ5ODAzM30.Rvd4TRq97Ee4-cooiBLJAzFQcatDWxCWQQb1OxGuxLw";

const BASE = `${SUPABASE_URL}/functions/v1`;

const STORAGE_KEY = "portal:session_token";

export function getPortalSessionToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPortalSessionToken(token: string | null) {
  try {
    if (!token) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

async function portalPost<T>(path: string, body: unknown): Promise<T> {
  const sessionToken = getPortalSessionToken();

  const resp = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      // Sempre envie Authorization para satisfazer o gateway do Supabase.
      // - Com sessão: Bearer <portal_session_token>
      // - Sem sessão (primeiro acesso/login): Bearer <anon_key>
      Authorization: `Bearer ${sessionToken ?? SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = (await resp.json().catch(() => null)) as any;
  if (!resp.ok) {
    const msg = data?.error || `Erro HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export type PortalMeResponse =
  | {
      ok: true;
      authenticated: true;
      salao: { id: string; nome: string };
      portal_account: { id: string; email: string | null };
      cliente?: { id: string; nome: string; telefone: string | null; email: string | null; data_nascimento: string | null } | null;
    }
  | { ok: true; authenticated: false; salao?: { id: string; nome: string } }
  | { ok: false; error: string };

export async function portalMe(token: string) {
  return portalPost<PortalMeResponse>("portal-me", { token });
}

export async function portalClienteUpsert(vars: {
  token: string;
  nome: string;
  telefone?: string;
  data_nascimento?: string; // dd/mm/yyyy
}) {
  return portalPost<{ ok: boolean; error?: string; cliente_id?: string }>("portal-cliente-upsert", vars);
}

export async function portalLogin(vars: { token: string; email: string; password: string }) {
  return portalPost<{ ok: boolean; error?: string; session_token?: string }>("portal-login", vars);
}

export async function portalRegister(vars: { token: string; email: string; password: string; confirmPassword: string }) {
  return portalPost<{ ok: boolean; error?: string; session_token?: string }>("portal-register", vars);
}

export async function portalLogout() {
  return portalPost<{ ok: boolean; error?: string }>("portal-logout", {});
}

export async function portalPasswordResetRequest(vars: { token: string; email: string }) {
  return portalPost<{ ok: boolean; error?: string }>("portal-password-reset-request", vars);
}

export async function portalPasswordResetConfirm(vars: {
  token: string;
  code: string;
  password: string;
  confirmPassword: string;
}) {
  return portalPost<{ ok: boolean; error?: string }>("portal-password-reset-confirm", vars);
}

export type PortalServico = { id: string; nome: string; duracao_minutos: number; valor: number };
export async function portalServicosList(token: string) {
  return portalPost<{ ok: boolean; error?: string; servicos?: PortalServico[] }>("portal-servicos-list", { token });
}

export type PortalAgendamentoRow = {
  id: string;
  data_hora_inicio: string;
  status: string;
  total_valor: number;
  total_duracao_minutos: number;
  funcionario_id: string;
  itens?: Array<{ servico?: { nome?: string } }>;
};

export async function portalAgendamentosList(token: string) {
  return portalPost<{
    ok: boolean;
    error?: string;
    cliente?: { id: string; nome: string } | null;
    agendamentos?: PortalAgendamentoRow[];
  }>("portal-agendamentos-list", { token });
}

export type PortalProfissional = { id: string; nome: string };
export async function portalProfissionaisByServico(vars: { token: string; servico_id: string }) {
  return portalPost<{ ok: boolean; error?: string; profissionais?: PortalProfissional[] }>("portal-profissionais-by-servico", vars);
}

export async function portalProfissionalDias(vars: { token: string; funcionario_id: string }) {
  return portalPost<{ ok: boolean; error?: string; dias?: number[] }>("portal-profissional-dias", vars);
}

export async function portalAvailableSlots(vars: {
  token: string;
  servico_id: string;
  funcionario_id: string;
  dia: string; // YYYY-MM-DD
  tz_offset_minutes: number;
}) {
  return portalPost<{ ok: boolean; error?: string; slots?: string[] }>("portal-available-slots", vars);
}

export async function portalAgendamentoCreate(vars: {
  token: string;
  servico_id: string;
  funcionario_id: string;
  dia: string; // YYYY-MM-DD
  hora: string; // HH:mm
  tz_offset_minutes: number;
}) {
  return portalPost<{ ok: boolean; error?: string; agendamento_id?: string }>("portal-agendamento-create", vars);
}

export async function portalAgendamentoGet(vars: { token: string; agendamento_id: string }) {
  return portalPost<{
    ok: boolean;
    error?: string;
    cliente?: { id: string; nome: string };
    agendamento?: any;
  }>("portal-agendamento-get", vars);
}

export async function portalAgendamentoCancel(vars: { token: string; agendamento_id: string }) {
  return portalPost<{ ok: boolean; error?: string; status?: string }>("portal-agendamento-cancel", vars);
}

export async function portalAgendamentoUpdate(vars: {
  token: string;
  agendamento_id: string;
  servico_id: string;
  funcionario_id: string;
  dia: string; // YYYY-MM-DD
  hora: string; // HH:mm
  tz_offset_minutes: number;
}) {
  return portalPost<{ ok: boolean; error?: string; agendamento_id?: string }>("portal-agendamento-update", vars);
}
