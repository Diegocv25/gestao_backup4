import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";
import type { AppRole } from "@/auth/access-context";

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
        const sb = supabase as any;

        // Busca o primeiro vínculo (role/salao) do usuário.
        // Importante: funcionários não têm `cadastros_estabelecimento` próprio; a validade vem do salão (admin).
        const { data: roles, error: rolesErr } = await sb
          .from("user_roles")
          .select("role,salao_id,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (rolesErr) throw rolesErr;

        const first = (roles ?? [])[0] as { role?: AppRole; salao_id?: string } | undefined;
        const role = (first?.role ?? null) as AppRole | null;
        const salaoId = (first?.salao_id ?? null) as string | null;

        // Sem vínculo ainda (onboarding / estado intermediário) -> não bloqueia.
        if (!role || !salaoId) {
          if (!cancelled) {
            setHasAccess(true);
            setChecking(false);
          }
          return;
        }

        // Admin: valida por user_id (cadastro comercial do próprio dono)
        if (role === "admin") {
          const { data, error } = await sb.rpc("has_active_access", { _user_id: user.id });
          if (error) throw error;
          const ok = Boolean(data);
          if (!cancelled) {
            setHasAccess(ok);
            setChecking(false);
          }
          return;
        }

        // Funcionários: valida por salão (admin ativo do salão)
        const { data, error } = await sb.rpc("has_salao_active", { _salao_id: salaoId });
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
