import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAccess } from "@/auth/access-context";

/**
 * Bloqueia explicitamente usuários com role `customer` no backoffice.
 * Mantém o fluxo de onboarding: usuário logado sem role ainda pode acessar /configuracoes.
 */
export function BackofficeGate() {
  const { role, loading, funcionarioId, funcionarioAtivo } = useAccess();
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

  // Se o usuário está vinculado a funcionário inativo, bloqueia acesso ao backoffice.
  if (funcionarioId && funcionarioAtivo === false) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">Acesso inativado</h2>
          <p className="text-sm text-muted-foreground">
            Seu acesso ao sistema foi inativado. Fale com o administrador para reativação.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}