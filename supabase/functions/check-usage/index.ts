import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 999999; // Unlimited for free users (temporarily disabled)
const VIP_DAILY_LIMIT = 20;

// CORS configuration
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) {
    return "https://rbqafiykevtbgztczizr.lovableproject.com";
  }
  
  const allowedPatterns = [
    /^https:\/\/rbqafiykevtbgztczizr\.lovableproject\.com$/,
    /^https:\/\/gmbinarypro\.lovable\.app$/,
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/,
  ];
  
  for (const pattern of allowedPatterns) {
    if (pattern.test(requestOrigin)) {
      return requestOrigin;
    }
  }
  
  return "https://rbqafiykevtbgztczizr.lovableproject.com";
};

// Secure IP extraction - ONLY trust CF-Connecting-IP
const getClientIP = (req: Request): string => {
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f:]+$/i;
    if (ipPattern.test(cfIP)) {
      return cfIP;
    }
  }
  
  // For local development only
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return ip;
    }
  }
  
  return "unknown";
};

// Check if user is VIP from their auth token
const checkVipStatus = async (
  supabaseUrl: string,
  anonKey: string,
  authHeader: string | null
): Promise<{ isVip: boolean; userId: string | null }> => {
  if (!authHeader) {
    return { isVip: false, userId: null };
  }

  try {
    // Create client with user's auth token
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { isVip: false, userId: null };
    }

    // Check VIP status using the is_vip function
    const { data: isVip, error: vipError } = await supabase
      .rpc('is_vip', { _user_id: user.id });

    if (vipError) {
      console.error("Error checking VIP status:", vipError);
      return { isVip: false, userId: user.id };
    }

    return { isVip: !!isVip, userId: user.id };
  } catch (err) {
    console.error("Error in checkVipStatus:", err);
    return { isVip: false, userId: null };
  }
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

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
        JSON.stringify({ error: "Service unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIP = getClientIP(req);
    const today = new Date().toISOString().split("T")[0];

    console.log("Checking usage for IP:", clientIP.slice(0, 10) + "***");

    // Check VIP status from auth header
    const authHeader = req.headers.get("authorization");
    const { isVip } = await checkVipStatus(SUPABASE_URL, SUPABASE_ANON_KEY, authHeader);
    
    // Set limits based on VIP status
    const dailyLimit = isVip ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT;
    console.log(`User type: ${isVip ? 'VIP' : 'FREE'}, Daily limit: ${dailyLimit}`);

    const headers = {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };

    const rpcResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/check_ip_usage`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_ip_address: clientIP,
          p_usage_date: today,
          p_daily_limit: dailyLimit,
        }),
      }
    );

    if (!rpcResponse.ok) {
      console.error("RPC failed:", rpcResponse.status);
      // Return defaults on error
      return new Response(
        JSON.stringify({ 
          usageCount: 0, 
          remaining: dailyLimit, 
          canAnalyze: true,
          dailyLimit: dailyLimit,
          isVip
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await rpcResponse.json();
    
    if (result && result.length > 0) {
      return new Response(
        JSON.stringify({ 
          usageCount: result[0].request_count,
          remaining: result[0].remaining,
          canAnalyze: result[0].can_analyze,
          dailyLimit: dailyLimit,
          isVip
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No usage record found - user has full quota
    return new Response(
      JSON.stringify({ 
        usageCount: 0, 
        remaining: dailyLimit, 
        canAnalyze: true,
        dailyLimit: dailyLimit,
        isVip
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ 
        usageCount: 0, 
        remaining: FREE_DAILY_LIMIT, 
        canAnalyze: true,
        dailyLimit: FREE_DAILY_LIMIT,
        isVip: false
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
