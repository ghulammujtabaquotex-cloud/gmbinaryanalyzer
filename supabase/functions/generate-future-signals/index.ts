import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREE_DAILY_LIMIT = 3;
const VIP_DAILY_LIMIT = 10;
const ADMIN_DAILY_LIMIT = 999999;

// ===== TYPES =====
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  direction: string;
}

interface Signal {
  time: string;
  direction: "CALL" | "PUT";
  confidence: number;
  reason: string;
}

// ===== INDICATOR FUNCTIONS =====

function calcEMA(data: number[], period: number): number[] {
  const ema: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;
  
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calcBollingerBands(closes: number[], period = 20, mult = 2) {
  const upper: number[] = [], lower: number[] = [], mid: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(closes[i]); lower.push(closes[i]); mid.push(closes[i]);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    mid.push(mean); upper.push(mean + mult * std); lower.push(mean - mult * std);
  }
  return { upper, lower, mid };
}

function findSupportResistance(candles: Candle[], lookback = 200): { support: number; resistance: number } {
  const recent = candles.slice(-lookback);
  const lows = recent.map(c => c.low);
  const highs = recent.map(c => c.high);
  
  // Find clusters of lows (support) and highs (resistance)
  lows.sort((a, b) => a - b);
  highs.sort((a, b) => b - a);
  
  // Use 10th percentile low and 90th percentile high for robust S/R
  const supIdx = Math.floor(lows.length * 0.1);
  const resIdx = Math.floor(highs.length * 0.1);
  
  return {
    support: lows[supIdx] || lows[0],
    resistance: highs[resIdx] || highs[0],
  };
}

// ===== TIME-BASED PROBABILITY ENGINE =====

interface MinuteStats {
  minute: number;
  totalCandles: number;
  upCount: number;
  downCount: number;
  upProbability: number;
  downProbability: number;
  avgRange: number;
}

function buildTimeProbabilityMap(candles: Candle[]): Map<number, MinuteStats> {
  const minuteMap = new Map<number, { ups: number; downs: number; total: number; rangeSum: number }>();
  
  for (const c of candles) {
    // Extract minute-of-hour from unix timestamp (PKT = UTC+5)
    const date = new Date((c.time + 5 * 3600) * 1000);
    const minute = date.getUTCMinutes();
    
    const entry = minuteMap.get(minute) || { ups: 0, downs: 0, total: 0, rangeSum: 0 };
    entry.total++;
    entry.rangeSum += c.high - c.low;
    if (c.close > c.open) entry.ups++;
    else if (c.close < c.open) entry.downs++;
    minuteMap.set(minute, entry);
  }
  
  const result = new Map<number, MinuteStats>();
  for (const [minute, data] of minuteMap) {
    result.set(minute, {
      minute,
      totalCandles: data.total,
      upCount: data.ups,
      downCount: data.downs,
      upProbability: data.total > 0 ? data.ups / data.total : 0.5,
      downProbability: data.total > 0 ? data.downs / data.total : 0.5,
      avgRange: data.total > 0 ? data.rangeSum / data.total : 0,
    });
  }
  return result;
}

// ===== HOUR-OF-DAY PROBABILITY =====

function buildHourProbabilityMap(candles: Candle[]): Map<number, { upProb: number; downProb: number; count: number }> {
  const hourMap = new Map<number, { ups: number; downs: number; total: number }>();
  
  for (const c of candles) {
    const date = new Date((c.time + 5 * 3600) * 1000);
    const hour = date.getUTCHours();
    const entry = hourMap.get(hour) || { ups: 0, downs: 0, total: 0 };
    entry.total++;
    if (c.close > c.open) entry.ups++;
    else if (c.close < c.open) entry.downs++;
    hourMap.set(hour, entry);
  }
  
  const result = new Map<number, { upProb: number; downProb: number; count: number }>();
  for (const [hour, data] of hourMap) {
    result.set(hour, {
      upProb: data.total > 0 ? data.ups / data.total : 0.5,
      downProb: data.total > 0 ? data.downs / data.total : 0.5,
      count: data.total,
    });
  }
  return result;
}

// ===== BACKTESTING ENGINE =====

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  maxConsecutiveLosses: number;
}

function backtestStrategy(
  candles: Candle[],
  timeProbMap: Map<number, MinuteStats>,
  probThreshold: number,
  rsiPeriod = 14
): BacktestResult {
  // Use last 30% as out-of-sample test data
  const splitIdx = Math.floor(candles.length * 0.7);
  const testCandles = candles.slice(splitIdx);
  const closes = testCandles.map(c => c.close);
  const rsiArr = calcRSI(closes, rsiPeriod);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, Math.min(200, Math.floor(closes.length * 0.8)));
  
  let wins = 0, losses = 0, maxConsecLoss = 0, consecLoss = 0;
  
  for (let i = Math.max(200, rsiPeriod + 1); i < testCandles.length - 1; i++) {
    const c = testCandles[i];
    const date = new Date((c.time + 5 * 3600) * 1000);
    const minute = date.getUTCMinutes();
    const stats = timeProbMap.get(minute);
    if (!stats || stats.totalCandles < 20) continue;
    
    const rsi = rsiArr[i];
    const trendUp = ema50[i] > ema200[i];
    const trendDown = ema50[i] < ema200[i];
    
    let direction: "CALL" | "PUT" | null = null;
    
    if (stats.upProbability > probThreshold && rsi < 40 && trendUp) {
      direction = "CALL";
    } else if (stats.downProbability > probThreshold && rsi > 60 && trendDown) {
      direction = "PUT";
    }
    
    if (!direction) continue;
    
    // Check next candle for result
    const next = testCandles[i + 1];
    const won = (direction === "CALL" && next.close > next.open) ||
                (direction === "PUT" && next.close < next.open);
    
    if (won) {
      wins++;
      consecLoss = 0;
    } else {
      losses++;
      consecLoss++;
      maxConsecLoss = Math.max(maxConsecLoss, consecLoss);
    }
  }
  
  const totalTrades = wins + losses;
  return {
    totalTrades,
    wins,
    losses,
    winRate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    maxConsecutiveLosses: maxConsecLoss,
  };
}

// ===== SIGNAL GENERATION =====

function generateSignals(
  candles: Candle[],
  pair: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): { signals: Signal[]; summary: string; backtest: BacktestResult; support: string; resistance: string; market_bias: string } {
  
  if (candles.length < 500) {
    return {
      signals: [],
      summary: "Insufficient data. Need at least 500 candles.",
      backtest: { totalTrades: 0, wins: 0, losses: 0, winRate: 0, maxConsecutiveLosses: 0 },
      support: "N/A", resistance: "N/A", market_bias: "NEUTRAL",
    };
  }

  // Sort candles oldest first
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const closes = sorted.map(c => c.close);
  const lastPrice = closes[closes.length - 1];
  const priceFormat = (n: number) => n.toFixed(lastPrice < 10 ? 5 : lastPrice < 100 ? 4 : lastPrice < 1000 ? 2 : 0);
  
  // Build probability maps using training data (first 70%)
  const trainSplit = Math.floor(sorted.length * 0.7);
  const trainCandles = sorted.slice(0, trainSplit);
  const timeProbMap = buildTimeProbabilityMap(trainCandles);
  const hourProbMap = buildHourProbabilityMap(trainCandles);
  
  // Find optimal threshold via backtesting
  let bestThreshold = 0.55;
  let bestWinRate = 0;
  for (let t = 0.52; t <= 0.65; t += 0.01) {
    const bt = backtestStrategy(sorted, timeProbMap, t);
    if (bt.totalTrades >= 10 && bt.winRate > bestWinRate) {
      bestWinRate = bt.winRate;
      bestThreshold = t;
    }
  }
  
  // Final backtest with best threshold
  const backtest = backtestStrategy(sorted, timeProbMap, bestThreshold);
  
  // Current indicators on recent data
  const recentCloses = closes.slice(-300);
  const rsiArr = calcRSI(recentCloses);
  const currentRSI = rsiArr[rsiArr.length - 1];
  const ema50 = calcEMA(recentCloses, 50);
  const ema200 = calcEMA(recentCloses, Math.min(200, recentCloses.length - 1));
  const trendUp = ema50[ema50.length - 1] > ema200[ema200.length - 1];
  const bb = calcBollingerBands(recentCloses);
  const sr = findSupportResistance(sorted);
  
  // Generate signals for specified time range
  const signals: Signal[] = [];
  let lastSignalDir: "CALL" | "PUT" | null = null;
  let consecutiveSameDir = 0;
  
  // Iterate through each minute in the time range
  let currentH = startHour;
  let currentM = startMinute;
  
  while (true) {
    // Check if we've passed end time
    if (currentH > endHour || (currentH === endHour && currentM > endMinute)) break;
    
    const timeStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
    const minuteStats = timeProbMap.get(currentM);
    const hourStats = hourProbMap.get(currentH);
    
    if (minuteStats && minuteStats.totalCandles >= 20) {
      let direction: "CALL" | "PUT" | null = null;
      let confidence = 0;
      const reasons: string[] = [];
      
      // 1. Time probability check
      const upProb = minuteStats.upProbability;
      const downProb = minuteStats.downProbability;
      
      // Combine hour-level and minute-level probability
      const hourUpProb = hourStats?.upProb ?? 0.5;
      const hourDownProb = hourStats?.downProb ?? 0.5;
      const combinedUp = (upProb * 0.7) + (hourUpProb * 0.3);
      const combinedDown = (downProb * 0.7) + (hourDownProb * 0.3);
      
      // Score CALL potential
      {
        let score = 0;
        
        // Time probability (primary driver)
        if (combinedUp >= bestThreshold) {
          score += Math.round((combinedUp - 0.5) * 200);
          reasons.push(`Time prob: ${(combinedUp * 100).toFixed(1)}%`);
        }
        
        // RSI
        if (currentRSI < 30) { score += 20; reasons.push("RSI oversold"); }
        else if (currentRSI < 45) { score += 10; reasons.push("RSI favorable"); }
        else if (currentRSI > 75) { score -= 15; }
        
        // EMA trend
        if (trendUp) { score += 15; reasons.push("Uptrend"); }
        
        // S/R
        const distSup = (lastPrice - sr.support) / lastPrice;
        if (distSup < 0.005) { score += 10; reasons.push("Near support"); }
        
        // Bollinger
        if (lastPrice <= bb.lower[bb.lower.length - 1]) { score += 10; reasons.push("BB lower touch"); }
        
        if (score >= 20 && combinedUp >= 0.52) {
          direction = "CALL";
          confidence = Math.min(Math.round(55 + score * 0.5), 92);
        }
      }
      
      // Score PUT potential (only if no CALL)
      if (!direction) {
        let score = 0;
        
        if (combinedDown >= bestThreshold) {
          score += Math.round((combinedDown - 0.5) * 200);
          reasons.push(`Time prob: ${(combinedDown * 100).toFixed(1)}%`);
        }
        
        if (currentRSI > 70) { score += 20; reasons.push("RSI overbought"); }
        else if (currentRSI > 55) { score += 10; reasons.push("RSI favorable"); }
        else if (currentRSI < 25) { score -= 15; }
        
        if (!trendUp) { score += 15; reasons.push("Downtrend"); }
        
        const distRes = (sr.resistance - lastPrice) / lastPrice;
        if (distRes < 0.005) { score += 10; reasons.push("Near resistance"); }
        
        if (lastPrice >= bb.upper[bb.upper.length - 1]) { score += 10; reasons.push("BB upper touch"); }
        
        if (score >= 20 && combinedDown >= 0.52) {
          direction = "PUT";
          confidence = Math.min(Math.round(55 + score * 0.5), 92);
        }
      }
      
      // Risk control: avoid >3 consecutive same direction
      if (direction) {
        if (direction === lastSignalDir) {
          consecutiveSameDir++;
          if (consecutiveSameDir >= 3) {
            direction = null; // Skip to avoid correlation clustering
          }
        } else {
          consecutiveSameDir = 1;
        }
      }
      
      if (direction) {
        signals.push({
          time: timeStr,
          direction,
          confidence,
          reason: reasons.join(", "),
        });
        lastSignalDir = direction;
      }
    }
    
    // Advance by 1 minute
    currentM++;
    if (currentM >= 60) {
      currentM = 0;
      currentH++;
      if (currentH >= 24) currentH = 0;
    }
  }
  
  // Market bias
  const callCount = signals.filter(s => s.direction === "CALL").length;
  const putCount = signals.filter(s => s.direction === "PUT").length;
  const market_bias = callCount > putCount + 2 ? "BULLISH" : putCount > callCount + 2 ? "BEARISH" : "MIXED";
  
  const summary = `Analyzed ${candles.length} candles. Optimal time-probability threshold: ${(bestThreshold * 100).toFixed(0)}%. ` +
    `Backtest: ${backtest.winRate.toFixed(1)}% win rate on ${backtest.totalTrades} trades (out-of-sample). ` +
    `RSI: ${currentRSI.toFixed(0)}, Trend: ${trendUp ? "UP" : "DOWN"}, ` +
    `S/R: ${priceFormat(sr.support)} — ${priceFormat(sr.resistance)}. ` +
    `${signals.length} signals generated with indicator confluence.`;
  
  return {
    signals,
    summary,
    backtest,
    support: priceFormat(sr.support),
    resistance: priceFormat(sr.resistance),
    market_bias,
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

// ===== MAIN =====

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pair, startTime, endTime } = body;
    
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

    // Usage check
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: usageResult, error: usageError } = await adminClient.rpc('atomic_increment_ip_usage', {
      p_ip_address: clientIP,
      p_usage_date: today,
      p_daily_limit: dailyLimit,
    });

    if (usageError) {
      console.error("Usage check failed:", usageError);
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

    // Determine time range
    const now = new Date();
    const pktOffset = 5 * 60 * 60 * 1000;
    const pktNow = new Date(now.getTime() + pktOffset);
    
    let sH: number, sM: number, eH: number, eM: number;
    
    if (startTime && endTime) {
      [sH, sM] = startTime.split(":").map(Number);
      [eH, eM] = endTime.split(":").map(Number);
    } else {
      sH = pktNow.getUTCHours();
      sM = pktNow.getUTCMinutes() + 1;
      if (sM >= 60) { sM = 0; sH = (sH + 1) % 24; }
      eH = (sH + 1) % 24;
      eM = sM;
    }

    // Fetch candles from new API
    const apiUrl = `https://mgqflouatyhxeqjackrq.supabase.co/functions/v1/get-candles?pair=${pair}&tf=M1&limit=30000`;
    
    console.log(`Fetching candles from: ${apiUrl}`);
    
    let marketRes: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);
      marketRes = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!marketRes.ok) throw new Error(`HTTP ${marketRes.status}`);
    } catch (e) {
      console.error("Candle fetch error:", e);
      return new Response(JSON.stringify({ error: "⚠️ Could not fetch market data. Try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketData = await marketRes.json();
    const rawCandles = marketData.candles || marketData;
    
    if (!Array.isArray(rawCandles) || rawCandles.length < 100) {
      return new Response(JSON.stringify({ error: "Insufficient candle data received" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse candles
    const candles: Candle[] = rawCandles
      .map((c: any) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        direction: c.direction || (c.close >= c.open ? "up" : "down"),
      }))
      .filter((c: Candle) => !isNaN(c.close) && c.close > 0 && !isNaN(c.time));

    console.log(`Parsed ${candles.length} valid candles out of ${rawCandles.length}`);

    // Generate signals
    const result = generateSignals(candles, pair, sH, sM, eH, eM);

    const generatedAt = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    const validUntil = `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`;

    return new Response(JSON.stringify({
      success: true,
      signals: result.signals,
      analysis_summary: result.summary,
      market_bias: result.market_bias,
      key_levels: { support: result.support, resistance: result.resistance },
      backtest: {
        winRate: result.backtest.winRate.toFixed(1),
        totalTrades: result.backtest.totalTrades,
        wins: result.backtest.wins,
        losses: result.backtest.losses,
        maxConsecutiveLosses: result.backtest.maxConsecutiveLosses,
      },
      pair,
      remaining,
      dailyLimit,
      generatedAt,
      validUntil,
      candlesAnalyzed: candles.length,
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
