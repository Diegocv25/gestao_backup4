-- =========================================
-- Portal (escopo mínimo):
--   - portal_accounts
--   - portal_sessions
--   - portal_password_resets
--   - ajuste mínimo em clientes (portal_account_id)
-- =========================================

-- 1) portal_accounts (identidade por salão)
CREATE TABLE IF NOT EXISTS public.portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicidade por estabelecimento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'portal_accounts_salao_email_norm_uniq'
  ) THEN
    ALTER TABLE public.portal_accounts
      ADD CONSTRAINT portal_accounts_salao_email_norm_uniq
      UNIQUE (salao_id, email_normalized);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_portal_accounts_salao_id ON public.portal_accounts (salao_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_portal_accounts_updated_at ON public.portal_accounts;
CREATE TRIGGER trg_portal_accounts_updated_at
BEFORE UPDATE ON public.portal_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- 2) portal_sessions (sessão server-side com regra de ouro via salao_id)
CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  portal_account_id uuid NOT NULL REFERENCES public.portal_accounts(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token_hash ON public.portal_sessions (session_token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_account_salao ON public.portal_sessions (portal_account_id, salao_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_salao_id ON public.portal_sessions (salao_id);


-- 3) portal_password_resets (reset por salão)
CREATE TABLE IF NOT EXISTS public.portal_password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  reset_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_password_resets_salao_email_norm ON public.portal_password_resets (salao_id, email_normalized);
CREATE INDEX IF NOT EXISTS idx_portal_password_resets_token_hash ON public.portal_password_resets (reset_token_hash);


-- 4) Ajuste mínimo em clientes: portal_account_id
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS portal_account_id uuid NULL REFERENCES public.portal_accounts(id) ON DELETE SET NULL;

-- Unicidade por salão para portal_account_id (somente quando não-nulo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'clientes_salao_portal_account_id_uniq'
  ) THEN
    CREATE UNIQUE INDEX clientes_salao_portal_account_id_uniq
      ON public.clientes (salao_id, portal_account_id)
      WHERE portal_account_id IS NOT NULL;
  END IF;
END$$;
