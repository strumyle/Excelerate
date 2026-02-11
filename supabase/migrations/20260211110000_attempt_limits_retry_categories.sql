-- Attempt limits, cumulative retry credits, and dedicated test categories.

-- 1) Dedicated test categories.
CREATE TABLE IF NOT EXISTS public.test_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_categories_name_lower_unique
  ON public.test_categories (lower(name));

CREATE INDEX IF NOT EXISTS idx_test_categories_name
  ON public.test_categories (name);

DROP TRIGGER IF EXISTS trg_test_categories_updated_at ON public.test_categories;
CREATE TRIGGER trg_test_categories_updated_at
BEFORE UPDATE ON public.test_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Extend tests with attempt limits and category reference.
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS attempt_limit INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.test_categories(id) ON DELETE SET NULL;

UPDATE public.tests
SET attempt_limit = 1
WHERE attempt_limit IS NULL OR attempt_limit <= 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tests_attempt_limit_positive'
  ) THEN
    ALTER TABLE public.tests
      ADD CONSTRAINT tests_attempt_limit_positive
      CHECK (attempt_limit > 0);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tests_category_id
  ON public.tests(category_id);

-- 3) Snapshot attempt limit into assignments.
ALTER TABLE public.test_assignments
  ADD COLUMN IF NOT EXISTS attempt_limit INTEGER NOT NULL DEFAULT 1;

UPDATE public.test_assignments ta
SET attempt_limit = t.attempt_limit
FROM public.tests t
WHERE ta.test_id = t.id
  AND (ta.attempt_limit IS NULL OR ta.attempt_limit <= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_assignments_attempt_limit_positive'
  ) THEN
    ALTER TABLE public.test_assignments
      ADD CONSTRAINT test_assignments_attempt_limit_positive
      CHECK (attempt_limit > 0);
  END IF;
END
$$;

-- 4) Make retake permissions cumulative credits.
ALTER TABLE public.test_retake_permissions
  ADD COLUMN IF NOT EXISTS granted_attempts INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.test_retake_permissions
  ADD COLUMN IF NOT EXISTS remaining_attempts INTEGER NOT NULL DEFAULT 1;

UPDATE public.test_retake_permissions
SET granted_attempts = 1
WHERE granted_attempts IS NULL OR granted_attempts <= 0;

UPDATE public.test_retake_permissions
SET remaining_attempts = 1
WHERE remaining_attempts IS NULL OR remaining_attempts < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_retake_permissions_granted_attempts_positive'
  ) THEN
    ALTER TABLE public.test_retake_permissions
      ADD CONSTRAINT test_retake_permissions_granted_attempts_positive
      CHECK (granted_attempts > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_retake_permissions_remaining_attempts_nonnegative'
  ) THEN
    ALTER TABLE public.test_retake_permissions
      ADD CONSTRAINT test_retake_permissions_remaining_attempts_nonnegative
      CHECK (remaining_attempts >= 0);
  END IF;
END
$$;

-- 5) RLS / grants for test categories and special-admin fallback for retry table.
ALTER TABLE public.test_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.test_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.test_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.test_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.test_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.test_retake_permissions TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_categories'
      AND policyname = 'test_categories_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY test_categories_admin_all ON public.test_categories';
  END IF;

  EXECUTE $p$
    CREATE POLICY test_categories_admin_all
    ON public.test_categories
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
      AND tablename = 'test_categories'
      AND policyname = 'test_categories_authenticated_read'
  ) THEN
    EXECUTE 'DROP POLICY test_categories_authenticated_read ON public.test_categories';
  END IF;

  EXECUTE $p$
    CREATE POLICY test_categories_authenticated_read
    ON public.test_categories
    FOR SELECT
    USING (auth.uid() IS NOT NULL)
  $p$;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_retake_permissions'
      AND policyname = 'Admins can manage retake permissions'
  ) THEN
    EXECUTE 'DROP POLICY "Admins can manage retake permissions" ON public.test_retake_permissions';
  END IF;

  EXECUTE $p$
    CREATE POLICY "Admins can manage retake permissions"
    ON public.test_retake_permissions
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
      AND tablename = 'test_retake_permissions'
      AND policyname = 'Users can view their retake permissions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view their retake permissions" ON public.test_retake_permissions';
  END IF;

  EXECUTE $p$
    CREATE POLICY "Users can view their retake permissions"
    ON public.test_retake_permissions
    FOR SELECT
    USING (user_id = auth.uid())
  $p$;
END
$$;
