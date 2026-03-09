import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";

export function AuthGate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando sessão…</div>
      </div>
    );
  }

  if (!user) {
    const isClientePortal = location.pathname.startsWith("/cliente/");
    const from = `${location.pathname}${location.search}${location.hash ?? ""}`;

    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isPortalHost = hostname.startsWith("portal.");

    // No domínio do portal, evite redirecionar para /auth por padrão (para não confundir clientes).
    if (isPortalHost && !isClientePortal) {
      return <Navigate to="/portal" replace state={{ from }} />;
    }

    return (
      <Navigate
        to="/auth"
        replace
        state={{
          from,
          allowSignup: isClientePortal,
          portal: isClientePortal ? "cliente" : undefined,
        }}
      />
    );
  }

  return <Outlet />;
}
