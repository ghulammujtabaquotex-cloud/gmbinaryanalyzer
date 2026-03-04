import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 10;
const ADMIN_DAILY_LIMIT = 999999; // Unlimited

// Special IP overrides - custom limits for specific users
const IP_LIMIT_OVERRIDES: Record<string, number> = {
  "202.47.55.98": 100,
};

// CORS configuration - allow all lovable preview domains
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
const checkUserStatus = async (
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
  authHeader: string | null
): Promise<{ isVip: boolean; isAdmin: boolean; userId: string | null }> => {
  if (!authHeader) {
    return { isVip: false, isAdmin: false, userId: null };
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { isVip: false, isAdmin: false, userId: null };
    }

    // Use service role to check roles/vip (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isVip } = await adminClient
      .rpc('is_vip', { _user_id: user.id });

    const { data: isAdmin } = await adminClient
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    return { isVip: !!isVip, isAdmin: !!isAdmin, userId: user.id };
  } catch (err) {
    console.error("Error in checkUserStatus:", err);
    return { isVip: false, isAdmin: false, userId: null };
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
        JSON.stringify({ error: "Service unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientIP = getClientIP(req);
    const today = new Date().toISOString().split("T")[0];

    console.log("Checking usage for IP:", clientIP.slice(0, 10) + "***");

    // Check user status from auth header
    const authHeader = req.headers.get("authorization");
    const { isVip, isAdmin } = await checkUserStatus(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, authHeader);
    
    // Determine daily limit: Admin > IP override > VIP > Free
    let dailyLimit: number;
    const hasIpOverride = clientIP in IP_LIMIT_OVERRIDES;
    
    if (isAdmin) {
      dailyLimit = ADMIN_DAILY_LIMIT;
      console.log(`Admin user: Unlimited`);
    } else if (hasIpOverride) {
      dailyLimit = IP_LIMIT_OVERRIDES[clientIP];
      console.log(`Special IP override: Limit = ${dailyLimit}`);
    } else {
      dailyLimit = isVip ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT;
      console.log(`User type: ${isVip ? 'VIP' : 'FREE'}, Daily limit: ${dailyLimit}`);
    }

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
          isVip,
          isAdmin
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
          isVip,
          isAdmin
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
        isVip,
        isAdmin
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
        isVip: false,
        isAdmin: false
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
