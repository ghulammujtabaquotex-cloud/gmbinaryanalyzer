-- Update atomic_increment_ip_usage with explicit SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.atomic_increment_ip_usage(p_ip_address text, p_usage_date date, p_daily_limit integer)
RETURNS TABLE(allowed boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  -- Try to insert or update atomically
  INSERT INTO public.ip_usage (ip_address, usage_date, request_count)
  VALUES (p_ip_address, p_usage_date, 1)
  ON CONFLICT (ip_address, usage_date) 
  DO UPDATE SET 
    request_count = ip_usage.request_count + 1,
    updated_at = now()
  WHERE ip_usage.request_count < p_daily_limit
  RETURNING ip_usage.request_count INTO v_current_count;
  
  -- If no row was updated (limit reached), get current count
  IF v_current_count IS NULL THEN
    SELECT request_count INTO v_current_count
    FROM public.ip_usage
    WHERE ip_address = p_ip_address AND usage_date = p_usage_date;
    
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, (p_daily_limit - v_current_count)::INTEGER;
  END IF;
END;
$$;

-- Update check_ip_usage with explicit SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.check_ip_usage(p_ip_address text, p_usage_date date, p_daily_limit integer)
RETURNS TABLE(request_count integer, remaining integer, can_analyze boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT ip_usage.request_count INTO v_count
  FROM public.ip_usage
  WHERE ip_address = p_ip_address AND usage_date = p_usage_date;
  
  IF v_count IS NULL THEN
    v_count := 0;
  END IF;
  
  RETURN QUERY SELECT 
    v_count, 
    (p_daily_limit - v_count)::INTEGER,
    (v_count < p_daily_limit);
END;
$$;

-- Add comment explaining the security model
COMMENT ON FUNCTION public.atomic_increment_ip_usage IS 'SECURITY DEFINER: Called only from edge functions with service role key. Bypasses RLS intentionally for IP rate limiting.';
COMMENT ON FUNCTION public.check_ip_usage IS 'SECURITY DEFINER: Called only from edge functions with service role key. Bypasses RLS intentionally for IP rate limiting.';