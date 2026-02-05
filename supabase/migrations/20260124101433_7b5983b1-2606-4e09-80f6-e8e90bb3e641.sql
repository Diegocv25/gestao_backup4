-- Fix: policy for profissionais verem suas próprias comissões

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comissoes'
      AND policyname = 'comissoes_profissional_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY comissoes_profissional_select_own '
      || 'ON public.comissoes FOR SELECT '
      || 'USING ( '
      || 'has_role(auth.uid(), ''profissional''::app_role) '
      || 'AND (salao_id = current_salao_id()) '
      || 'AND EXISTS ( '
      || '  SELECT 1 FROM public.funcionarios f '
      || '  WHERE f.id = comissoes.funcionario_id '
      || '    AND f.salao_id = current_salao_id() '
      || '    AND f.auth_user_id = auth.uid() '
      || ') '
      || ')';
  END IF;
END
$do$;
