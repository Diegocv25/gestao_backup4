-- Migration 1/2: only add enum values (must be committed before use)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='gerente') THEN
    ALTER TYPE public.app_role ADD VALUE 'gerente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='profissional') THEN
    ALTER TYPE public.app_role ADD VALUE 'profissional';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='recepcionista') THEN
    ALTER TYPE public.app_role ADD VALUE 'recepcionista';
  END IF;
END $$;