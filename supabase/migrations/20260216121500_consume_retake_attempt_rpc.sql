-- Securely consume one retake attempt for the signed-in candidate.
-- This avoids relying on client-side UPDATE/DELETE against test_retake_permissions.

CREATE OR REPLACE FUNCTION public.consume_test_retake_attempt(
  p_test_id UUID,
  p_permission_id UUID DEFAULT NULL
)
RETURNS TABLE (
  consumed BOOLEAN,
  remaining_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_permission_id UUID;
  v_remaining_attempts INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_permission_id IS NOT NULL THEN
    SELECT id, remaining_attempts
    INTO v_permission_id, v_remaining_attempts
    FROM public.test_retake_permissions
    WHERE id = p_permission_id
      AND user_id = v_user_id
      AND test_id = p_test_id
      AND remaining_attempts > 0
    FOR UPDATE;
  ELSE
    SELECT id, remaining_attempts
    INTO v_permission_id, v_remaining_attempts
    FROM public.test_retake_permissions
    WHERE user_id = v_user_id
      AND test_id = p_test_id
      AND remaining_attempts > 0
    ORDER BY granted_at ASC, id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_permission_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  IF COALESCE(v_remaining_attempts, 0) <= 1 THEN
    DELETE FROM public.test_retake_permissions
    WHERE id = v_permission_id;

    RETURN QUERY SELECT TRUE, 0;
    RETURN;
  END IF;

  UPDATE public.test_retake_permissions
  SET remaining_attempts = v_remaining_attempts - 1
  WHERE id = v_permission_id
  RETURNING remaining_attempts INTO v_remaining_attempts;

  RETURN QUERY SELECT TRUE, v_remaining_attempts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_test_retake_attempt(UUID, UUID) TO authenticated;
