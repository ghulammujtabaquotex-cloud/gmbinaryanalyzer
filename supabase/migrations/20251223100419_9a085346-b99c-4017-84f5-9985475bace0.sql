-- Create submission_usage table for per-IP submission rate limiting
CREATE TABLE public.submission_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submission_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ip_address, usage_date)
);

-- Enable RLS (no client policies - server-side only via edge functions)
ALTER TABLE public.submission_usage ENABLE ROW LEVEL SECURITY;

-- Add comment explaining intentional lack of policies
COMMENT ON TABLE public.submission_usage IS 'Accessed only via edge functions with service role. No client policies by design.';

-- Create atomic increment function for submission rate limiting
CREATE OR REPLACE FUNCTION public.atomic_increment_submission(
  p_ip_address TEXT,
  p_usage_date DATE,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  -- Try to insert or update atomically
  INSERT INTO public.submission_usage (ip_address, usage_date, submission_count)
  VALUES (p_ip_address, p_usage_date, 1)
  ON CONFLICT (ip_address, usage_date) 
  DO UPDATE SET 
    submission_count = submission_usage.submission_count + 1,
    updated_at = now()
  WHERE submission_usage.submission_count < p_daily_limit
  RETURNING submission_usage.submission_count INTO v_current_count;
  
  -- If no row was updated (limit reached), get current count
  IF v_current_count IS NULL THEN
    SELECT submission_count INTO v_current_count
    FROM public.submission_usage
    WHERE ip_address = p_ip_address AND usage_date = p_usage_date;
    
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, (p_daily_limit - v_current_count)::INTEGER;
  END IF;
END;
$$;

-- Create index for faster lookups
CREATE INDEX idx_submission_usage_ip_date ON public.submission_usage(ip_address, usage_date);