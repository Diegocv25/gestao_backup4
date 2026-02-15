import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type,authorization,x-kiwify-token,x-webhook-token,x-api-key",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      ...(init?.headers ?? {}),
    },
  });
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function getTrigger(payload: Record<string, unknown>) {
  const w = payload.webhooks_event as Record<string, unknown> | undefined;
  return (
    asText(w?.type) ??
    asText(payload.trigger) ??
    asText(payload.event) ??
    asText(payload.type) ??
    "unknown"
  );
}

function getOrderId(payload: Record<string, unknown>) {
  const order = payload.order as Record<string, unknown> | undefined;
  const sale = payload.sale as Record<string, unknown> | undefined;
  return asText(payload.order_id) ?? asText(payload.sale_id) ?? asText(order?.id) ?? asText(sale?.id);
}

function getSubscriptionId(payload: Record<string, unknown>) {
  const sub = payload.subscription as Record<string, unknown> | undefined;
  return asText(payload.subscription_id) ?? asText(sub?.id);
}

function getCustomerEmail(payload: Record<string, unknown>) {
  const customer = payload.customer as Record<string, unknown> | undefined;
  const buyer = payload.buyer as Record<string, unknown> | undefined;
  const email = asText(customer?.email) ?? asText(buyer?.email) ?? asText(payload.email);
  return email?.toLowerCase() ?? null;
}

function getProduct(payload: Record<string, unknown>) {
  const product = payload.product as Record<string, unknown> | undefined;
  return {
    id: asText(payload.product_id) ?? asText(product?.id),
    name: asText(payload.product_name) ?? asText(product?.name),
  };
}

function getHeaderToken(req: Request) {
  const candidates = [
    req.headers.get("x-kiwify-token"),
    req.headers.get("x-webhook-token"),
    req.headers.get("x-api-key"),
  ];
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    candidates.push(auth.slice(7).trim());
  }

  for (const c of candidates) {
    const t = asText(c);
    if (t) return t;
  }
  return null;
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function mapStatus(trigger: string): string {
  switch (trigger) {
    case "compra_aprovada":
    case "subscription_renewed":
      return "active";
    case "subscription_late":
      return "late_grace";
    case "subscription_canceled":
      return "canceled";
    case "compra_reembolsada":
      return "refunded";
    case "chargeback":
      return "chargeback";
    case "compra_recusada":
      return "payment_failed";
    default:
      return "pending";
  }
}

function buildHeadersSnapshot(req: Request) {
  const out: Record<string, string> = {};
  for (const [k, v] of req.headers.entries()) out[k] = v;
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, { status: 405 });

  const sb = getServiceClient();
  let insertedEventId: string | null = null;
  try {
    const payload = (await req.json()) as Record<string, unknown>;

    const expectedToken = asText(Deno.env.get("KIWIFY_WEBHOOK_TOKEN"));
    const queryToken = asText(new URL(req.url).searchParams.get("token"));
    const bodyToken = asText(payload.token);
    const headerToken = getHeaderToken(req);
    const incomingToken = headerToken ?? queryToken ?? bodyToken;

    if (expectedToken && incomingToken !== expectedToken) {
      return json({ ok: false, error: "invalid webhook token" }, { status: 403 });
    }

    const trigger = getTrigger(payload);
    const orderId = getOrderId(payload);
    const subscriptionId = getSubscriptionId(payload);
    const customerEmail = getCustomerEmail(payload);
    const product = getProduct(payload);

    const rawPayload = JSON.stringify(payload);
    const eventHash = await sha256Hex(`${trigger}|${orderId ?? ""}|${subscriptionId ?? ""}|${customerEmail ?? ""}|${rawPayload}`);

    const { data: insertedEvent, error: eventInsertError } = await sb
      .from("kiwify_events")
      .insert({
        trigger,
        event_hash: eventHash,
        order_id: orderId,
        subscription_id: subscriptionId,
        customer_email: customerEmail,
        raw_payload: payload,
        raw_headers: buildHeadersSnapshot(req),
        processed_ok: false,
      })
      .select("id")
      .single();

    insertedEventId = insertedEvent?.id ?? null;

    if (eventInsertError) {
      const msg = String(eventInsertError.message ?? eventInsertError);
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        return json({ ok: true, duplicate: true, trigger, event_hash: eventHash });
      }
      throw eventInsertError;
    }

    const status = mapStatus(trigger);

    if (customerEmail) {
      const graceDays = Number(Deno.env.get("KIWIFY_GRACE_DAYS") ?? "3");
      const graceUntil = Number.isFinite(graceDays)
        ? new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const meta: Record<string, unknown> = {
        grace_days: Number.isFinite(graceDays) ? graceDays : 3,
      };
      if (status === "late_grace" && graceUntil) meta.grace_until = graceUntil;

      const { error: upsertError } = await sb.from("subscriptions").upsert(
        {
          provider: "kiwify",
          customer_email: customerEmail,
          status,
          product_id: product.id,
          product_name: product.name,
          order_id: orderId,
          subscription_id: subscriptionId,
          last_event_trigger: trigger,
          meta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,customer_email" },
      );

      if (upsertError) throw upsertError;
    }

    await sb
      .from("kiwify_events")
      .update({ processed_ok: true, processed_at: new Date().toISOString() })
      .eq("id", insertedEvent.id);

    return json({
      ok: true,
      trigger,
      status,
      customer_email: customerEmail,
      order_id: orderId,
      subscription_id: subscriptionId,
      event_hash: eventHash,
    });
  } catch (error: any) {
    if (insertedEventId) {
      await sb
        .from("kiwify_events")
        .update({
          processed_ok: false,
          processed_at: new Date().toISOString(),
          error: String(error?.message ?? error),
        })
        .eq("id", insertedEventId);
    }
    return json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
});
