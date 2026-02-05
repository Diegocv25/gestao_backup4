-- Salão (MVP) schema

create extension if not exists pgcrypto;

-- Enums
DO $$ BEGIN
  create type public.agendamento_status as enum ('marcado','confirmado','concluido','cancelado');
EXCEPTION
  when duplicate_object then null;
END $$;

-- Core tables
create table if not exists public.saloes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  endereco text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dias_funcionamento (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  dia_semana smallint not null, -- 0=domingo ... 6=sabado
  abre_em time,
  fecha_em time,
  fechado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salao_id, dia_semana)
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  observacoes text,
  ultima_visita date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.horarios_funcionario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  dia_semana smallint not null,
  inicio time not null,
  fim time not null,
  almoco_inicio time,
  almoco_fim time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funcionario_id, dia_semana)
);

create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  nome text not null,
  duracao_minutos integer not null,
  valor numeric(12,2) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.servicos_funcionarios (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references public.servicos(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (servico_id, funcionario_id)
);

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  funcionario_id uuid not null references public.funcionarios(id) on delete restrict,
  data_hora_inicio timestamptz not null,
  total_duracao_minutos integer not null,
  total_valor numeric(12,2) not null,
  status public.agendamento_status not null default 'marcado',
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agendamentos_salao_data on public.agendamentos (salao_id, data_hora_inicio);
create index if not exists idx_agendamentos_funcionario_data on public.agendamentos (funcionario_id, data_hora_inicio);

-- Multi-serviço por agendamento (snapshot de preço/duração)
create table if not exists public.agendamento_itens (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  duracao_minutos integer not null,
  valor numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agendamento_itens_agendamento on public.agendamento_itens (agendamento_id);

-- Comissões (geradas ao concluir)
create table if not exists public.comissoes (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id) on delete restrict,
  base_valor numeric(12,2) not null,
  taxa_percentual numeric(5,2),
  valor_fixo numeric(12,2),
  valor_calculado numeric(12,2) not null,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  unique (agendamento_id) -- 1 comissão por agendamento no MVP
);

-- Timestamp helper
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_saloes_updated_at') then
    create trigger trg_saloes_updated_at before update on public.saloes for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_dias_funcionamento_updated_at') then
    create trigger trg_dias_funcionamento_updated_at before update on public.dias_funcionamento for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_clientes_updated_at') then
    create trigger trg_clientes_updated_at before update on public.clientes for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_funcionarios_updated_at') then
    create trigger trg_funcionarios_updated_at before update on public.funcionarios for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_horarios_funcionario_updated_at') then
    create trigger trg_horarios_funcionario_updated_at before update on public.horarios_funcionario for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_servicos_updated_at') then
    create trigger trg_servicos_updated_at before update on public.servicos for each row execute function public.update_updated_at_column();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_agendamentos_updated_at') then
    create trigger trg_agendamentos_updated_at before update on public.agendamentos for each row execute function public.update_updated_at_column();
  end if;
end $$;

-- Comissão + ultima_visita ao concluir
create or replace function public.handle_agendamento_concluido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taxa numeric(5,2);
  v_base numeric(12,2);
  v_valor numeric(12,2);
begin
  -- só quando transicionar para 'concluido'
  if (tg_op = 'UPDATE') and (old.status is distinct from new.status) and (new.status = 'concluido') then
    v_taxa := 40.00; -- padrão MVP: 40%
    v_base := new.total_valor;
    v_valor := round((v_base * v_taxa / 100.0)::numeric, 2);

    insert into public.comissoes (salao_id, agendamento_id, funcionario_id, base_valor, taxa_percentual, valor_calculado)
    values (new.salao_id, new.id, new.funcionario_id, v_base, v_taxa, v_valor)
    on conflict (agendamento_id) do nothing;

    update public.clientes
      set ultima_visita = (new.data_hora_inicio at time zone 'utc')::date
    where id = new.cliente_id;
  end if;

  return new;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_agendamentos_concluido') then
    create trigger trg_agendamentos_concluido
      after update on public.agendamentos
      for each row
      execute function public.handle_agendamento_concluido();
  end if;
end $$;

-- RLS (MVP): apenas usuários autenticados acessam
alter table public.saloes enable row level security;
alter table public.dias_funcionamento enable row level security;
alter table public.clientes enable row level security;
alter table public.funcionarios enable row level security;
alter table public.horarios_funcionario enable row level security;
alter table public.servicos enable row level security;
alter table public.servicos_funcionarios enable row level security;
alter table public.agendamentos enable row level security;
alter table public.agendamento_itens enable row level security;
alter table public.comissoes enable row level security;

-- Policies: allow authenticated full access (single-salão MVP)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['saloes','dias_funcionamento','clientes','funcionarios','horarios_funcionario','servicos','servicos_funcionarios','agendamentos','agendamento_itens','comissoes']
  LOOP
    EXECUTE format('drop policy if exists "%s_select" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_insert" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_update" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_delete" on public.%I', t, t);

    EXECUTE format('create policy "%s_select" on public.%I for select to authenticated using (true)', t, t);
    EXECUTE format('create policy "%s_insert" on public.%I for insert to authenticated with check (true)', t, t);
    EXECUTE format('create policy "%s_update" on public.%I for update to authenticated using (true) with check (true)', t, t);
    EXECUTE format('create policy "%s_delete" on public.%I for delete to authenticated using (true)', t, t);
  END LOOP;
END $$;
