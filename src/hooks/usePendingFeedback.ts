import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface PendingFeedback {
  id: string;
  signal: "CALL" | "PUT";
  pair: string;
  created_at: string;
}

export function usePendingFeedback() {
  const { user } = useAuth();
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingFeedback = useCallback(async () => {
    if (!user) {
      setPendingFeedback(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("pending_feedback")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching pending feedback:", error);
        setPendingFeedback(null);
      } else {
        setPendingFeedback(data as PendingFeedback | null);
      }
    } catch (err) {
      console.error("Error fetching pending feedback:", err);
      setPendingFeedback(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPendingFeedback();
  }, [fetchPendingFeedback]);

  const createPendingFeedback = async (signal: "CALL" | "PUT", pair: string) => {
    if (!user) return { error: "Not authenticated" };

    try {
      const { error } = await supabase
        .from("pending_feedback")
        .insert({
          user_id: user.id,
          signal,
          pair,
        });

      if (error) {
        // If duplicate, it's fine - user already has pending feedback
        if (error.code === "23505") {
          await fetchPendingFeedback();
          return { error: null };
        }
        console.error("Error creating pending feedback:", error);
        return { error: error.message };
      }

      await fetchPendingFeedback();
      return { error: null };
    } catch (err) {
      console.error("Error creating pending feedback:", err);
      return { error: "Failed to create pending feedback" };
    }
  };

  const submitResult = async (result: "WIN" | "LOSS") => {
    if (!user || !pendingFeedback) return { error: "No pending feedback" };

    try {
      // Insert the trade result
      const { error: insertError } = await supabase
        .from("trade_results")
        .insert({
          user_id: user.id,
          signal: pendingFeedback.signal,
          result,
        });

      if (insertError) {
        console.error("Error inserting trade result:", insertError);
        return { error: insertError.message };
      }

      // Delete the pending feedback
      const { error: deleteError } = await supabase
        .from("pending_feedback")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("Error deleting pending feedback:", deleteError);
        return { error: deleteError.message };
      }

      setPendingFeedback(null);
      return { error: null };
    } catch (err) {
      console.error("Error submitting result:", err);
      return { error: "Failed to submit result" };
    }
  };

  return {
    pendingFeedback,
    isLoading,
    hasPendingFeedback: !!pendingFeedback,
    createPendingFeedback,
    submitResult,
    refetch: fetchPendingFeedback,
  };
}