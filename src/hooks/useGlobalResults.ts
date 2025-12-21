import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GlobalResults {
  totalTrades: number;
  wins: number;
  losses: number;
  accuracy: number;
}

export function useGlobalResults() {
  const [results, setResults] = useState<GlobalResults>({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    accuracy: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      // Use secure RPC function that only returns aggregated stats (no user data exposed)
      const { data, error } = await supabase.rpc("get_trade_statistics");

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching global results:", error);
        }
        return;
      }

      if (data && data.length > 0) {
        const stats = data[0];
        setResults({
          totalTrades: Number(stats.total_trades) || 0,
          wins: Number(stats.total_wins) || 0,
          losses: Number(stats.total_losses) || 0,
          accuracy: Number(stats.accuracy) || 0,
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Error fetching global results:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return {
    results,
    isLoading,
    refetch: fetchResults,
  };
}
