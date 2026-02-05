-- RPC segura: lista somente id/nome de clientes do salão (sem PII)
CREATE OR REPLACE FUNCTION public.clientes_nomes_current_salao()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.nome
  FROM public.clientes c
  WHERE c.salao_id = public.current_salao_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
      OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      OR public.has_role(auth.uid(), 'profissional'::public.app_role)
    )
  ORDER BY c.nome;
$$;

-- SERVICOS: incluir gerente/recepcionista/profissional no SELECT e gerente/recepcionista no WRITE
DROP POLICY IF EXISTS servicos_select_role ON public.servicos;
DROP POLICY IF EXISTS servicos_write_admin_staff ON public.servicos;

CREATE POLICY servicos_select_roles
ON public.servicos
FOR SELECT
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
    OR public.has_role(auth.uid(), 'profissional'::public.app_role)
    OR public.has_role(auth.uid(), 'customer'::public.app_role)
  )
);

CREATE POLICY servicos_write_admin_staff_gerente_recep
ON public.servicos
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

-- SERVICOS_FUNCIONARIOS: profissional precisa SELECT (para saber que serviços pode executar)
DROP POLICY IF EXISTS servicos_funcionarios_select_role ON public.servicos_funcionarios;
DROP POLICY IF EXISTS servicos_funcionarios_write_admin_staff ON public.servicos_funcionarios;

CREATE POLICY servicos_funcionarios_select_roles
ON public.servicos_funcionarios
FOR SELECT
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
    OR public.has_role(auth.uid(), 'profissional'::public.app_role)
    OR public.has_role(auth.uid(), 'customer'::public.app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.servicos s
    WHERE s.id = servicos_funcionarios.servico_id
      AND s.salao_id = public.current_salao_id()
  )
);

CREATE POLICY servicos_funcionarios_write_admin_staff_gerente_recep
ON public.servicos_funcionarios
FOR ALL
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.servicos s
    WHERE s.id = servicos_funcionarios.servico_id
      AND s.salao_id = public.current_salao_id()
  )
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.servicos s
    WHERE s.id = servicos_funcionarios.servico_id
      AND s.salao_id = public.current_salao_id()
  )
);

-- HORARIOS_FUNCIONARIO: profissional precisa SELECT (para calcular slots)
DROP POLICY IF EXISTS horarios_funcionario_select_role ON public.horarios_funcionario;
DROP POLICY IF EXISTS horarios_funcionario_write_admin_staff ON public.horarios_funcionario;

CREATE POLICY horarios_funcionario_select_roles
ON public.horarios_funcionario
FOR SELECT
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
    OR public.has_role(auth.uid(), 'profissional'::public.app_role)
    OR public.has_role(auth.uid(), 'customer'::public.app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = horarios_funcionario.funcionario_id
      AND f.salao_id = public.current_salao_id()
  )
);

CREATE POLICY horarios_funcionario_write_admin_staff_gerente
ON public.horarios_funcionario
FOR ALL
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = horarios_funcionario.funcionario_id
      AND f.salao_id = public.current_salao_id()
  )
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
  AND EXISTS (
    SELECT 1 FROM public.funcionarios f
    WHERE f.id = horarios_funcionario.funcionario_id
      AND f.salao_id = public.current_salao_id()
  )
);

-- DIAS_FUNCIONAMENTO: profissional precisa SELECT (para exibir/validar disponibilidade do salão)
DROP POLICY IF EXISTS dias_funcionamento_select_role ON public.dias_funcionamento;
DROP POLICY IF EXISTS dias_funcionamento_write_admin_staff ON public.dias_funcionamento;

CREATE POLICY dias_funcionamento_select_roles
ON public.dias_funcionamento
FOR SELECT
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
    OR public.has_role(auth.uid(), 'profissional'::public.app_role)
    OR public.has_role(auth.uid(), 'customer'::public.app_role)
  )
);

CREATE POLICY dias_funcionamento_write_admin_staff_gerente
ON public.dias_funcionamento
FOR ALL
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
);
