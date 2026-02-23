-- Allow anonymous users to insert into candidates table during registration.
-- RLS is enabled on candidates but there was no insert policy for the anon role,
-- which caused the "Failed to save candidate information" registration error.

CREATE POLICY "Allow anonymous registration inserts"
ON public.candidates
FOR INSERT
TO anon
WITH CHECK (true);
