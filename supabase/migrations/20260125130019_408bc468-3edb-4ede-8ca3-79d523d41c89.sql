-- Function que valida se um agendamento conflita com outros existentes
CREATE OR REPLACE FUNCTION public.validate_agendamento_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fim_novo timestamptz;
  v_conflito_count integer;
BEGIN
  -- Calcula o fim do novo agendamento
  v_fim_novo := NEW.data_hora_inicio + (NEW.total_duracao_minutos || ' minutes')::interval;
  
  -- Verifica se existe algum agendamento que conflita:
  -- - Mesmo funcionário
  -- - Mesmo dia
  -- - Status diferente de 'cancelado'
  -- - Que se sobreponha no tempo
  -- - Excluindo o próprio agendamento em caso de UPDATE
  SELECT COUNT(*)
  INTO v_conflito_count
  FROM public.agendamentos a
  WHERE a.funcionario_id = NEW.funcionario_id
    AND a.status != 'cancelado'
    AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      -- O novo agendamento começa durante um existente
      (NEW.data_hora_inicio >= a.data_hora_inicio 
       AND NEW.data_hora_inicio < a.data_hora_inicio + (a.total_duracao_minutos || ' minutes')::interval)
      OR
      -- O novo agendamento termina durante um existente
      (v_fim_novo > a.data_hora_inicio 
       AND v_fim_novo <= a.data_hora_inicio + (a.total_duracao_minutos || ' minutes')::interval)
      OR
      -- O novo agendamento engloba completamente um existente
      (NEW.data_hora_inicio <= a.data_hora_inicio 
       AND v_fim_novo >= a.data_hora_inicio + (a.total_duracao_minutos || ' minutes')::interval)
    );
  
  -- Se encontrou conflito, impede a operação
  IF v_conflito_count > 0 THEN
    RAISE EXCEPTION 'Este horário já está ocupado para este profissional. Por favor, escolha outro horário.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Cria trigger BEFORE INSERT OR UPDATE para validar conflitos
DROP TRIGGER IF EXISTS trigger_validate_agendamento_conflict ON public.agendamentos;

CREATE TRIGGER trigger_validate_agendamento_conflict
  BEFORE INSERT OR UPDATE OF data_hora_inicio, total_duracao_minutos, funcionario_id, status
  ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_agendamento_conflict();