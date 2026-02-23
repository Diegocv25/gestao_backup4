-- Tabela de clientes IA multi-tenant (por instância + cliente)
create table if not exists public.dados_clientes_ia (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid,
  instance_phone text not null,
  cliente_phone text not null,
  nomewpp text,
  atendimento_ia text not null default 'reativada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_dados_clientes_ia_tenant_cliente
  on public.dados_clientes_ia (instance_phone, cliente_phone);

create index if not exists idx_dados_clientes_ia_salao_id
  on public.dados_clientes_ia (salao_id);
create index if not exists idx_dados_clientes_ia_cliente_phone
  on public.dados_clientes_ia (cliente_phone);
create index if not exists idx_dados_clientes_ia_instance_phone
  on public.dados_clientes_ia (instance_phone);

create or replace function public.set_updated_at_dados_clientes_ia()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_dados_clientes_ia on public.dados_clientes_ia;
create trigger trg_set_updated_at_dados_clientes_ia
before update on public.dados_clientes_ia
for each row execute function public.set_updated_at_dados_clientes_ia();

alter table public.dados_clientes_ia enable row level security;

drop policy if exists dados_clientes_ia_select on public.dados_clientes_ia;
drop policy if exists dados_clientes_ia_insert on public.dados_clientes_ia;
drop policy if exists dados_clientes_ia_update on public.dados_clientes_ia;
drop policy if exists dados_clientes_ia_delete on public.dados_clientes_ia;

create policy dados_clientes_ia_select on public.dados_clientes_ia
for select to anon, authenticated using (true);
create policy dados_clientes_ia_insert on public.dados_clientes_ia
for insert to anon, authenticated with check (true);
create policy dados_clientes_ia_update on public.dados_clientes_ia
for update to anon, authenticated using (true) with check (true);
create policy dados_clientes_ia_delete on public.dados_clientes_ia
for delete to anon, authenticated using (true);
