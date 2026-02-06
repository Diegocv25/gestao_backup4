import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAccess } from "@/auth/access-context";

/**
 * Bloqueia explicitamente usuários com role `customer` no backoffice.
 * Mantém o fluxo de onboarding: usuário logado sem role ainda pode acessar /configuracoes.
 */
export function BackofficeGate() {
  const { role, loading } = useAccess();
  const location = useLocation();

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

  return <Outlet />;
}
