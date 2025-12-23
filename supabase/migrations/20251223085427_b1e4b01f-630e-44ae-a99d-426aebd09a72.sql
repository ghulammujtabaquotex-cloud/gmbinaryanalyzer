-- Drop the overly permissive policy that allows anyone to read all trade results
DROP POLICY IF EXISTS "Anyone can read results for aggregation" ON public.trade_results;

-- The existing "Users can view their own trade results" policy already exists and provides proper access control
-- The get_trade_statistics() RPC function uses SECURITY DEFINER and bypasses RLS for aggregation