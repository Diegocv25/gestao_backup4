-- =========================================
-- RLS policies explícitas (nega tudo) para as tabelas do Portal
-- Objetivo: impedir acesso via client SDK e remover aviso "RLS Enabled No Policy".
-- O Portal acessa estes dados somente via Edge Functions (service role).
-- =========================================

-- portal_accounts
ALTER TABLE public.portal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_accounts_deny_all_select ON public.portal_accounts;
CREATE POLICY portal_accounts_deny_all_select
ON public.portal_accounts
FOR SELECT
USING (false);

DROP POLICY IF EXISTS portal_accounts_deny_all_insert ON public.portal_accounts;
CREATE POLICY portal_accounts_deny_all_insert
ON public.portal_accounts
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS portal_accounts_deny_all_update ON public.portal_accounts;
CREATE POLICY portal_accounts_deny_all_update
ON public.portal_accounts
FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS portal_accounts_deny_all_delete ON public.portal_accounts;
CREATE POLICY portal_accounts_deny_all_delete
ON public.portal_accounts
FOR DELETE
USING (false);


-- portal_sessions
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_sessions_deny_all_select ON public.portal_sessions;
CREATE POLICY portal_sessions_deny_all_select
ON public.portal_sessions
FOR SELECT
USING (false);

DROP POLICY IF EXISTS portal_sessions_deny_all_insert ON public.portal_sessions;
CREATE POLICY portal_sessions_deny_all_insert
ON public.portal_sessions
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS portal_sessions_deny_all_update ON public.portal_sessions;
CREATE POLICY portal_sessions_deny_all_update
ON public.portal_sessions
FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS portal_sessions_deny_all_delete ON public.portal_sessions;
CREATE POLICY portal_sessions_deny_all_delete
ON public.portal_sessions
FOR DELETE
USING (false);


-- portal_password_resets
ALTER TABLE public.portal_password_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_password_resets_deny_all_select ON public.portal_password_resets;
CREATE POLICY portal_password_resets_deny_all_select
ON public.portal_password_resets
FOR SELECT
USING (false);

DROP POLICY IF EXISTS portal_password_resets_deny_all_insert ON public.portal_password_resets;
CREATE POLICY portal_password_resets_deny_all_insert
ON public.portal_password_resets
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS portal_password_resets_deny_all_update ON public.portal_password_resets;
CREATE POLICY portal_password_resets_deny_all_update
ON public.portal_password_resets
FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS portal_password_resets_deny_all_delete ON public.portal_password_resets;
CREATE POLICY portal_password_resets_deny_all_delete
ON public.portal_password_resets
FOR DELETE
USING (false);
