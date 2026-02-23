-- Allow anonymous users to update candidates table during registration upsert.
-- This is needed because the registration flow uses upsert (onConflict: email)
-- to handle users trying to register again with an existing email,
-- which requires UPDATE privileges when a conflict occurs.

CREATE POLICY "Allow anonymous registration updates"
ON public.candidates
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
