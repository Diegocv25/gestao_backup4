-- Allow role 'profissional' to SELECT product-related data (for reports/visibility)
-- This does NOT allow writing, only reading.

-- produtos
DROP POLICY IF EXISTS "produtos_select_roles" ON public.produtos;
CREATE POLICY "produtos_select_roles"
  ON public.produtos FOR SELECT
  USING (
    salao_id = current_salao_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'recepcionista'::app_role)
      OR has_role(auth.uid(), 'profissional'::app_role)
    )
  );

-- vendas_produtos
DROP POLICY IF EXISTS "vendas_produtos_select_roles" ON public.vendas_produtos;
CREATE POLICY "vendas_produtos_select_roles"
  ON public.vendas_produtos FOR SELECT
  USING (
    salao_id = current_salao_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'recepcionista'::app_role)
      OR has_role(auth.uid(), 'profissional'::app_role)
    )
  );

-- movimentacoes_estoque
DROP POLICY IF EXISTS "movimentacoes_estoque_select_roles" ON public.movimentacoes_estoque;
CREATE POLICY "movimentacoes_estoque_select_roles"
  ON public.movimentacoes_estoque FOR SELECT
  USING (
    salao_id = current_salao_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'recepcionista'::app_role)
      OR has_role(auth.uid(), 'profissional'::app_role)
    )
  );

-- recebimentos (para exibir formas/valores vinculados às vendas)
DROP POLICY IF EXISTS "recebimentos_select_roles" ON public.recebimentos;
CREATE POLICY "recebimentos_select_roles"
  ON public.recebimentos FOR SELECT
  USING (
    salao_id = current_salao_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'recepcionista'::app_role)
      OR has_role(auth.uid(), 'profissional'::app_role)
    )
  );
