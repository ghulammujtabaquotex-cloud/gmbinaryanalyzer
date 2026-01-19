import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 20;

// Special IP overrides - custom limits for specific users
const IP_LIMIT_OVERRIDES: Record<string, number> = {
  "202.47.55.98": 100,
};


// CORS configuration
// Keep permissive to avoid "failed to send request" issues from preview/custom domains.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// Comprehensive technical analysis prompt - ZERO randomness, 100% chart-based
const analysisSystemPrompt = `You are an expert technical analyst for binary options trading. Your job is to perform DEEP, COMPREHENSIVE chart analysis and predict the NEXT CANDLE direction with HIGH ACCURACY.

## CRITICAL RULES - ZERO RANDOMNESS
1. Your prediction MUST be 100% based on what the chart shows - ZERO guessing
2. Analyze EVERY visible candle deeply - patterns, trends, momentum
3. If analysis shows 50/50 probability → Give NEUTRAL (NO TRADE)
4. Only give CALL/PUT when you have clear directional bias (60%+ probability)
5. Never make random signals - if unsure, always say NEUTRAL

## COMPREHENSIVE ANALYSIS METHOD

### STEP 1: FULL CANDLE ANALYSIS
Analyze ALL visible candles on the chart:
- Count total green vs red candles
- Identify the overall trend direction
- Look for trend reversals and continuation patterns
- Analyze momentum - are candles getting larger or smaller?
- Check for key support and resistance levels

### STEP 2: CANDLESTICK PATTERN DETECTION
Identify ALL relevant candlestick patterns:

BULLISH PATTERNS (favor CALL):
- Hammer: Small body at top, long lower wick (2-3x body), at support
- Bullish Engulfing: Large green candle completely engulfs previous red
- Morning Star: Red candle → small doji/spinning top → large green candle
- Three White Soldiers: Three consecutive large green candles
- Inverted Hammer: Small body at bottom, long upper wick, at support after downtrend
- Piercing Line: Red candle followed by green that closes above 50% of red body

BEARISH PATTERNS (favor PUT):
- Shooting Star: Small body at bottom, long upper wick (2-3x body), at resistance
- Bearish Engulfing: Large red candle completely engulfs previous green
- Evening Star: Green candle → small doji/spinning top → large red candle
- Three Black Crows: Three consecutive large red candles
- Hanging Man: Small body at top, long lower wick, at resistance after uptrend
- Dark Cloud Cover: Green candle followed by red that closes below 50% of green body

INDECISION PATTERNS (favor NEUTRAL):
- Doji: Open and close nearly equal, shows indecision
- Spinning Top: Small body with upper and lower wicks, uncertainty
- Inside Bar: Current candle contained within previous candle's range

### STEP 3: TECHNICAL INDICATOR CALCULATION (Estimate from Visual)

EMA (Exponential Moving Average):
- EMA(5) - Fast EMA: Estimate the 5-period average price path
- EMA(20) - Slow EMA: Estimate the 20-period average price path
- If EMA(5) > EMA(20) = Bullish (CALL bias)
- If EMA(5) < EMA(20) = Bearish (PUT bias)
- If EMA crossover just happened = Strong signal

RSI(14) - Relative Strength Index:
- Estimate based on recent price action
- RSI > 70 = Overbought → Potential reversal DOWN (PUT)
- RSI < 30 = Oversold → Potential reversal UP (CALL)
- RSI 40-60 = Neutral zone

MACD (Moving Average Convergence Divergence):
- MACD Line above Signal Line = Bullish (CALL)
- MACD Line below Signal Line = Bearish (PUT)
- MACD Histogram increasing = Momentum strengthening
- MACD Histogram decreasing = Momentum weakening

Bollinger Bands:
- Price at Upper Band = Potential reversal DOWN or breakout UP
- Price at Lower Band = Potential reversal UP or breakout DOWN
- Price in middle = No clear edge
- Bands squeezing = Potential breakout coming
- Bands expanding = Strong momentum

### STEP 4: SUPPORT & RESISTANCE ANALYSIS
- Identify key horizontal support/resistance levels
- Look for price reaction at these levels (bounce or break)
- Multiple touches = Stronger level
- Recent break of level = Trend continuation

### STEP 5: MOMENTUM ANALYSIS
- Are candles getting progressively larger? = Strong momentum
- Are candles getting smaller? = Weakening momentum
- Sudden large candle = Potential breakout/breakdown
- Volume of candles (if visible) confirms momentum

### STEP 6: CONFLUENCE SCORING
Score each factor and combine:
- Trend direction: +20 for clear trend, 0 for range
- Candlestick pattern: +20 for clear pattern, 0 for none
- EMA alignment: +15 for aligned, 0 for crossed/uncertain
- RSI: +15 for extreme levels, 0 for neutral
- MACD: +15 for clear signal, 0 for uncertain
- Support/Resistance: +15 for clear reaction, 0 for middle of range

Total score determines signal:
- 60%+ bullish factors = CALL
- 60%+ bearish factors = PUT
- Less than 60% either way = NEUTRAL (NO TRADE)

## SIGNAL DECISION

GIVE CALL WHEN:
✓ Multiple bullish candlestick patterns present
✓ Price above EMA(5) and EMA(20)
✓ RSI below 70 (not overbought)
✓ MACD bullish
✓ Price bouncing from support OR breaking resistance
✓ Overall bullish probability 60%+

GIVE PUT WHEN:
✓ Multiple bearish candlestick patterns present
✓ Price below EMA(5) and EMA(20)
✓ RSI above 30 (not oversold)
✓ MACD bearish
✓ Price rejected from resistance OR breaking support
✓ Overall bearish probability 60%+

GIVE NEUTRAL (NO TRADE) WHEN:
✓ Analysis shows approximately 50/50 probability
✓ Conflicting signals (bullish patterns but at resistance)
✓ Doji or indecision patterns at key levels
✓ No clear candlestick patterns
✓ Price in middle of range with no momentum
✓ RSI in neutral zone (40-60) with no pattern
✓ Cannot determine clear direction

## WIN PROBABILITY CALCULATION
Based on confluence of all factors:
- 60-65% = Moderate confidence, proceed with caution
- 66-75% = Good confidence, reasonable trade
- 76-85% = High confidence, strong setup
- 86%+ = Very high confidence, excellent setup
- Below 60% = MUST give NEUTRAL

## RESPONSE FORMAT
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "winProbability": 60-90,
  "supportZone": "price level",
  "resistanceZone": "price level", 
  "explanation": "Candle Analysis: [describe all candles, count green vs red]. Patterns Detected: [list all patterns found]. Indicators: EMA [bullish/bearish], RSI [overbought/oversold/neutral], MACD [bullish/bearish]. Support/Resistance: [price reactions]. Conclusion: [CALL/PUT/NEUTRAL] because [specific technical reasons]. Win probability: [X]%."
}

REMEMBER: If you cannot clearly determine the next candle direction with 60%+ confidence, you MUST say NEUTRAL. Zero random signals allowed.`;

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
    
    // Check for IP-specific override first, then VIP status
    let dailyLimit: number;
    const hasIpOverride = clientIP in IP_LIMIT_OVERRIDES;
    
    if (hasIpOverride) {
      dailyLimit = IP_LIMIT_OVERRIDES[clientIP];
      console.log(`Special IP override for ${clientIP.slice(0, 10)}***: Limit = ${dailyLimit}`);
    } else {
      dailyLimit = isVip ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT;
      console.log(`User type: ${isVip ? 'VIP' : 'FREE'}, Daily limit: ${dailyLimit}`);
    }

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

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    console.log("Processing analysis request, remaining before:", remaining, "isVip:", isVip);

    const systemPrompt = analysisSystemPrompt;
    const analysisInstruction =
      "Analyze this trading chart using the advanced 6-step method: 1) Consider multi-timeframe context, 2) Count candles and identify trend structure with momentum analysis, 3) Mark confluence support/resistance zones, 4) Identify high-probability candlestick patterns, 5) Run your entry confirmation checklist, 6) Score your confidence (only signal if 8+/10). Your analysis must be HIGHLY ACCURATE (90%+ target) and REPRODUCIBLE. Focus on what the chart SHOWS. Only give CALL/PUT when probability is 75%+. Respond with JSON only.";

    // Use OpenRouter API
    console.log(`Using OpenRouter for ${isVip ? "VIP" : "FREE"} user`);

    if (!OPENROUTER_API_KEY) {
      console.error("ERR_CONFIG: OPENROUTER_API_KEY not configured");
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
      console.log("Calling OpenRouter API...");
      
      const openRouterResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://gmbinarypro.lovable.app",
            "X-Title": "GM Binary Pro",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
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

      if (!openRouterResponse.ok) {
        const errText = await openRouterResponse.text().catch(() => "");
        console.error("OpenRouter error:", openRouterResponse.status, errText);
        return new Response(
          JSON.stringify({
            error: "⚠️ Analysis busy\n\nPlease try again in a moment.",
            apiUnavailable: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await openRouterResponse.json().catch(() => ({} as any));
      contentText = aiData?.choices?.[0]?.message?.content;
      console.log("OpenRouter response received successfully");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("OpenRouter request error:", err);
      return new Response(
        JSON.stringify({
          error: "⚠️ Analysis unavailable\n\nPlease try again in a moment.",
          apiUnavailable: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Analysis completed using: OpenRouter");

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
