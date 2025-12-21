-- Create table for global trade results (anonymous, aggregated)
CREATE TABLE public.trade_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  signal TEXT NOT NULL CHECK (signal IN ('CALL', 'PUT')),
  result TEXT NOT NULL CHECK (result IN ('WIN', 'LOSS')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_results ENABLE ROW LEVEL SECURITY;

-- Users can insert their own results
CREATE POLICY "Users can insert their own results" 
ON public.trade_results 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Anyone can read aggregated results (for global stats display)
-- We use SELECT policy that allows reading but only expose aggregates in the app
CREATE POLICY "Anyone can read results for aggregation" 
ON public.trade_results 
FOR SELECT 
USING (true);

-- Create table to track pending feedback (locks analysis until feedback given)
CREATE TABLE public.pending_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  signal TEXT NOT NULL CHECK (signal IN ('CALL', 'PUT')),
  pair TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_feedback ENABLE ROW LEVEL SECURITY;

-- Users can manage their own pending feedback
CREATE POLICY "Users can view their own pending feedback" 
ON public.pending_feedback 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending feedback" 
ON public.pending_feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending feedback" 
ON public.pending_feedback 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_trade_results_created_at ON public.trade_results(created_at);
CREATE INDEX idx_pending_feedback_user_id ON public.pending_feedback(user_id);