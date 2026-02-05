-- RPCs para o portal do cliente: vincular cliente existente e ler horários de forma segura

CREATE OR REPLACE FUNCTION public.portal_link_cliente_by_email(
  _salao_id uuid,
  _user_id uuid,
  _email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _salao_id IS NULL OR _user_id IS NULL OR _email IS NULL OR length(trim(_email)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Encontra um cliente do mesmo salão com o mesmo e-mail que ainda não está vinculado
  SELECT c.id
    INTO v_id
  FROM public.clientes c
  WHERE c.salao_id = _salao_id
    AND c.email IS NOT NULL
    AND lower(c.email) = lower(trim(_email))
    AND c.auth_user_id IS NULL
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.clientes
     SET auth_user_id = _user_id
   WHERE id = v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.portal_link_cliente_by_email(uuid, uuid, text)
IS 'Vincula (auth_user_id) um cliente existente ao usuário autenticado usando salao_id + email. Usado no portal do cliente para 1º acesso.';


CREATE OR REPLACE FUNCTION public.portal_horarios_funcionario_public(
  _salao_id uuid,
  _funcionario_id uuid
)
RETURNS TABLE(
  dia_semana int,
  inicio text,
  fim text,
  almoco_inicio text,
  almoco_fim text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT hf.dia_semana,
         hf.inicio,
         hf.fim,
         hf.almoco_inicio,
         hf.almoco_fim
  FROM public.horarios_funcionario hf
  JOIN public.funcionarios f ON f.id = hf.funcionario_id
  WHERE f.salao_id = _salao_id
    AND hf.funcionario_id = _funcionario_id;
$$;

COMMENT ON FUNCTION public.portal_horarios_funcionario_public(uuid, uuid)
IS 'Retorna somente campos de horários necessários para o portal do cliente, filtrado por salao_id e funcionario_id (SECURITY DEFINER).';
