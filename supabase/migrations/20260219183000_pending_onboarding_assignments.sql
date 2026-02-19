-- Queue assessment assignments by email for candidates who have not registered yet.
-- When a user profile is created/updated with that email, queued assignments are materialized.

CREATE TABLE IF NOT EXISTS public.pending_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  availability_window_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (availability_window_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_via TEXT NOT NULL DEFAULT 'email',
  source_unit TEXT,
  source_file_name TEXT,
  resolved_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_test_assignments_email
  ON public.pending_test_assignments (email);

CREATE INDEX IF NOT EXISTS idx_pending_test_assignments_test_id
  ON public.pending_test_assignments (test_id);

CREATE INDEX IF NOT EXISTS idx_pending_test_assignments_is_active
  ON public.pending_test_assignments (is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_test_assignments_email_test_active
  ON public.pending_test_assignments (email, test_id, is_active);

CREATE OR REPLACE FUNCTION public.normalize_pending_test_assignment_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(trim(COALESCE(NEW.email, '')));
  IF NEW.email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_test_assignments_normalize_email ON public.pending_test_assignments;
CREATE TRIGGER trg_pending_test_assignments_normalize_email
BEFORE INSERT OR UPDATE OF email
ON public.pending_test_assignments
FOR EACH ROW
EXECUTE FUNCTION public.normalize_pending_test_assignment_email();

DROP TRIGGER IF EXISTS trg_pending_test_assignments_updated_at ON public.pending_test_assignments;
CREATE TRIGGER trg_pending_test_assignments_updated_at
BEFORE UPDATE ON public.pending_test_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.materialize_pending_test_assignments_for_user(p_user_id UUID, p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email TEXT := lower(trim(COALESCE(p_email, '')));
  applied_count INTEGER := 0;
BEGIN
  IF p_user_id IS NULL OR normalized_email = '' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.test_assignments (
    user_id,
    test_id,
    question_count,
    is_active,
    available_until,
    assigned_by,
    assigned_via,
    source_unit,
    source_file_name
  )
  SELECT
    p_user_id,
    p.test_id,
    p.question_count,
    true,
    now() + make_interval(mins => GREATEST(1, p.availability_window_minutes)),
    p.assigned_by,
    CASE
      WHEN p.assigned_via IN ('unit', 'csv', 'migration', 'manual') THEN p.assigned_via
      ELSE 'manual'
    END,
    p.source_unit,
    p.source_file_name
  FROM public.pending_test_assignments p
  WHERE p.is_active = true
    AND p.resolved_user_id IS NULL
    AND p.email = normalized_email
  ON CONFLICT (user_id, test_id) WHERE is_active = true
  DO UPDATE SET
    question_count = EXCLUDED.question_count,
    available_until = EXCLUDED.available_until,
    assigned_by = COALESCE(EXCLUDED.assigned_by, public.test_assignments.assigned_by),
    assigned_via = EXCLUDED.assigned_via,
    source_unit = EXCLUDED.source_unit,
    source_file_name = EXCLUDED.source_file_name,
    updated_at = now();

  UPDATE public.pending_test_assignments
  SET
    resolved_user_id = p_user_id,
    resolved_at = now(),
    updated_at = now()
  WHERE is_active = true
    AND resolved_user_id IS NULL
    AND email = normalized_email;

  GET DIAGNOSTICS applied_count = ROW_COUNT;
  RETURN applied_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_pending_test_assignments_on_user_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.materialize_pending_test_assignments_for_user(NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_sync_pending_test_assignments ON public.users;
CREATE TRIGGER trg_users_sync_pending_test_assignments
AFTER INSERT OR UPDATE OF email
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_pending_test_assignments_on_user_upsert();

ALTER TABLE public.pending_test_assignments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.pending_test_assignments
TO authenticated;

GRANT EXECUTE ON FUNCTION public.materialize_pending_test_assignments_for_user(UUID, TEXT)
TO authenticated;

DROP POLICY IF EXISTS pending_test_assignments_admin_all ON public.pending_test_assignments;
CREATE POLICY pending_test_assignments_admin_all
ON public.pending_test_assignments
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
);

