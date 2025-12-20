import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS - restrict to known domains
const getAllowedOrigin = (requestOrigin: string | null): string => {
  const allowedOrigins = [
    "https://rbqafiykevtbgztczizr.lovableproject.com",
    "https://gmbinarypro.lovable.app",
    "https://lovable.dev",
  ];
  
  // Allow localhost for development
  if (requestOrigin && (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1"))) {
    return requestOrigin;
  }
  
  // Allow any lovableproject.com or lovable.app subdomain
  if (requestOrigin && (requestOrigin.endsWith(".lovableproject.com") || requestOrigin.endsWith(".lovable.app"))) {
    return requestOrigin;
  }
  
  if (requestOrigin && allowedOrigins.some(origin => requestOrigin.startsWith(origin))) {
    return requestOrigin;
  }
  
  return allowedOrigins[0];
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

// Input validation
const validateImageInput = (imageBase64: string): { valid: boolean; error?: string } => {
  // Check if input exists
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return { valid: false, error: "No image provided" };
  }

  // Max size: 5MB in base64 (base64 increases size by ~33%)
  const maxBase64Size = 7 * 1024 * 1024;
  if (imageBase64.length > maxBase64Size) {
    return { valid: false, error: "Image is too large. Please use an image under 5MB." };
  }

  // Validate base64 data URI format
  const dataUriPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
  if (!dataUriPattern.test(imageBase64)) {
    return { valid: false, error: "Invalid image format. Please upload a PNG, JPEG, GIF, or WebP image." };
  }

  return { valid: true };
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

    console.log("Processing analysis request");

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

    console.log("Analysis completed");

    // Parse the JSON response from AI
    let analysis;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(cleanContent);
    } catch {
      console.error("ERR_PARSE");
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
  } catch {
    console.error("ERR_UNEXPECTED");
    return new Response(
      JSON.stringify({ error: "Analysis failed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
