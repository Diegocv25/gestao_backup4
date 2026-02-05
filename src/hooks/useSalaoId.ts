import { useQuery } from "@tanstack/react-query";
import { useAccess } from "@/auth/access-context";

export function useSalaoId() {
  const { salaoId, loading } = useAccess();
  return useQuery({
    queryKey: ["salao-id"],
    enabled: !loading,
    queryFn: async () => salaoId ?? null,
    initialData: salaoId ?? null,
  });
}

