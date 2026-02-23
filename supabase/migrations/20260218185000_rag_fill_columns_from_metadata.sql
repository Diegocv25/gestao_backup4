-- Preenche colunas obrigatórias do RAG multi-tenant a partir do metadata
-- Necessário para compatibilizar ingestão via n8n Vector Store (content/metadata/embedding)

create or replace function public.rag_chunks_fill_from_metadata()
returns trigger
language plpgsql
as $$
begin
  if new.salao_id is null and (new.metadata ? 'salao_id') then
    new.salao_id := (new.metadata->>'salao_id')::uuid;
  end if;

  if (new.instance_phone is null or new.instance_phone = '') and (new.metadata ? 'instance_phone') then
    new.instance_phone := regexp_replace(new.metadata->>'instance_phone', '\\D', '', 'g');
  end if;

  if new.source_ref is null and (new.metadata ? 'source_ref') then
    new.source_ref := new.metadata->>'source_ref';
  end if;

  if new.block_number is null and (new.metadata ? 'block_number') then
    new.block_number := nullif(new.metadata->>'block_number','')::integer;
  end if;

  if new.chunk_name is null and (new.metadata ? 'name') then
    new.chunk_name := new.metadata->>'name';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_rag_chunks_fill_from_metadata on public.rag_chunks_multi_tenant;
create trigger trg_rag_chunks_fill_from_metadata
before insert on public.rag_chunks_multi_tenant
for each row execute function public.rag_chunks_fill_from_metadata();
