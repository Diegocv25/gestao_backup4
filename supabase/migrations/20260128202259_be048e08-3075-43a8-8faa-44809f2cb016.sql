-- Allow customer role per-salao while enforcing single-salao for backoffice roles.

BEGIN;

-- 1) Replace UNIQUE(user_id, role) with UNIQUE(user_id, salao_id, role)
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT c.conname INTO v_conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'user_roles'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) LIKE '%(user_id, role)%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'user_roles'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) LIKE '%(user_id, salao_id, role)%'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_salao_id_role_key UNIQUE (user_id, salao_id, role);
  END IF;
END $$;

-- 2) Enforce: any role != 'customer' can only exist in ONE salao per user_id
CREATE OR REPLACE FUNCTION public.validate_user_roles_single_backoffice_salao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for backoffice roles (everything except customer)
  IF NEW.role <> 'customer'::public.app_role THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id
        AND ur.role <> 'customer'::public.app_role
        AND ur.salao_id <> NEW.salao_id
        AND ur.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'backoffice user must belong to only one salao';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_roles_single_backoffice_salao ON public.user_roles;
CREATE TRIGGER trg_validate_user_roles_single_backoffice_salao
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_roles_single_backoffice_salao();

COMMIT;