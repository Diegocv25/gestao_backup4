-- Allow same auth_user_id to exist in multiple salões (multi-tenant customer)
-- Previously: unique(auth_user_id) blocked registering the same user as a cliente in another salao.

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_auth_user_id_uniq;

-- Enforce uniqueness only within a salao, and only when auth_user_id is set
CREATE UNIQUE INDEX IF NOT EXISTS clientes_salao_auth_user_id_uniq
  ON public.clientes (salao_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;
