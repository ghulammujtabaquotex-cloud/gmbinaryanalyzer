
-- Table 1: future_signals_pool (Admin uploads signals here)
CREATE TABLE public.future_signals_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pair TEXT NOT NULL,
  signal_time TEXT NOT NULL, -- Format "HH:MM" (24-hour)
  direction TEXT NOT NULL CHECK (direction IN ('CALL', 'PUT')),
  confidence INTEGER DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.future_signals_pool ENABLE ROW LEVEL SECURITY;

-- Admin can manage signals
CREATE POLICY "Admins can manage future signals"
ON public.future_signals_pool
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read signals (for generation)
CREATE POLICY "Anyone can read future signals"
ON public.future_signals_pool
FOR SELECT
USING (true);

-- Table 2: Add future_signal_count to ip_usage (reuse existing table)
ALTER TABLE public.ip_usage 
ADD COLUMN IF NOT EXISTS future_signal_count INTEGER DEFAULT 0;

-- Table 3: signals_history (Global counter for generated signals)
CREATE TABLE public.signals_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  ip_address TEXT,
  pair TEXT NOT NULL,
  signal_time TEXT NOT NULL,
  direction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signals_history ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for tracking)
CREATE POLICY "Anyone can insert signals history"
ON public.signals_history
FOR INSERT
WITH CHECK (true);

-- Anyone can read (for global counter)
CREATE POLICY "Anyone can read signals history"
ON public.signals_history
FOR SELECT
USING (true);

-- Enable realtime for signals_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals_history;

-- Function to get total signals generated
CREATE OR REPLACE FUNCTION public.get_total_signals_generated()
RETURNS INTEGER
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::INTEGER FROM public.signals_history
$$;

-- Function to check and increment future signal usage
CREATE OR REPLACE FUNCTION public.check_future_signal_usage(
  p_ip_address TEXT, 
  p_usage_date DATE, 
  p_daily_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Get or create usage record
  INSERT INTO public.ip_usage (ip_address, usage_date, request_count, future_signal_count)
  VALUES (p_ip_address, p_usage_date, 0, 0)
  ON CONFLICT (ip_address, usage_date) DO NOTHING;
  
  -- Get current count
  SELECT COALESCE(future_signal_count, 0) INTO v_count
  FROM public.ip_usage
  WHERE ip_address = p_ip_address AND usage_date = p_usage_date;
  
  IF v_count IS NULL THEN
    v_count := 0;
  END IF;
  
  RETURN QUERY SELECT 
    (v_count < p_daily_limit),
    v_count,
    GREATEST(0, p_daily_limit - v_count)::INTEGER;
END;
$$;

-- Function to increment future signal count
CREATE OR REPLACE FUNCTION public.increment_future_signal_usage(
  p_ip_address TEXT,
  p_usage_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.ip_usage
  SET future_signal_count = COALESCE(future_signal_count, 0) + 1,
      updated_at = now()
  WHERE ip_address = p_ip_address AND usage_date = p_usage_date;
END;
$$;
