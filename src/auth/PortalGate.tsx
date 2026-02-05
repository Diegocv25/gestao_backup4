import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { portalMe } from "@/portal/portal-api";

export function PortalGate() {
  const { token } = useParams();
  const location = useLocation();

  const tokenValue = useMemo(() => (typeof token === "string" ? token.trim() : ""), [token]);

  const meQuery = useQuery({
    queryKey: ["portal-me", tokenValue],
    enabled: tokenValue.length > 0,
    queryFn: async () => portalMe(tokenValue),
    retry: false,
    staleTime: 1000 * 15,
  });

  if (!tokenValue) {
    return <Navigate to="/" replace />;
  }

  if (meQuery.isLoading) {
    return null;
  }

  const data = meQuery.data;
  const authenticated = !!(data && (data as any).ok && (data as any).authenticated);
  const hasCliente = !!((data as any)?.cliente?.id);
  const isCadastroRoute = location.pathname.endsWith("/cadastro");

  if (!authenticated) {
    return <Navigate to={`/cliente/${encodeURIComponent(tokenValue)}/entrar`} replace state={{ from: location.pathname }} />;
  }

  // Fase 2: se está logado mas ainda não tem cadastro de cliente neste salão,
  // força completar o cadastro antes de permitir agendar/visualizar.
  if (!hasCliente && !isCadastroRoute) {
    return <Navigate to={`/cliente/${encodeURIComponent(tokenValue)}/cadastro`} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
