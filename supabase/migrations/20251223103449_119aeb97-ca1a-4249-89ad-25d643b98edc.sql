-- Allow anonymous users to count trade_results for global counter
CREATE POLICY "Anyone can count trade results for global stats" 
ON public.trade_results 
FOR SELECT 
USING (true);