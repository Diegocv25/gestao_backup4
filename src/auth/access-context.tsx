import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";

export type AppRole = "admin" | "staff" | "gerente" | "recepcionista" | "profissional" | "customer";

type AccessContextValue = {
  role: AppRole | null;
  salaoId: string | null;
  funcionarioId: string | null;
  loading: boolean;
};

const AccessContext = createContext<AccessContextValue | undefined>(undefined);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [salaoId, setSalaoId] = useState<string | null>(null);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) {
          setRole(null);
          setSalaoId(null);
          setFuncionarioId(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        // NOTE: types.ts é read-only e pode estar defasado (novas colunas); por isso usamos `as any`.
        const sb = supabase as any;
        const { data: roles, error: rolesErr } = await sb
          .from("user_roles")
          .select("role,salao_id,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });
        if (rolesErr) throw rolesErr;

        const first = (roles ?? [])[0] as { role?: AppRole; salao_id?: string } | undefined;
        const nextRole = (first?.role ?? null) as AppRole | null;
        const nextSalaoId = (first?.salao_id ?? null) as string | null;

        let nextFuncionarioId: string | null = null;
        if (nextRole === "profissional") {
          const { data: f, error: fErr } = await sb
            .from("funcionarios")
            .select("id")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          if (fErr) throw fErr;
          nextFuncionarioId = (f?.id ?? null) as string | null;
        }

        if (!cancelled) {
          setRole(nextRole);
          setSalaoId(nextSalaoId);
          setFuncionarioId(nextFuncionarioId);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          // Falha em carregar acesso -> trata como sem acesso.
          setRole(null);
          setSalaoId(null);
          setFuncionarioId(null);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const value = useMemo<AccessContextValue>(
    () => ({ role, salaoId, funcionarioId, loading: loading || authLoading }),
    [role, salaoId, funcionarioId, loading, authLoading]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used within <AccessProvider>");
  return ctx;
}
