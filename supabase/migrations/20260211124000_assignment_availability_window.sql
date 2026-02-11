-- Add assignment availability window support.

ALTER TABLE public.test_assignments
  ADD COLUMN IF NOT EXISTS available_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_test_assignments_available_until
  ON public.test_assignments(available_until);
