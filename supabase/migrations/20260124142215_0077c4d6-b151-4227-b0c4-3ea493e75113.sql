-- Hardening: negar explicitamente SELECT para role anon em todas as tabelas do schema public.
-- Isso elimina falsos-positivos e garante que nada vaze sem login, mesmo com policies genéricas.

DO $$
DECLARE
  t text;
  policy text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'agendamento_itens',
      'agendamentos',
      'clientes',
      'comissoes',
      'despesas_variaveis',
      'dias_funcionamento',
      'folha_salarial_mensal',
      'funcionarios',
      'horarios_funcionario',
      'saloes',
      'servicos',
      'servicos_funcionarios',
      'user_roles'
    ])
  LOOP
    policy := format('%s_deny_anon_select', t);

    -- drop if exists
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = policy
    ) THEN
      EXECUTE format('DROP POLICY %I ON public.%I', policy, t);
    END IF;

    -- create restrictive deny policy for anon
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (false)',
      policy,
      t
    );
  END LOOP;
END $$;
