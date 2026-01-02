import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS configuration - allow all lovable preview domains
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secure IP extraction - only trust Cloudflare header
const getClientIP = (req: Request): string => {
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f:]+$/i;
    if (ipPattern.test(cfIP)) {
      return cfIP;
    }
  }
  
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return ip;
    }
  }
  
  return "unknown";
};

const SUBMISSION_DAILY_LIMIT = 20;

const checkAndIncrementSubmission = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  ipAddress: string
): Promise<{ allowed: boolean; remaining: number }> => {
  const today = new Date().toISOString().split("T")[0];
  
  const headers = {
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  try {
    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/atomic_increment_submission`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_ip_address: ipAddress,
          p_usage_date: today,
          p_daily_limit: SUBMISSION_DAILY_LIMIT,
        }),
      }
    );

    if (!rpcResponse.ok) {
      console.error("Submission rate check RPC failed:", rpcResponse.status);
      return { allowed: true, remaining: SUBMISSION_DAILY_LIMIT };
    }

    const result = await rpcResponse.json();
    if (result && result.length > 0) {
      return { 
        allowed: result[0].allowed, 
        remaining: result[0].remaining 
      };
    }

    return { allowed: true, remaining: SUBMISSION_DAILY_LIMIT };
  } catch (err) {
    console.error("Submission rate limit check error:", err);
    return { allowed: true, remaining: SUBMISSION_DAILY_LIMIT };
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }


  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("Missing Supabase config");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIP = getClientIP(req);
    console.log("Result submission from IP:", clientIP.slice(0, 10) + "***");

    const body = await req.json();
    const { signal, result, signalHistoryId } = body;

    // Strict input validation
    if (!signal || !result) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["CALL", "PUT"].includes(signal)) {
      return new Response(
        JSON.stringify({ error: "Invalid signal value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedResult = result.toUpperCase();
    if (!["WIN", "LOSS"].includes(normalizedResult)) {
      return new Response(
        JSON.stringify({ error: "Invalid result value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check per-IP rate limit
    const { allowed, remaining } = await checkAndIncrementSubmission(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientIP);
    if (!allowed) {
      console.log("Rate limit reached for IP:", clientIP.slice(0, 10) + "***");
      return new Response(
        JSON.stringify({ error: "Too many submissions today. Please try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If signalHistoryId is provided, update the signal_history table for VIP user
    if (signalHistoryId) {
      console.log("Updating signal_history for ID:", signalHistoryId);
      
      // Get user from auth header to verify ownership
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Update signal_history with result - RLS ensures user can only update their own
          const { error: updateError } = await supabase
            .from('signal_history')
            .update({ result: normalizedResult })
            .eq('id', signalHistoryId)
            .eq('user_id', user.id);

          if (updateError) {
            console.error("Error updating signal_history:", updateError);
          } else {
            console.log("Successfully updated signal_history for user:", user.id.slice(0, 8) + "***");
          }
        }
      }
    }

    // Insert into global trade_results using service role
    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/trade_results`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          signal: signal,
          result: normalizedResult,
          user_id: "00000000-0000-0000-0000-000000000000",
        }),
      }
    );

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      console.error("Insert failed:", insertResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to save result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Result saved successfully for IP:", clientIP.slice(0, 10) + "***", "remaining:", remaining);

    return new Response(
      JSON.stringify({ success: true, remaining }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to save result" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});