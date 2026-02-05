-- 1) Adicionar forma de pagamento às comissões (para retirada)
ALTER TABLE public.comissoes
ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento;

-- Garantir que quando pago_em estiver preenchido, a forma_pagamento também esteja
CREATE OR REPLACE FUNCTION public.validate_comissao_pagamento_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pago_em IS NOT NULL AND NEW.forma_pagamento IS NULL THEN
    RAISE EXCEPTION 'forma_pagamento é obrigatória quando pago_em estiver preenchido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_comissao_pagamento_fields ON public.comissoes;
CREATE TRIGGER trg_validate_comissao_pagamento_fields
BEFORE INSERT OR UPDATE ON public.comissoes
FOR EACH ROW
EXECUTE FUNCTION public.validate_comissao_pagamento_fields();


-- 2) Despesas variáveis: registrar pagamento (data + forma) para virar retirada
ALTER TABLE public.despesas_variaveis
ADD COLUMN IF NOT EXISTS pago_em timestamp with time zone,
ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento;

CREATE OR REPLACE FUNCTION public.validate_despesa_pagamento_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pago_em IS NOT NULL AND NEW.forma_pagamento IS NULL THEN
    RAISE EXCEPTION 'forma_pagamento é obrigatória quando pago_em estiver preenchido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_despesa_pagamento_fields ON public.despesas_variaveis;
CREATE TRIGGER trg_validate_despesa_pagamento_fields
BEFORE INSERT OR UPDATE ON public.despesas_variaveis
FOR EACH ROW
EXECUTE FUNCTION public.validate_despesa_pagamento_fields();


-- 3) Pagamentos de salários (por funcionário)
CREATE TABLE IF NOT EXISTS public.pagamentos_salarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id uuid NOT NULL,
  funcionario_id uuid NOT NULL,
  competencia date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  pago_em timestamp with time zone NOT NULL DEFAULT now(),
  forma_pagamento public.forma_pagamento NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pagamentos_salarios_unique_competencia UNIQUE (salao_id, funcionario_id, competencia)
);

ALTER TABLE public.pagamentos_salarios ENABLE ROW LEVEL SECURITY;

-- Backoffice total
CREATE POLICY "pagamentos_salarios_admin_staff_gerente_recep_all"
ON public.pagamentos_salarios
FOR ALL
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
  )
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
  )
);

-- negar anon select
CREATE POLICY "pagamentos_salarios_deny_anon_select"
ON public.pagamentos_salarios
FOR SELECT
USING (false);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_pagamentos_salarios_updated_at ON public.pagamentos_salarios;
CREATE TRIGGER update_pagamentos_salarios_updated_at
BEFORE UPDATE ON public.pagamentos_salarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Índices para filtros por data
CREATE INDEX IF NOT EXISTS idx_comissoes_pago_em ON public.comissoes (pago_em);
CREATE INDEX IF NOT EXISTS idx_despesas_variaveis_pago_em ON public.despesas_variaveis (pago_em);
CREATE INDEX IF NOT EXISTS idx_pagamentos_salarios_pago_em ON public.pagamentos_salarios (pago_em);
CREATE INDEX IF NOT EXISTS idx_pagamentos_salarios_competencia ON public.pagamentos_salarios (competencia);
