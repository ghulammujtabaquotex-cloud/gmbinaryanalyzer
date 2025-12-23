-- Add access_token column for secure payment status tracking
ALTER TABLE public.payment_requests 
ADD COLUMN access_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Drop old permissive SELECT policy for users
DROP POLICY IF EXISTS "Users can view their own payment requests" ON public.payment_requests;

-- Create new policy: payment requests accessible only by access_token or admin
-- Anonymous users can only view their own payment via access_token
CREATE POLICY "Payment requests accessible by token or owner"
ON public.payment_requests
FOR SELECT
USING (
  -- Admins can see all
  has_role(auth.uid(), 'admin')
  OR
  -- Authenticated users can see their own (by user_id)
  (auth.uid() = user_id AND user_id IS NOT NULL)
);

-- Create a secure function to get payment by token (bypasses RLS for token-based access)
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
  -- Validate token format (UUID)
  IF p_token IS NULL OR LENGTH(p_token) < 10 THEN
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