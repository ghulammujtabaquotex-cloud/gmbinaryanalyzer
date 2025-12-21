-- Add SELECT policy so authenticated users can view their own trade results
CREATE POLICY "Users can view their own trade results"
ON public.trade_results
FOR SELECT
USING (auth.uid() = user_id);