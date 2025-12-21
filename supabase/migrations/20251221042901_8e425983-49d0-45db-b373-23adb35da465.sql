-- Create RPC function to return only aggregated trade statistics (no user data exposed)
CREATE OR REPLACE FUNCTION public.get_trade_statistics()
RETURNS TABLE(total_trades BIGINT, total_wins BIGINT, total_losses BIGINT, accuracy INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_trades,
    COUNT(*) FILTER (WHERE LOWER(result) = 'win')::BIGINT as total_wins,
    COUNT(*) FILTER (WHERE LOWER(result) = 'loss')::BIGINT as total_losses,
    COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE LOWER(result) = 'win') / NULLIF(COUNT(*), 0))::INTEGER, 0) as accuracy
  FROM public.trade_results;
END;
$$;

-- Drop the overly permissive SELECT policy that exposes user data
DROP POLICY IF EXISTS "Anyone can read results for aggregation" ON public.trade_results;