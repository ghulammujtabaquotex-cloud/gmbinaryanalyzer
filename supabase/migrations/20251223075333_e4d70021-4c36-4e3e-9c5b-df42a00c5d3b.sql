-- Add rate limiting function for payment requests (max 3 per email per 24 hours)
CREATE OR REPLACE FUNCTION public.check_payment_request_rate(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) < 3
    FROM public.payment_requests
    WHERE email = p_email
    AND created_at > NOW() - INTERVAL '24 hours'
  );
END;
$$;

-- Drop old permissive policy
DROP POLICY IF EXISTS "Anyone can submit payment requests" ON public.payment_requests;

-- Create rate-limited policy for anonymous payment submissions
CREATE POLICY "Rate limited anonymous payment submissions"
ON public.payment_requests
FOR INSERT
WITH CHECK (
  check_payment_request_rate(email)
);