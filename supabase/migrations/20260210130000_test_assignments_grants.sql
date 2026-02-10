-- Ensure authenticated role has table privileges for assignment flow.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.test_assignments
TO authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.test_submissions
TO authenticated;
