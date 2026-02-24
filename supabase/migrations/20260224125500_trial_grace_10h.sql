-- Trial/subscription enforcement grace period
-- Allow access for 10 hours after `acesso_ate` to avoid mid-shift cutoffs.

begin;

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
        or (ce.acesso_ate + interval '10 hours') >= now()
      )
  );
$$;

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
        or (ce.acesso_ate + interval '10 hours') >= now()
      )
  );
$$;

commit;
