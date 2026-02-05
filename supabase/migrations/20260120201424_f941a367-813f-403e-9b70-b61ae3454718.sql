-- Add fixed salary support to funcionarios
ALTER TABLE public.funcionarios
ADD COLUMN IF NOT EXISTS recebe_salario_fixo boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS salario_fixo_mensal numeric NOT NULL DEFAULT 0;

-- Helpful indexes for reporting/listing
CREATE INDEX IF NOT EXISTS idx_funcionarios_salao_ativo ON public.funcionarios (salao_id, ativo);
CREATE INDEX IF NOT EXISTS idx_funcionarios_salao_recebe_salario ON public.funcionarios (salao_id, recebe_salario_fixo);
