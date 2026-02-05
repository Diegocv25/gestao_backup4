-- Tighten RLS policies to avoid permissive (true) checks
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['saloes','dias_funcionamento','clientes','funcionarios','horarios_funcionario','servicos','servicos_funcionarios','agendamentos','agendamento_itens','comissoes']
  LOOP
    EXECUTE format('drop policy if exists "%s_select" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_insert" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_update" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_delete" on public.%I', t, t);

    -- authenticated-only gate
    EXECUTE format('create policy "%s_select" on public.%I for select to authenticated using (auth.uid() is not null)', t, t);
    EXECUTE format('create policy "%s_insert" on public.%I for insert to authenticated with check (auth.uid() is not null)', t, t);
    EXECUTE format('create policy "%s_update" on public.%I for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)', t, t);
    EXECUTE format('create policy "%s_delete" on public.%I for delete to authenticated using (auth.uid() is not null)', t, t);
  END LOOP;
END $$;
