-- Kiwify Phase 1: auditoria de webhook + estado de assinatura

create table if not exists public.kiwify_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  trigger text not null,
  event_hash text not null unique,
  order_id text,
  subscription_id text,
  customer_email text,
  raw_payload jsonb not null,
  raw_headers jsonb,
  processed_ok boolean not null default false,
  processed_at timestamptz,
  error text
);

create index if not exists idx_kiwify_events_received_at on public.kiwify_events (received_at desc);
create index if not exists idx_kiwify_events_trigger on public.kiwify_events (trigger);
create index if not exists idx_kiwify_events_order_id on public.kiwify_events (order_id);
create index if not exists idx_kiwify_events_subscription_id on public.kiwify_events (subscription_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'kiwify',
  customer_email text not null,
  status text not null default 'pending',
  product_id text,
  product_name text,
  order_id text,
  subscription_id text,
  current_period_end timestamptz,
  next_charge_at timestamptz,
  last_event_trigger text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (
    status in (
      'pending',
      'active',
      'late',
      'late_grace',
      'canceled',
      'refunded',
      'chargeback',
      'payment_failed'
    )
  )
);

create unique index if not exists uq_subscriptions_provider_email on public.subscriptions (provider, customer_email);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_order_id on public.subscriptions (order_id);
create index if not exists idx_subscriptions_subscription_id on public.subscriptions (subscription_id);

alter table public.kiwify_events enable row level security;
alter table public.subscriptions enable row level security;

-- Nega acesso direto por padrão; service_role continua com bypass
drop policy if exists "kiwify_events_no_direct_access" on public.kiwify_events;
create policy "kiwify_events_no_direct_access"
on public.kiwify_events
for all
using (false)
with check (false);

drop policy if exists "subscriptions_no_direct_access" on public.subscriptions;
create policy "subscriptions_no_direct_access"
on public.subscriptions
for all
using (false)
with check (false);
