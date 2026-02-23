-- RAG multi-tenant rastreável por salao_id + instance_phone
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.rag_chunks_multi_tenant (
  id uuid primary key default gen_random_uuid(),
  salao_id uuid not null references public.saloes(id) on delete cascade,
  instance_phone text not null,
  source text not null default 'onboarding_form',
  source_ref text,
  block_number integer,
  chunk_name text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rag_chunks_multi_tenant_salao_id
  on public.rag_chunks_multi_tenant (salao_id);

create index if not exists idx_rag_chunks_multi_tenant_instance_phone
  on public.rag_chunks_multi_tenant (instance_phone);

create index if not exists idx_rag_chunks_multi_tenant_source
  on public.rag_chunks_multi_tenant (source);

create index if not exists idx_rag_chunks_multi_tenant_metadata_gin
  on public.rag_chunks_multi_tenant using gin (metadata);

-- IMPORTANTE:
-- Para index vetorial HNSW/IVFFLAT é necessário definir dimensão fixa no campo embedding
-- (ex.: vector(1536) para text-embedding-3-small).
-- Como o modelo pode variar no ambiente atual, o índice vetorial não foi criado nesta migration.

create or replace function public.set_updated_at_rag_chunks_multi_tenant()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_rag_chunks_multi_tenant on public.rag_chunks_multi_tenant;
create trigger trg_set_updated_at_rag_chunks_multi_tenant
before update on public.rag_chunks_multi_tenant
for each row execute function public.set_updated_at_rag_chunks_multi_tenant();

create or replace view public.v_rag_chunks_rastreio as
select
  r.id,
  r.salao_id,
  s.nome as salao_nome,
  s.telefone as salao_telefone_config,
  r.instance_phone as instance_phone_rag,
  r.source,
  r.source_ref,
  r.block_number,
  r.chunk_name,
  left(r.content, 180) as content_preview,
  r.metadata,
  r.created_at,
  r.updated_at
from public.rag_chunks_multi_tenant r
join public.saloes s on s.id = r.salao_id;