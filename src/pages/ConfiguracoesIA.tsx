import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";

import { FormPageShell } from "@/components/layout/FormPageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type AccessResponse = {
  ok: boolean;
  form_url?: string;
  expires_at?: string;
  error?: string;
};

export default function ConfiguracoesIAPage() {
  const accessQuery = useQuery({
    queryKey: ["ia-onboarding-access"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ia-onboarding-access", { body: {} });
      if (error) throw error;
      return (data ?? {}) as AccessResponse;
    },
    retry: false,
  });

  if (!accessQuery.isLoading && (!accessQuery.data?.ok || !accessQuery.data?.form_url)) {
    return <Navigate to="/configuracoes" replace />;
  }

  return (
    <FormPageShell
      title="Configuração da IA"
      description="Onboarding da IA com validação de assinatura PRO + IA e tenant do estabelecimento."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formulário de onboarding da IA</CardTitle>
        </CardHeader>
        <CardContent>
          {accessQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Validando acesso…</div>
          ) : (
            <iframe
              title="Formulário de configuração da IA"
              src={accessQuery.data?.form_url}
              className="h-[75vh] w-full rounded-md border"
            />
          )}
        </CardContent>
      </Card>
    </FormPageShell>
  );
}
