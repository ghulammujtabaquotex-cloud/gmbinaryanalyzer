-- Create secure function to get total analysis count without exposing IPs
CREATE OR REPLACE FUNCTION public.get_total_analysis_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(SUM(request_count)::integer, 0) FROM public.ip_usage
$$;

-- Remove the public read policy that exposes IP addresses
DROP POLICY IF EXISTS "Anyone can read ip_usage for global stats" ON public.ip_usage;