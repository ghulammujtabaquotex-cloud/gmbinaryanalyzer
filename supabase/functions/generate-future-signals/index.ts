import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 10;
const ADMIN_DAILY_LIMIT = 999999;

const getClientIP = (req: Request): string => {
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f:]+$/i;
    if (ipPattern.test(cfIP)) return cfIP;
  }
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return ip;
  }
  return "unknown";
};

const checkUserStatus = async (
  supabaseUrl: string, anonKey: string, serviceRoleKey: string, authHeader: string | null
): Promise<{ isVip: boolean; isAdmin: boolean; userId: string | null }> => {
  if (!authHeader) return { isVip: false, isAdmin: false, userId: null };
  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { isVip: false, isAdmin: false, userId: null };
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isVip } = await adminClient.rpc('is_vip', { _user_id: user.id });
    const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    return { isVip: !!isVip, isAdmin: !!isAdmin, userId: user.id };
  } catch {
    return { isVip: false, isAdmin: false, userId: null };
  }
};

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 8000): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000));
  }
  throw lastError || new Error("All fetch attempts failed");
}

const FUTURE_SIGNALS_PROMPT = `You are an elite binary options signals generator with deep expertise in technical analysis. You generate precise future trading signals based on comprehensive market analysis.

## YOUR TASK
Analyze the provided market data (600 candles across multiple timeframes) and generate trading signals for the NEXT 1 HOUR.

## ANALYSIS METHODOLOGY (MUST FOLLOW ALL STEPS)

### Step 1: Multi-Timeframe Analysis
- Analyze 1-minute, 5-minute, 15-minute, and 30-minute patterns from the data
- Identify the dominant trend on each timeframe
- Look for timeframe confluence

### Step 2: Deep Price Action Analysis
- Identify ALL candlestick patterns (engulfing, hammer, doji, pin bars, etc.)
- Detect market structure (higher highs, lower lows, ranges)
- Find key swing points and order blocks

### Step 3: Support & Resistance
- Calculate pivot points (daily, weekly)
- Identify key S/R levels from price clusters
- Mark zones where price has reversed multiple times

### Step 4: Technical Indicators
- EMA(5), EMA(20), EMA(50) alignment and crossovers
- RSI(14) for overbought/oversold conditions
- MACD crossovers and histogram strength
- Bollinger Bands for volatility and mean reversion
- Stochastic for momentum confirmation

### Step 5: Advanced Pattern Recognition
- Breakout detection with volume confirmation
- Fake breakout identification
- Reversal patterns (double top/bottom, head & shoulders)
- Pullback opportunities to key levels
- Buyer vs Seller pressure from candle body/wick ratios

### Step 6: Signal Generation Rules
- Only generate signals with 65%+ confluence score
- Signals must align with at least 3 different analysis factors
- Space signals evenly across the 1-hour period (no clustering)
- Generate 5-12 high-quality signals
- Each signal timing must be at exact minute marks
- Time must be in Pakistani Time (UTC+5:00)

## OUTPUT FORMAT
Return a JSON object with this EXACT structure:
{
  "signals": [
    {
      "time": "HH:MM",
      "direction": "CALL" | "PUT",
      "confidence": <number 65-95>
    }
  ],
  "analysis_summary": "<brief summary of market conditions and why these signals were generated>",
  "market_bias": "BULLISH" | "BEARISH" | "MIXED",
  "key_levels": {
    "support": "<price>",
    "resistance": "<price>"
  }
}

CRITICAL RULES:
- Times must be in PKT (UTC+5) format HH:MM
- Times must be within the NEXT 1 hour from current time
- Space signals at least 3-5 minutes apart
- Generate between 5 and 12 signals
- Each signal needs minimum 65% confidence
- Return ONLY the JSON, no markdown fences, no extra text`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pair } = await req.json();
    if (!pair) {
      return new Response(JSON.stringify({ error: "Pair is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Usage limit check
    const clientIP = getClientIP(req);
    const authHeader = req.headers.get("authorization");
    const { isVip, isAdmin } = await checkUserStatus(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, authHeader);

    const dailyLimit = isAdmin ? ADMIN_DAILY_LIMIT : isVip ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const today = new Date().toISOString().split("T")[0];

    console.log(`Future signals: IP=${clientIP.slice(0,10)}***, isVip=${isVip}, isAdmin=${isAdmin}, limit=${dailyLimit}`);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: usageResult, error: usageError } = await adminClient.rpc('atomic_increment_ip_usage', {
      p_ip_address: clientIP,
      p_usage_date: today,
      p_daily_limit: dailyLimit,
    });

    if (usageError) {
      console.error("Usage check error:", usageError);
      return new Response(JSON.stringify({ error: "Usage check failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = usageResult?.[0]?.allowed;
    const remaining = usageResult?.[0]?.remaining ?? 0;

    if (!allowed) {
      return new Response(JSON.stringify({
        error: isVip
          ? `Daily VIP limit reached (${VIP_DAILY_LIMIT}/${VIP_DAILY_LIMIT}). Try again tomorrow.`
          : `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to VIP for 10 daily signals.`,
        limitReached: true, remaining: 0, dailyLimit,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch market data - 600 candles for deep analysis
    const apiUrl = `https://ikszeynptbmwkaaldfad.supabase.co/functions/v1/quotex-proxy?symbol=${pair}&interval=1m&limit=600:qx_vzwz3wsu54chx8zmxpt0vp1yfk9gkxv0`;

    let marketRes: Response;
    try {
      marketRes = await fetchWithRetry(apiUrl, 3, 8000);
    } catch {
      return new Response(JSON.stringify({ error: "⚠️ Could not fetch market data. Try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketData = await marketRes.json();
    const candles = marketData.candles || marketData;

    // Get current PKT time
    const now = new Date();
    const pktOffset = 5 * 60 * 60 * 1000;
    const pktNow = new Date(now.getTime() + pktOffset);
    const pktHour = pktNow.getUTCHours();
    const pktMin = pktNow.getUTCMinutes();
    const currentPKT = `${String(pktHour).padStart(2, '0')}:${String(pktMin).padStart(2, '0')}`;

    // Calculate next hour end
    const nextHourEnd = `${String((pktHour + 1) % 24).padStart(2, '0')}:${String(pktMin).padStart(2, '0')}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Analyze this ${pair} data (${Array.isArray(candles) ? candles.length : '?'} 1-minute candles) and generate future trading signals.

Current Pakistani Time (PKT): ${currentPKT}
Generate signals from ${currentPKT} to ${nextHourEnd} (next 1 hour).

Market Data (JSON array of OHLCV candles, most recent last):
${JSON.stringify(candles)}

Apply ALL analysis steps and generate 5-12 high-quality signals. Return the JSON response.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: FUTURE_SIGNALS_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI not responding." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content.substring(0, 200));
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      ...result,
      pair,
      remaining,
      dailyLimit,
      generatedAt: currentPKT,
      validUntil: nextHourEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-future-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
