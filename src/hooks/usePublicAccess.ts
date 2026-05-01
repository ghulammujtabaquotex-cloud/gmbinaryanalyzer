import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SETTING_ID = "public_access";

export const usePublicAccess = () => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSetting = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("id", SETTING_ID)
        .maybeSingle();

      if (error) {
        console.error("Error fetching public_access:", error);
        setEnabled(true); // fail-open so app stays usable on errors
      } else {
        const v = (data?.value as { enabled?: boolean } | null) ?? null;
        setEnabled(v?.enabled !== false);
      }
    } catch (e) {
      console.error(e);
      setEnabled(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSetting();

    // Refetch whenever tab becomes visible / focused
    const onFocus = () => fetchSetting();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // Light polling every 30s as a fallback (no realtime configured)
    const interval = setInterval(fetchSetting, 30_000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(interval);
    };
  }, [fetchSetting]);

  const setPublicAccess = useCallback(
    async (value: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .update({ value: { enabled: value }, updated_at: new Date().toISOString() })
        .eq("id", SETTING_ID);
      if (error) throw error;
      setEnabled(value);
    },
    []
  );

  return { enabled, isLoading, setPublicAccess, refetch: fetchSetting };
};
