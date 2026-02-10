-- Revamp assessment assignment model to support per-candidate randomized question sets.

-- 1) New assignment source-of-truth table.
CREATE TABLE IF NOT EXISTS public.test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_via TEXT NOT NULL DEFAULT 'manual'
    CHECK (assigned_via IN ('unit', 'csv', 'migration', 'manual')),
  source_unit TEXT,
  source_file_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_assignments_user_id
  ON public.test_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_test_assignments_test_id
  ON public.test_assignments(test_id);

CREATE INDEX IF NOT EXISTS idx_test_assignments_is_active
  ON public.test_assignments(is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_assignments_active_user_test
  ON public.test_assignments(user_id, test_id)
  WHERE is_active = true;

-- Keep updated_at current on assignment updates.
CREATE OR REPLACE FUNCTION public.update_test_assignments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_test_assignments_updated_at ON public.test_assignments;
CREATE TRIGGER trg_test_assignments_updated_at
BEFORE UPDATE ON public.test_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_test_assignments_updated_at();

-- 2) Extend submissions with assignment and locked question set.
ALTER TABLE public.test_submissions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.test_assignments(id) ON DELETE SET NULL;

ALTER TABLE public.test_submissions
  ADD COLUMN IF NOT EXISTS question_ids UUID[];

CREATE INDEX IF NOT EXISTS idx_test_submissions_assignment_id
  ON public.test_submissions(assignment_id);

-- 3) Backfill assignments from legacy users.assigned_test_type.
WITH legacy AS (
  SELECT
    u.id AS user_id,
    u.assigned_test_type,
    t_direct.id AS direct_test_id,
    t_type.id AS type_test_id
  FROM public.users u
  LEFT JOIN public.tests t_direct
    ON t_direct.id::text = u.assigned_test_type
  LEFT JOIN LATERAL (
    SELECT t2.id
    FROM public.tests t2
    WHERE t2.test_type = u.assigned_test_type
    ORDER BY COALESCE(t2.is_active, false) DESC, t2.created_at DESC
    LIMIT 1
  ) t_type ON true
  WHERE u.assigned_test_type IS NOT NULL
),
resolved AS (
  SELECT
    user_id,
    COALESCE(direct_test_id, type_test_id) AS test_id
  FROM legacy
)
INSERT INTO public.test_assignments (
  user_id,
  test_id,
  question_count,
  is_active,
  assigned_by,
  assigned_via
)
SELECT
  r.user_id,
  r.test_id,
  COALESCE(array_length(t.question_ids, 1), 0),
  true,
  NULL,
  'migration'
FROM resolved r
JOIN public.tests t
  ON t.id = r.test_id
WHERE r.test_id IS NOT NULL
  AND COALESCE(array_length(t.question_ids, 1), 0) > 0
ON CONFLICT DO NOTHING;

-- 4) Backfill historical submissions with assignment_id/question_ids where missing.
UPDATE public.test_submissions ts
SET assignment_id = ta.id
FROM public.test_assignments ta
WHERE ts.assignment_id IS NULL
  AND ts.user_id = ta.user_id
  AND ts.test_id = ta.test_id
  AND ta.is_active = true;

UPDATE public.test_submissions ts
SET question_ids = t.question_ids
FROM public.tests t
WHERE ts.question_ids IS NULL
  AND ts.test_id = t.id;

-- 5) RLS: assignment table and submission ownership/admin access.
ALTER TABLE public.test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_assignments'
      AND policyname = 'test_assignments_admin_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY test_assignments_admin_all
      ON public.test_assignments
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_assignments'
      AND policyname = 'test_assignments_candidate_select_own_active'
  ) THEN
    EXECUTE $p$
      CREATE POLICY test_assignments_candidate_select_own_active
      ON public.test_assignments
      FOR SELECT
      USING (
        user_id = auth.uid()
        AND is_active = true
      )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_submissions'
      AND policyname = 'test_submissions_admin_all'
  ) THEN
    EXECUTE $p$
      CREATE POLICY test_submissions_admin_all
      ON public.test_submissions
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
      )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_submissions'
      AND policyname = 'test_submissions_user_select_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY test_submissions_user_select_own
      ON public.test_submissions
      FOR SELECT
      USING (user_id = auth.uid())
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_submissions'
      AND policyname = 'test_submissions_user_insert_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY test_submissions_user_insert_own
      ON public.test_submissions
      FOR INSERT
      WITH CHECK (user_id = auth.uid())
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'test_submissions'
      AND policyname = 'test_submissions_user_update_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY test_submissions_user_update_own
      ON public.test_submissions
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    $p$;
  END IF;
END
$$;
