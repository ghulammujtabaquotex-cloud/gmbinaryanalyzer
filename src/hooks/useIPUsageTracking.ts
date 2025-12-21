import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DAILY_LIMIT = 5;

export const useIPUsageTracking = () => {
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      // Call server-side edge function to get real IP usage
      const { data, error } = await supabase.functions.invoke("check-usage");

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching IP usage:", error);
        }
        // On error, assume fresh start but allow analysis
        setUsageCount(0);
        setLimitReached(false);
        return;
      }
      
      if (data) {
        setUsageCount(data.usageCount ?? 0);
        setLimitReached(!data.canAnalyze);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching IP usage:", error);
      }
      // On error, assume fresh start
      setUsageCount(0);
      setLimitReached(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch actual usage on mount
    fetchUsage();
  }, [fetchUsage]);

  const updateFromResponse = (remaining: number, isLimitReached: boolean = false) => {
    setUsageCount(DAILY_LIMIT - remaining);
    setLimitReached(isLimitReached);
  };

  const refetch = () => {
    setIsLoading(true);
    fetchUsage();
  };

  return {
    usageCount,
    remaining: DAILY_LIMIT - usageCount,
    dailyLimit: DAILY_LIMIT,
    isLoading,
    canAnalyze: !limitReached && usageCount < DAILY_LIMIT,
    limitReached,
    updateFromResponse,
    refetch,
  };
};
