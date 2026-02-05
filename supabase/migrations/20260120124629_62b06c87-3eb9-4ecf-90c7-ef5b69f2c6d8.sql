-- Etapa base para funcionalidades pedidas: comissões por funcionário, intervalos do salão e triggers

-- 1) Enum para tipo de comissão
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comissao_tipo') THEN
    CREATE TYPE public.comissao_tipo AS ENUM ('percentual','fixo');
  END IF;
END $$;

-- 2) Funcionários: carga + comissão configurável
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS carga TEXT,
  ADD COLUMN IF NOT EXISTS comissao_tipo public.comissao_tipo NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS comissao_percentual NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS comissao_valor_fixo NUMERIC(12,2);

-- 3) Dias de funcionamento: intervalo do salão (opcional)
ALTER TABLE public.dias_funcionamento
  ADD COLUMN IF NOT EXISTS intervalo_inicio TIME,
  ADD COLUMN IF NOT EXISTS intervalo_fim TIME;

-- 4) Função de comissão/última visita: usa configuração do funcionário
CREATE OR REPLACE FUNCTION public.handle_agendamento_concluido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo public.comissao_tipo;
  v_percentual numeric(5,2);
  v_fixo numeric(12,2);
  v_base numeric(12,2);
  v_valor numeric(12,2);
BEGIN
  -- só quando transicionar para 'concluido'
  IF (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'concluido') THEN

    v_base := NEW.total_valor;

    SELECT f.comissao_tipo, f.comissao_percentual, f.comissao_valor_fixo
      INTO v_tipo, v_percentual, v_fixo
    FROM public.funcionarios f
    WHERE f.id = NEW.funcionario_id;

    -- defaults seguros
    IF v_tipo IS NULL THEN
      v_tipo := 'percentual';
    END IF;

    IF v_tipo = 'fixo' THEN
      v_valor := COALESCE(v_fixo, 0);
      INSERT INTO public.comissoes (salao_id, agendamento_id, funcionario_id, base_valor, valor_fixo, valor_calculado)
      VALUES (NEW.salao_id, NEW.id, NEW.funcionario_id, v_base, COALESCE(v_fixo, 0), round(COALESCE(v_fixo, 0)::numeric, 2))
      ON CONFLICT (agendamento_id) DO NOTHING;
    ELSE
      v_percentual := COALESCE(v_percentual, 40.00);
      v_valor := round((v_base * v_percentual / 100.0)::numeric, 2);
      INSERT INTO public.comissoes (salao_id, agendamento_id, funcionario_id, base_valor, taxa_percentual, valor_calculado)
      VALUES (NEW.salao_id, NEW.id, NEW.funcionario_id, v_base, v_percentual, v_valor)
      ON CONFLICT (agendamento_id) DO NOTHING;
    END IF;

    UPDATE public.clientes
      SET ultima_visita = (NEW.data_hora_inicio AT TIME ZONE 'utc')::date
    WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Triggers: updated_at + comissão no agendamento

-- updated_at (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_saloes_updated_at') THEN
    CREATE TRIGGER trg_saloes_updated_at
    BEFORE UPDATE ON public.saloes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_dias_funcionamento_updated_at') THEN
    CREATE TRIGGER trg_dias_funcionamento_updated_at
    BEFORE UPDATE ON public.dias_funcionamento
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_clientes_updated_at') THEN
    CREATE TRIGGER trg_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_funcionarios_updated_at') THEN
    CREATE TRIGGER trg_funcionarios_updated_at
    BEFORE UPDATE ON public.funcionarios
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_horarios_funcionario_updated_at') THEN
    CREATE TRIGGER trg_horarios_funcionario_updated_at
    BEFORE UPDATE ON public.horarios_funcionario
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_servicos_updated_at') THEN
    CREATE TRIGGER trg_servicos_updated_at
    BEFORE UPDATE ON public.servicos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agendamentos_updated_at') THEN
    CREATE TRIGGER trg_agendamentos_updated_at
    BEFORE UPDATE ON public.agendamentos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_handle_agendamento_concluido') THEN
    CREATE TRIGGER trg_handle_agendamento_concluido
    AFTER UPDATE ON public.agendamentos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.handle_agendamento_concluido();
  END IF;
END $$;