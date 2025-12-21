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
      const { data, error } = await supabase
        .from("trade_results")
        .select("result");

      if (error) {
        console.error("Error fetching global results:", error);
        return;
      }

      const wins = data?.filter((r) => r.result === "WIN").length || 0;
      const losses = data?.filter((r) => r.result === "LOSS").length || 0;
      const totalTrades = wins + losses;
      const accuracy = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

      setResults({
        totalTrades,
        wins,
        losses,
        accuracy,
      });
    } catch (err) {
      console.error("Error fetching global results:", err);
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