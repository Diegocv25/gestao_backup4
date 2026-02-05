-- 1) Campo da logo no cadastro do salão
ALTER TABLE public.saloes
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2) Bucket de logos (público para renderizar facilmente no app)
INSERT INTO storage.buckets (id, name, public)
VALUES ('estabelecimento-logos', 'estabelecimento-logos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 3) Políticas de acesso ao bucket
-- Leitura pública das logos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read estabelecimento logos'
  ) THEN
    CREATE POLICY "Public read estabelecimento logos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'estabelecimento-logos');
  END IF;
END $$;

-- Escrita apenas para admin/gerente do salão atual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins manage estabelecimento logos'
  ) THEN
    CREATE POLICY "Admins manage estabelecimento logos"
    ON storage.objects
    FOR ALL
    USING (
      bucket_id = 'estabelecimento-logos'
      AND (public.has_role_in_current_salao('admin') OR public.has_role_in_current_salao('gerente'))
    )
    WITH CHECK (
      bucket_id = 'estabelecimento-logos'
      AND (public.has_role_in_current_salao('admin') OR public.has_role_in_current_salao('gerente'))
    );
  END IF;
END $$;