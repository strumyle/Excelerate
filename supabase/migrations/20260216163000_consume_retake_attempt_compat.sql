-- Make consume_test_retake_attempt resilient across legacy and current retry schemas.
-- Current schema: test_retake_permissions has remaining_attempts.
-- Legacy schema: test_retake_permissions has one row per credit (no remaining_attempts column).

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
  v_has_retake_table BOOLEAN;
  v_has_remaining_attempts BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT to_regclass('public.test_retake_permissions') IS NOT NULL
  INTO v_has_retake_table;

  IF NOT v_has_retake_table THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'test_retake_permissions'
      AND column_name = 'remaining_attempts'
  )
  INTO v_has_remaining_attempts;

  -- Current retry schema path.
  IF v_has_remaining_attempts THEN
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
      ORDER BY granted_at ASC NULLS LAST, id ASC
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
    RETURN;
  END IF;

  -- Legacy retry schema path: each row is a single credit.
  IF p_permission_id IS NOT NULL THEN
    SELECT id
    INTO v_permission_id
    FROM public.test_retake_permissions
    WHERE id = p_permission_id
      AND user_id = v_user_id
      AND test_id = p_test_id
    FOR UPDATE;
  ELSE
    SELECT id
    INTO v_permission_id
    FROM public.test_retake_permissions
    WHERE user_id = v_user_id
      AND test_id = p_test_id
    ORDER BY granted_at ASC NULLS LAST, id ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_permission_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  DELETE FROM public.test_retake_permissions
  WHERE id = v_permission_id;

  RETURN QUERY SELECT TRUE, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_test_retake_attempt(UUID, UUID) TO authenticated;
