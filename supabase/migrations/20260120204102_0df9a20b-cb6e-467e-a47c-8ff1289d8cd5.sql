-- Ajusta cálculo de comissão: sem default 40% e sem depender de comissao_tipo.
-- Comissão passa a ser baseada somente em comissao_percentual (0 quando nulo).
CREATE OR REPLACE FUNCTION public.handle_agendamento_concluido()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_percentual numeric(5,2);
  v_base numeric(12,2);
  v_valor numeric(12,2);
BEGIN
  -- só quando transicionar para 'concluido'
  IF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'concluido') THEN

    v_base := NEW.total_valor;

    SELECT COALESCE(f.comissao_percentual, 0)
      INTO v_percentual
    FROM public.funcionarios f
    WHERE f.id = NEW.funcionario_id;

    v_valor := round((v_base * v_percentual / 100.0)::numeric, 2);

    INSERT INTO public.comissoes (salao_id, agendamento_id, funcionario_id, base_valor, taxa_percentual, valor_calculado)
    VALUES (NEW.salao_id, NEW.id, NEW.funcionario_id, v_base, v_percentual, v_valor)
    ON CONFLICT (agendamento_id) DO NOTHING;

    UPDATE public.clientes
      SET ultima_visita = (NEW.data_hora_inicio AT TIME ZONE 'utc')::date
    WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END;
$function$;