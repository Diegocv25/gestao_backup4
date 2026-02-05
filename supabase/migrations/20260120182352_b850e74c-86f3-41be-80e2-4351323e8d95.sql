-- Add public booking token to generate a fixed client link per salon
ALTER TABLE public.saloes
ADD COLUMN IF NOT EXISTS public_booking_token TEXT;

-- Backfill existing rows
UPDATE public.saloes
SET public_booking_token = COALESCE(public_booking_token, gen_random_uuid()::text);

-- Ensure token is always present for new rows
ALTER TABLE public.saloes
ALTER COLUMN public_booking_token SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.saloes
ALTER COLUMN public_booking_token SET NOT NULL;

-- Make token unique
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'saloes_public_booking_token_uniq'
  ) THEN
    CREATE UNIQUE INDEX saloes_public_booking_token_uniq ON public.saloes (public_booking_token);
  END IF;
END $$;
