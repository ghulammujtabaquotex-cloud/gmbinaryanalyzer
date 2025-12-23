import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS configuration with strict validation
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) {
    return "https://rbqafiykevtbgztczizr.lovableproject.com";
  }
  
  // Strict regex patterns - no subdomain bypass possible
  const allowedPatterns = [
    /^https:\/\/rbqafiykevtbgztczizr\.lovableproject\.com$/,
    /^https:\/\/gmbinarypro\.lovable\.app$/,
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/, // Dev only with optional port
  ];
  
  for (const pattern of allowedPatterns) {
    if (pattern.test(requestOrigin)) {
      return requestOrigin;
    }
  }
  
  return "https://rbqafiykevtbgztczizr.lovableproject.com";
};

// Secure IP extraction - only trust Cloudflare header
const getClientIP = (req: Request): string => {
  // ONLY trust CF-Connecting-IP on Supabase Edge Functions
  // This header is set by Cloudflare and cannot be spoofed by clients
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    // Validate it looks like a real IP (IPv4 or IPv6)
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f:]+$/i;
    if (ipPattern.test(cfIP)) {
      return cfIP;
    }
  }
  
  // For local development fallback
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    // Only allow obvious local IPs in dev
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return ip;
    }
  }
  
  return "unknown";
};

// Per-IP rate limiting for submissions (max 20 per day per IP)
const SUBMISSION_DAILY_LIMIT = 20;

// Check and increment submission count atomically per IP
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
    // Use atomic increment function for per-IP rate limiting
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
      // Fail open for rate checking (allow submission)
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
    return { allowed: true, remaining: SUBMISSION_DAILY_LIMIT }; // Fail open
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
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase config");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get and validate client IP
    const clientIP = getClientIP(req);
    console.log("Result submission from IP:", clientIP.slice(0, 10) + "***");

    // Parse and validate input
    const body = await req.json();
    const { signal, result } = body;

    // Strict input validation
    if (!signal || !result) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate signal is exactly CALL or PUT
    if (!["CALL", "PUT"].includes(signal)) {
      return new Response(
        JSON.stringify({ error: "Invalid signal value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate result is exactly WIN or LOSS (normalize to uppercase for DB constraint)
    const normalizedResult = result.toUpperCase();
    if (!["WIN", "LOSS"].includes(normalizedResult)) {
      return new Response(
        JSON.stringify({ error: "Invalid result value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check per-IP rate limit for submissions (atomically increments if allowed)
    const { allowed, remaining } = await checkAndIncrementSubmission(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientIP);
    if (!allowed) {
      console.log("Rate limit reached for IP:", clientIP.slice(0, 10) + "***");
      return new Response(
        JSON.stringify({ error: "Too many submissions today. Please try again tomorrow." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert using service role to bypass RLS
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
          user_id: "00000000-0000-0000-0000-000000000000", // Anonymous placeholder
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
