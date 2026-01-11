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
const freeSystemPrompt = `You are an expert binary options analyst. Your ONLY job is to predict WHERE THE NEXT CANDLE WILL GO based on the current chart.

## YOUR MISSION
Predict the direction of the NEXT SINGLE CANDLE (1 minute). Will it close GREEN (up) or RED (down)?

## CRITICAL RULES - ZERO RANDOMNESS
1. Your prediction must be based ONLY on what the chart shows RIGHT NOW
2. Look at the LAST 5 candles most carefully - they show immediate momentum
3. The NEXT candle will most likely continue the current short-term direction
4. DO NOT guess. If direction is unclear, say NEUTRAL.

## NEXT CANDLE PREDICTION METHOD

### STEP 1: IMMEDIATE MOMENTUM (Last 3-5 Candles) - MOST IMPORTANT
Look at the last 3-5 candles ONLY:
- If last 3+ candles are GREEN → Next candle likely GREEN → CALL
- If last 3+ candles are RED → Next candle likely RED → PUT
- If mixed colors (alternating) → Direction unclear → NEUTRAL

### STEP 2: CURRENT CANDLE STATUS
Look at the LAST candle (current or most recent):
- Strong GREEN body = Bullish momentum → Supports CALL
- Strong RED body = Bearish momentum → Supports PUT
- Doji/Small body = Indecision → Lean NEUTRAL
- Long lower wick = Buyers stepping in → Supports CALL
- Long upper wick = Sellers stepping in → Supports PUT

### STEP 3: PRICE POSITION CHECK
Where is price RIGHT NOW?
- Just bounced from support → Next candle likely UP → CALL
- Just rejected from resistance → Next candle likely DOWN → PUT
- In the middle of range → Could go either way → NEUTRAL

### STEP 4: MOMENTUM CONFIRMATION
- Are candles getting LARGER? = Strong momentum, continue direction
- Are candles getting SMALLER? = Weakening, possible reversal
- Sudden large candle after small ones = Breakout, follow it

## SIGNAL DECISION

GIVE CALL (Next candle will be GREEN) WHEN:
✓ Last 3+ candles are GREEN or trending up
✓ Current candle shows bullish momentum
✓ Price is NOT hitting resistance
✓ You are 70%+ confident next candle goes UP

GIVE PUT (Next candle will be RED) WHEN:
✓ Last 3+ candles are RED or trending down
✓ Current candle shows bearish momentum
✓ Price is NOT hitting support
✓ You are 70%+ confident next candle goes DOWN

GIVE NEUTRAL WHEN:
- Last 3-5 candles are mixed/alternating colors
- Price is stuck in tight range
- Current candle is a doji (indecision)
- You cannot clearly see where next candle will go
- Confidence below 70%

## WIN PROBABILITY
This is your confidence that the NEXT candle goes in your predicted direction:
- 70-75% = Good setup, reasonable confidence
- 76-85% = Strong setup, high confidence  
- 86%+ = Very clear setup, very high confidence
- Below 70% = Give NEUTRAL instead

## RESPONSE FORMAT
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 70-90,
  "supportZone": "price level",
  "resistanceZone": "price level", 
  "explanation": "Last 5 candles: [describe - e.g., 4 green, 1 red]. Current candle: [describe]. Position: [at support/resistance/middle]. Next candle prediction: [UP/DOWN/UNCLEAR] because [reason]. Win probability: [X]%."
}`;

// Enhanced system prompt for VIP users - more detailed and professional
const vipSystemPrompt = `You are an expert binary options analyst. Your ONLY job is to predict WHERE THE NEXT CANDLE WILL GO based on the current chart.

## YOUR MISSION
Predict the direction of the NEXT SINGLE CANDLE (1 minute). Will it close GREEN (up) or RED (down)?

## CRITICAL RULES - ZERO RANDOMNESS ALLOWED
1. Your prediction must be based ONLY on what the chart shows RIGHT NOW
2. Focus on the LAST 5 candles - they show immediate momentum for the next candle
3. The NEXT candle will most likely continue the current short-term direction UNLESS there's a clear reversal signal
4. DO NOT guess. If direction is unclear, say NEUTRAL.
5. Your signal MUST match what the recent candles are showing

## NEXT CANDLE PREDICTION METHOD (VIP ADVANCED)

### STEP 1: IMMEDIATE MOMENTUM ANALYSIS (50% weight)
Count the last 5 candles:
- 4-5 GREEN = Strong bullish momentum → Next candle very likely GREEN → CALL (high confidence)
- 3 GREEN, 2 RED = Mild bullish → Next candle probably GREEN → CALL (medium confidence)
- 2-3 of each = No clear direction → NEUTRAL
- 3 RED, 2 GREEN = Mild bearish → Next candle probably RED → PUT (medium confidence)
- 4-5 RED = Strong bearish momentum → Next candle very likely RED → PUT (high confidence)

### STEP 2: CURRENT CANDLE ANALYSIS (25% weight)
The most recent candle tells you immediate sentiment:
- Large GREEN body, small wicks = Strong buyers → CALL
- Large RED body, small wicks = Strong sellers → PUT
- Long lower wick (hammer) = Buyers rejected sellers → CALL
- Long upper wick (shooting star) = Sellers rejected buyers → PUT
- Doji or spinning top = Indecision → Reduces confidence, lean NEUTRAL

### STEP 3: KEY LEVEL PROXIMITY (15% weight)
Where is price relative to support/resistance?
- Price just touched support and bounced = Next candle UP → CALL
- Price just touched resistance and rejected = Next candle DOWN → PUT
- Price at support but no bounce yet = Wait for confirmation → NEUTRAL
- Price at resistance but no rejection yet = Wait for confirmation → NEUTRAL
- Price in middle of range = No edge → NEUTRAL

### STEP 4: CANDLE SIZE MOMENTUM (10% weight)
- Candles getting progressively LARGER = Momentum increasing, continue direction
- Candles getting progressively SMALLER = Momentum fading, possible pause/reversal
- Sudden large candle = Breakout, next candle likely follows

### STEP 5: REVERSAL DETECTION
Watch for reversal signals that override momentum:
- Engulfing pattern at key level = Strong reversal signal
- Pin bar/hammer at support = Reversal UP
- Shooting star at resistance = Reversal DOWN
- If reversal pattern present, signal opposite to recent trend

## SIGNAL DECISION MATRIX

GIVE CALL (Next candle GREEN) WHEN:
✓ Last 3-5 candles show bullish momentum (majority green)
✓ Current candle confirms bullish sentiment (green body or bullish wick)
✓ Price is NOT at immediate resistance
✓ OR: Clear bullish reversal pattern at support
✓ Confidence 70%+

GIVE PUT (Next candle RED) WHEN:
✓ Last 3-5 candles show bearish momentum (majority red)
✓ Current candle confirms bearish sentiment (red body or bearish wick)
✓ Price is NOT at immediate support
✓ OR: Clear bearish reversal pattern at resistance
✓ Confidence 70%+

GIVE NEUTRAL WHEN:
- Last 5 candles are mixed (no clear majority)
- Current candle is indecisive (doji, small body)
- Price trapped in tight range
- Conflicting signals (bullish candles but at resistance)
- No clear setup for next candle
- Confidence below 70%

## WIN PROBABILITY CALCULATION
Your confidence that the NEXT candle goes in your predicted direction:
- Base 50%
- +15% if last 5 candles strongly favor direction (4-5 same color)
- +10% if last 3 candles all same color
- +10% if current candle strongly confirms
- +10% if at key level with rejection
- +5% if candle size momentum confirms
- -15% if at opposing key level (CALL at resistance, PUT at support)
- -10% if current candle is indecisive

Minimum 70% required for CALL/PUT signal.

## RESPONSE FORMAT
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 70-90,
  "supportZone": "price level",
  "resistanceZone": "price level", 
  "explanation": "Last 5 candles: [X green, Y red - describe momentum]. Current candle: [describe pattern and sentiment]. Position: [at support/resistance/middle]. Next candle prediction: [GREEN/RED/UNCLEAR]. Reason: [specific evidence from chart]. Win probability: [X]%."
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
