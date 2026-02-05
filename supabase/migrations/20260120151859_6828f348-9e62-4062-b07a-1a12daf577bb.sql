-- 1) Política de antecedência para agendamentos (por salão)
ALTER TABLE public.saloes
  ADD COLUMN IF NOT EXISTS agendamento_antecedencia_modo TEXT NOT NULL DEFAULT 'horas',
  ADD COLUMN IF NOT EXISTS agendamento_antecedencia_horas INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'saloes_agendamento_antecedencia_modo_check'
  ) THEN
    ALTER TABLE public.saloes
      ADD CONSTRAINT saloes_agendamento_antecedencia_modo_check
      CHECK (agendamento_antecedencia_modo IN ('horas','proximo_dia'));
  END IF;
END$$;

-- 2) Vincular cliente ao usuário autenticado (para auto-cadastro no link público)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_auth_user_id_uniq
  ON public.clientes (auth_user_id)
  WHERE auth_user_id IS NOT NULL;