create table if not exists public.ia_onboarding_tokens (
  token text primary key,
  user_id uuid not null,
  salao_id uuid not null references public.saloes(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists ia_onboarding_tokens_user_idx on public.ia_onboarding_tokens (user_id);
create index if not exists ia_onboarding_tokens_salao_idx on public.ia_onboarding_tokens (salao_id);
create index if not exists ia_onboarding_tokens_exp_idx on public.ia_onboarding_tokens (expires_at);

alter table public.ia_onboarding_tokens enable row level security;

-- Apenas service_role/manutenção acessa diretamente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ia_onboarding_tokens' AND policyname='ia_onboarding_tokens_service_role_all'
  ) THEN
    CREATE POLICY ia_onboarding_tokens_service_role_all
      ON public.ia_onboarding_tokens
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END$$;
