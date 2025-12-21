import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DAILY_LIMIT = 5;

// CORS configuration with strict regex validation to prevent subdomain bypass attacks
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) {
    return "https://rbqafiykevtbgztczizr.lovableproject.com";
  }
  
  // Strict regex patterns - prevents bypass via subdomains like localhost.evil.com
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
  
  // Reject unknown origins - return default
  return "https://rbqafiykevtbgztczizr.lovableproject.com";
};

const systemPrompt = `You are a PROFESSIONAL binary options price action analyst with 15+ years experience. Your analysis must be CONSISTENT and RELIABLE.

## CRITICAL CONSISTENCY RULE
For the SAME chart, you MUST always give the SAME signal. Your analysis is based on OBJECTIVE technical factors, not randomness. Focus on what the chart SHOWS, not guesses.

## ANALYSIS METHOD (Follow This Order)

### STEP 1: IDENTIFY THE DOMINANT TREND (Most Important)
Look at the LAST 20-30 candles:
- COUNT: How many candles closed GREEN vs RED?
- STRUCTURE: Are there Higher Highs + Higher Lows (UPTREND) or Lower Highs + Lower Lows (DOWNTREND)?
- STRENGTH: Is the trend strong (consecutive same-color candles) or weak (alternating)?

TREND DECISION:
- 60%+ green candles with HH+HL structure = UPTREND → Bias CALL
- 60%+ red candles with LH+LL structure = DOWNTREND → Bias PUT  
- No clear structure = RANGE

### STEP 2: FIND KEY SUPPORT/RESISTANCE ZONES
- SUPPORT: Price level where price bounced UP at least 2 times
- RESISTANCE: Price level where price rejected DOWN at least 2 times
- Note the CURRENT price position relative to these zones

### STEP 3: ANALYZE THE LAST 3-5 CANDLES (Entry Timing)
Look for CONFIRMATION patterns:

FOR CALL SIGNAL (All conditions should align):
✓ Overall trend is UP or price at SUPPORT
✓ Last candle shows bullish sign: green body, long lower wick rejection, or bullish engulfing
✓ Price is NOT hitting resistance

FOR PUT SIGNAL (All conditions should align):
✓ Overall trend is DOWN or price at RESISTANCE  
✓ Last candle shows bearish sign: red body, long upper wick rejection, or bearish engulfing
✓ Price is NOT hitting support

### STEP 4: CONFIRMATION CHECKLIST
Before giving CALL, verify:
□ Trend supports upward movement
□ No major resistance directly above
□ Recent candles show buying pressure

Before giving PUT, verify:
□ Trend supports downward movement  
□ No major support directly below
□ Recent candles show selling pressure

## SIGNAL RULES

GIVE CALL WHEN:
1. Strong uptrend (HH+HL) + bullish candle pattern, OR
2. Price bouncing from clear support zone with bullish rejection, OR
3. Downtrend breaking with strong bullish reversal candles

GIVE PUT WHEN:
1. Strong downtrend (LH+LL) + bearish candle pattern, OR
2. Price rejecting from clear resistance zone with bearish rejection, OR
3. Uptrend breaking with strong bearish reversal candles

GIVE NEUTRAL ONLY WHEN:
- Price is EXACTLY in the middle of a tight range
- No visible trend structure at all
- Conflicting signals (bullish trend but at resistance, bearish trend but at support)
- Chart is unclear, blurry, or has less than 20 candles

## CONSISTENCY GUARANTEE
Your signal is based on:
1. Objective candle count (green vs red)
2. Clear price structure (HH/HL or LH/LL)
3. Visible support/resistance zones
4. Last candle pattern

Same chart = Same objective factors = SAME SIGNAL

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "supportZone": "price level or range",
  "resistanceZone": "price level or range", 
  "explanation": "Trend: [describe trend with candle count]. Structure: [HH/HL or LH/LL]. Last candles: [pattern seen]. Key level: [support/resistance interaction]. Signal reason: [why this direction]."
}`;

// Image magic bytes for validation
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  jpeg: [[0xFF, 0xD8, 0xFF]],
  gif: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF....WEBP)
};

// Validate image content by checking magic bytes
const validateImageMagicBytes = (base64Data: string): boolean => {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length && i < 12; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    for (const [format, signatures] of Object.entries(IMAGE_SIGNATURES)) {
      for (const sig of signatures) {
        if (sig.every((byte, i) => bytes[i] === byte)) {
          // Additional check for WebP: verify WEBP marker at offset 8
          if (format === 'webp') {
            const webpMarker = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
            if (webpMarker.every((byte, i) => bytes[i + 8] === byte)) {
              return true;
            }
          } else {
            return true;
          }
        }
      }
    }
    return false;
  } catch {
    return false;
  }
};

// Input validation - tightened size limits for security
const validateImageInput = (imageBase64: string): { valid: boolean; error?: string } => {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return { valid: false, error: "No image provided" };
  }

  // Tightened limit: 2.5MB base64 = ~2MB actual file size (base64 is ~33% larger)
  const maxBase64Size = 2.5 * 1024 * 1024;
  if (imageBase64.length > maxBase64Size) {
    return { valid: false, error: "Image is too large. Please use an image under 2MB." };
  }

  const dataUriPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
  if (!dataUriPattern.test(imageBase64)) {
    return { valid: false, error: "Invalid image format. Please upload a PNG, JPEG, GIF, or WebP image." };
  }

  // Extract base64 data and validate magic bytes
  const base64Data = imageBase64.split(',')[1];
  if (!base64Data || !validateImageMagicBytes(base64Data)) {
    return { valid: false, error: "Invalid image content. Please upload a valid image file." };
  }

  return { valid: true };
};

// Secure IP extraction - ONLY trust CF-Connecting-IP to prevent spoofing
const getClientIP = (req: Request): string => {
  // ONLY trust CF-Connecting-IP on Supabase Edge Functions
  // This header is set by Cloudflare and cannot be spoofed by clients
  // X-Forwarded-For and X-Real-IP can be manipulated by attackers
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    // Validate it looks like a real IP (IPv4 or IPv6)
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f:]+$/i;
    if (ipPattern.test(cfIP)) {
      return cfIP;
    }
  }
  
  // For local development only - allow obvious local IPs
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    // Only allow obvious local IPs in dev
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return ip;
    }
  }
  
  // Log potential spoofing attempts
  const suspiciousXFF = req.headers.get("x-forwarded-for");
  if (suspiciousXFF && !cfIP) {
    console.warn("Potential IP spoofing: XFF present without CF-Connecting-IP:", suspiciousXFF.slice(0, 20));
  }
  
  return "unknown";
};

// Check IP usage without incrementing
const checkIPUsage = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  ipAddress: string
): Promise<{ count: number; remaining: number; canAnalyze: boolean }> => {
  const today = new Date().toISOString().split("T")[0];

  const headers = {
    "apikey": serviceRoleKey,
    "Authorization": `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  try {
    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/check_ip_usage`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_ip_address: ipAddress,
          p_usage_date: today,
          p_daily_limit: DAILY_LIMIT,
        }),
      }
    );

    if (!rpcResponse.ok) {
      console.error("Check IP usage RPC failed, status:", rpcResponse.status);
      return { count: 0, remaining: DAILY_LIMIT, canAnalyze: true };
    }

    const result = await rpcResponse.json();
    if (result && result.length > 0) {
      return { 
        count: result[0].request_count,
        remaining: result[0].remaining,
        canAnalyze: result[0].can_analyze
      };
    }

    return { count: 0, remaining: DAILY_LIMIT, canAnalyze: true };
  } catch (err) {
    console.error("Check IP usage error:", err);
    return { count: 0, remaining: DAILY_LIMIT, canAnalyze: true };
  }
};

// Increment IP usage (only call after CALL/PUT signal)
const incrementIPUsage = async (
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
      `${supabaseUrl}/rest/v1/rpc/atomic_increment_ip_usage`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_ip_address: ipAddress,
          p_usage_date: today,
          p_daily_limit: DAILY_LIMIT,
        }),
      }
    );

    if (!rpcResponse.ok) {
      console.error("Increment IP usage RPC failed, status:", rpcResponse.status);
      return { allowed: false, remaining: 0 };
    }

    const result = await rpcResponse.json();
    if (result && result.length > 0) {
      return { 
        allowed: result[0].allowed, 
        remaining: result[0].remaining 
      };
    }

    return { allowed: false, remaining: 0 };
  } catch (err) {
    console.error("Increment IP usage error:", err);
    return { allowed: false, remaining: 0 };
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
      console.error("ERR_CONFIG: Missing Supabase config");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP
    const clientIP = getClientIP(req);
    console.log("Processing request from IP:", clientIP.slice(0, 10) + "***");

    // Check current usage (without incrementing)
    const { remaining, canAnalyze } = await checkIPUsage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientIP);
    
    if (!canAnalyze) {
      return new Response(
        JSON.stringify({ 
          error: "Daily limit reached",
          limitReached: true,
          message: "JOIN VIP FOR MORE CREDIT"
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = await req.json();

    // Validate input
    const validation = validateImageInput(imageBase64);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("ERR_CONFIG: Missing API key");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing analysis request, remaining before:", remaining);

    // Add timeout for AI gateway request (55 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
              {
                  type: "text",
                  text: "Analyze this trading chart using your systematic 4-step method: 1) Count green vs red candles in last 20-30 bars and identify trend structure (HH/HL or LH/LL), 2) Mark support and resistance zones where price bounced/rejected multiple times, 3) Analyze last 3-5 candles for entry confirmation patterns, 4) Run your confirmation checklist before deciding. Your analysis must be OBJECTIVE and REPRODUCIBLE - the same chart analyzed again must give the same signal. Focus on what the chart SHOWS, not guesses. Respond with JSON only.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        console.error("Request timeout after 55s");
        return new Response(
          JSON.stringify({ error: "Analysis timed out. Please try again." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw err;
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Gateway error:", response.status);
      return new Response(
        JSON.stringify({ error: "Analysis failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("ERR_EMPTY_RESPONSE");
      return new Response(
        JSON.stringify({ error: "Analysis failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response from AI
    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch {
      console.error("ERR_PARSE");
      analysis = {
        pair: "Unknown",
        trend: "Range",
        signal: "NEUTRAL",
        supportZone: "Unable to determine",
        resistanceZone: "Unable to determine",
        explanation: "Could not fully analyze the chart. Please ensure the image shows a clear trading chart with at least 30 visible candlesticks and try again.",
      };
    }

    // ONLY increment usage for CALL or PUT signals, NOT for NEUTRAL
    let finalRemaining = remaining;
    if (analysis.signal === "CALL" || analysis.signal === "PUT") {
      const { remaining: newRemaining } = await incrementIPUsage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientIP);
      finalRemaining = newRemaining;
      console.log("CALL/PUT signal - usage incremented, remaining:", finalRemaining);
    } else {
      console.log("NEUTRAL signal - usage NOT incremented, remaining:", finalRemaining);
    }

    return new Response(JSON.stringify({ ...analysis, remaining: finalRemaining }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ERR_UNEXPECTED:", err);
    return new Response(
      JSON.stringify({ error: "Analysis failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
