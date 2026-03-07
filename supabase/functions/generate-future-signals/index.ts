import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 10;
const ADMIN_DAILY_LIMIT = 999999;

// ===== TA ENGINE =====

interface Candle { open: number; high: number; low: number; close: number; }

function parseCandles(raw: any): Candle[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: any) => ({
    open: Number(c.open ?? c.o ?? c[1]),
    high: Number(c.high ?? c.h ?? c[2]),
    low: Number(c.low ?? c.l ?? c[3]),
    close: Number(c.close ?? c.c ?? c[4]),
  })).filter(c => !isNaN(c.close) && c.close > 0);
}

function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function calcMACD(closes: number[]): { histogram: number } {
  if (closes.length < 26) return { histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine.slice(-9), 9);
  return { histogram: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1] };
}

function calcBB(closes: number[], period = 20): { upper: number; lower: number } {
  if (closes.length < period) return { upper: closes[closes.length - 1], lower: closes[closes.length - 1] };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { upper: mean + 2 * std, lower: mean - 2 * std };
}

function findSR(candles: Candle[]): { support: number; resistance: number } {
  const recent = candles.slice(-50);
  return {
    support: Math.min(...recent.map(c => c.low)),
    resistance: Math.max(...recent.map(c => c.high)),
  };
}

function detectPatterns(candles: Candle[]): { bullish: number; bearish: number } {
  if (candles.length < 3) return { bullish: 0, bearish: 0 };
  let bull = 0, bear = 0;
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);

  // Doji = indecision, skip
  if (range > 0 && body / range < 0.1) return { bullish: 0, bearish: 0 };

  // Hammer
  if (lowerWick > body * 2 && upperWick < body * 0.5 && body > 0) bull += 2;
  // Shooting star
  if (upperWick > body * 2 && lowerWick < body * 0.5 && body > 0) bear += 2;
  // Bullish engulfing
  if (prev.close < prev.open && last.close > last.open && last.close > prev.open && last.open < prev.close) bull += 3;
  // Bearish engulfing
  if (prev.close > prev.open && last.close < last.open && last.open > prev.close && last.close < prev.open) bear += 3;

  return { bullish: bull, bearish: bear };
}

interface FutureSignal { time: string; direction: "CALL" | "PUT"; confidence: number; }

function generateFutureSignals(candles: Candle[], pair: string, currentPKT: string): { signals: FutureSignal[]; market_bias: string; support: string; resistance: string; summary: string } {
  if (candles.length < 50) {
    return { signals: [], market_bias: "MIXED", support: "N/A", resistance: "N/A", summary: "Insufficient data." };
  }

  const closes = candles.map(c => c.close);
  const lastPrice = closes[closes.length - 1];
  const sr = findSR(candles);
  const priceFormat = (n: number) => n.toFixed(lastPrice < 10 ? 5 : 2);

  // Parse current time
  const [curH, curM] = currentPKT.split(":").map(Number);

  const signals: FutureSignal[] = [];
  const windowSize = 30; // analyze windows of candles

  // Generate signals at ~5 min intervals over next hour
  for (let offset = 3; offset <= 60; offset += 5) {
    const targetMin = curM + offset;
    const targetH = (curH + Math.floor(targetMin / 60)) % 24;
    const targetM = targetMin % 60;
    const timeStr = `${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}`;

    // Use a shifted window of candles for each signal to simulate different market snapshots
    const shift = Math.min(offset, candles.length - windowSize);
    const windowStart = Math.max(0, candles.length - windowSize - shift);
    const window = candles.slice(windowStart, windowStart + windowSize);
    const windowCloses = window.map(c => c.close);

    // Score
    let bullScore = 0, bearScore = 0;

    // EMA
    const ema5 = calcEMA(windowCloses, 5);
    const ema20 = calcEMA(windowCloses, 20);
    if (ema5[ema5.length - 1] > ema20[ema20.length - 1]) bullScore += 15; else bearScore += 15;

    // RSI
    const rsi = calcRSI(windowCloses);
    if (rsi < 30) bullScore += 20;
    else if (rsi < 40) bullScore += 10;
    else if (rsi > 70) bearScore += 20;
    else if (rsi > 60) bearScore += 10;

    // MACD
    const macd = calcMACD(windowCloses);
    if (macd.histogram > 0) bullScore += 10; else bearScore += 10;

    // Bollinger
    const bb = calcBB(windowCloses);
    const wp = windowCloses[windowCloses.length - 1];
    if (wp <= bb.lower) bullScore += 15;
    if (wp >= bb.upper) bearScore += 15;

    // Patterns
    const pat = detectPatterns(window);
    bullScore += pat.bullish * 5;
    bearScore += pat.bearish * 5;

    // S/R proximity
    const distSupport = (wp - sr.support) / wp;
    const distResist = (sr.resistance - wp) / wp;
    if (distSupport < 0.003) bullScore += 10;
    if (distResist < 0.003) bearScore += 10;

    // Trend (last 10 candles green/red ratio)
    const last10 = window.slice(-10);
    const greens = last10.filter(c => c.close > c.open).length;
    if (greens >= 7) bullScore += 10;
    else if (greens <= 3) bearScore += 10;

    const totalMax = 80;
    const bullPct = Math.round((bullScore / totalMax) * 100);
    const bearPct = Math.round((bearScore / totalMax) * 100);

    if (bullPct >= 65 && bullPct > bearPct + 10) {
      signals.push({ time: timeStr, direction: "CALL", confidence: Math.min(bullPct, 92) });
    } else if (bearPct >= 65 && bearPct > bullPct + 10) {
      signals.push({ time: timeStr, direction: "PUT", confidence: Math.min(bearPct, 92) });
    }
    // else skip — not enough confluence
  }

  // Determine market bias
  const overallCloses = closes.slice(-50);
  const overallEma5 = calcEMA(overallCloses, 5);
  const overallEma20 = calcEMA(overallCloses, 20);
  const overallRsi = calcRSI(overallCloses);
  const callCount = signals.filter(s => s.direction === "CALL").length;
  const putCount = signals.filter(s => s.direction === "PUT").length;
  const market_bias = callCount > putCount + 2 ? "BULLISH" : putCount > callCount + 2 ? "BEARISH" : "MIXED";

  const summary = `Analysis of ${candles.length} candles. EMA(5) ${overallEma5[overallEma5.length - 1] > overallEma20[overallEma20.length - 1] ? "above" : "below"} EMA(20). RSI at ${Math.round(overallRsi)}. ${signals.length} signals generated with 65%+ confluence. S/R: ${priceFormat(sr.support)} — ${priceFormat(sr.resistance)}.`;

  return {
    signals,
    market_bias,
    support: priceFormat(sr.support),
    resistance: priceFormat(sr.resistance),
    summary,
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
  if (forwarded) return forwarded.split(",")[0].trim();
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

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 8000): Promise<Response> {
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

    console.log(`Future signals: IP=${clientIP.slice(0,10)}***, isVip=${isVip}, isAdmin=${isAdmin}, limit=${dailyLimit}`);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: usageResult, error: usageError } = await adminClient.rpc('atomic_increment_ip_usage', {
      p_ip_address: clientIP,
      p_usage_date: today,
      p_daily_limit: dailyLimit,
    });

    if (usageError) {
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
          : `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to VIP for 10 daily signals.`,
        limitReached: true, remaining: 0, dailyLimit,
      }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch 600 candles
    const apiUrl = `https://ikszeynptbmwkaaldfad.supabase.co/functions/v1/quotex-proxy?symbol=${pair}&interval=1m&limit=600:qx_vzwz3wsu54chx8zmxpt0vp1yfk9gkxv0`;

    let marketRes: Response;
    try {
      marketRes = await fetchWithRetry(apiUrl, 3, 8000);
    } catch {
      return new Response(JSON.stringify({ error: "⚠️ Could not fetch market data. Try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketData = await marketRes.json();
    const candles = marketData.candles || marketData;

    // Get current PKT time
    const now = new Date();
    const pktOffset = 5 * 60 * 60 * 1000;
    const pktNow = new Date(now.getTime() + pktOffset);
    const pktHour = pktNow.getUTCHours();
    const pktMin = pktNow.getUTCMinutes();
    const currentPKT = `${String(pktHour).padStart(2, '0')}:${String(pktMin).padStart(2, '0')}`;
    const nextHourEnd = `${String((pktHour + 1) % 24).padStart(2, '0')}:${String(pktMin).padStart(2, '0')}`;

    // Pure TA — no AI needed!
    const parsed = parseCandles(candles);
    const result = generateFutureSignals(parsed, pair, currentPKT);

    return new Response(JSON.stringify({
      success: true,
      signals: result.signals,
      analysis_summary: result.summary,
      market_bias: result.market_bias,
      key_levels: { support: result.support, resistance: result.resistance },
      pair,
      remaining,
      dailyLimit,
      generatedAt: currentPKT,
      validUntil: nextHourEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-future-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
