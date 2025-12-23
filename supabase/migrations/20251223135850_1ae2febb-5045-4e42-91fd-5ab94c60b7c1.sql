-- Add token expiration to payment_requests (30 days from creation)
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ DEFAULT now() + interval '30 days';

-- Update existing rows to have expiration
UPDATE public.payment_requests 
SET token_expires_at = created_at + interval '30 days'
WHERE token_expires_at IS NULL;

-- Update get_payment_by_token to check expiration
CREATE OR REPLACE FUNCTION public.get_payment_by_token(p_token text)
RETURNS TABLE(id uuid, status payment_status, email text, generated_password text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    AND (pr.token_expires_at IS NULL OR pr.token_expires_at > now())
  LIMIT 1;
END;
$$;