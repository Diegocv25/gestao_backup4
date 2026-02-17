import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";
import { FormPageShell } from "@/components/layout/FormPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const IA_FORM_URL = "https://n8nfila-n8n-webhook.elzqmm.easypanel.host/webhook/8f1f738c-8eb2-4ae2-8420-03cf583839df";

export default function ConfiguracoesIAPage() {
  const { user } = useAuth();

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current", user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from("subscriptions")
        .select("status,product_id,product_name,updated_at")
        .eq("provider", "kiwify")
        .eq("customer_email", String(user?.email ?? "").toLowerCase())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const hasProIA = useMemo(() => {
    const s = subscriptionQuery.data as any;
    const pid = String(s?.product_id ?? "").toLowerCase();
    const pname = String(s?.product_name ?? "").toLowerCase();
    return pid.includes("pro_ia") || pname.includes("pro") || pname.includes("ia");
  }, [subscriptionQuery.data]);

  if (!subscriptionQuery.isLoading && !hasProIA) {
    return <Navigate to="/configuracoes" replace />;
  }

  return (
    <FormPageShell
      title="Configuração da IA"
      description="Onboarding da IA dentro do Gestão (acesso exclusivo para plano PRO + IA)."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formulário de onboarding da IA</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptionQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Validando plano…</div>
          ) : (
            <iframe
              title="Formulário de configuração da IA"
              src={IA_FORM_URL}
              className="h-[75vh] w-full rounded-md border"
            />
          )}
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
