import { useSalaoId } from "@/hooks/useSalaoId";

/**
 * Alias semântico para multi-tenant.
 *
 * Importante:
 * - No banco (por enquanto) o identificador do tenant continua sendo `salao_id`.
 * - No frontend, a convenção para novas features é usar o termo “estabelecimento”.
 */
export function useEstabelecimentoId() {
  return useSalaoId();
}
