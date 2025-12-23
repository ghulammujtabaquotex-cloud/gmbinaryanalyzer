import { useState, useEffect, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Auto logout after 30 minutes of inactivity
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const signOut = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await supabase.auth.signOut();
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Only set timer if user is logged in
    if (user) {
      timeoutRef.current = setTimeout(() => {
        signOut();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, signOut]);

  // Verify user still exists in database
  const verifyUserExists = useCallback(async () => {
    if (!session?.user) return;
    
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        console.log("User account no longer exists, signing out...");
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error("Error verifying user:", err);
      await supabase.auth.signOut();
    }
  }, [session]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        // If user signed in, verify they still exist
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setTimeout(() => {
            verifyUserExists();
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      // Verify user exists on app load
      if (session?.user) {
        setTimeout(() => {
          verifyUserExists();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [verifyUserExists]);

  // Set up inactivity listeners
  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    
    // Start the timer
    resetInactivityTimer();
    
    // Reset timer on user activity
    events.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, resetInactivityTimer]);

  return { user, session, isLoading, signOut };
};