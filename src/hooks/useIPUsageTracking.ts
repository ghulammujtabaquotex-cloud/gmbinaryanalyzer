import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { PAYMENT_CONFIG } from "@/lib/paymentConfig";

export const useIPUsageTracking = () => {
  const { user } = useAuth();
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [isVip, setIsVip] = useState(false);

  const dailyLimit = isVip ? PAYMENT_CONFIG.vipDailyLimit : PAYMENT_CONFIG.freeDailyLimit;

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
            // VIP users still have a limit, fetch their usage
            const { data, error } = await supabase.functions.invoke("check-usage");
            if (!error && data) {
              setUsageCount(data.usageCount ?? 0);
              setLimitReached(data.usageCount >= PAYMENT_CONFIG.vipDailyLimit);
            }
            setIsLoading(false);
            return;
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
        setLimitReached(data.usageCount >= PAYMENT_CONFIG.freeDailyLimit);
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
