-- MIGRAÇÃO: Onboarding multi-tenant seguro (1 usuário = 1 empresa)

-- 1) Coluna de propriedade temporária no onboarding
ALTER TABLE public.saloes
ADD COLUMN IF NOT EXISTS created_by_user_id uuid;

ALTER TABLE public.saloes
ALTER COLUMN created_by_user_id SET DEFAULT auth.uid();

COMMENT ON COLUMN public.saloes.created_by_user_id
IS 'Usuário que criou o salão durante o onboarding (antes de existir admin). Usado apenas para RLS de bootstrap.';


-- 2) Atualizar função: deixa de ser global e vira por-usuário
CREATE OR REPLACE FUNCTION public.can_bootstrap_first_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    _user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = 'admin'::public.app_role
    )
  );
$$;

COMMENT ON FUNCTION public.can_bootstrap_first_admin(uuid)
IS 'Permite bootstrap de admin por usuário (não global). Retorna true se o usuário ainda não é admin de nenhum estabelecimento.';


-- 3) RLS: saloes (substitui policies antigas por versão com onboarding)
DROP POLICY IF EXISTS saloes_select_tenant_roles ON public.saloes;
DROP POLICY IF EXISTS saloes_write_admin_staff_gerente ON public.saloes;
DROP POLICY IF EXISTS saloes_select_onboarding_or_tenant ON public.saloes;
DROP POLICY IF EXISTS saloes_insert_onboarding_or_admin ON public.saloes;
DROP POLICY IF EXISTS saloes_update_admin_staff_gerente ON public.saloes;
DROP POLICY IF EXISTS saloes_delete_admin_staff ON public.saloes;

-- SELECT: usuário com role vê seu tenant; usuário sem role vê apenas o salao que ele criou (onboarding)
CREATE POLICY saloes_select_onboarding_or_tenant
ON public.saloes
FOR SELECT
TO authenticated
USING (
  (
    id = public.current_salao_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
      OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      OR public.has_role(auth.uid(), 'profissional'::public.app_role)
      OR public.has_role(auth.uid(), 'customer'::public.app_role)
    )
  )
  OR
  (
    created_by_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  )
);

-- INSERT: onboarding (sem role) pode criar 1 salao (qualquer número de inserts, mas o claim admin será 1x); roles normais continuam ok
CREATE POLICY saloes_insert_onboarding_or_admin
ON public.saloes
FOR INSERT
TO authenticated
WITH CHECK (
  (
    -- onboarding: sem nenhum role ainda
    NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
    -- e o registro criado pertence ao usuário
    AND created_by_user_id = auth.uid()
  )
  OR
  (
    id = public.current_salao_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    )
  )
);

-- UPDATE: admin/staff/gerente no tenant; OU onboarding pode atualizar o seu próprio salao enquanto ainda não existe admin nele
CREATE POLICY saloes_update_admin_staff_gerente
ON public.saloes
FOR UPDATE
TO authenticated
USING (
  (
    id = public.current_salao_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    )
  )
  OR
  (
    created_by_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.salao_id = saloes.id
        AND ur2.role = 'admin'::public.app_role
    )
  )
)
WITH CHECK (
  (
    id = public.current_salao_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'staff'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    )
  )
  OR
  (
    created_by_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.salao_id = saloes.id
        AND ur2.role = 'admin'::public.app_role
    )
  )
);

-- DELETE: mantém restrito (não libera onboarding para não criar vetor de abuso)
CREATE POLICY saloes_delete_admin_staff
ON public.saloes
FOR DELETE
TO authenticated
USING (
  id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
  )
);


-- 4) RLS: dias_funcionamento (adiciona onboarding)
DROP POLICY IF EXISTS dias_funcionamento_onboarding_select ON public.dias_funcionamento;
DROP POLICY IF EXISTS dias_funcionamento_onboarding_insert ON public.dias_funcionamento;
DROP POLICY IF EXISTS dias_funcionamento_onboarding_update ON public.dias_funcionamento;

-- SELECT no onboarding: permite ver horários do salao criado pelo usuário
CREATE POLICY dias_funcionamento_onboarding_select
ON public.dias_funcionamento
FOR SELECT
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.saloes s
    WHERE s.id = dias_funcionamento.salao_id
      AND s.created_by_user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur2
        WHERE ur2.salao_id = s.id
          AND ur2.role = 'admin'::public.app_role
      )
  )
);

-- INSERT no onboarding: permite criar horários do salao criado pelo usuário
CREATE POLICY dias_funcionamento_onboarding_insert
ON public.dias_funcionamento
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.saloes s
    WHERE s.id = dias_funcionamento.salao_id
      AND s.created_by_user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur2
        WHERE ur2.salao_id = s.id
          AND ur2.role = 'admin'::public.app_role
      )
  )
);

-- UPDATE no onboarding: permite ajustar horários antes de existir admin
CREATE POLICY dias_funcionamento_onboarding_update
ON public.dias_funcionamento
FOR UPDATE
TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.saloes s
    WHERE s.id = dias_funcionamento.salao_id
      AND s.created_by_user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur2
        WHERE ur2.salao_id = s.id
          AND ur2.role = 'admin'::public.app_role
      )
  )
)
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.saloes s
    WHERE s.id = dias_funcionamento.salao_id
      AND s.created_by_user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur2
        WHERE ur2.salao_id = s.id
          AND ur2.role = 'admin'::public.app_role
      )
  )
);


-- 5) RLS: user_roles (bootstrap admin por salao criado pelo próprio usuário)
DROP POLICY IF EXISTS user_roles_insert_bootstrap_first_admin ON public.user_roles;

CREATE POLICY user_roles_insert_bootstrap_first_admin
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'admin'::public.app_role
  AND public.can_bootstrap_first_admin(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.saloes s
    WHERE s.id = public.user_roles.salao_id
      AND s.created_by_user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur2
        WHERE ur2.salao_id = s.id
          AND ur2.role = 'admin'::public.app_role
      )
  )
);
