-- Fix SECURITY DEFINER functions to avoid bypassing RLS boundaries

-- update_updated_at_column: no need for elevated privileges
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- handle_agendamento_concluido: should run with invoker privileges so RLS applies
CREATE OR REPLACE FUNCTION public.handle_agendamento_concluido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_taxa numeric(5,2);
  v_base numeric(12,2);
  v_valor numeric(12,2);
BEGIN
  -- só quando transicionar para 'concluido'
  IF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'concluido') THEN
    v_taxa := 40.00; -- padrão MVP: 40%
    v_base := NEW.total_valor;
    v_valor := round((v_base * v_taxa / 100.0)::numeric, 2);

    INSERT INTO public.comissoes (salao_id, agendamento_id, funcionario_id, base_valor, taxa_percentual, valor_calculado)
    VALUES (NEW.salao_id, NEW.id, NEW.funcionario_id, v_base, v_taxa, v_valor)
    ON CONFLICT (agendamento_id) DO NOTHING;

    UPDATE public.clientes
      SET ultima_visita = (NEW.data_hora_inicio AT TIME ZONE 'utc')::date
    WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END;
$$;
