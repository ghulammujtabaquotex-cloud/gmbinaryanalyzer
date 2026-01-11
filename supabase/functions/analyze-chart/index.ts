import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 20;


// CORS configuration
// Keep permissive to avoid "failed to send request" issues from preview/custom domains.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Same high-quality analysis for all users - VIP benefits are more daily analyses, history, stats
const freeSystemPrompt = `You are an ELITE binary options price action analyst with 15+ years experience. Your analysis must be OBJECTIVE, UNBIASED, and based ONLY on what the chart actually shows.

## CRITICAL ANTI-BIAS RULES (MUST FOLLOW)
1. YOU MUST NOT DEFAULT TO ANY DIRECTION. Do not favor PUT or CALL without clear chart evidence.
2. BEFORE deciding signal, you MUST count: How many of the last 20 candles are GREEN vs RED?
3. If GREEN candles > RED candles AND price making Higher Highs = UPTREND → Bias CALL
4. If RED candles > GREEN candles AND price making Lower Lows = DOWNTREND → Bias PUT
5. If roughly equal OR no clear structure = RANGE → Give NEUTRAL
6. NEVER guess. If the chart doesn't clearly show direction, say NEUTRAL.
7. Your signal MUST match what the MAJORITY of recent candles show.

## MANDATORY CANDLE COUNT (Do This First!)
Before ANY analysis, physically count the last 15-20 visible candles:
- Count GREEN (bullish) candles: ___
- Count RED (bearish) candles: ___
- Result: If GREEN > RED by 3+ candles → Bullish bias. If RED > GREEN by 3+ candles → Bearish bias. Otherwise → Neutral.

## OBJECTIVE ANALYSIS METHOD

### STEP 1: CANDLE COLOR MAJORITY (Most Important)
Count the last 15-20 candles:
- 60%+ GREEN (e.g., 12 green, 8 red) = Bullish market → Only consider CALL
- 60%+ RED (e.g., 12 red, 8 green) = Bearish market → Only consider PUT
- Close to 50/50 = No clear direction → NEUTRAL

### STEP 2: PRICE STRUCTURE
- Higher Highs + Higher Lows = UPTREND → Supports CALL
- Lower Highs + Lower Lows = DOWNTREND → Supports PUT
- No clear pattern = RANGE → NEUTRAL

### STEP 3: CURRENT CANDLE POSITION
- At strong support with bullish rejection = CALL opportunity
- At strong resistance with bearish rejection = PUT opportunity
- In the middle of range = NO TRADE (NEUTRAL)

### STEP 4: CONFIRMATION REQUIREMENTS
For CALL signal (ALL must be true):
✓ More GREEN candles than RED in last 15-20 candles
✓ Price structure shows upward bias OR at strong support
✓ Last 1-2 candles show bullish sign (green body, lower wick rejection)
✓ No immediate resistance blocking upward move

For PUT signal (ALL must be true):
✓ More RED candles than GREEN in last 15-20 candles
✓ Price structure shows downward bias OR at strong resistance
✓ Last 1-2 candles show bearish sign (red body, upper wick rejection)
✓ No immediate support blocking downward move

### STEP 5: WHEN TO SAY NEUTRAL
Give NEUTRAL if ANY of these are true:
- Candle count is close to 50/50 (within 2 candles difference)
- Price is stuck in tight range with no breakout
- Mixed signals (green candles but at resistance)
- Chart has less than 15 clear candles
- Last candle is a doji (indecision)
- You're not at least 70% confident

## WIN PROBABILITY CALCULATION
- Base: 50% (neutral starting point)
- +15% if candle color majority clearly favors direction (60%+)
- +10% if price structure confirms (HH/HL or LH/LL)
- +10% if at key support/resistance with rejection
- +5% if last candle strongly confirms direction
- Minimum 70% required for CALL/PUT signal

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 70-90,
  "supportZone": "price level",
  "resistanceZone": "price level", 
  "explanation": "Candle Count: [X green, Y red in last 20]. Structure: [HH/HL or LH/LL or Range]. Current Position: [at support/resistance/middle]. Pattern: [last candle pattern]. Win probability: [X]%. Signal Reason: [why this direction based on evidence]."
}`;

// Enhanced system prompt for VIP users - more detailed and professional
const vipSystemPrompt = `You are an ELITE binary options price action analyst with 15+ years experience. Your analysis must be OBJECTIVE, UNBIASED, and based ONLY on what the chart actually shows.

## CRITICAL ANTI-BIAS RULES (MUST FOLLOW - ZERO TOLERANCE)
1. YOU MUST NOT DEFAULT TO ANY DIRECTION. Do not favor PUT or CALL without clear chart evidence.
2. BEFORE deciding signal, you MUST physically count candles: How many of the last 20 candles are GREEN vs RED?
3. Your signal MUST align with the MAJORITY candle color direction.
4. If market is clearly going UP (more green, higher highs) → CALL only
5. If market is clearly going DOWN (more red, lower lows) → PUT only
6. If UNCLEAR → NEUTRAL (this is the safe choice)
7. NEVER guess or assume. Base everything on visible chart data.
8. If you're not 75%+ confident, give NEUTRAL.

## MANDATORY CANDLE COUNT (Do This First - Required!)
Before ANY analysis, physically count the last 15-20 visible candles:
- Count GREEN (bullish) candles: ___
- Count RED (bearish) candles: ___
- Calculate percentage: GREEN% = green/(green+red) × 100

DECISION MATRIX:
- GREEN 65%+ (13+ green out of 20) = Strong Bullish → CALL with high confidence
- GREEN 55-64% (11-12 green out of 20) = Mild Bullish → CALL if other factors confirm
- GREEN 45-54% (9-10 green out of 20) = NEUTRAL zone → Give NEUTRAL
- RED 55-64% (11-12 red out of 20) = Mild Bearish → PUT if other factors confirm
- RED 65%+ (13+ red out of 20) = Strong Bearish → PUT with high confidence

## VIP ADVANCED ANALYSIS METHOD

### STEP 1: CANDLE COLOR ANALYSIS (Primary Factor - 40% weight)
Count last 20 candles carefully:
- Note exact count: "I see X green and Y red candles"
- Calculate dominance: Which color has clear majority?
- Assess strength: Are winning candles larger bodied?

### STEP 2: PRICE STRUCTURE ANALYSIS (30% weight)
Identify the pattern:
- Higher Highs + Higher Lows = Confirmed UPTREND
- Lower Highs + Lower Lows = Confirmed DOWNTREND  
- Mixed or sideways = RANGE (no trade)
- IMPORTANT: Structure must MATCH candle color majority

### STEP 3: KEY LEVEL ANALYSIS (20% weight)
- Identify nearest support (where price bounced up 2+ times)
- Identify nearest resistance (where price rejected down 2+ times)
- Current position: Is price at, near, or far from these levels?
- CALL favored at support, PUT favored at resistance

### STEP 4: LAST CANDLE CONFIRMATION (10% weight)
Analyze the most recent 1-2 candles:
- Strong green body with small wicks = Bullish confirmation
- Strong red body with small wicks = Bearish confirmation
- Long wick rejection at level = Potential reversal
- Doji or small body = Indecision (reduces confidence)

### STEP 5: INDICATOR CROSS-CHECK (If Visible)
- RSI > 70 at resistance = Supports PUT
- RSI < 30 at support = Supports CALL
- MACD bullish crossover = Supports CALL
- MACD bearish crossover = Supports PUT
- Indicators should CONFIRM, not contradict candle majority

### STEP 6: TRAP DETECTION
Watch for fakeouts:
- Price spikes through level then immediately reverses = TRAP
- Long wick through support/resistance = Rejection/Trap
- If trap detected, give NEUTRAL regardless of other factors

## SIGNAL DECISION CRITERIA

GIVE CALL WHEN (ALL must be true):
✓ GREEN candles are majority (55%+ of last 20)
✓ Price structure shows upward bias (HH/HL) OR at strong support
✓ Last candle is bullish or shows lower wick rejection
✓ Not at immediate resistance
✓ Confidence 75%+

GIVE PUT WHEN (ALL must be true):
✓ RED candles are majority (55%+ of last 20)
✓ Price structure shows downward bias (LH/LL) OR at strong resistance
✓ Last candle is bearish or shows upper wick rejection
✓ Not at immediate support
✓ Confidence 75%+

GIVE NEUTRAL WHEN (ANY is true):
- Candle split is 45-54% (too close to call)
- Structure doesn't match candle majority
- Price in middle of range
- Trap pattern detected
- Conflicting indicator signals
- Confidence below 75%
- Chart unclear or less than 15 candles

## WIN PROBABILITY CALCULATION
Start at 50%, then adjust:
- +20% if candle majority is 65%+ in signal direction
- +15% if price structure confirms (HH/HL or LH/LL)
- +10% if at key level with rejection pattern
- +5% if last candle strongly confirms
- -15% if any trap pattern visible
- -10% if indicators conflict

Only give CALL/PUT if final probability is 70%+

## RESPONSE FORMAT
Respond with valid JSON only:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 70-90,
  "supportZone": "price level",
  "resistanceZone": "price level", 
  "explanation": "Candle Count: [X green, Y red = Z% green in last 20]. Structure: [HH/HL confirmed OR LH/LL confirmed OR Range]. Position: [at support/resistance/middle]. Last Candle: [pattern]. Indicators: [if visible]. Win probability: [X]%. Signal: [detailed reason matching candle majority]."
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

  // Allow up to 4MB base64 ≈ 3MB actual file size (frontend compresses to ~1MB)
  const maxBase64Size = 4 * 1024 * 1024;
  if (imageBase64.length > maxBase64Size) {
    return { valid: false, error: "Image is too large. Please use an image under 3MB." };
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }


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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          isVip,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64 } = await req.json();

    // Validate input
    const validation = validateImageInput(imageBase64);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error, validationError: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    console.log("Processing analysis request, remaining before:", remaining, "isVip:", isVip);

    const systemPrompt = isVip ? vipSystemPrompt : freeSystemPrompt;
    const analysisInstruction =
      "Analyze this trading chart using the advanced 6-step method: 1) Consider multi-timeframe context, 2) Count candles and identify trend structure with momentum analysis, 3) Mark confluence support/resistance zones, 4) Identify high-probability candlestick patterns, 5) Run your entry confirmation checklist, 6) Score your confidence (only signal if 8+/10). Your analysis must be HIGHLY ACCURATE (90%+ target) and REPRODUCIBLE. Focus on what the chart SHOWS. Only give CALL/PUT when probability is 75%+. Respond with JSON only.";

    // Use Lovable AI (powered by Gemini 2.5 Flash)
    console.log(`Using Lovable AI for ${isVip ? "VIP" : "FREE"} user`);

    if (!LOVABLE_API_KEY) {
      console.error("ERR_CONFIG: LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({
          error: "⚠️ Analysis unavailable\n\nPlease try again later.",
          apiUnavailable: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add timeout for AI request (55 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let contentText: string | undefined;

    try {
      console.log("Calling Lovable AI...");
      
      const lovableResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
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
        }
      );

      clearTimeout(timeoutId);

      if (!lovableResponse.ok) {
        const errText = await lovableResponse.text().catch(() => "");
        console.error("Lovable AI error:", lovableResponse.status, errText);
        return new Response(
          JSON.stringify({
            error: "⚠️ Analysis busy\n\nPlease try again in a moment.",
            apiUnavailable: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await lovableResponse.json().catch(() => ({} as any));
      contentText = aiData?.choices?.[0]?.message?.content;
      console.log("Lovable AI response received successfully");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Lovable AI request error:", err);
      return new Response(
        JSON.stringify({
          error: "⚠️ Analysis unavailable\n\nPlease try again in a moment.",
          apiUnavailable: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analysis completed using: Lovable AI");

    if (!contentText) {
      console.error("ERR_EMPTY_RESPONSE: AI returned no content");
      return new Response(
        JSON.stringify({
          error:
            "⚠️ Analysis unavailable\n\nAI returned an empty response.\n\nPlease upload a clear trading chart screenshot and try again.",
          apiUnavailable: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = contentText;

    // Parse the JSON response from AI (robust extraction)
    let analysis;
    try {
      const stripped = content.replace(/```json\n?|\n?```/g, "").trim();

      // First attempt: parse as-is
      try {
        analysis = JSON.parse(stripped);
      } catch {
        // Second attempt: extract the largest JSON object from the text
        const firstBrace = stripped.indexOf("{");
        const lastBrace = stripped.lastIndexOf("}");
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) throw new Error("No JSON object found");

        const maybeJson = stripped.slice(firstBrace, lastBrace + 1);
        analysis = JSON.parse(maybeJson);
      }
    } catch (e) {
      const preview = content.slice(0, 300);
      console.error("ERR_PARSE: Failed to parse external AI response", {
        message: e instanceof Error ? e.message : String(e),
        preview,
      });

      // Friendly hint for common failure: user uploaded a non-chart image or unclear screenshot
      const looksLikeRefusal = /cannot analyze|can't analyze|food|not.*chart/i.test(preview);
      const helpText = looksLikeRefusal
        ? "Please upload a clear trading chart screenshot (candles + pair name) and try again."
        : "Please try again with a clearer chart screenshot.";

      return new Response(
        JSON.stringify({
          error: `⚠️ Analysis unavailable\n\nAI returned an invalid format (not JSON).\n\n${helpText}`,
          apiUnavailable: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      // Send Telegram notification for CALL/PUT signals
      try {
        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
        
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const now = new Date();
          const pakistanTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).format(now);

          const directionEmoji = analysis.signal === 'CALL' ? '🟢' : '🔴';
          const userTypeLabel = isVip ? 'VIP' : 'FREE';
          
          let message = `📊 <b>GM BINARY PRO - CHART ANALYSIS</b>\n`;
          message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
          message += `${directionEmoji} <b>SIGNAL: ${analysis.signal}</b>\n\n`;
          message += `💱 Pair: <b>${analysis.pair || 'Unknown'}</b>\n`;
          message += `📈 Trend: <b>${analysis.trend || 'Range'}</b>\n`;
          message += `📉 Support: ${analysis.supportZone || 'N/A'}\n`;
          message += `📈 Resistance: ${analysis.resistanceZone || 'N/A'}\n`;
          if (winProbability) {
            message += `🎯 Win Probability: <b>${winProbability}%</b>\n`;
          }
          message += `\n👤 User Type: ${userTypeLabel}\n`;
          message += `🕐 Time (PKT): ${pakistanTime}\n\n`;
          message += `─────────────────────\n`;
          message += `💡 <i>Trade wisely. Signals are for educational purposes.</i>\n`;
          message += `\n🌐 GM Binary Pro`;

          const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
          
          // Fire and forget - don't wait for Telegram response
          fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text: message,
              parse_mode: "HTML",
            }),
          }).then(res => {
            if (res.ok) {
              console.log("Telegram notification sent successfully");
            } else {
              console.error("Telegram notification failed:", res.status);
            }
          }).catch(err => {
            console.error("Telegram notification error:", err);
          });
        }
      } catch (telegramErr) {
        console.error("Failed to send Telegram notification:", telegramErr);
      }

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
      console.log("NEUTRAL signal - usage NOT incremented, no Telegram notification, remaining:", finalRemaining);
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
        error: "⚠️ Analysis unavailable\n\nAI is temporarily unavailable.\n\nNo signal generated to avoid random trades.",
        apiUnavailable: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
