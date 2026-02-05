-- ============================================
-- MÓDULO DE PRODUTOS / ESTOQUE / VENDAS
-- ============================================

-- 1) Tabela de produtos
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salao_id UUID NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  preco_venda NUMERIC NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  custo_medio NUMERIC NOT NULL DEFAULT 0 CHECK (custo_medio >= 0),
  estoque_atual NUMERIC NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
  estoque_minimo NUMERIC NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_produtos_salao_id ON public.produtos(salao_id);
CREATE INDEX idx_produtos_ativo ON public.produtos(ativo);

-- RLS para produtos
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_select_roles"
  ON public.produtos FOR SELECT
  USING (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  );

CREATE POLICY "produtos_write_admin_staff_gerente"
  ON public.produtos FOR ALL
  USING (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role)
    )
  )
  WITH CHECK (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role)
    )
  );

CREATE POLICY "produtos_deny_anon_select"
  ON public.produtos FOR SELECT
  USING (false);

-- Trigger para updated_at
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2) Tabela de movimentações de estoque
CREATE TABLE public.movimentacoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salao_id UUID NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida_consumo', 'saida_venda')),
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_movimentacoes_estoque_salao_id ON public.movimentacoes_estoque(salao_id);
CREATE INDEX idx_movimentacoes_estoque_produto_id ON public.movimentacoes_estoque(produto_id);
CREATE INDEX idx_movimentacoes_estoque_tipo ON public.movimentacoes_estoque(tipo);
CREATE INDEX idx_movimentacoes_estoque_created_at ON public.movimentacoes_estoque(created_at);

-- RLS para movimentações
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimentacoes_estoque_select_roles"
  ON public.movimentacoes_estoque FOR SELECT
  USING (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  );

CREATE POLICY "movimentacoes_estoque_write_admin_staff_gerente_recep"
  ON public.movimentacoes_estoque FOR ALL
  USING (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  )
  WITH CHECK (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  );

CREATE POLICY "movimentacoes_estoque_deny_anon_select"
  ON public.movimentacoes_estoque FOR SELECT
  USING (false);

-- ============================================
-- 3) Tabela de vendas de produtos
CREATE TABLE public.vendas_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salao_id UUID NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade NUMERIC NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC NOT NULL CHECK (preco_unitario >= 0),
  total_venda NUMERIC NOT NULL CHECK (total_venda >= 0),
  custo_unitario NUMERIC NOT NULL CHECK (custo_unitario >= 0),
  total_custo NUMERIC NOT NULL CHECK (total_custo >= 0),
  lucro_bruto NUMERIC NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  forma_pagamento TEXT,
  cliente_nome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_vendas_produtos_salao_id ON public.vendas_produtos(salao_id);
CREATE INDEX idx_vendas_produtos_produto_id ON public.vendas_produtos(produto_id);
CREATE INDEX idx_vendas_produtos_funcionario_id ON public.vendas_produtos(funcionario_id);
CREATE INDEX idx_vendas_produtos_created_at ON public.vendas_produtos(created_at);

-- RLS para vendas
ALTER TABLE public.vendas_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_produtos_select_roles"
  ON public.vendas_produtos FOR SELECT
  USING (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  );

CREATE POLICY "vendas_produtos_write_admin_staff_gerente_recep"
  ON public.vendas_produtos FOR ALL
  USING (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  )
  WITH CHECK (
    salao_id = current_salao_id() 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'staff'::app_role) 
      OR has_role(auth.uid(), 'gerente'::app_role) 
      OR has_role(auth.uid(), 'recepcionista'::app_role)
    )
  );

CREATE POLICY "vendas_produtos_deny_anon_select"
  ON public.vendas_produtos FOR SELECT
  USING (false);