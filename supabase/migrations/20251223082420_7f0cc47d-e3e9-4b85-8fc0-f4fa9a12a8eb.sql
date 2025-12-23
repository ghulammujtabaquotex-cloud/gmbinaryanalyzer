-- Update get_payment_by_token with strict UUID validation to prevent brute force attacks
CREATE OR REPLACE FUNCTION public.get_payment_by_token(p_token TEXT)
RETURNS TABLE(
  id UUID,
  status payment_status,
  email TEXT,
  generated_password TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Strict UUID format validation (prevents short token attacks and brute force)
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- Return empty result for invalid tokens
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    pr.id,
    pr.status,
    pr.email,
    pr.generated_password,
    pr.created_at
  FROM public.payment_requests pr
  WHERE pr.access_token = p_token
  LIMIT 1;
END;
$$;