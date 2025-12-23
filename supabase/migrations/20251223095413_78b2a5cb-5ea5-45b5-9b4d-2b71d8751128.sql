-- Create signal_history table for VIP users to track their analysis history
CREATE TABLE public.signal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pair TEXT NOT NULL,
  trend TEXT NOT NULL,
  signal TEXT NOT NULL,
  support_zone TEXT,
  resistance_zone TEXT,
  explanation TEXT,
  confidence INTEGER,
  result TEXT, -- 'WIN', 'LOSS', or NULL (pending)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signal_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own signal history
CREATE POLICY "Users can view their own signal history"
ON public.signal_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own signals
CREATE POLICY "Users can insert their own signals"
ON public.signal_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own signals (for adding results)
CREATE POLICY "Users can update their own signals"
ON public.signal_history
FOR UPDATE
USING (auth.uid() = user_id);

-- Create function to get user's personal accuracy statistics
CREATE OR REPLACE FUNCTION public.get_user_accuracy(p_user_id UUID)
RETURNS TABLE(total_signals BIGINT, wins BIGINT, losses BIGINT, pending BIGINT, accuracy INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_signals,
    COUNT(*) FILTER (WHERE UPPER(result) = 'WIN')::BIGINT as wins,
    COUNT(*) FILTER (WHERE UPPER(result) = 'LOSS')::BIGINT as losses,
    COUNT(*) FILTER (WHERE result IS NULL)::BIGINT as pending,
    COALESCE(
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE UPPER(result) = 'WIN') / 
        NULLIF(COUNT(*) FILTER (WHERE result IS NOT NULL), 0)
      )::INTEGER, 
      0
    ) as accuracy
  FROM public.signal_history
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_accuracy(UUID) TO authenticated;

-- Create index for faster queries
CREATE INDEX idx_signal_history_user_id ON public.signal_history(user_id);
CREATE INDEX idx_signal_history_created_at ON public.signal_history(created_at DESC);