import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 20;

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

// Same high-quality analysis for all users - VIP benefits are more daily analyses, history, stats
const freeSystemPrompt = `You are a PROFESSIONAL binary options price action analyst with 15+ years experience. Your analysis must be CONSISTENT, RELIABLE, and HIGHLY ACCURATE.

## CRITICAL CONSISTENCY RULE
For the SAME chart, you MUST always give the SAME signal. Your analysis is based on OBJECTIVE technical factors, not randomness. Focus on what the chart SHOWS, not guesses.

## ADVANCED ANALYSIS METHOD (Follow This Order)

### STEP 1: MULTI-TIMEFRAME CONTEXT
Even though this is a 1-minute chart, consider:
- Overall market structure (trending or ranging)
- Position relative to recent swing highs/lows
- Volume analysis if visible

### STEP 2: IDENTIFY THE DOMINANT TREND (Most Important)
Look at the LAST 20-30 candles:
- COUNT: How many candles closed GREEN vs RED?
- STRUCTURE: Are there Higher Highs + Higher Lows (UPTREND) or Lower Highs + Lower Lows (DOWNTREND)?
- STRENGTH: Is the trend strong (consecutive same-color candles) or weak (alternating)?
- MOMENTUM: Are the candles getting larger (increasing momentum) or smaller (decreasing)?

TREND DECISION:
- 60%+ green candles with HH+HL structure = UPTREND → Bias CALL
- 60%+ red candles with LH+LL structure = DOWNTREND → Bias PUT  
- No clear structure = RANGE → Be extra careful

### STEP 3: FIND KEY SUPPORT/RESISTANCE ZONES
- SUPPORT: Price level where price bounced UP at least 2-3 times
- RESISTANCE: Price level where price rejected DOWN at least 2-3 times
- Look for CONFLUENCE: Multiple touches, round numbers, previous swing points
- Note the CURRENT price position relative to these zones

### STEP 4: ANALYZE CANDLESTICK PATTERNS (Last 3-5 Candles)
Look for HIGH-PROBABILITY patterns:
- Pin Bars / Hammer / Shooting Star (long wick rejection)
- Engulfing patterns (bullish/bearish)
- Doji at key levels (indecision, potential reversal)
- Three white soldiers / Three black crows (momentum)
- Inside bars followed by breakout

### STEP 5: ENTRY CONFIRMATION CHECKLIST

FOR CALL SIGNAL (ALL conditions should align):
✓ Overall trend is UP or price at STRONG SUPPORT
✓ Last candle shows bullish sign: green body, long lower wick rejection, or bullish engulfing
✓ Price is NOT hitting immediate resistance
✓ No bearish divergence patterns
✓ Volume supports the move (if visible)

FOR PUT SIGNAL (ALL conditions should align):
✓ Overall trend is DOWN or price at STRONG RESISTANCE  
✓ Last candle shows bearish sign: red body, long upper wick rejection, or bearish engulfing
✓ Price is NOT hitting immediate support
✓ No bullish divergence patterns
✓ Volume supports the move (if visible)

### STEP 6: WIN PROBABILITY CALCULATION
Calculate the probability of the next candle going in the signal direction (0-100%):
- Base probability on trend strength (stronger trend = higher probability)
- Adjust for pattern clarity (+5-15% for clear patterns)
- Adjust for key level proximity (+10% at strong S/R, -10% against S/R)
- Adjust for momentum (+5-10% with momentum, -5-10% against)
- Minimum probability for CALL/PUT signal: 65%
- Below 65%: Give NEUTRAL

## SIGNAL RULES

GIVE CALL WHEN (probability 65%+):
1. Strong uptrend (HH+HL) + bullish candle pattern, OR
2. Price bouncing from STRONG support zone with clear bullish rejection, OR
3. Downtrend breaking with strong bullish reversal candles + volume

GIVE PUT WHEN (probability 65%+):
1. Strong downtrend (LH+LL) + bearish candle pattern, OR
2. Price rejecting from STRONG resistance zone with clear bearish rejection, OR
3. Uptrend breaking with strong bearish reversal candles + volume

GIVE NEUTRAL WHEN:
- Probability below 65%
- Price is in middle of tight range with no clear bias
- Conflicting signals (bullish trend but at resistance, bearish trend but at support)
- Chart is unclear, blurry, or has less than 20 candles
- High-impact news period likely

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 75,
  "supportZone": "price level or range",
  "resistanceZone": "price level or range", 
  "explanation": "Trend: [describe trend with candle count]. Structure: [HH/HL or LH/LL]. Pattern: [candlestick pattern observed]. Key level: [support/resistance interaction]. Win probability: [X]%. Signal reason: [why this direction]."
}`;

// Enhanced system prompt for VIP users - more detailed and professional
const vipSystemPrompt = `You are a PROFESSIONAL binary options price action analyst with 15+ years experience. Your analysis must be CONSISTENT, RELIABLE, and HIGHLY ACCURATE.

## CRITICAL CONSISTENCY RULE
For the SAME chart, you MUST always give the SAME signal. Your analysis is based on OBJECTIVE technical factors, not randomness. Focus on what the chart SHOWS, not guesses.

## ADVANCED VIP ANALYSIS METHOD (Follow This Order)

### STEP 1: MULTI-TIMEFRAME CONTEXT
Even though this is a 1-minute chart, consider:
- Overall market structure (trending or ranging)
- Position relative to recent swing highs/lows
- Volume analysis if visible

### STEP 2: IDENTIFY THE DOMINANT TREND (Most Important)
Look at the LAST 20-30 candles:
- COUNT: How many candles closed GREEN vs RED?
- STRUCTURE: Are there Higher Highs + Higher Lows (UPTREND) or Lower Highs + Lower Lows (DOWNTREND)?
- STRENGTH: Is the trend strong (consecutive same-color candles) or weak (alternating)?
- MOMENTUM: Are the candles getting larger (increasing momentum) or smaller (decreasing)?

TREND DECISION:
- 60%+ green candles with HH+HL structure = UPTREND → Bias CALL
- 60%+ red candles with LH+LL structure = DOWNTREND → Bias PUT  
- No clear structure = RANGE → Be extra careful

### STEP 3: FIND KEY SUPPORT/RESISTANCE ZONES
- SUPPORT: Price level where price bounced UP at least 2-3 times
- RESISTANCE: Price level where price rejected DOWN at least 2-3 times
- Look for CONFLUENCE: Multiple touches, round numbers, previous swing points
- Note the CURRENT price position relative to these zones

### STEP 4: ANALYZE CANDLESTICK PATTERNS (Last 3-5 Candles)
Look for HIGH-PROBABILITY patterns:
- Pin Bars / Hammer / Shooting Star (long wick rejection)
- Engulfing patterns (bullish/bearish)
- Doji at key levels (indecision, potential reversal)
- Three white soldiers / Three black crows (momentum)
- Inside bars followed by breakout

### STEP 5: ENTRY CONFIRMATION CHECKLIST

FOR CALL SIGNAL (ALL conditions should align):
✓ Overall trend is UP or price at STRONG SUPPORT
✓ Last candle shows bullish sign: green body, long lower wick rejection, or bullish engulfing
✓ Price is NOT hitting immediate resistance
✓ No bearish divergence patterns
✓ Volume supports the move (if visible)

FOR PUT SIGNAL (ALL conditions should align):
✓ Overall trend is DOWN or price at STRONG RESISTANCE  
✓ Last candle shows bearish sign: red body, long upper wick rejection, or bearish engulfing
✓ Price is NOT hitting immediate support
✓ No bullish divergence patterns
✓ Volume supports the move (if visible)

### STEP 6: CONFIDENCE SCORING
Rate your confidence (1-10) based on:
- How many confirmation factors align
- Clarity of the pattern
- Strength of support/resistance
- Trend alignment

Only give CALL/PUT if confidence is 7+. Otherwise, give NEUTRAL.

## SIGNAL RULES

GIVE CALL WHEN (confidence 7+):
1. Strong uptrend (HH+HL) + bullish candle pattern, OR
2. Price bouncing from STRONG support zone with clear bullish rejection, OR
3. Downtrend breaking with strong bullish reversal candles + volume

GIVE PUT WHEN (confidence 7+):
1. Strong downtrend (LH+LL) + bearish candle pattern, OR
2. Price rejecting from STRONG resistance zone with clear bearish rejection, OR
3. Uptrend breaking with strong bearish reversal candles + volume

GIVE NEUTRAL WHEN:
- Confidence below 7
- Price is in middle of tight range with no clear bias
- Conflicting signals (bullish trend but at resistance, bearish trend but at support)
- Chart is unclear, blurry, or has less than 20 candles
- High-impact news period likely

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "supportZone": "price level or range",
  "resistanceZone": "price level or range", 
  "explanation": "Trend: [describe trend with candle count]. Structure: [HH/HL or LH/LL]. Pattern: [candlestick pattern observed]. Key level: [support/resistance interaction]. Confidence: [X/10]. Signal reason: [why this direction]."
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
      console.log("No authenticated user found");
      return { isVip: false, userId: null };
    }

    // Check VIP status using the is_vip function
    const { data: isVip, error: vipError } = await supabase
      .rpc('is_vip', { _user_id: user.id });

    if (vipError) {
      console.error("Error checking VIP status:", vipError);
      return { isVip: false, userId: user.id };
    }

    console.log(`User ${user.id.slice(0, 8)}... VIP status:`, isVip);
    return { isVip: !!isVip, userId: user.id };
  } catch (err) {
    console.error("Error in checkVipStatus:", err);
    return { isVip: false, userId: null };
  }
};

// Check IP usage without incrementing
const checkIPUsage = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  ipAddress: string,
  dailyLimit: number
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
          p_daily_limit: dailyLimit,
        }),
      }
    );

    if (!rpcResponse.ok) {
      console.error("Check IP usage RPC failed, status:", rpcResponse.status);
      return { count: 0, remaining: dailyLimit, canAnalyze: true };
    }

    const result = await rpcResponse.json();
    if (result && result.length > 0) {
      return { 
        count: result[0].request_count,
        remaining: result[0].remaining,
        canAnalyze: result[0].can_analyze
      };
    }

    return { count: 0, remaining: dailyLimit, canAnalyze: true };
  } catch (err) {
    console.error("Check IP usage error:", err);
    return { count: 0, remaining: dailyLimit, canAnalyze: true };
  }
};

// Increment IP usage (only call after CALL/PUT signal)
const incrementIPUsage = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  ipAddress: string,
  dailyLimit: number
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
          p_daily_limit: dailyLimit,
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
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("ERR_CONFIG: Missing Supabase config");
      return new Response(
        JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP
    const clientIP = getClientIP(req);
    console.log("Processing request from IP:", clientIP.slice(0, 10) + "***");

    // Check VIP status from auth header
    const authHeader = req.headers.get("authorization");
    const { isVip, userId } = await checkVipStatus(SUPABASE_URL, SUPABASE_ANON_KEY, authHeader);
    
    // Set limits based on VIP status
    const dailyLimit = isVip ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT;
    console.log(`User type: ${isVip ? 'VIP' : 'FREE'}, Daily limit: ${dailyLimit}`);

    // Check current usage (without incrementing)
    const { remaining, canAnalyze } = await checkIPUsage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientIP, dailyLimit);
    
    if (!canAnalyze) {
      return new Response(
        JSON.stringify({ 
          error: "Daily limit reached",
          limitReached: true,
          message: isVip ? "VIP daily limit reached. Try again tomorrow!" : "JOIN VIP FOR MORE CREDIT",
          isVip
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

    console.log("Processing analysis request, remaining before:", remaining, "isVip:", isVip);

    // Same high-quality model and analysis for all users
    // VIP benefits: more daily analyses (20 vs 3), signal history, personal stats, PDF exports
    // Using user's own Gemini API key directly
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "⚠️ Analysis unavailable\n\nGemini API key not configured.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const model = "gemini-1.5-flash-latest";
    const systemPrompt = freeSystemPrompt; // Now using the same advanced prompt for everyone
    const analysisInstruction = "Analyze this trading chart using the advanced 6-step method: 1) Consider multi-timeframe context, 2) Count candles and identify trend structure with momentum analysis, 3) Mark confluence support/resistance zones, 4) Identify high-probability candlestick patterns, 5) Run your entry confirmation checklist, 6) Score your confidence (only signal if 7+). Your analysis must be HIGHLY ACCURATE and REPRODUCIBLE. Focus on what the chart SHOWS. Respond with JSON only.";

    console.log(`Using Gemini API directly with model: ${model} for ${isVip ? 'VIP' : 'FREE'} user`);

    // Add timeout for Gemini API request (55 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    // Extract mime type + base64 payload from the data URL
    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    const mimeType = mimeMatch?.[1] ?? "image/png";
    const base64Payload = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt + "\n\n" + analysisInstruction },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Payload,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
        }
      );
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("External AI API error:", err);
      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nExternal AI API not responding.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("External AI API error:", response.status, errText);
      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nExternal AI API not responding.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    // Gemini API response format: candidates[0].content.parts[0].text
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("ERR_EMPTY_RESPONSE: External AI returned no content");
      return new Response(
        JSON.stringify({ 
          error: "⚠️ Analysis unavailable\n\nExternal AI API not responding.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response from AI - NO FALLBACK, fail if parse fails
    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch {
      console.error("ERR_PARSE: Failed to parse external AI response");
      return new Response(
        JSON.stringify({ 
          error: "⚠️ Analysis unavailable\n\nExternal AI API returned invalid response.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract win probability from response (0-100%)
    let winProbability: number | null = analysis.winProbability || null;
    
    // Also try to extract from explanation if not in structured response
    if (!winProbability) {
      const probMatch = analysis.explanation?.match(/Win probability:\s*(\d+)%/i);
      if (probMatch) {
        winProbability = parseInt(probMatch[1], 10);
      }
    }
    
    // Ensure winProbability is within valid range
    if (winProbability !== null) {
      winProbability = Math.max(0, Math.min(100, winProbability));
    }

    // ONLY increment usage for CALL or PUT signals, NOT for NEUTRAL
    let finalRemaining = remaining;
    let signalHistoryId: string | null = null;
    
    if (analysis.signal === "CALL" || analysis.signal === "PUT") {
      const { remaining: newRemaining } = await incrementIPUsage(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientIP, dailyLimit);
      finalRemaining = newRemaining;
      console.log("CALL/PUT signal - usage incremented, remaining:", finalRemaining);

      // Save signal to history for VIP users and get the ID
      if (isVip && userId) {
        try {
          const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const { data: insertedSignal, error: historyError } = await supabaseAdmin
            .from('signal_history')
            .insert({
              user_id: userId,
              pair: analysis.pair || 'Unknown',
              trend: analysis.trend || 'Range',
              signal: analysis.signal,
              support_zone: analysis.supportZone,
              resistance_zone: analysis.resistanceZone,
              explanation: analysis.explanation,
              confidence: winProbability ? Math.round(winProbability / 10) : null, // Store as 1-10 for DB
              result: null // Will be updated when user submits result
            })
            .select('id')
            .single();

          if (historyError) {
            console.error("Error saving signal history:", historyError);
          } else if (insertedSignal) {
            signalHistoryId = insertedSignal.id;
            console.log("Signal saved to history for VIP user:", userId.slice(0, 8) + "...", "ID:", signalHistoryId);
          }
        } catch (histErr) {
          console.error("Failed to save signal history:", histErr);
        }
      }
    } else {
      console.log("NEUTRAL signal - usage NOT incremented, remaining:", finalRemaining);
    }

    return new Response(JSON.stringify({ 
      ...analysis, 
      remaining: finalRemaining,
      isVip,
      dailyLimit,
      winProbability,
      signalHistoryId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ERR_UNEXPECTED:", err);
    return new Response(
      JSON.stringify({ 
        error: "⚠️ Analysis unavailable\n\nExternal AI API not responding.\n\nNo signal generated to avoid random trades.",
        apiUnavailable: true
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
