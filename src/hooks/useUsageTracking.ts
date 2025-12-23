import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const DAILY_LIMIT = 10;

export const useUsageTracking = () => {
  const { user } = useAuth();
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setUsageCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("analysis_usage")
        .select("request_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      if (error) {
        // Log only in development
        if (import.meta.env.DEV) {
          console.error("Error fetching usage:", error);
        }
      }
      
      setUsageCount(data?.request_count ?? 0);
    } catch (error) {
      // Log only in development
      if (import.meta.env.DEV) {
        console.error("Error fetching usage:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const incrementUsage = async (): Promise<{ allowed: boolean; remaining: number }> => {
    if (!user) {
      return { allowed: false, remaining: 0 };
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      // Check current usage
      const { data: existingUsage, error: fetchError } = await supabase
        .from("analysis_usage")
        .select("id, request_count")
        .eq("user_id", user.id)
        .eq("usage_date", today)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentCount = existingUsage?.request_count ?? 0;

      if (currentCount >= DAILY_LIMIT) {
        return { allowed: false, remaining: 0 };
      }

      if (existingUsage) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("analysis_usage")
          .update({ request_count: currentCount + 1 })
          .eq("id", existingUsage.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("analysis_usage")
          .insert({ user_id: user.id, usage_date: today, request_count: 1 });

        if (insertError) throw insertError;
      }

      const newCount = currentCount + 1;
      setUsageCount(newCount);
      
      return { allowed: true, remaining: DAILY_LIMIT - newCount };
    } catch (error) {
      // Log only in development
      if (import.meta.env.DEV) {
        console.error("Error incrementing usage:", error);
      }
      return { allowed: false, remaining: 0 };
    }
  };

  return {
    usageCount,
    remaining: DAILY_LIMIT - usageCount,
    dailyLimit: DAILY_LIMIT,
    isLoading,
    incrementUsage,
    canAnalyze: usageCount < DAILY_LIMIT,
  };
};