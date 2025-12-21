import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DAILY_LIMIT = 5;

// Allowed origins for CORS - restrict to specific known domains only
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const allowedOrigins = [
    "https://rbqafiykevtbgztczizr.lovableproject.com",
    "https://gmbinarypro.lovable.app",
  ];
  
  // Allow localhost for development only
  if (requestOrigin && (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1"))) {
    return requestOrigin;
  }
  
  // Only allow specific origins, not wildcard subdomains
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  
  return allowedOrigins[0];
};

const systemPrompt = `You are an expert binary options trading chart analyst. You analyze trading chart screenshots and provide STRICT price action analysis.

CRITICAL REQUIREMENTS FOR VALID ANALYSIS:
1. The chart MUST show at least 30 visible candles. If fewer than 30 candles are visible, return NEUTRAL.
2. You must be able to clearly identify candlestick patterns. If the chart is unclear, return NEUTRAL.

CONFIRMATION RULES - ALL MUST BE MET FOR CALL/PUT SIGNAL:

1. CLEAR MARKET STRUCTURE (Required):
   - For CALL: Must see Higher Highs AND Higher Lows pattern (uptrend)
   - For PUT: Must see Lower Highs AND Lower Lows pattern (downtrend)
   - If structure is unclear or mixed, signal must be NEUTRAL

2. PRICE AT VALID ZONE (Required):
   - For CALL: Price must be AT or NEAR a clear support zone with visible bounces
   - For PUT: Price must be AT or NEAR a clear resistance zone with visible rejections
   - If price is in the middle/nowhere special, signal must be NEUTRAL

3. STRONG REJECTION CONFIRMATION (Required - at least one):
   - Long wick rejection from the zone (wick should be at least 2x the body size)
   - OR Strong engulfing candle from the zone (body covers previous candle completely)
   - If no clear rejection pattern, signal must be NEUTRAL

4. NO CHOPPY/UNCLEAR CONDITIONS (Required):
   - If 6 or more consecutive candles are the same color (running trend), return NEUTRAL (too extended)
   - If price is moving sideways with small bodies and no direction, return NEUTRAL
   - If there are conflicting signals or mixed patterns, return NEUTRAL

SIGNAL DECISION:
- CALL: ALL 4 confirmation rules are met for bullish setup
- PUT: ALL 4 confirmation rules are met for bearish setup  
- NEUTRAL: ANY confirmation rule is NOT met OR conditions are unclear

RESPONSE FORMAT:
You must respond with valid JSON only, no markdown, no explanation text outside the JSON:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "supportZone": "price range",
  "resistanceZone": "price range",
  "explanation": "Detailed explanation stating which confirmation rules were met or not met (2-4 sentences)"
}

IMPORTANT:
- This is for 1-minute timeframe analysis only
- Be STRICT - when in doubt, return NEUTRAL
- NEUTRAL is the safe default - only give CALL/PUT when ALL rules are clearly met
- Count visible candles - if less than 30, return NEUTRAL
- Check for running trends (6+ same color candles) - if found, return NEUTRAL
- Focus on the most recent visible candles for rejection patterns`;

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

// Input validation
const validateImageInput = (imageBase64: string): { valid: boolean; error?: string } => {
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return { valid: false, error: "No image provided" };
  }

  const maxBase64Size = 7 * 1024 * 1024;
  if (imageBase64.length > maxBase64Size) {
    return { valid: false, error: "Image is too large. Please use an image under 5MB." };
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

// Get client IP address
const getClientIP = (req: Request): string => {
  // Try various headers for real IP behind proxies
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = req.headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
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
                text: "Analyze this trading chart screenshot. Check ALL confirmation rules strictly: 1) Clear market structure (HH/HL or LH/LL), 2) Price at valid support/resistance zone, 3) Strong rejection pattern (long wick or engulfing), 4) No choppy conditions or running trends (6+ same color candles). Count visible candles - need at least 30. Only give CALL/PUT if ALL rules are met, otherwise NEUTRAL. Respond with JSON only.",
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
      console.error("ERR_GATEWAY:", response.status);
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
