-- Define dimensão fixa de embedding para o RAG multi-tenant
-- Modelo: text-embedding-3-small (1536 dimensões)

alter table public.rag_chunks_multi_tenant
  alter column embedding type vector(1536)
  using embedding::vector(1536);

create index if not exists idx_rag_chunks_multi_tenant_embedding_hnsw
  on public.rag_chunks_multi_tenant using hnsw (embedding vector_cosine_ops);
