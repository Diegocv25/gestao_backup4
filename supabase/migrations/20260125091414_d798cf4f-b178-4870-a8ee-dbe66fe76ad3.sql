-- RPC para o portal do cliente cancelar apenas seus próprios agendamentos
-- (evita UPDATE silencioso por RLS e garante efeito no banco)

CREATE OR REPLACE FUNCTION public.portal_cancel_agendamento(_agendamento_id uuid)
RETURNS TABLE (
  id uuid,
  status public.agendamento_status
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.agendamentos a
  SET status = 'cancelado'::public.agendamento_status
  WHERE a.id = _agendamento_id
    AND a.cliente_id IN (
      SELECT c.id
      FROM public.clientes c
      WHERE c.auth_user_id = auth.uid()
    )
  RETURNING a.id, a.status;
$$;

REVOKE ALL ON FUNCTION public.portal_cancel_agendamento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cancel_agendamento(uuid) TO authenticated;
