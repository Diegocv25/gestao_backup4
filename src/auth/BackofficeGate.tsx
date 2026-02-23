import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAccess } from "@/auth/access-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Bloqueia explicitamente usuários com role `customer` no backoffice.
 * Mantém o fluxo de onboarding: usuário logado sem role ainda pode acessar /configuracoes.
 */
export function BackofficeGate() {
  const { role, loading, funcionarioId, funcionarioAtivo } = useAccess();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const funcionarioInativo = Boolean(funcionarioId) && funcionarioAtivo === false;

  useEffect(() => {
    let cancelled = false;

    async function forceLogout() {
      if (!funcionarioInativo) return;
      if (signingOut) return;

      setSigningOut(true);
      try {
        await supabase.auth.signOut();
      } finally {
        if (!cancelled) {
          window.location.replace("/auth");
        }
      }
    }

    void forceLogout();
    return () => {
      cancelled = true;
    };
  }, [funcionarioInativo, signingOut]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando permissões…</div>
      </div>
    );
  }

  if (role === "customer") {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ blocked: "customer_backoffice", from: `${location.pathname}${location.search}${location.hash ?? ""}` }}
      />
    );
  }

  // Se o usuário está vinculado a funcionário inativo, encerra sessão e volta para login.
  if (funcionarioInativo) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">Acesso inativado</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Encerrando sua sessão para permitir novo login em outra conta.
          </p>
          <Button
            variant="secondary"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.replace("/auth");
            }}
          >
            Ir para login agora
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
