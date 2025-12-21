-- Update get_trade_statistics to handle both uppercase and lowercase results
CREATE OR REPLACE FUNCTION public.get_trade_statistics()
RETURNS TABLE(total_trades bigint, total_wins bigint, total_losses bigint, accuracy integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_trades,
    COUNT(*) FILTER (WHERE UPPER(result) = 'WIN')::BIGINT as total_wins,
    COUNT(*) FILTER (WHERE UPPER(result) = 'LOSS')::BIGINT as total_losses,
    COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE UPPER(result) = 'WIN') / NULLIF(COUNT(*), 0))::INTEGER, 0) as accuracy
  FROM public.trade_results;
END;
$$;