-- Enforce trial/subscription access by `cadastros_estabelecimento.acesso_ate`
-- Goal: block all salon data access after trial expires, but allow access again after subscription payment updates `acesso_ate`.

begin;

-- 1) active access by user_id
create or replace function public.has_active_access(_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.cadastros_estabelecimento ce
    where ce.user_id = _user_id
      and (
        ce.acesso_ate is null
        or ce.acesso_ate >= now()
      )
  );
$$;

-- 2) active access by salao_id (used for customer policies)
create or replace function public.has_salao_active(_salao_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.cadastros_estabelecimento ce on ce.user_id = ur.user_id
    where ur.salao_id = _salao_id
      and ur.role = 'admin'::public.app_role
      and (
        ce.acesso_ate is null
        or ce.acesso_ate >= now()
      )
  );
$$;

-- 3) Make current_salao_id() return NULL when access expired
-- Most RLS policies compare (salao_id = current_salao_id()), so returning NULL effectively blocks access.
create or replace function public.current_salao_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select ur.salao_id
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and public.has_active_access(auth.uid())
  order by ur.created_at asc
  limit 1;
$$;

-- 4) Customers should only access if the salao is active
create or replace function public.has_customer_access(_salao_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'customer'::public.app_role
      and ur.salao_id = _salao_id
  )
  and public.has_salao_active(_salao_id);
$$;

commit;
