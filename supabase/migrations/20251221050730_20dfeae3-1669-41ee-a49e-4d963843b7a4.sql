-- Remove the overly permissive policy that exposes IP addresses
-- Edge functions already use service role key, so no replacement needed
DROP POLICY "Allow all operations on ip_usage" ON public.ip_usage;