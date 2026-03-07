import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 10;
const ADMIN_DAILY_LIMIT = 999999;

// ===== TECHNICAL ANALYSIS ENGINE =====

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

function parseCandles(raw: any): Candle[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any) => ({
    open: Number(c.open ?? c.o ?? c[1]),
    high: Number(c.high ?? c.h ?? c[2]),
    low: Number(c.low ?? c.l ?? c[3]),
    close: Number(c.close ?? c.c ?? c[4]),
    volume: Number(c.volume ?? c.v ?? c[5] ?? 0),
  })).filter(c => !isNaN(c.close) && c.close > 0);
}

function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

function calcBollingerBands(closes: number[], period = 20): { upper: number; middle: number; lower: number } {
  if (closes.length < period) {
    const last = closes[closes.length - 1];
    return { upper: last, middle: last, lower: last };
  }
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: mean + 2 * std, middle: mean, lower: mean - 2 * std };
}

function findSupportResistance(candles: Candle[]): { support: number; resistance: number } {
  const lows = candles.map(c => c.low);
  const highs = candles.map(c => c.high);
  const recentLows = lows.slice(-30);
  const recentHighs = highs.slice(-30);
  return {
    support: Math.min(...recentLows),
    resistance: Math.max(...recentHighs),
  };
}

function detectPatterns(candles: Candle[]): string[] {
  const patterns: string[] = [];
  if (candles.length < 3) return patterns;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  const bodyLast = Math.abs(last.close - last.open);
  const rangeLast = last.high - last.low;
  const bodyPrev = Math.abs(prev.close - prev.open);

  // Doji
  if (rangeLast > 0 && bodyLast / rangeLast < 0.1) patterns.push("Doji");

  // Hammer (bullish)
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  if (lowerWick > bodyLast * 2 && upperWick < bodyLast * 0.5 && bodyLast > 0) patterns.push("Hammer");

  // Shooting Star (bearish)
  if (upperWick > bodyLast * 2 && lowerWick < bodyLast * 0.5 && bodyLast > 0) patterns.push("Shooting Star");

  // Bullish Engulfing
  if (prev.close < prev.open && last.close > last.open && last.close > prev.open && last.open < prev.close) {
    patterns.push("Bullish Engulfing");
  }

  // Bearish Engulfing
  if (prev.close > prev.open && last.close < last.open && last.open > prev.close && last.close < prev.open) {
    patterns.push("Bearish Engulfing");
  }

  // Three White Soldiers
  if (prev2.close > prev2.open && prev.close > prev.open && last.close > last.open &&
      prev.close > prev2.close && last.close > prev.close) {
    patterns.push("Three White Soldiers");
  }

  // Three Black Crows
  if (prev2.close < prev2.open && prev.close < prev.open && last.close < last.open &&
      prev.close < prev2.close && last.close < prev.close) {
    patterns.push("Three Black Crows");
  }

  // Morning Star
  if (prev2.close < prev2.open && bodyPrev / (prev.high - prev.low + 0.0001) < 0.3 && last.close > last.open && last.close > (prev2.open + prev2.close) / 2) {
    patterns.push("Morning Star");
  }

  // Evening Star
  if (prev2.close > prev2.open && bodyPrev / (prev.high - prev.low + 0.0001) < 0.3 && last.close < last.open && last.close < (prev2.open + prev2.close) / 2) {
    patterns.push("Evening Star");
  }

  return patterns;
}

function analyzeChart(rawCandles: any): any {
  const candles = parseCandles(rawCandles);
  if (candles.length < 20) {
    return { signal: "NEUTRAL", confidence: 0, trend: "SIDEWAYS", patterns_detected: [], support_zone: "N/A", resistance_zone: "N/A", ema_status: "neutral", rsi_value: 50, rsi_status: "neutral", macd_status: "weak", explanation: "Insufficient data for analysis." };
  }

  const closes = candles.map(c => c.close);
  const lastPrice = closes[closes.length - 1];

  // Indicators
  const ema5 = calcEMA(closes, 5);
  const ema20 = calcEMA(closes, 20);
  const lastEma5 = ema5[ema5.length - 1];
  const lastEma20 = ema20[ema20.length - 1];
  const emaStatus = lastEma5 > lastEma20 ? "bullish" : lastEma5 < lastEma20 ? "bearish" : "crossed";

  const rsi = calcRSI(closes);
  const rsiStatus = rsi < 30 ? "oversold" : rsi > 70 ? "overbought" : "neutral";

  const macd = calcMACD(closes);
  const macdStatus = macd.histogram > 0 ? "bullish" : macd.histogram < 0 ? "bearish" : "weak";

  const bb = calcBollingerBands(closes);
  const sr = findSupportResistance(candles);
  const patterns = detectPatterns(candles);

  // Trend
  const greenCount = candles.slice(-20).filter(c => c.close > c.open).length;
  const trend = greenCount >= 13 ? "BULLISH" : greenCount <= 7 ? "BEARISH" : "SIDEWAYS";

  // Confluence scoring (100 points)
  let bullScore = 0, bearScore = 0;

  // Candlestick patterns (25 pts)
  const bullishPatterns = ["Hammer", "Bullish Engulfing", "Three White Soldiers", "Morning Star"];
  const bearishPatterns = ["Shooting Star", "Bearish Engulfing", "Three Black Crows", "Evening Star"];
  if (patterns.some(p => bullishPatterns.includes(p))) bullScore += 25;
  if (patterns.some(p => bearishPatterns.includes(p))) bearScore += 25;

  // S/R reaction (25 pts)
  const distToSupport = (lastPrice - sr.support) / lastPrice;
  const distToResistance = (sr.resistance - lastPrice) / lastPrice;
  if (distToSupport < 0.002) bullScore += 25; // near support = bullish bounce
  if (distToResistance < 0.002) bearScore += 25; // near resistance = bearish rejection

  // EMA (15 pts)
  if (emaStatus === "bullish") bullScore += 15;
  if (emaStatus === "bearish") bearScore += 15;

  // RSI (15 pts)
  if (rsi < 30) bullScore += 15;
  else if (rsi > 70) bearScore += 15;
  else if (rsi < 45) bullScore += 7;
  else if (rsi > 55) bearScore += 7;

  // MACD (10 pts)
  if (macdStatus === "bullish") bullScore += 10;
  if (macdStatus === "bearish") bearScore += 10;

  // Trend (10 pts)
  if (trend === "BULLISH") bullScore += 10;
  if (trend === "BEARISH") bearScore += 10;

  // Bollinger (bonus)
  if (lastPrice <= bb.lower) bullScore += 5;
  if (lastPrice >= bb.upper) bearScore += 5;

  const totalMax = 105; // 25+25+15+15+10+10+5
  const bullPct = Math.round((bullScore / totalMax) * 100);
  const bearPct = Math.round((bearScore / totalMax) * 100);

  let signal: "CALL" | "PUT" | "NEUTRAL";
  let confidence: number;

  if (bullPct >= 60 && bullPct > bearPct + 10) {
    signal = "CALL";
    confidence = Math.min(bullPct, 95);
  } else if (bearPct >= 60 && bearPct > bullPct + 10) {
    signal = "PUT";
    confidence = Math.min(bearPct, 95);
  } else {
    signal = "NEUTRAL";
    confidence = Math.max(bullPct, bearPct);
  }

  // Build explanation
  const reasons: string[] = [];
  if (emaStatus !== "crossed") reasons.push(`EMA crossover is ${emaStatus}`);
  if (rsiStatus !== "neutral") reasons.push(`RSI at ${Math.round(rsi)} (${rsiStatus})`);
  if (macdStatus !== "weak") reasons.push(`MACD histogram is ${macdStatus}`);
  if (patterns.length > 0) reasons.push(`Detected: ${patterns.join(", ")}`);
  reasons.push(`Trend: ${trend}`);

  const priceFormat = (n: number) => n.toFixed(lastPrice < 10 ? 5 : 2);

  return {
    signal,
    confidence,
    trend,
    patterns_detected: patterns,
    support_zone: priceFormat(sr.support),
    resistance_zone: priceFormat(sr.resistance),
    ema_status: emaStatus,
    rsi_value: Math.round(rsi),
    rsi_status: rsiStatus,
    macd_status: macdStatus,
    explanation: reasons.join(". ") + ".",
  };
}

// ===== HELPERS =====

const getClientIP = (req: Request): string => {
  const cfIP = req.headers.get("cf-connecting-ip");
  if (cfIP) {
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-f:]+$/i;
    if (ipPattern.test(cfIP)) return cfIP;
  }
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    return ip;
  }
  return "unknown";
};

const checkUserStatus = async (
  supabaseUrl: string, anonKey: string, serviceRoleKey: string, authHeader: string | null
): Promise<{ isVip: boolean; isAdmin: boolean; userId: string | null }> => {
  if (!authHeader) return { isVip: false, isAdmin: false, userId: null };
  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { isVip: false, isAdmin: false, userId: null };
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isVip } = await adminClient.rpc('is_vip', { _user_id: user.id });
    const { data: isAdmin } = await adminClient.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    return { isVip: !!isVip, isAdmin: !!isAdmin, userId: user.id };
  } catch {
    return { isVip: false, isAdmin: false, userId: null };
  }
};

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 5000): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000));
  }
  throw lastError || new Error("All fetch attempts failed");
}

// ===== MAIN =====

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pair } = await req.json();
    if (!pair) {
      return new Response(JSON.stringify({ error: "Pair is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const clientIP = getClientIP(req);
    const authHeader = req.headers.get("authorization");
    const { isVip, isAdmin } = await checkUserStatus(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, authHeader);

    const dailyLimit = isAdmin ? ADMIN_DAILY_LIMIT : isVip ? VIP_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const today = new Date().toISOString().split("T")[0];

    console.log(`Analyze: IP=${clientIP.slice(0,10)}***, isVip=${isVip}, isAdmin=${isAdmin}, limit=${dailyLimit}`);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: usageResult, error: usageError } = await adminClient.rpc('atomic_increment_ip_usage', {
      p_ip_address: clientIP,
      p_usage_date: today,
      p_daily_limit: dailyLimit,
    });

    if (usageError) {
      console.error("Usage check error:", usageError);
      return new Response(JSON.stringify({ error: "Usage check failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = usageResult?.[0]?.allowed;
    const remaining = usageResult?.[0]?.remaining ?? 0;

    if (!allowed) {
      return new Response(JSON.stringify({
        error: isVip
          ? `Daily VIP limit reached (${VIP_DAILY_LIMIT}/${VIP_DAILY_LIMIT}). Try again tomorrow.`
          : `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to VIP for 10 daily analyses.`,
        limitReached: true, remaining: 0, dailyLimit,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch market data
    const apiUrl = `https://ikszeynptbmwkaaldfad.supabase.co/functions/v1/quotex-proxy?symbol=${pair}&interval=1m&limit=100:qx_vzwz3wsu54chx8zmxpt0vp1yfk9gkxv0`;

    let marketRes: Response;
    try {
      marketRes = await fetchWithRetry(apiUrl, 3, 5000);
    } catch {
      return new Response(JSON.stringify({ error: "⚠️ MARKET DATA ERROR — Could not fetch market data. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketData = await marketRes.json();
    const candles = marketData.candles || marketData;

    // Pure TA analysis — no AI needed!
    const analysisResult = analyzeChart(candles);

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
      pair,
      remaining,
      dailyLimit,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-chart error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
