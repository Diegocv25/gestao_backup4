-- RPC para validar link público do portal sem depender de SELECT em public.saloes (evita "Link não encontrado" para usuários novos)
-- Retorna apenas campos necessários ao portal.

CREATE OR REPLACE FUNCTION public.portal_salao_by_token(_token text)
RETURNS TABLE (
  id uuid,
  nome text,
  agendamento_antecedencia_modo text,
  agendamento_antecedencia_horas integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.nome, s.agendamento_antecedencia_modo, s.agendamento_antecedencia_horas
  FROM public.saloes s
  WHERE s.public_booking_token = _token
  LIMIT 1;
$$;

-- Garante que qualquer usuário (anon/autenticado) possa executar.
GRANT EXECUTE ON FUNCTION public.portal_salao_by_token(text) TO anon, authenticated;