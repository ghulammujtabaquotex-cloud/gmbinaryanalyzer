-- Create IP-based usage tracking table
CREATE TABLE public.ip_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ip_address, usage_date)
);

-- Enable RLS but allow public access for IP tracking
ALTER TABLE public.ip_usage ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (public table, no auth)
CREATE POLICY "Allow all operations on ip_usage"
ON public.ip_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Create atomic increment function for IP-based usage
CREATE OR REPLACE FUNCTION public.atomic_increment_ip_usage(
  p_ip_address TEXT,
  p_usage_date DATE,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
SET search_path TO 'public'
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

-- Create function to check IP usage without incrementing
CREATE OR REPLACE FUNCTION public.check_ip_usage(
  p_ip_address TEXT,
  p_usage_date DATE,
  p_daily_limit INTEGER
)
RETURNS TABLE(request_count INTEGER, remaining INTEGER, can_analyze BOOLEAN)
LANGUAGE plpgsql
SET search_path TO 'public'
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