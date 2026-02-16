-- Enforce mandatory camera/audio proctoring for all tests.

UPDATE public.tests
SET proctoring_required = TRUE
WHERE proctoring_required IS DISTINCT FROM TRUE;

ALTER TABLE public.tests
  ALTER COLUMN proctoring_required SET DEFAULT TRUE;

ALTER TABLE public.tests
  ALTER COLUMN proctoring_required SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tests_proctoring_required_mandatory'
      AND conrelid = 'public.tests'::regclass
  ) THEN
    ALTER TABLE public.tests
      ADD CONSTRAINT tests_proctoring_required_mandatory
      CHECK (proctoring_required = TRUE);
  END IF;
END
$$;
