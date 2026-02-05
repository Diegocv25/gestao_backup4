import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

type PortalSalao = {
  id: string;
  nome: string;
  logo_url?: string | null;
  agendamento_antecedencia_modo?: string | null;
  agendamento_antecedencia_horas?: number | null;
};

/**
 * Valida/busca dados mínimos do salão via token público usando RPC (SECURITY DEFINER),
 * evitando falhas por RLS em usuários recém-criados.
 */
export function usePortalSalaoByToken(token: string) {
  return useQuery({
    queryKey: ["portal-salao-by-token", token],
    enabled: token.trim().length > 0,
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb.rpc("portal_salao_by_token", { _token: token.trim() });
      if (error) throw error;
      const first = (data ?? [])[0] as PortalSalao | undefined;
      return first ?? null;
    },
  });
}
