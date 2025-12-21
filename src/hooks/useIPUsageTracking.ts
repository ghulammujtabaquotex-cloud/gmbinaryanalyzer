import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const DAILY_LIMIT = 5;

export const useIPUsageTracking = () => {
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase.rpc("check_ip_usage", {
        p_ip_address: "client", // Will be handled server-side
        p_usage_date: today,
        p_daily_limit: DAILY_LIMIT,
      });

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching IP usage:", error);
        }
      }
      
      if (data && data.length > 0) {
        setUsageCount(data[0].request_count ?? 0);
        setLimitReached(!data[0].can_analyze);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching IP usage:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load - usage will be tracked server-side
    setIsLoading(false);
  }, []);

  const updateFromResponse = (remaining: number, isLimitReached: boolean = false) => {
    setUsageCount(DAILY_LIMIT - remaining);
    setLimitReached(isLimitReached);
  };

  return {
    usageCount,
    remaining: DAILY_LIMIT - usageCount,
    dailyLimit: DAILY_LIMIT,
    isLoading,
    canAnalyze: !limitReached && usageCount < DAILY_LIMIT,
    limitReached,
    updateFromResponse,
  };
};
