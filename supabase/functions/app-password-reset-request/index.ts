// Edge Function: app-password-reset-request
// Public endpoint (verify_jwt=false).
// Sends password recovery email via Resend (avoids Supabase built-in mailer).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido" }, 405);

  try {
    const { email } = (await req.json()) as { email?: string };
    const emailNorm = normalizeEmail(email || "");
    if (!emailNorm) return json({ ok: false, error: "email obrigatório" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    const resendApiKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
    const resendFrom = (Deno.env.get("RESEND_FROM") || "").trim();
    const resendReplyTo = (Deno.env.get("RESEND_REPLY_TO") || "").trim();
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");
    if (!resendFrom) throw new Error("Missing RESEND_FROM");

    const authBaseUrl = (Deno.env.get("AUTH_BASE_URL") || Deno.env.get("APP_BASE_URL") || "").trim().replace(/\/+$/, "");
    // Important: include type=recovery so the frontend shows the ResetPasswordForm.
    const redirectTo = authBaseUrl ? `${authBaseUrl}/auth?type=recovery` : `${new URL(req.url).origin}/auth?type=recovery`;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Generate a recovery link without sending email via Supabase.
    // Note: for security, always return ok even if user doesn't exist.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: emailNorm,
      options: { redirectTo },
    } as any);

    if (error) {
      // Still return ok to avoid email enumeration.
      console.warn("[app-password-reset-request] generateLink error", error);
      return json({ ok: true });
    }

    const actionLink = (data as any)?.properties?.action_link as string | undefined;
    if (!actionLink) {
      // No link (user may not exist). Still return ok.
      return json({ ok: true });
    }

    const subject = "Redefinir senha — Nexus Automação";
    const html = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background:#0b0f19;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.25);">
        <tr>
          <td style="padding:22px 24px;background:#0b0f19;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
            <div style="font-size:18px;line-height:22px;font-weight:800;">Nexus Automação</div>
            <div style="font-size:13px;line-height:18px;color:#b7c0d6;">Redefinição de senha</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
            <p style="margin:0 0 12px 0;">Você solicitou a redefinição de senha da sua conta.</p>
            <p style="margin:0 0 16px 0;">Clique no botão abaixo para criar uma nova senha:</p>
            <p style="margin:0 0 18px 0;">
              <a href="${actionLink}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:10px;font-size:14px;font-weight:700;">Redefinir senha</a>
            </p>
            <p style="margin:0;font-size:12.5px;line-height:18px;color:#6b7280;">Se você não solicitou, ignore este e-mail.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        ...(resendReplyTo ? { reply_to: resendReplyTo } : {}),
        to: [emailNorm],
        subject,
        html,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.warn("[app-password-reset-request] resend error", resp.status, text);
      // still return ok to avoid enumeration
      return json({ ok: true });
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error("[app-password-reset-request] error", e);
    // still return ok to avoid enumeration
    return json({ ok: true });
  }
});
