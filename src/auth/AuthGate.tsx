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
