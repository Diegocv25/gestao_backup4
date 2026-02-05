-- Allow a one-time bootstrap of the first admin user (so existing projects don't lose access after enabling RBAC/RLS)

-- 1) Helper function (SECURITY DEFINER) to check if there is already an admin.
-- Uses SECURITY DEFINER to bypass RLS and avoid recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.can_bootstrap_first_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    _user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role
    )
  );
$$;

-- 2) Policy: allow authenticated user to insert their own 'admin' role only if no admin exists yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_roles'
      AND policyname = 'user_roles_insert_bootstrap_first_admin'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY user_roles_insert_bootstrap_first_admin
      ON public.user_roles
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND role = 'admin'::public.app_role
        AND public.can_bootstrap_first_admin(auth.uid())
      );
    $pol$;
  END IF;
END $$;

COMMENT ON FUNCTION public.can_bootstrap_first_admin(uuid)
IS 'Allows a one-time bootstrap of the first admin role when no admins exist yet. SECURITY DEFINER to bypass RLS and avoid recursion.';
