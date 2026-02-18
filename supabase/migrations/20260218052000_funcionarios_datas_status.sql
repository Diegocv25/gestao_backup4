-- Funcionários: datas de admissão e inatividade (soft delete operacional)
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS data_admissao date,
  ADD COLUMN IF NOT EXISTS data_inatividade date;

-- Backfill básico para registros já existentes:
-- se está ativo e não tem data_admissao, assume a data de criação.
UPDATE public.funcionarios
SET data_admissao = COALESCE(data_admissao, created_at::date)
WHERE ativo = true;

-- se está inativo e não tem data_inatividade, usa updated_at como aproximação.
UPDATE public.funcionarios
SET data_inatividade = COALESCE(data_inatividade, updated_at::date)
WHERE ativo = false;
