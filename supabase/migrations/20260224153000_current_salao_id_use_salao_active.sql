-- Fix employee access after trial enforcement
-- current_salao_id() must validate access by salon (admin) validity, not by the employee's own `cadastros_estabelecimento`.

begin;

create or replace function public.current_salao_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select ur.salao_id
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and public.has_salao_active(ur.salao_id)
  order by ur.created_at asc
  limit 1;
$$;

commit;
