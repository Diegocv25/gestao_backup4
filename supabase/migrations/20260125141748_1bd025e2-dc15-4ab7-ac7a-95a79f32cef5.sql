-- RPC para o portal: retorna apenas blocos ocupados (inicio + duracao) de um profissional em um dia
-- Segurança: só funciona para usuário autenticado que seja cliente do salão informado.

CREATE OR REPLACE FUNCTION public.portal_agendamentos_ocupados_public(
  _salao_id uuid,
  _funcionario_id uuid,
  _dia date
)
RETURNS TABLE(
  data_hora_inicio timestamptz,
  total_duracao_minutos integer,
  id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- exige login
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- exige que o usuário seja cliente do salão
  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.salao_id = _salao_id
      AND c.auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  -- Retorna somente o mínimo necessário para bloquear slots.
  -- Observação sobre data:
  -- usamos (data_hora_inicio AT TIME ZONE 'utc')::date para manter consistente com armazenamento em timestamptz.
  RETURN QUERY
  SELECT a.data_hora_inicio,
         a.total_duracao_minutos,
         a.id
  FROM public.agendamentos a
  WHERE a.salao_id = _salao_id
    AND a.funcionario_id = _funcionario_id
    AND a.status <> 'cancelado'::public.agendamento_status
    AND (a.data_hora_inicio AT TIME ZONE 'utc')::date = _dia
  ORDER BY a.data_hora_inicio;
END;
$$;