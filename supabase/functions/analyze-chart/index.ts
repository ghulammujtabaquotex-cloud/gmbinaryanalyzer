import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 10;
const VIP_DAILY_LIMIT = 20;

// CORS configuration with strict regex validation to prevent subdomain bypass attacks
const getAllowedOrigin = (requestOrigin: string | null): string => {
  if (!requestOrigin) {
    return "https://rbqafiykevtbgztczizr.lovableproject.com";
  }
  
  // Strict regex patterns - prevents bypass via subdomains like localhost.evil.com
  const allowedPatterns = [
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
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
const freeSystemPrompt = `You are an ELITE binary options price action analyst with 15+ years experience. Your analysis must be CONSISTENT, RELIABLE, and produce SURESHOT TRADES with 70%+ accuracy.

## CRITICAL CONSISTENCY RULE
For the SAME chart, you MUST always give the SAME signal. Your analysis is based on OBJECTIVE technical factors, not randomness. Focus on what the chart SHOWS, not guesses.

## ADVANCED SURESHOT ANALYSIS METHOD (Follow This Order)

### STEP 1: MULTI-TIMEFRAME CONTEXT
Even though this is a 1-minute chart, consider:
- Overall market structure (trending or ranging)
- Position relative to recent swing highs/lows
- Volume analysis if visible
- Session timing (London/NY overlap = high volatility)

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

### STEP 3: MARKET TRAP DETECTION (CRITICAL FOR SURESHOT)
⚠️ AVOID THESE TRAP PATTERNS - They cause losing trades:

BULL TRAP SIGNS (Fake Breakout Up):
- Price breaks above resistance then immediately reverses with strong red candle
- Long upper wicks at resistance level
- Breakout candle has small body but large upper wick
- Volume spike on breakout but no follow-through
- Price quickly returns below the breakout level

BEAR TRAP SIGNS (Fake Breakout Down):
- Price breaks below support then immediately reverses with strong green candle
- Long lower wicks at support level
- Breakdown candle has small body but large lower wick
- Volume spike on breakdown but no follow-through
- Price quickly returns above the breakdown level

LIQUIDITY GRAB / STOP HUNT:
- Sharp spike through key level followed by immediate reversal
- Occurs after extended consolidation
- Usually happens at obvious support/resistance or round numbers
- Look for rejection candles (pin bars) after the grab

IF TRAP DETECTED → Give NEUTRAL signal, explain the trap

### STEP 4: FIND KEY SUPPORT/RESISTANCE ZONES
- SUPPORT: Price level where price bounced UP at least 2-3 times
- RESISTANCE: Price level where price rejected DOWN at least 2-3 times
- Look for CONFLUENCE: Multiple touches, round numbers, previous swing points
- Note the CURRENT price position relative to these zones

### STEP 5: TECHNICAL INDICATORS ANALYSIS
Analyze these if visible on chart:
- RSI: Overbought (>70) = bearish bias, Oversold (<30) = bullish bias
- MACD: Histogram increasing = momentum building, decreasing = weakening
- Moving Averages: Price above MA = bullish, below = bearish, MA crossover = signal
- Bollinger Bands: Touch upper band = overbought, lower band = oversold
- Stochastic: Cross in oversold zone = CALL, overbought zone = PUT

### STEP 6: ANALYZE CANDLESTICK PATTERNS (Last 3-5 Candles)
Look for HIGH-PROBABILITY patterns:
- Pin Bars / Hammer / Shooting Star (long wick rejection)
- Engulfing patterns (bullish/bearish)
- Doji at key levels (indecision, potential reversal)
- Three white soldiers / Three black crows (momentum)
- Inside bars followed by breakout
- Morning/Evening Star patterns

### STEP 7: SURESHOT ENTRY CRITERIA (ALL Must Pass)

FOR CALL SIGNAL (Sureshot Conditions):
✓ Overall trend is UP or price at STRONG SUPPORT
✓ NO BULL TRAP detected - price has follow-through
✓ Last candle shows strong bullish sign: full body green, long lower wick rejection, or bullish engulfing
✓ Price is NOT hitting immediate resistance (give room to move)
✓ No bearish divergence patterns
✓ At least 3 confirmation factors align
✓ Risk-reward favorable (support close, resistance far)

FOR PUT SIGNAL (Sureshot Conditions):
✓ Overall trend is DOWN or price at STRONG RESISTANCE  
✓ NO BEAR TRAP detected - price has follow-through
✓ Last candle shows strong bearish sign: full body red, long upper wick rejection, or bearish engulfing
✓ Price is NOT hitting immediate support (give room to move)
✓ No bullish divergence patterns
✓ At least 3 confirmation factors align
✓ Risk-reward favorable (resistance close, support far)

### STEP 8: WIN PROBABILITY CALCULATION
Calculate the probability of the next candle going in the signal direction (0-100%):
- Base probability on trend strength (stronger trend = higher probability)
- +10-15% for clear sureshot setup with multiple confirmations
- +10% for clean break without trap pattern
- +5-10% at strong S/R level
- -20% if any trap pattern detected
- -15% if conflicting signals
- Minimum probability for CALL/PUT signal: 65%
- Below 65%: Give NEUTRAL

## SIGNAL RULES

GIVE CALL WHEN (probability 65%+, NO traps):
1. Strong uptrend (HH+HL) + bullish candle + no resistance ahead, OR
2. Price bouncing from STRONG support with clear rejection + no bull trap, OR
3. Clean trend reversal with volume confirmation

GIVE PUT WHEN (probability 65%+, NO traps):
1. Strong downtrend (LH+LL) + bearish candle + no support ahead, OR
2. Price rejecting from STRONG resistance with clear rejection + no bear trap, OR
3. Clean trend reversal with volume confirmation

GIVE NEUTRAL WHEN:
- Probability below 65%
- ANY trap pattern detected (bull trap, bear trap, stop hunt)
- Price is in middle of tight range
- Conflicting signals present
- Chart is unclear or has less than 20 candles

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 75,
  "supportZone": "price level or range",
  "resistanceZone": "price level or range", 
  "explanation": "Trend: [describe trend]. Trap Check: [PASSED/DETECTED - describe]. Pattern: [candlestick pattern]. Key Level: [S/R interaction]. Indicators: [if visible]. Sureshot Score: [X/5 factors]. Win probability: [X]%. Signal: [reason]."
}`;

// Enhanced system prompt for VIP users - more detailed and professional
const vipSystemPrompt = `You are an ELITE binary options price action analyst with 15+ years experience. Your analysis must be CONSISTENT, RELIABLE, and produce SURESHOT TRADES with 75%+ accuracy.

## CRITICAL CONSISTENCY RULE
For the SAME chart, you MUST always give the SAME signal. Your analysis is based on OBJECTIVE technical factors, not randomness. Focus on what the chart SHOWS, not guesses.

## ADVANCED VIP SURESHOT ANALYSIS METHOD (Follow This Order)

### STEP 1: MULTI-TIMEFRAME CONTEXT
Even though this is a 1-minute chart, consider:
- Overall market structure (trending or ranging)
- Position relative to recent swing highs/lows
- Volume analysis if visible
- Session timing (London/NY overlap = high volatility, Asian = low volatility)

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

### STEP 3: MARKET TRAP DETECTION (CRITICAL FOR SURESHOT)
⚠️ AVOID THESE TRAP PATTERNS - They cause losing trades:

BULL TRAP SIGNS (Fake Breakout Up):
- Price breaks above resistance then immediately reverses with strong red candle
- Long upper wicks at resistance level (rejection)
- Breakout candle has small body but large upper wick
- Volume spike on breakout but no follow-through candles
- Price quickly returns below the breakout level
- Multiple tests of resistance with weakening momentum

BEAR TRAP SIGNS (Fake Breakout Down):
- Price breaks below support then immediately reverses with strong green candle
- Long lower wicks at support level (rejection)
- Breakdown candle has small body but large lower wick
- Volume spike on breakdown but no follow-through candles
- Price quickly returns above the breakdown level
- Multiple tests of support with weakening momentum

LIQUIDITY GRAB / STOP HUNT:
- Sharp spike through key level followed by immediate reversal
- Occurs after extended consolidation (smart money hunting stops)
- Usually happens at obvious support/resistance or round numbers
- Look for rejection candles (pin bars, hammers) after the grab
- Often seen before major moves in opposite direction

FAKEOUT CONFIRMATION:
- Wait for 2-3 candles after suspected breakout
- True breakout: Strong momentum candles follow
- Fake breakout: Quick reversal within 1-2 candles

IF ANY TRAP DETECTED → Give NEUTRAL signal, explain the trap pattern

### STEP 4: FIND KEY SUPPORT/RESISTANCE ZONES
- SUPPORT: Price level where price bounced UP at least 2-3 times
- RESISTANCE: Price level where price rejected DOWN at least 2-3 times
- Look for CONFLUENCE: Multiple touches, round numbers, previous swing points
- STRENGTH RATING: More touches = stronger zone
- Note the CURRENT price position relative to these zones

### STEP 5: TECHNICAL INDICATORS ANALYSIS
Analyze these if visible on chart:

RSI (Relative Strength Index):
- Overbought (>70) = bearish bias, watch for reversal
- Oversold (<30) = bullish bias, watch for bounce
- Divergence: Price making new high but RSI lower = bearish divergence
- Divergence: Price making new low but RSI higher = bullish divergence

MACD (Moving Average Convergence Divergence):
- Histogram increasing (green) = bullish momentum building
- Histogram decreasing (red) = bearish momentum building
- Signal line crossover = potential entry signal
- Zero line cross = trend change confirmation

Moving Averages:
- Price above MA = bullish bias
- Price below MA = bearish bias
- MA crossover (fast crosses slow) = trend change signal
- Price bouncing off MA = dynamic support/resistance

Bollinger Bands:
- Touch upper band in uptrend = continuation
- Touch upper band in range = overbought, reversal possible
- Touch lower band in downtrend = continuation
- Touch lower band in range = oversold, reversal possible
- Band squeeze = volatility expansion coming

Stochastic:
- Cross above 20 from oversold = CALL signal
- Cross below 80 from overbought = PUT signal
- Divergence with price = reversal signal

### STEP 6: ANALYZE CANDLESTICK PATTERNS (Last 3-5 Candles)
Look for HIGH-PROBABILITY patterns:
- Pin Bars / Hammer / Shooting Star (long wick rejection) - 70%+ accuracy at key levels
- Engulfing patterns (bullish/bearish) - Strong reversal signal
- Doji at key levels (indecision, potential reversal)
- Three white soldiers / Three black crows (momentum continuation)
- Inside bars followed by breakout (consolidation breakout)
- Morning Star / Evening Star (three-candle reversal)
- Tweezer Tops / Bottoms (double rejection)

### STEP 7: SURESHOT ENTRY CRITERIA (ALL Must Pass)

FOR CALL SIGNAL (Sureshot Conditions):
✓ Overall trend is UP or price at STRONG SUPPORT
✓ NO BULL TRAP or STOP HUNT detected - clean price action
✓ Last candle shows strong bullish sign: full body green, long lower wick rejection, or bullish engulfing
✓ Price is NOT hitting immediate resistance (minimum 10 pips room)
✓ No bearish divergence on indicators
✓ At least 4 confirmation factors align (trend, pattern, level, indicator)
✓ Risk-reward favorable (support close, resistance far)
✓ Not in choppy/ranging market

FOR PUT SIGNAL (Sureshot Conditions):
✓ Overall trend is DOWN or price at STRONG RESISTANCE  
✓ NO BEAR TRAP or STOP HUNT detected - clean price action
✓ Last candle shows strong bearish sign: full body red, long upper wick rejection, or bearish engulfing
✓ Price is NOT hitting immediate support (minimum 10 pips room)
✓ No bullish divergence on indicators
✓ At least 4 confirmation factors align (trend, pattern, level, indicator)
✓ Risk-reward favorable (resistance close, support far)
✓ Not in choppy/ranging market

### STEP 8: CONFIDENCE SCORING
Rate your confidence (1-10) based on:
- Trend alignment: +2 points
- Pattern clarity: +2 points
- Key level confluence: +2 points
- No trap patterns: +2 points
- Indicator confirmation: +2 points

Only give CALL/PUT if confidence is 7+. Otherwise, give NEUTRAL.

## SIGNAL RULES

GIVE CALL WHEN (confidence 7+, NO traps):
1. Strong uptrend (HH+HL) + bullish candle + no resistance ahead + indicator confirmation, OR
2. Price bouncing from STRONG support with clear rejection + no bull trap + oversold indicators, OR
3. Clean bullish reversal pattern + multiple confirmations

GIVE PUT WHEN (confidence 7+, NO traps):
1. Strong downtrend (LH+LL) + bearish candle + no support ahead + indicator confirmation, OR
2. Price rejecting from STRONG resistance with clear rejection + no bear trap + overbought indicators, OR
3. Clean bearish reversal pattern + multiple confirmations

GIVE NEUTRAL WHEN:
- Confidence below 7
- ANY trap pattern detected (bull trap, bear trap, stop hunt, liquidity grab)
- Price is in middle of tight range with no edge
- Conflicting signals between indicators and price action
- Chart is unclear or has less than 20 candles
- High-impact news period likely

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "supportZone": "price level or range",
  "resistanceZone": "price level or range", 
  "explanation": "Trend: [describe with candle count]. Trap Check: [PASSED/DETECTED - specify type]. Pattern: [candlestick pattern]. Key Level: [S/R interaction]. Indicators: [RSI/MACD/MA status if visible]. Sureshot Score: [X/5 factors]. Confidence: [X/10]. Signal: [detailed reason with entry logic]."
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
    console.log("Processing analysis request, remaining before:", remaining, "isVip:", isVip);

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nAI is not configured.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Lovable AI (no external provider quota keys)
    const model = "google/gemini-2.5-flash";
    const systemPrompt = freeSystemPrompt; // Same advanced prompt for everyone
    const analysisInstruction =
      "Analyze this trading chart using the advanced 6-step method: 1) Consider multi-timeframe context, 2) Count candles and identify trend structure with momentum analysis, 3) Mark confluence support/resistance zones, 4) Identify high-probability candlestick patterns, 5) Run your entry confirmation checklist, 6) Score your confidence (only signal if 7+). Your analysis must be HIGHLY ACCURATE and REPRODUCIBLE. Focus on what the chart SHOWS. Respond with JSON only.";

    console.log(`Using Lovable AI model: ${model} for ${isVip ? "VIP" : "FREE"} user`);

    // Add timeout for AI request (55 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      // Lovable AI uses an OpenAI-compatible chat completions API
      response = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: analysisInstruction },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
        }),
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("AI request error:", err);
      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nAI is temporarily unavailable.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("AI response error:", response.status, errText);

      // Explicit handling for rate limiting
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error:
              "⚠️ Analysis busy\n\nToo many requests right now. Please wait ~60 seconds and try again.",
            apiUnavailable: true,
            retryAfterSeconds: 60,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nAI is temporarily unavailable.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ai = await response.json().catch(() => ({} as any));
    const content = ai?.choices?.[0]?.message?.content ?? ai?.output_text ?? ai?.text;

    if (!content) {
      console.error("ERR_EMPTY_RESPONSE: AI returned no content", ai);
      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nAI returned an empty response.\n\nNo signal generated to avoid random trades.",
          apiUnavailable: true,
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
