-- Roles (admin/staff/customer) for real access control
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- user_roles policies
DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert_own_customer ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;

CREATE POLICY user_roles_select_own
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to self-assign ONLY the 'customer' role
CREATE POLICY user_roles_insert_own_customer
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'customer');

-- Admins can manage roles
CREATE POLICY user_roles_admin_all
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper predicate for staff/admin
-- We'll use the expression inline to avoid dependency on more functions.

-- Replace overly-permissive existing policies (auth-only) with role-based ones.
-- NOTE: We keep the app in MVP mode: staff/admin can see everything; customers only see their own.

-- SALOES
DROP POLICY IF EXISTS saloes_select ON public.saloes;
DROP POLICY IF EXISTS saloes_insert ON public.saloes;
DROP POLICY IF EXISTS saloes_update ON public.saloes;
DROP POLICY IF EXISTS saloes_delete ON public.saloes;

CREATE POLICY saloes_select_role
ON public.saloes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'customer')
);

CREATE POLICY saloes_write_admin_staff
ON public.saloes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- SERVICOS
DROP POLICY IF EXISTS servicos_select ON public.servicos;
DROP POLICY IF EXISTS servicos_insert ON public.servicos;
DROP POLICY IF EXISTS servicos_update ON public.servicos;
DROP POLICY IF EXISTS servicos_delete ON public.servicos;

CREATE POLICY servicos_select_role
ON public.servicos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'customer')
);

CREATE POLICY servicos_write_admin_staff
ON public.servicos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- FUNCIONARIOS
DROP POLICY IF EXISTS funcionarios_select ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_insert ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_update ON public.funcionarios;
DROP POLICY IF EXISTS funcionarios_delete ON public.funcionarios;

CREATE POLICY funcionarios_select_role
ON public.funcionarios
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'customer')
);

CREATE POLICY funcionarios_write_admin_staff
ON public.funcionarios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- HORARIOS_FUNCIONARIO
DROP POLICY IF EXISTS horarios_funcionario_select ON public.horarios_funcionario;
DROP POLICY IF EXISTS horarios_funcionario_insert ON public.horarios_funcionario;
DROP POLICY IF EXISTS horarios_funcionario_update ON public.horarios_funcionario;
DROP POLICY IF EXISTS horarios_funcionario_delete ON public.horarios_funcionario;

CREATE POLICY horarios_funcionario_select_role
ON public.horarios_funcionario
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'customer')
);

CREATE POLICY horarios_funcionario_write_admin_staff
ON public.horarios_funcionario
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- DIAS_FUNCIONAMENTO
DROP POLICY IF EXISTS dias_funcionamento_select ON public.dias_funcionamento;
DROP POLICY IF EXISTS dias_funcionamento_insert ON public.dias_funcionamento;
DROP POLICY IF EXISTS dias_funcionamento_update ON public.dias_funcionamento;
DROP POLICY IF EXISTS dias_funcionamento_delete ON public.dias_funcionamento;

CREATE POLICY dias_funcionamento_select_role
ON public.dias_funcionamento
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'customer')
);

CREATE POLICY dias_funcionamento_write_admin_staff
ON public.dias_funcionamento
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- SERVICOS_FUNCIONARIOS
DROP POLICY IF EXISTS servicos_funcionarios_select ON public.servicos_funcionarios;
DROP POLICY IF EXISTS servicos_funcionarios_insert ON public.servicos_funcionarios;
DROP POLICY IF EXISTS servicos_funcionarios_update ON public.servicos_funcionarios;
DROP POLICY IF EXISTS servicos_funcionarios_delete ON public.servicos_funcionarios;

CREATE POLICY servicos_funcionarios_select_role
ON public.servicos_funcionarios
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'customer')
);

CREATE POLICY servicos_funcionarios_write_admin_staff
ON public.servicos_funcionarios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- CLIENTES
DROP POLICY IF EXISTS clientes_select ON public.clientes;
DROP POLICY IF EXISTS clientes_insert ON public.clientes;
DROP POLICY IF EXISTS clientes_update ON public.clientes;
DROP POLICY IF EXISTS clientes_delete ON public.clientes;

CREATE POLICY clientes_admin_staff_all
ON public.clientes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY clientes_customer_select_own
ON public.clientes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'customer') AND auth.uid() = auth_user_id);

CREATE POLICY clientes_customer_insert_own
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'customer') AND auth.uid() = auth_user_id);

CREATE POLICY clientes_customer_update_own
ON public.clientes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'customer') AND auth.uid() = auth_user_id)
WITH CHECK (public.has_role(auth.uid(), 'customer') AND auth.uid() = auth_user_id);

-- AGENDAMENTOS
DROP POLICY IF EXISTS agendamentos_select ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_insert ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_update ON public.agendamentos;
DROP POLICY IF EXISTS agendamentos_delete ON public.agendamentos;

CREATE POLICY agendamentos_admin_staff_all
ON public.agendamentos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY agendamentos_customer_select_own
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_customer_insert_own
ON public.agendamentos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_customer_update_own
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamentos_customer_delete_own
ON public.agendamentos
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = agendamentos.cliente_id
      AND c.auth_user_id = auth.uid()
  )
);

-- AGENDAMENTO_ITENS
DROP POLICY IF EXISTS agendamento_itens_select ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_insert ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_update ON public.agendamento_itens;
DROP POLICY IF EXISTS agendamento_itens_delete ON public.agendamento_itens;

CREATE POLICY agendamento_itens_admin_staff_all
ON public.agendamento_itens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY agendamento_itens_customer_select_own
ON public.agendamento_itens
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamento_itens_customer_write_own
ON public.agendamento_itens
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamento_itens_customer_update_own
ON public.agendamento_itens
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY agendamento_itens_customer_delete_own
ON public.agendamento_itens
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'customer')
  AND EXISTS (
    SELECT 1
    FROM public.agendamentos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = agendamento_itens.agendamento_id
      AND c.auth_user_id = auth.uid()
  )
);

-- COMISSOES: only admin/staff
DROP POLICY IF EXISTS comissoes_select ON public.comissoes;
DROP POLICY IF EXISTS comissoes_insert ON public.comissoes;
DROP POLICY IF EXISTS comissoes_update ON public.comissoes;
DROP POLICY IF EXISTS comissoes_delete ON public.comissoes;

CREATE POLICY comissoes_admin_staff_all
ON public.comissoes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- DESPESAS_VARIAVEIS: only admin/staff
DROP POLICY IF EXISTS despesas_variaveis_select ON public.despesas_variaveis;
DROP POLICY IF EXISTS despesas_variaveis_insert ON public.despesas_variaveis;
DROP POLICY IF EXISTS despesas_variaveis_update ON public.despesas_variaveis;
DROP POLICY IF EXISTS despesas_variaveis_delete ON public.despesas_variaveis;

CREATE POLICY despesas_variaveis_admin_staff_all
ON public.despesas_variaveis
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- FOLHA_SALARIAL_MENSAL: only admin/staff
DROP POLICY IF EXISTS folha_salarial_mensal_select ON public.folha_salarial_mensal;
DROP POLICY IF EXISTS folha_salarial_mensal_insert ON public.folha_salarial_mensal;
DROP POLICY IF EXISTS folha_salarial_mensal_update ON public.folha_salarial_mensal;
DROP POLICY IF EXISTS folha_salarial_mensal_delete ON public.folha_salarial_mensal;

CREATE POLICY folha_salarial_mensal_admin_staff_all
ON public.folha_salarial_mensal
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));