import { supabase } from "@/integrations/supabase/client";

type EnsureCustomerRoleArgs = {
  userId: string;
  salaoId: string;
};

/**
 * Ensures the logged-in user has the `customer` role for the given `salaoId`.
 *
 * IMPORTANT: This is required for RLS policies that depend on `has_customer_access(salao_id)`.
 */
export async function ensureCustomerRole({ userId, salaoId }: EnsureCustomerRoleArgs) {
  const sb = supabase as any;

  const { error } = await sb
    .from("user_roles")
    .upsert(
      { user_id: userId, role: "customer", salao_id: salaoId },
      { onConflict: "user_id,salao_id,role", ignoreDuplicates: true } as any,
    );

  if (error) throw error;
}
