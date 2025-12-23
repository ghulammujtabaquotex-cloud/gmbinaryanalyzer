-- Allow anonymous users to read ip_usage for global analysis counter
CREATE POLICY "Anyone can read ip_usage for global stats" 
ON public.ip_usage 
FOR SELECT 
USING (true);