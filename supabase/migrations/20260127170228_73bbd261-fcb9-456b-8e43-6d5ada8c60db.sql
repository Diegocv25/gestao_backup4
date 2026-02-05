-- 1) Helper: customer access per salao (avoid current_salao_id() trap)
create or replace function public.has_customer_access(_salao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'customer'::public.app_role
      and ur.salao_id = _salao_id
  );
$$;

-- 2) RPC: find possible pre-registered cliente by email (no auto-link)
create or replace function public.portal_find_cliente_by_email(_salao_id uuid, _email text)
returns table(id uuid, nome text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- require auth
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if _salao_id is null or _email is null or length(trim(_email)) = 0 then
    return;
  end if;

  return query
  select c.id, c.nome
  from public.clientes c
  where c.salao_id = _salao_id
    and c.email is not null
    and lower(c.email) = lower(trim(_email))
    and c.auth_user_id is null
  order by c.created_at asc
  limit 1;
end;
$$;

-- 3) RLS: clientes (customer)
drop policy if exists clientes_customer_insert_own on public.clientes;
create policy "clientes_customer_insert_own"
on public.clientes
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and auth.uid() = auth_user_id
  and public.has_customer_access(salao_id)
);

drop policy if exists clientes_customer_select_own on public.clientes;
create policy "clientes_customer_select_own"
on public.clientes
for select
to authenticated
using (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and auth.uid() = auth_user_id
  and public.has_customer_access(salao_id)
);

drop policy if exists clientes_customer_update_own on public.clientes;
create policy "clientes_customer_update_own"
on public.clientes
for update
to authenticated
using (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and auth.uid() = auth_user_id
  and public.has_customer_access(salao_id)
)
with check (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and auth.uid() = auth_user_id
  and public.has_customer_access(salao_id)
);

-- 4) RLS: agendamentos (customer)
drop policy if exists agendamentos_customer_select_own on public.agendamentos;
create policy "agendamentos_customer_select_own"
on public.agendamentos
for select
to authenticated
using (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and public.has_customer_access(salao_id)
  and exists (
    select 1
    from public.clientes c
    where c.id = agendamentos.cliente_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = agendamentos.salao_id
  )
);

drop policy if exists agendamentos_customer_insert_own on public.agendamentos;
create policy "agendamentos_customer_insert_own"
on public.agendamentos
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and public.has_customer_access(salao_id)
  and exists (
    select 1
    from public.clientes c
    where c.id = agendamentos.cliente_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = agendamentos.salao_id
  )
);

drop policy if exists agendamentos_customer_update_own on public.agendamentos;
create policy "agendamentos_customer_update_own"
on public.agendamentos
for update
to authenticated
using (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and public.has_customer_access(salao_id)
  and exists (
    select 1
    from public.clientes c
    where c.id = agendamentos.cliente_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = agendamentos.salao_id
  )
)
with check (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and public.has_customer_access(salao_id)
  and exists (
    select 1
    from public.clientes c
    where c.id = agendamentos.cliente_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = agendamentos.salao_id
  )
);

drop policy if exists agendamentos_customer_delete_own on public.agendamentos;
create policy "agendamentos_customer_delete_own"
on public.agendamentos
for delete
to authenticated
using (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and public.has_customer_access(salao_id)
  and exists (
    select 1
    from public.clientes c
    where c.id = agendamentos.cliente_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = agendamentos.salao_id
  )
);

-- 5) RLS: agendamento_itens (customer)
drop policy if exists agendamento_itens_customer_own on public.agendamento_itens;
create policy "agendamento_itens_customer_own"
on public.agendamento_itens
for all
to authenticated
using (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and exists (
    select 1
    from public.agendamentos a
    join public.clientes c on c.id = a.cliente_id
    where a.id = agendamento_itens.agendamento_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = a.salao_id
      and public.has_customer_access(a.salao_id)
  )
)
with check (
  public.has_role(auth.uid(), 'customer'::public.app_role)
  and exists (
    select 1
    from public.agendamentos a
    join public.clientes c on c.id = a.cliente_id
    where a.id = agendamento_itens.agendamento_id
      and c.auth_user_id = auth.uid()
      and c.salao_id = a.salao_id
      and public.has_customer_access(a.salao_id)
  )
);

-- 6) RLS: servicos (allow customer read for the salao(s) they are customer in)
drop policy if exists servicos_select_roles on public.servicos;
create policy "servicos_select_roles"
on public.servicos
for select
to authenticated
using (
  (
    salao_id = public.current_salao_id()
    and (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or public.has_role(auth.uid(), 'staff'::public.app_role)
      or public.has_role(auth.uid(), 'gerente'::public.app_role)
      or public.has_role(auth.uid(), 'recepcionista'::public.app_role)
      or public.has_role(auth.uid(), 'profissional'::public.app_role)
    )
  )
  or (
    public.has_role(auth.uid(), 'customer'::public.app_role)
    and public.has_customer_access(salao_id)
  )
);
