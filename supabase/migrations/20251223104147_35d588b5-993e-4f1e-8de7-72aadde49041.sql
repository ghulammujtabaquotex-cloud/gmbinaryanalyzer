-- Remove the overly permissive SELECT policy on trade_results
-- The RPC function get_trade_statistics() already provides safe aggregated statistics
DROP POLICY IF EXISTS "Anyone can count trade results for global stats" ON public.trade_results;