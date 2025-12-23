import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const DAILY_LIMIT = 5;

export const useIPUsageTracking = () => {
  const { user } = useAuth();
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [isVip, setIsVip] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      // Check VIP status first if user is logged in
      if (user) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('tier, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subData && subData.tier === 'vip') {
          const isActive = !subData.expires_at || new Date(subData.expires_at) > new Date();
          if (isActive) {
            setIsVip(true);
            setUsageCount(0);
            setLimitReached(false);
            setIsLoading(false);
            return; // VIP users have unlimited access
          }
        }
      }

      setIsVip(false);

      // Call server-side edge function to get real IP usage
      const { data, error } = await supabase.functions.invoke("check-usage");

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching IP usage:", error);
        }
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
      setUsageCount(0);
      setLimitReached(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Defer the API call to break the critical render chain
    // This allows the initial UI to render before making the network request
    const scheduleRequest = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => fetchUsage(), { timeout: 1000 });
      } else {
        setTimeout(fetchUsage, 100);
      }
    };
    scheduleRequest();
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
    remaining: isVip ? 999 : DAILY_LIMIT - usageCount,
    dailyLimit: DAILY_LIMIT,
    isLoading,
    canAnalyze: isVip || (!limitReached && usageCount < DAILY_LIMIT),
    limitReached: isVip ? false : limitReached,
    isVip,
    updateFromResponse,
    refetch,
  };
};
