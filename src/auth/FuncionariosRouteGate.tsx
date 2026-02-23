import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccess } from "@/auth/access-context";

export function FuncionariosRouteGate() {
  const { loading, canManageFuncionarios } = useAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando permissões…</div>
      </div>
    );
  }

  if (!canManageFuncionarios) {
    return <Navigate to="/" replace state={{ from: location.pathname, blocked: "funcionario_inativo" }} />;
  }

  return <Outlet />;
}
