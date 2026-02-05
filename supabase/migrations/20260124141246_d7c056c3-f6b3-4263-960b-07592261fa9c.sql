-- Phase 1 (segura): endurecer RLS em dados sensíveis de funcionarios e expor somente o necessário via RPC

-- 1) RPC para listar profissionais de forma segura (somente id/nome) a partir de uma lista de IDs
--    Usado pelo portal do cliente para montar selects sem expor salário/contato.
CREATE OR REPLACE FUNCTION public.funcionarios_public_by_ids(_ids uuid[])
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.nome
  FROM public.funcionarios f
  WHERE f.id = ANY(_ids)
    AND f.salao_id = public.current_salao_id()
    AND f.ativo = true
    AND COALESCE(f.carga, 'profissional') = 'profissional'
  ORDER BY f.nome;
$$;

GRANT EXECUTE ON FUNCTION public.funcionarios_public_by_ids(uuid[]) TO authenticated;

-- 2) Ajuste de RLS em funcionarios: remove customer e limita profissional ao próprio registro
DO $$
BEGIN
  -- remove policy antiga (se existir)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'funcionarios'
      AND policyname = 'funcionarios_select_tenant_roles'
  ) THEN
    EXECUTE 'DROP POLICY "funcionarios_select_tenant_roles" ON public.funcionarios';
  END IF;
END $$;

-- Admin/Staff/Gerente/Recepcionista podem ler funcionarios do tenant (uso interno)
CREATE POLICY funcionarios_select_admin_staff_gerente_recep
ON public.funcionarios
FOR SELECT
USING (
  salao_id = public.current_salao_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'staff'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
  )
);

-- Profissional só pode ler o próprio registro
CREATE POLICY funcionarios_select_profissional_own
ON public.funcionarios
FOR SELECT
USING (
  salao_id = public.current_salao_id()
  AND public.has_role(auth.uid(), 'profissional'::public.app_role)
  AND auth_user_id = auth.uid()
);

-- Observação: políticas de escrita existentes (admin/staff/gerente) permanecem como estão.
