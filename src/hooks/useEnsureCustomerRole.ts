import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { ensureCustomerRole } from "@/lib/ensure-customer-role";

type EnsureState =
  | { status: "idle"; error: null }
  | { status: "pending"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: Error };

/**
 * Ensures `customer` role for a given (userId, salaoId).
 * - Emits a destructive toast on failure.
 * - Exposes `retry()` so pages can provide a "Tentar novamente" button.
 */
export function useEnsureCustomerRole(userId?: string, salaoId?: string) {
  const [state, setState] = useState<EnsureState>({ status: "idle", error: null });
  const lastKeyRef = useRef<string>("");

  const run = useCallback(async () => {
    if (!userId || !salaoId) return;
    setState({ status: "pending", error: null });
    try {
      await ensureCustomerRole({ userId, salaoId });
      setState({ status: "success", error: null });
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e?.message ?? e));
      setState({ status: "error", error: err });
      toast({
        title: "Não foi possível preparar seu acesso",
        description: err.message,
        variant: "destructive",
      });
    }
  }, [userId, salaoId]);

  useEffect(() => {
    const key = userId && salaoId ? `${userId}:${salaoId}` : "";
    if (!key) return;
    if (lastKeyRef.current === key && state.status !== "error") return;
    lastKeyRef.current = key;
    // fire-and-forget
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, salaoId]);

  return {
    isPending: state.status === "pending",
    isReady: state.status === "success",
    error: state.status === "error" ? state.error : null,
    retry: run,
  };
}
