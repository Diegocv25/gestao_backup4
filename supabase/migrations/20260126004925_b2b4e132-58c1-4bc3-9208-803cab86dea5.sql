-- Adiciona coluna data_nascimento na tabela clientes
ALTER TABLE public.clientes
ADD COLUMN data_nascimento DATE NULL;