-- 1) Multi-tenant: adicionar salao_id em user_roles e fazer backfill
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS salao_id uuid;

-- Backfill para registros existentes (assume o salão mais antigo como tenant inicial)
UPDATE public.user_roles ur
SET salao_id = s.id
FROM (
  SELECT id
  FROM public.saloes
  ORDER BY created_at ASC
  LIMIT 1
) s
WHERE ur.salao_id IS NULL;

ALTER TABLE public.user_roles
ALTER COLUMN salao_id SET NOT NULL;

-- Evita duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_salao_role_uniq
ON public.user_roles (user_id, salao_id, role);

-- 2) Funções auxiliares para tenant/roles
CREATE OR REPLACE FUNCTION public.current_salao_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.salao_id
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  ORDER BY ur.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_current_salao(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.salao_id = public.current_salao_id()
      AND ur.role = _role
  );
$$;

-- 3) Vincular profissional (auth) ao funcionário
ALTER TABLE public.funcionarios
ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS funcionarios_auth_user_id_uniq
ON public.funcionarios (auth_user_id)
WHERE auth_user_id IS NOT NULL;

-- 4) View segura: profissional enxerga SOMENTE id/nome de clientes que aparecem nos próprios agendamentos
-- A view roda com privilégios do owner (não depende de SELECT em clientes para o profissional), e expõe apenas colunas seguras.
CREATE OR REPLACE VIEW public.clientes_profissional
AS
SELECT DISTINCT c.id, c.nome, c.salao_id
FROM public.clientes c
JOIN public.agendamentos a ON a.cliente_id = c.id
JOIN public.funcionarios f ON f.id = a.funcionario_id
WHERE f.auth_user_id = auth.uid();

-- 5) Reescrever políticas RLS (tenant + papéis)
-- Observação: usaremos os valores existentes do enum (admin, staff, customer, gerente, profissional, recepcionista).

-- SALOES
DROP POLICY IF EXISTS saloes_select_role ON public.saloes;
DROP POLICY IF EXISTS saloes_write_admin_staff ON public.saloes;

CREATE POLICY saloes_select_tenant_roles
ON public.saloes
FOR SELECT
USING (
  id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
    OR public.has_role(auth.uid(), 'profissional'::public.app_role)
    OR public.has_role(auth.uid(), 'customer'::public.app_role)
  )
);

CREATE POLICY saloes_write_admin_staff_gerente
ON public.saloes
FOR ALL
USING (
  id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
)
WITH CHECK (
  id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
);

-- CLIENTES (sem acesso direto para profissional; ele usa a view clientes_profissional)
DROP POLICY IF EXISTS clientes_admin_staff_all ON public.clientes;
DROP POLICY IF EXISTS clientes_customer_insert_own ON public.clientes;
DROP POLICY IF EXISTS clientes_customer_select_own ON public.clientes;
DROP POLICY IF EXISTS clientes_customer_update_own ON public.clientes;

CREATE POLICY clientes_admin_staff_gerente_recep_all
ON public.clientes
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

-- Cliente final (customer) só o próprio
CREATE POLICY clientes_customer_select_own
ON public.clientes
FOR SELECT
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND auth.uid() = auth_user_id
  AND salao_id = public.current_salao_id()
);

CREATE POLICY clientes_customer_insert_own
ON public.clientes
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND auth.uid() = auth_user_id
  AND salao_id = public.current_salao_id()
);

CREATE POLICY clientes_customer_update_own
ON public.clientes
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND auth.uid() = auth_user_id
  AND salao_id = public.current_salao_id()
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND auth.uid() = auth_user_id
  AND salao_id = public.current_salao_id()
);

-- FUNCIONARIOS
DROP POLICY IF EXISTS funcionarios_select_role ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_write_admin_staff ON public.funcionarios;

CREATE POLICY funcionarios_select_tenant_roles
ON public.funcionarios
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

CREATE POLICY funcionarios_write_admin_staff_gerente
ON public.funcionarios
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

-- AGENDAMENTOS
DROP POLICY IF EXISTS agendamentos_admin_staff_all ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_customer_delete_own ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_customer_insert_own ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_customer_select_own ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_customer_update_own ON public.agendamentos;

-- Admin/Staff/Gerente: tudo no salão
CREATE POLICY agendamentos_admin_staff_gerente_all
ON public.agendamentos
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

-- Recepcionista: tudo no salão (para qualquer profissional)
CREATE POLICY agendamentos_recepcionista_all
ON public.agendamentos
FOR ALL
USING (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'recepcionista'::public.app_role)
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'recepcionista'::public.app_role)
);

-- Profissional: apenas os próprios agendamentos
CREATE POLICY agendamentos_profissional_select_own
ON public.agendamentos
FOR SELECT
USING (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE f.id = agendamentos.funcionario_id
      AND f.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_profissional_insert_own
ON public.agendamentos
FOR INSERT
WITH CHECK (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE f.id = agendamentos.funcionario_id
      AND f.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_profissional_update_own
ON public.agendamentos
FOR UPDATE
USING (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE f.id = agendamentos.funcionario_id
      AND f.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE f.id = agendamentos.funcionario_id
      AND f.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_profissional_delete_own
ON public.agendamentos
FOR DELETE
USING (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.funcionarios f
    WHERE f.id = agendamentos.funcionario_id
      AND f.auth_user_id = auth.uid()
  )
);

-- Customer: mantém regras atuais + tenant
CREATE POLICY agendamentos_customer_select_own
ON public.agendamentos
FOR SELECT
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND salao_id = public.current_salao_id()
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_customer_insert_own
ON public.agendamentos
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND salao_id = public.current_salao_id()
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_customer_update_own
ON public.agendamentos
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND salao_id = public.current_salao_id()
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND salao_id = public.current_salao_id()
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_customer_delete_own
ON public.agendamentos
FOR DELETE
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND salao_id = public.current_salao_id()
  AND EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

-- AGENDAMENTO_ITENS: replica critério via join com agendamentos
DROP POLICY IF EXISTS agendamento_itens_admin_staff_all ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_customer_delete_own ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_customer_select_own ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_customer_update_own ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_customer_write_own ON public.agendamento_itens;

CREATE POLICY agendamento_itens_admin_staff_gerente_recep_all
ON public.agendamento_itens
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.id = agendamento_itens.agendamento_id
      AND a.salao_id = public.current_salao_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'staff'::public.app_role)
        OR public.has_role(auth.uid(), 'gerente'::public.app_role)
        OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agendamentos a
    WHERE a.id = agendamento_itens.agendamento_id
      AND a.salao_id = public.current_salao_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'staff'::public.app_role)
        OR public.has_role(auth.uid(), 'gerente'::public.app_role)
        OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      )
  )
);

CREATE POLICY agendamento_itens_profissional_own
ON public.agendamento_itens
FOR ALL
USING (
  public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.funcionarios f ON f.id = a.funcionario_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND a.salao_id = public.current_salao_id()
      AND f.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.funcionarios f ON f.id = a.funcionario_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND a.salao_id = public.current_salao_id()
      AND f.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamento_itens_customer_own
ON public.agendamento_itens
FOR ALL
USING (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND a.salao_id = public.current_salao_id()
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND a.salao_id = public.current_salao_id()
      AND c.auth_user_id = auth.uid()
  )
);
