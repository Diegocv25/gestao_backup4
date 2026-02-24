import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";

export function SubscriptionGate() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) {
          setHasAccess(true);
          setChecking(false);
        }
        return;
      }

      setChecking(true);
      try {
        // RPC: public.has_active_access(_user_id uuid)
        const { data, error } = await (supabase as any).rpc("has_active_access", {
          _user_id: user.id,
        });

        if (error) throw error;

        const ok = Boolean(data);
        if (!cancelled) {
          setHasAccess(ok);
          setChecking(false);
        }
      } catch {
        // Se não conseguirmos checar, não bloqueamos (fail-open) para evitar lock acidental.
        if (!cancelled) {
          setHasAccess(true);
          setChecking(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Verificando assinatura…</div>
      </div>
    );
  }

  if (!user) return <Outlet />;

  if (!hasAccess) {
    const from = `${location.pathname}${location.search}${location.hash ?? ""}`;
    return <Navigate to="/acesso-expirado" replace state={{ from }} />;
  }

  return <Outlet />;
}
