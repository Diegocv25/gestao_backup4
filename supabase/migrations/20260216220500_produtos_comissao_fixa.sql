-- Comissão fixa por produto + registro da comissão da venda para funcionário

alter table public.produtos
  add column if not exists comissao_valor_fixo numeric not null default 0;

alter table public.produtos
  add constraint produtos_comissao_valor_fixo_nonnegative
  check (comissao_valor_fixo >= 0);

alter table public.vendas_produtos
  add column if not exists comissao_funcionario numeric not null default 0;

alter table public.vendas_produtos
  add constraint vendas_produtos_comissao_funcionario_nonnegative
  check (comissao_funcionario >= 0);

-- Preenche retroativo sem quebrar histórico
update public.vendas_produtos
set comissao_funcionario = 0
where comissao_funcionario is null;
