-- Add per-candidate question count to tests (default question count for assignments).

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS question_count INTEGER;

-- Backfill with the full bank size where possible.
UPDATE public.tests
SET question_count = CASE
  WHEN question_count IS NOT NULL THEN question_count
  WHEN question_ids IS NULL THEN NULL
  WHEN array_length(question_ids, 1) IS NULL THEN NULL
  WHEN array_length(question_ids, 1) = 0 THEN NULL
  ELSE array_length(question_ids, 1)
END;

-- Normalize invalid values before adding constraint.
UPDATE public.tests
SET question_count = NULL
WHERE question_count IS NOT NULL AND question_count <= 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tests_question_count_positive'
  ) THEN
    ALTER TABLE public.tests
      ADD CONSTRAINT tests_question_count_positive
      CHECK (question_count IS NULL OR question_count > 0);
  END IF;
END
$$;
