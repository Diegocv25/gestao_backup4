// Edge Function: kiwify-webhook
// Public endpoint (verify_jwt=false). Recebe eventos da Kiwify.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

function json(body: unknown, init: ResponseInit, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...cors, ...(init.headers ?? {}) },
  });
}

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-webhook-token, x-kiwify-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function getEventType(payload: any): string {
  return String(
    payload?.webhooks_event?.type ??
      payload?.event ??
      payload?.type ??
      payload?.data?.event ??
      "",
  )
    .trim()
    .toLowerCase();
}

function getEventId(payload: any): string | null {
  return (
    payload?.event_id ??
    payload?.id ??
    payload?.webhooks_event?.id ??
    payload?.order?.id ??
    payload?.order_id ??
    payload?.sale_id ??
    payload?.transaction_id ??
    null
  );
}

function inferPlanIdFromPayload(payload: any): "profissional" | "pro_ia" | null {
  const raw = String(
    payload?.product?.name ??
      payload?.offer?.name ??
      payload?.plan?.name ??
      payload?.product_name ??
      "",
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!raw) return null;
  if (raw.includes("pro") && raw.includes("ia")) return "pro_ia";
  if (raw.includes("profissional")) return "profissional";
  return null;
}

function mapStatusPagamento(eventType: string): string {
  switch (eventType) {
    case "pix_gerado":
      return "PENDENTE_PIX";
    case "compra_aprovada":
      return "PAGO";
    case "assinatura_renovada":
      return "PAGO";
    case "reembolso":
      return "REEMBOLSADO";
    case "assinatura_cancelada":
      return "CANCELADO";
    case "assinatura_atrasada":
      return "ATRASADO";
    default:
      return eventType || "DESCONHECIDO";
  }
}

function isActiveEvent(eventType: string): boolean {
  return eventType === "compra_aprovada" || eventType === "assinatura_renovada";
}

async function sendAccessEmail(session: any) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM");
  const resendReplyTo = Deno.env.get("RESEND_REPLY_TO");
  const resendTestTo = Deno.env.get("RESEND_TEST_TO");
  const authBaseUrl = (Deno.env.get("AUTH_BASE_URL") || "").replace(/\/+$/, "");

  if (!resendApiKey || !resendFrom || !authBaseUrl) {
    console.warn("[kiwify-webhook] email config ausente, ignorando envio de email de acesso");
    return;
  }

  const accessLink = `${authBaseUrl}/auth`;
  const toAddress = resendTestTo ? [resendTestTo] : [session.user_email];

  const payload: any = {
    from: resendFrom,
    to: toAddress,
    subject: "Pagamento confirmado — acesso ao sistema",
    html: `
      <div style="font-family: sans-serif; font-size: 16px; color: #333;">
        ${resendTestTo ? `<p style="background:#ffeb3b; padding:10px; font-weight:bold;">[TEST MODE] Destinatário original: ${session.user_email}</p>` : ""}
        <h1>Pagamento confirmado ✅</h1>
        <p>Olá <strong>${session.nome_proprietario ?? "cliente"}</strong>,</p>
        <p>Seu pagamento foi confirmado e seu cadastro está ativo.</p>
        <p>Para acessar o sistema de gestão, use o link abaixo:</p>
        <p>
          <a href="${accessLink}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">
            Acessar o sistema
          </a>
        </p>
        <p style="font-size:14px;color:#666;">Ou copie o link: <a href="${accessLink}">${accessLink}</a></p>
      </div>
    `,
  };

  if (resendReplyTo) payload.reply_to = resendReplyTo;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const t = await r.text();
    console.error("[kiwify-webhook] resend failed", r.status, t);
  }
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 }, cors);

  try {
    const url = new URL(req.url);
    const payload = await req.json();

    const expectedToken = Deno.env.get("KIWIFY_WEBHOOK_TOKEN") || "";
    const tokenReceived =
      req.headers.get("x-webhook-token") ||
      req.headers.get("x-kiwify-token") ||
      req.headers.get("x-kiwify-webhook-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      payload?.token ||
      payload?.webhook_token ||
      payload?.webhooks_event?.token ||
      url.searchParams.get("token") ||
      "";

    if (!expectedToken || tokenReceived !== expectedToken) {
      return json({ error: "Unauthorized" }, { status: 401 }, cors);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server config missing" }, { status: 500 }, cors);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const eventType = getEventType(payload);
    const eventId = getEventId(payload);
    const customerEmail = String(payload?.customer?.email ?? payload?.email ?? "").trim().toLowerCase();
    const customerDoc = digitsOnly(payload?.customer?.document ?? payload?.customer?.cpf ?? payload?.customer?.cnpj ?? payload?.document);
    const orderId = String(payload?.order?.id ?? payload?.order_id ?? payload?.sale_id ?? payload?.transaction_id ?? "").trim();

    // idempotência por event_id + evento
    if (eventId) {
      const { data: already } = await admin
        .from("payment_sessions")
        .select("id")
        .eq("event_id", String(eventId))
        .maybeSingle();

      if (already) {
        return json({ received: true, duplicate: true }, { status: 200 }, cors);
      }
    }

    let session: any = null;

    if (orderId) {
      const { data } = await admin
        .from("payment_sessions")
        .select("*")
        .eq("provider_bill_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) session = data;
    }

    if (!session && customerEmail) {
      const { data } = await admin
        .from("payment_sessions")
        .select("*")
        .ilike("user_email", customerEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) session = data;
    }

    if (!session && customerDoc) {
      const { data } = await admin
        .from("payment_sessions")
        .select("*")
        .eq("tax_id", customerDoc)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) session = data;
    }

    if (!session) {
      return json({ received: true, ignored: true, reason: "session_not_found" }, { status: 200 }, cors);
    }

    const inferredPlan = inferPlanIdFromPayload(payload) ?? (session.plan_id === "pro_ia" ? "pro_ia" : "profissional");
    const nowIso = new Date().toISOString();

    const updateData: Record<string, any> = {
      provider: "kiwify",
      plan_id: inferredPlan,
      status_pagamento: mapStatusPagamento(eventType),
      ultimo_evento: eventType || null,
      data_ultimo_evento: nowIso,
      payload_raw: payload,
      event_id: eventId,
    };

    if (orderId) updateData.provider_bill_id = orderId;

    if (isActiveEvent(eventType)) {
      updateData.status = "paid_waiting_account";
      updateData.paid_at = session.paid_at ?? nowIso;
    }

    await admin.from("payment_sessions").update(updateData).eq("id", session.id);

    if (isActiveEvent(eventType) && session.status !== "paid" && session.status !== "paid_waiting_account") {
      await sendAccessEmail({ ...session, plan_id: inferredPlan });
    }

    return json({ received: true, processed: true, event: eventType }, { status: 200 }, cors);
  } catch (e) {
    console.error("kiwify-webhook error:", e);
    return json({ error: "Internal error" }, { status: 500 }, buildCorsHeaders(req));
  }
});
