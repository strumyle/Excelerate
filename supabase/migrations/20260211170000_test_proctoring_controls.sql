-- Add per-test proctoring controls and candidate consent tracking.

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS proctoring_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.test_submissions
  ADD COLUMN IF NOT EXISTS proctoring_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.test_submissions
  ADD COLUMN IF NOT EXISTS proctoring_consent TEXT NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'test_submissions_proctoring_consent_check'
  ) THEN
    ALTER TABLE public.test_submissions
      ADD CONSTRAINT test_submissions_proctoring_consent_check
      CHECK (proctoring_consent IN ('granted', 'denied', 'unsupported', 'unknown'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_test_submissions_proctoring_consent
  ON public.test_submissions (proctoring_consent);
