import { useMemo } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/auth-context";
import { useAccess } from "@/auth/access-context";
import { Button } from "@/components/ui/button";

const PLANS_URL_FALLBACK = "https://pay.kiwify.com.br/H5429N1";
const PLANS_URL = (import.meta.env.VITE_PLANS_URL || PLANS_URL_FALLBACK).replace(/\/+$/, "");

/**
 * Banner de aviso de vencimento.
 * Regras:
 * - Exibir somente para admin/gerente (quem toma decisão de pagamento).
 * - Exibir somente para salões que NÃO têm assinatura automática ativa (ex.: pix/manual):
 *   se houver subscription ativa (kiwify) para o email do usuário, não mostrar banner.
 * - Exibir quando faltar 5 dias ou menos para acesso_ate.
 */
export function ExpiryBanner() {
  const { user } = useAuth();
  const { role } = useAccess();

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-current", user?.email],
    enabled: !!user?.email,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const client = supabase as any;
      const { data, error } = await client
        .from("subscriptions")
        .select("status,updated_at")
        .eq("provider", "kiwify")
        .eq("customer_email", String(user?.email ?? "").toLowerCase())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const cadastroQuery = useQuery({
    queryKey: ["cadastro-estabelecimento", user?.id],
    enabled: !!user?.id && (role === "admin" || role === "gerente"),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cadastros_estabelecimento")
        .select("acesso_ate")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.acesso_ate ?? null) as string | null;
    },
  });

  const diasRestantes = useMemo(() => {
    const acesso = cadastroQuery.data;
    if (!acesso) return null;
    try {
      const d = typeof acesso === "string" ? parseISO(acesso) : new Date(acesso as any);
      return differenceInCalendarDays(d, new Date());
    } catch {
      return null;
    }
  }, [cadastroQuery.data]);

  // Condições de exibição
  if (!user) return null;
  if (!(role === "admin" || role === "gerente")) return null;

  // Se há assinatura ativa (automática), não exibe aviso de cobrança.
  const subStatus = String(subscriptionQuery.data?.status ?? "");
  const hasAutoSubscription = subStatus.toLowerCase() === "active" || subStatus.toLowerCase() === "paid";
  if (hasAutoSubscription) return null;

  if (diasRestantes == null) return null;
  if (diasRestantes > 5) return null;

  const expired = diasRestantes < 0;
  const critical = diasRestantes <= 1;

  const label = expired
    ? "Seu acesso expirou. Regularize para continuar usando o sistema."
    : `Seu acesso vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}.`;

  return (
    <div
      className={
        "mt-2 flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between " +
        (critical || expired ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10")
      }
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <div className={"font-medium " + (critical || expired ? "text-red-200" : "text-amber-200")}>{label}</div>
        <div className="text-xs text-muted-foreground">
          Se você paga via Pix/manual, renove para evitar bloqueio. (Assinaturas automáticas não precisam deste aviso.)
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm">
          <a href={PLANS_URL} target="_blank" rel="noreferrer">
            Regularizar
          </a>
        </Button>
      </div>
    </div>
  );
}
