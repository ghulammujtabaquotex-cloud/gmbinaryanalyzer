-- Fix: Add SECURITY INVOKER to prevent RLS bypass
CREATE OR REPLACE FUNCTION public.update_usage_updated_at()
RETURNS TRIGGER 
SECURITY INVOKER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create atomic rate limit function that handles race conditions
CREATE OR REPLACE FUNCTION public.atomic_increment_usage(
  p_user_id UUID,
  p_usage_date DATE,
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER)
SECURITY INVOKER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  -- Try to insert or update atomically
  INSERT INTO public.analysis_usage (user_id, usage_date, request_count)
  VALUES (p_user_id, p_usage_date, 1)
  ON CONFLICT (user_id, usage_date) 
  DO UPDATE SET 
    request_count = analysis_usage.request_count + 1,
    updated_at = now()
  WHERE analysis_usage.request_count < p_daily_limit
  RETURNING analysis_usage.request_count INTO v_current_count;
  
  -- If no row was updated (limit reached), get current count
  IF v_current_count IS NULL THEN
    SELECT request_count INTO v_current_count
    FROM public.analysis_usage
    WHERE user_id = p_user_id AND usage_date = p_usage_date;
    
    RETURN QUERY SELECT false, 0;
  ELSE
    RETURN QUERY SELECT true, (p_daily_limit - v_current_count)::INTEGER;
  END IF;
END;
$$;

-- Add unique constraint for atomic upsert if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'analysis_usage_user_id_usage_date_key'
  ) THEN
    ALTER TABLE public.analysis_usage 
    ADD CONSTRAINT analysis_usage_user_id_usage_date_key 
    UNIQUE (user_id, usage_date);
  END IF;
END
$$;