-- Fase 1 (finalização): garantir isolamento por tenant em tabelas financeiras

-- COMISSOES: admin/staff precisam respeitar salao_id = current_salao_id()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comissoes'
      AND policyname = 'comissoes_admin_staff_all'
  ) THEN
    EXECUTE 'DROP POLICY "comissoes_admin_staff_all" ON public.comissoes';
  END IF;
END $$;

CREATE POLICY comissoes_admin_staff_all
ON public.comissoes
FOR ALL
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
);

-- DESPESAS_VARIAVEIS: admin/staff precisam respeitar salao_id = current_salao_id()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'despesas_variaveis'
      AND policyname = 'despesas_variaveis_admin_staff_all'
  ) THEN
    EXECUTE 'DROP POLICY "despesas_variaveis_admin_staff_all" ON public.despesas_variaveis';
  END IF;
END $$;

CREATE POLICY despesas_variaveis_admin_staff_all
ON public.despesas_variaveis
FOR ALL
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
);

-- FOLHA_SALARIAL_MENSAL: admin/staff precisam respeitar salao_id = current_salao_id()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'folha_salarial_mensal'
      AND policyname = 'folha_salarial_mensal_admin_staff_all'
  ) THEN
    EXECUTE 'DROP POLICY "folha_salarial_mensal_admin_staff_all" ON public.folha_salarial_mensal';
  END IF;
END $$;

CREATE POLICY folha_salarial_mensal_admin_staff_all
ON public.folha_salarial_mensal
FOR ALL
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
);
