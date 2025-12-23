import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { PAYMENT_CONFIG } from "@/lib/paymentConfig";

export const useIPUsageTracking = () => {
  const { user } = useAuth();
  const [usageCount, setUsageCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(PAYMENT_CONFIG.freeDailyLimit);
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [isVip, setIsVip] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      // Call server-side edge function to get real IP usage
      // The edge function will check VIP status from the auth token
      const { data, error } = await supabase.functions.invoke("check-usage");

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching IP usage:", error);
        }
        setUsageCount(0);
        setLimitReached(false);
        setIsVip(false);
        setDailyLimit(PAYMENT_CONFIG.freeDailyLimit);
        return;
      }
      
      if (data) {
        const serverDailyLimit = data.dailyLimit ?? PAYMENT_CONFIG.freeDailyLimit;
        const serverIsVip = data.isVip ?? false;
        const serverUsageCount = data.usageCount ?? 0;
        
        setUsageCount(serverUsageCount);
        setDailyLimit(serverDailyLimit);
        setIsVip(serverIsVip);
        setLimitReached(serverUsageCount >= serverDailyLimit);
        
        if (import.meta.env.DEV) {
          console.log("Usage data:", { 
            usageCount: serverUsageCount, 
            dailyLimit: serverDailyLimit, 
            isVip: serverIsVip,
            remaining: data.remaining 
          });
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching IP usage:", error);
      }
      setUsageCount(0);
      setLimitReached(false);
      setIsVip(false);
      setDailyLimit(PAYMENT_CONFIG.freeDailyLimit);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const scheduleRequest = () => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => fetchUsage(), { timeout: 1000 });
      } else {
        setTimeout(fetchUsage, 100);
      }
    };
    scheduleRequest();
  }, [fetchUsage, user]); // Re-fetch when user changes (login/logout)

  const updateFromResponse = (remaining: number, isLimitReached: boolean = false) => {
    setUsageCount(dailyLimit - remaining);
    setLimitReached(isLimitReached);
  };

  const refetch = () => {
    setIsLoading(true);
    fetchUsage();
  };

  return {
    usageCount,
    remaining: dailyLimit - usageCount,
    dailyLimit,
    isLoading,
    canAnalyze: !limitReached && usageCount < dailyLimit,
    limitReached,
    isVip,
    updateFromResponse,
    refetch,
  };
};
