-- Fix do linter: remover view (security definer) e substituir por RPC com retorno limitado
DROP VIEW IF EXISTS public.clientes_profissional;

CREATE OR REPLACE FUNCTION public.clientes_profissional_list()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT c.id, c.nome
  FROM public.clientes c
  JOIN public.agendamentos a ON a.cliente_id = c.id
  JOIN public.funcionarios f ON f.id = a.funcionario_id
  WHERE f.auth_user_id = auth.uid()
    AND a.salao_id = public.current_salao_id();
$$;