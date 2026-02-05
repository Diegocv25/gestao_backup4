-- Tabela de recebimentos (forma de pagamento) para controle financeiro
-- Cada agendamento concluído deve ter um recebimento associado.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'forma_pagamento') THEN
    CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'dinheiro', 'cartao');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.recebimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salao_id UUID NOT NULL,
  agendamento_id UUID NULL UNIQUE,
  venda_produto_id UUID NULL,
  forma public.forma_pagamento NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FKs (comportamento seguro: se apagar agendamento, apaga recebimento; mesmo para venda no futuro)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recebimentos_agendamento_id_fkey'
  ) THEN
    ALTER TABLE public.recebimentos
      ADD CONSTRAINT recebimentos_agendamento_id_fkey
      FOREIGN KEY (agendamento_id)
      REFERENCES public.agendamentos(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recebimentos_venda_produto_id_fkey'
  ) THEN
    -- FK placeholder para o futuro: vendas_produtos já existe
    ALTER TABLE public.recebimentos
      ADD CONSTRAINT recebimentos_venda_produto_id_fkey
      FOREIGN KEY (venda_produto_id)
      REFERENCES public.vendas_produtos(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recebimentos_salao_created_at ON public.recebimentos (salao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recebimentos_agendamento ON public.recebimentos (agendamento_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_venda_produto ON public.recebimentos (venda_produto_id);

-- RLS
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

-- Backoffice (admin/staff/gerente/recepcionista): acesso total no salão atual
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recebimentos' AND policyname='recebimentos_backoffice_all'
  ) THEN
    CREATE POLICY "recebimentos_backoffice_all"
    ON public.recebimentos
    FOR ALL
    USING (
      salao_id = public.current_salao_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'staff'::public.app_role)
        OR public.has_role(auth.uid(), 'gerente'::public.app_role)
        OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      )
    )
    WITH CHECK (
      salao_id = public.current_salao_id()
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'staff'::public.app_role)
        OR public.has_role(auth.uid(), 'gerente'::public.app_role)
        OR public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      )
    );
  END IF;
END $$;

-- Profissional: pode ver/criar/editar recebimento apenas dos próprios agendamentos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recebimentos' AND policyname='recebimentos_profissional_own'
  ) THEN
    CREATE POLICY "recebimentos_profissional_own"
    ON public.recebimentos
    FOR ALL
    USING (
      public.has_role(auth.uid(), 'profissional'::public.app_role)
      AND salao_id = public.current_salao_id()
      AND (
        agendamento_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.agendamentos a
          JOIN public.funcionarios f ON f.id = a.funcionario_id
          WHERE a.id = recebimentos.agendamento_id
            AND a.salao_id = public.current_salao_id()
            AND f.auth_user_id = auth.uid()
        )
      )
    )
    WITH CHECK (
      public.has_role(auth.uid(), 'profissional'::public.app_role)
      AND salao_id = public.current_salao_id()
      AND (
        agendamento_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.agendamentos a
          JOIN public.funcionarios f ON f.id = a.funcionario_id
          WHERE a.id = recebimentos.agendamento_id
            AND a.salao_id = public.current_salao_id()
            AND f.auth_user_id = auth.uid()
        )
      )
    );
  END IF;
END $$;

-- Bloqueia anon
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='recebimentos' AND policyname='recebimentos_deny_anon_select'
  ) THEN
    CREATE POLICY "recebimentos_deny_anon_select"
    ON public.recebimentos
    FOR SELECT
    USING (false);
  END IF;
END $$;