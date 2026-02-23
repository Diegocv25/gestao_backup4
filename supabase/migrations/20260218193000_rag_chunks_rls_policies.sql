-- Políticas RLS para permitir ingestão via n8n (credencial API)
-- OBS: endurecer depois com políticas por tenant/role quando credenciais de serviço estiverem padronizadas.

drop policy if exists rag_chunks_mt_select on public.rag_chunks_multi_tenant;
drop policy if exists rag_chunks_mt_insert on public.rag_chunks_multi_tenant;
drop policy if exists rag_chunks_mt_update on public.rag_chunks_multi_tenant;
drop policy if exists rag_chunks_mt_delete on public.rag_chunks_multi_tenant;

create policy rag_chunks_mt_select
on public.rag_chunks_multi_tenant
for select
to anon, authenticated
using (true);

create policy rag_chunks_mt_insert
on public.rag_chunks_multi_tenant
for insert
to anon, authenticated
with check (true);

create policy rag_chunks_mt_update
on public.rag_chunks_multi_tenant
for update
to anon, authenticated
using (true)
with check (true);

create policy rag_chunks_mt_delete
on public.rag_chunks_multi_tenant
for delete
to anon, authenticated
using (true);
