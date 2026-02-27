-- Permitir pagamento dividido: múltiplos recebimentos por agendamento
-- Antes: unique(agendamento_id) em public.recebimentos
-- Depois: remover unique para permitir 1:N

alter table public.recebimentos
  drop constraint if exists recebimentos_agendamento_id_key;

-- índice já existe: idx_recebimentos_agendamento (agendamento_id)
