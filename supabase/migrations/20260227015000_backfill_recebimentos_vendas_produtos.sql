-- Backfill: criar recebimentos para vendas de produtos antigas
-- Motivo: Fluxo de Caixa passa a calcular entradas somente por public.recebimentos

insert into public.recebimentos (salao_id, venda_produto_id, forma, valor, created_at)
select
  vp.salao_id,
  vp.id as venda_produto_id,
  vp.forma_pagamento::forma_pagamento as forma,
  vp.total_venda as valor,
  vp.created_at
from public.vendas_produtos vp
where vp.forma_pagamento is not null
  and not exists (
    select 1
    from public.recebimentos r
    where r.venda_produto_id = vp.id
  );
