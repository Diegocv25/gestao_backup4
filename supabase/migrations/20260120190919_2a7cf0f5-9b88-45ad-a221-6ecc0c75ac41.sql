-- Despesas variáveis (lançamentos) e folha salarial (total mensal)

CREATE TABLE IF NOT EXISTS public.despesas_variaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL,
  competencia date NOT NULL, -- 1º dia do mês de competência
  descricao text NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_despesas_variaveis_salao_competencia
  ON public.despesas_variaveis (salao_id, competencia);

ALTER TABLE public.despesas_variaveis ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='despesas_variaveis' AND policyname='despesas_variaveis_select'
  ) THEN
    CREATE POLICY despesas_variaveis_select ON public.despesas_variaveis
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='despesas_variaveis' AND policyname='despesas_variaveis_insert'
  ) THEN
    CREATE POLICY despesas_variaveis_insert ON public.despesas_variaveis
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='despesas_variaveis' AND policyname='despesas_variaveis_update'
  ) THEN
    CREATE POLICY despesas_variaveis_update ON public.despesas_variaveis
      FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='despesas_variaveis' AND policyname='despesas_variaveis_delete'
  ) THEN
    CREATE POLICY despesas_variaveis_delete ON public.despesas_variaveis
      FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Folha salarial (total mensal)
CREATE TABLE IF NOT EXISTS public.folha_salarial_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL,
  competencia date NOT NULL, -- 1º dia do mês de competência
  valor numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salao_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_folha_salarial_mensal_salao_competencia
  ON public.folha_salarial_mensal (salao_id, competencia);

ALTER TABLE public.folha_salarial_mensal ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='folha_salarial_mensal' AND policyname='folha_salarial_mensal_select'
  ) THEN
    CREATE POLICY folha_salarial_mensal_select ON public.folha_salarial_mensal
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='folha_salarial_mensal' AND policyname='folha_salarial_mensal_insert'
  ) THEN
    CREATE POLICY folha_salarial_mensal_insert ON public.folha_salarial_mensal
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='folha_salarial_mensal' AND policyname='folha_salarial_mensal_update'
  ) THEN
    CREATE POLICY folha_salarial_mensal_update ON public.folha_salarial_mensal
      FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='folha_salarial_mensal' AND policyname='folha_salarial_mensal_delete'
  ) THEN
    CREATE POLICY folha_salarial_mensal_delete ON public.folha_salarial_mensal
      FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Triggers para updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_despesas_variaveis_updated_at'
  ) THEN
    CREATE TRIGGER set_despesas_variaveis_updated_at
    BEFORE UPDATE ON public.despesas_variaveis
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_folha_salarial_mensal_updated_at'
  ) THEN
    CREATE TRIGGER set_folha_salarial_mensal_updated_at
    BEFORE UPDATE ON public.folha_salarial_mensal
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
