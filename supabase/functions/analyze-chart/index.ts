import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are an expert binary options trading chart analyst. You analyze trading chart screenshots and provide price action analysis.

ANALYSIS FRAMEWORK:
1. Identify the trading pair from the chart (e.g., EUR/USD, GBP/USD, BTC/USD)
2. Determine the current trend: Uptrend, Downtrend, or Range
3. Identify key support and resistance zones visible in the chart
4. Analyze the last visible candles for price action patterns:
   - Pin bars (rejection wicks)
   - Engulfing candles
   - Break and retest patterns
   - Rejection from key levels

SIGNAL RULES (1-minute timeframe):
- PUT signal: Price is rejecting from resistance zone (long upper wicks, bearish engulfing, failed breakout)
- CALL signal: Price is rejecting from support zone (long lower wicks, bullish engulfing, failed breakdown)
- NEUTRAL signal: Market is choppy, no clear direction, or conflicting signals

RESPONSE FORMAT:
You must respond with valid JSON only, no markdown, no explanation text outside the JSON:
{
  "pair": "SYMBOL/QUOTE",
  "trend": "Uptrend" | "Downtrend" | "Range",
  "signal": "CALL" | "PUT" | "NEUTRAL",
  "supportZone": "price range",
  "resistanceZone": "price range",
  "explanation": "Detailed price action explanation (2-4 sentences)"
}

IMPORTANT:
- This is for 1-minute timeframe analysis only
- Provide next candle bias, not a guaranteed prediction
- Focus on the most recent visible candles
- Be specific about the price action patterns you observe
- If you cannot clearly identify the chart elements, default to NEUTRAL`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      throw new Error("No image provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing chart image...");

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
                text: "Analyze this trading chart screenshot. Identify the pair, trend, support/resistance zones, and provide a signal (CALL/PUT/NEUTRAL) based on price action. Respond with JSON only.",
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
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from AI");
    }

    console.log("AI response:", content);

    // Parse the JSON response from AI
    let analysis;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback response if parsing fails
      analysis = {
        pair: "Unknown",
        trend: "Range",
        signal: "NEUTRAL",
        supportZone: "Unable to determine",
        resistanceZone: "Unable to determine",
        explanation: "Could not fully analyze the chart. Please ensure the image shows a clear trading chart with visible candlesticks and try again.",
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-chart error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
