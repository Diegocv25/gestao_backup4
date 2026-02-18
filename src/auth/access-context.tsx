import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";

export type AppRole = "admin" | "staff" | "gerente" | "recepcionista" | "profissional" | "customer";

type AccessContextValue = {
  role: AppRole | null;
  salaoId: string | null;
  funcionarioId: string | null;
  funcionarioAtivo: boolean | null;
  canManageFuncionarios: boolean;
  loading: boolean;
};

const AccessContext = createContext<AccessContextValue | undefined>(undefined);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [salaoId, setSalaoId] = useState<string | null>(null);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [funcionarioAtivo, setFuncionarioAtivo] = useState<boolean | null>(null);
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
          setFuncionarioAtivo(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        // NOTE: types.ts pode estar defasado; usamos any para colunas novas.
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
        let nextFuncionarioAtivo: boolean | null = null;

        // Para qualquer role operacional, se houver vínculo em funcionarios,
        // carregamos ativo para controlar acesso a rotas sensíveis.
        if (nextRole && nextRole !== "customer") {
          const { data: f, error: fErr } = await sb
            .from("funcionarios")
            .select("id,ativo")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          if (fErr) throw fErr;

          nextFuncionarioId = (f?.id ?? null) as string | null;
          nextFuncionarioAtivo = typeof f?.ativo === "boolean" ? Boolean(f.ativo) : null;
        }

        if (!cancelled) {
          setRole(nextRole);
          setSalaoId(nextSalaoId);
          setFuncionarioId(nextFuncionarioId);
          setFuncionarioAtivo(nextFuncionarioAtivo);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          // Falha em carregar acesso -> trata como sem acesso.
          setRole(null);
          setSalaoId(null);
          setFuncionarioId(null);
          setFuncionarioAtivo(null);
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const canManageFuncionarios = useMemo(() => {
    if (!role) return false;
    if (!["admin", "staff", "gerente"].includes(role)) return false;

    // Se não está vinculado a um registro em funcionarios (caso dono antigo), mantém acesso.
    if (!funcionarioId) return true;

    // Se está vinculado, só mantém acesso quando ativo.
    return funcionarioAtivo === true;
  }, [role, funcionarioId, funcionarioAtivo]);

  const value = useMemo<AccessContextValue>(
    () => ({
      role,
      salaoId,
      funcionarioId,
      funcionarioAtivo,
      canManageFuncionarios,
      loading: loading || authLoading,
    }),
    [role, salaoId, funcionarioId, funcionarioAtivo, canManageFuncionarios, loading, authLoading],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error("useAccess must be used within <AccessProvider>");
  return ctx;
}
