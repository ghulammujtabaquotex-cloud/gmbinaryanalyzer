import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_SYSTEM_PROMPT = `You are a professional binary options chart analyst. You analyze candlestick data and provide trading signals.

## CORE RULES
- Prediction MUST be 100% based on the data provided
- NEVER guess or make random signals
- If analysis shows 50/50 probability → NEUTRAL (NO TRADE)
- Only give CALL/PUT when clear directional bias exists (60%+ probability)

## SIGNAL THRESHOLDS
- Below 60% → MUST be NEUTRAL
- 60-65% → Moderate confidence
- 66-75% → Good confidence
- 76-85% → High confidence
- 86%+ → Very high confidence

## 6-STEP ANALYSIS METHOD

Step 1: Full Candle Analysis - Count green vs red candles, identify trend, reversals, momentum, S/R levels.

Step 2: Candlestick Pattern Detection
BULLISH: Hammer, Bullish Engulfing, Morning Star, Three White Soldiers, Inverted Hammer, Piercing Line
BEARISH: Shooting Star, Bearish Engulfing, Evening Star, Three Black Crows, Hanging Man, Dark Cloud Cover
INDECISION: Doji, Spinning Top, Inside Bar

Step 3: Technical Indicators
- EMA(5) vs EMA(20): EMA5 > EMA20 = bullish, EMA5 < EMA20 = bearish
- RSI(14): Below 30 = oversold (CALL), Above 70 = overbought (PUT), 40-60 = neutral
- MACD: Line above Signal = bullish, below = bearish
- Bollinger Bands: Price at Lower = bullish, Upper = bearish

Step 4: Support & Resistance - Key levels, bounces, breaks, multiple touches = stronger

Step 5: Momentum - Larger candles = strong, smaller = weakening

Step 6: Confluence Scoring (out of 100):
- Trend direction: 20 pts
- Candlestick pattern: 20 pts
- EMA alignment: 15 pts
- RSI levels: 15 pts
- MACD signal: 15 pts
- S/R reaction: 15 pts

60%+ bullish = CALL | 60%+ bearish = PUT | Otherwise = NEUTRAL

## RESPONSE FORMAT (strict JSON)
{
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "confidence": <number 0-100>,
  "trend": "BULLISH" | "BEARISH" | "SIDEWAYS",
  "patterns_detected": ["pattern1", "pattern2"],
  "support_zone": "<price>",
  "resistance_zone": "<price>",
  "ema_status": "bullish" | "bearish" | "crossed",
  "rsi_value": <number>,
  "rsi_status": "oversold" | "overbought" | "neutral",
  "macd_status": "bullish" | "bearish" | "weak",
  "explanation": "<brief 2-3 sentence explanation of the signal reasoning>"
}

Return ONLY the JSON object, no markdown, no extra text.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pair } = await req.json();
    if (!pair) {
      return new Response(JSON.stringify({ error: "Pair is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch market data from the quotex proxy API - NO extra headers
    const apiUrl = `https://ikszeynptbmwkaaldfad.supabase.co/functions/v1/quotex-proxy?symbol=${pair}&interval=1m&limit=100:qx_vzwz3wsu54chx8zmxpt0vp1yfk9gkxv0`;
    
    console.log("Fetching market data for:", pair);
    const marketRes = await fetch(apiUrl);
    
    if (!marketRes.ok) {
      const errText = await marketRes.text();
      console.error("Market API error:", marketRes.status, errText);
      return new Response(JSON.stringify({ error: "Failed to fetch market data", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketData = await marketRes.json();
    const candles = marketData.candles || marketData;
    console.log("Market data received, candles:", Array.isArray(candles) ? candles.length : "not array");

    // Send to Lovable AI for analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Analyze this ${pair} 1-minute candlestick data (${Array.isArray(candles) ? candles.length : '?'} candles) and provide a trading signal.

Market Data (JSON array of OHLCV candles):
${JSON.stringify(candles)}

Analyze using the 6-step method and return the JSON response.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiRes.text();
      console.error("AI API error:", aiRes.status, errText);
      return new Response(JSON.stringify({ error: "⚠️ Analysis unavailable - AI API not responding. No signal generated to avoid random trades." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse AI response - strip markdown fences if present
    let analysisResult;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysisResult = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis", raw: content }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, analysis: analysisResult, pair }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-chart error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
