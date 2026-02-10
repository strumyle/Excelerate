-- Allow special admin account to manage assignments/submissions even if users.role is not set.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_assignments'
      AND policyname = 'test_assignments_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY test_assignments_admin_all ON public.test_assignments';
  END IF;

  EXECUTE $p$
    CREATE POLICY test_assignments_admin_all
    ON public.test_assignments
    FOR ALL
    USING (
      auth.uid() = '600a8af2-9ccf-4c55-b351-a14e2b5b2221'
      OR (auth.jwt() ->> 'email') = 'ameh.oche@babbangona.com'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
      )
    )
    WITH CHECK (
      auth.uid() = '600a8af2-9ccf-4c55-b351-a14e2b5b2221'
      OR (auth.jwt() ->> 'email') = 'ameh.oche@babbangona.com'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
      )
    )
  $p$;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_submissions'
      AND policyname = 'test_submissions_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY test_submissions_admin_all ON public.test_submissions';
  END IF;

  EXECUTE $p$
    CREATE POLICY test_submissions_admin_all
    ON public.test_submissions
    FOR ALL
    USING (
      auth.uid() = '600a8af2-9ccf-4c55-b351-a14e2b5b2221'
      OR (auth.jwt() ->> 'email') = 'ameh.oche@babbangona.com'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
      )
    )
    WITH CHECK (
      auth.uid() = '600a8af2-9ccf-4c55-b351-a14e2b5b2221'
      OR (auth.jwt() ->> 'email') = 'ameh.oche@babbangona.com'
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
      )
    )
  $p$;
END
$$;
