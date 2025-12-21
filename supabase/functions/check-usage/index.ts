import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DAILY_LIMIT = 5;

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
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase config");
      return new Response(
        JSON.stringify({ error: "Service unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIP = getClientIP(req);
    const today = new Date().toISOString().split("T")[0];

    console.log("Checking usage for IP:", clientIP.slice(0, 10) + "***");

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
          p_daily_limit: DAILY_LIMIT,
        }),
      }
    );

    if (!rpcResponse.ok) {
      console.error("RPC failed:", rpcResponse.status);
      // Return defaults on error
      return new Response(
        JSON.stringify({ 
          usageCount: 0, 
          remaining: DAILY_LIMIT, 
          canAnalyze: true,
          dailyLimit: DAILY_LIMIT
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
          dailyLimit: DAILY_LIMIT
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No usage record found - user has full quota
    return new Response(
      JSON.stringify({ 
        usageCount: 0, 
        remaining: DAILY_LIMIT, 
        canAnalyze: true,
        dailyLimit: DAILY_LIMIT
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ 
        usageCount: 0, 
        remaining: DAILY_LIMIT, 
        canAnalyze: true,
        dailyLimit: DAILY_LIMIT
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
