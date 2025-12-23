-- Create a function to check if email already has an approved VIP payment
CREATE OR REPLACE FUNCTION public.check_email_is_vip(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.payment_requests 
    WHERE email = p_email 
    AND status = 'approved'
  );
END;
$$;

-- Grant execute permission to anon so the check can be performed before payment
GRANT EXECUTE ON FUNCTION public.check_email_is_vip(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_is_vip(text) TO authenticated;