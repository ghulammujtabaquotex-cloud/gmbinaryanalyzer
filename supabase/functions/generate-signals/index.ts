import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OTC_PAIRS = [
  "USDEGP_otc",
  "USDBDT_otc",
  "USDARS_otc",
  "USDBRL_otc",
  "USDCOP_otc",
  "USDMXN_otc",
  "USDIDR_otc",
  "USDINR_otc",
  "USDPKR_otc",
  "USDTRY_otc",
  "EURUSD_otc",
  "GBPUSD_otc",
  "USDJPY_otc",
  "AUDUSD_otc",
  "USDCAD_otc",
  "NZDUSD_otc",
];

const API_BASE = "https://mrbeaxt.site/Qx/Qx.php";

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  candle_time: string;
}

// ── Technical Indicators ──

function calcSMA(closes: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { sma.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    sma.push(sum / period);
  }
  return sma;
}

function calcEMA(closes: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { ema.push(closes[i]); continue; }
    ema.push(closes[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { rsi.push(50); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i === period) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - 100 / (1 + rs));
      } else {
        rsi.push(50);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }
  return rsi;
}

function calcMACD(closes: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

function calcBollingerBands(closes: number[], period = 20, mult = 2) {
  const sma = calcSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(sma[i])) { upper.push(NaN); lower.push(NaN); continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - sma[i]) ** 2;
    const std = Math.sqrt(sumSq / period);
    upper.push(sma[i] + mult * std);
    lower.push(sma[i] - mult * std);
  }
  return { upper, middle: sma, lower };
}

function calcStochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
  const k: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) { k.push(50); continue; }
    let high = -Infinity, low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > high) high = candles[j].high;
      if (candles[j].low < low) low = candles[j].low;
    }
    const range = high - low;
    k.push(range === 0 ? 50 : ((candles[i].close - low) / range) * 100);
  }
  const d = calcSMA(k, dPeriod);
  return { k, d };
}

// ── Signal Generation with Backtesting ──

interface Signal {
  pair: string;
  direction: "CALL" | "PUT";
  confidence: number;
  signal_time: string;
  indicators: Record<string, string>;
}

function generateSignal(candles: Candle[], pair: string): Signal | null {
  if (candles.length < 450) return null;

  // Use last 450 candles for backtesting context
  const backtestCandles = candles.slice(0, 450);
  const closes = backtestCandles.map((c) => c.close);
  const last = closes.length - 1;

  // Calculate all indicators
  const rsi = calcRSI(closes, 14);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const { macd, signal, histogram } = calcMACD(closes);
  const bb = calcBollingerBands(closes, 20, 2);
  const stoch = calcStochastic(backtestCandles, 14, 3);

  const currentRSI = rsi[last];
  const currentMACD = macd[last];
  const currentSignal = signal[last];
  const currentHist = histogram[last];
  const prevHist = histogram[last - 1];
  const currentStochK = stoch.k[last];
  const currentStochD = stoch.d[last];

  // ── Trend Filter ──
  const trendUp = sma20[last] > sma50[last] && closes[last] > sma20[last];
  const trendDown = sma20[last] < sma50[last] && closes[last] < sma20[last];

  // ── Scoring system ──
  let bullScore = 0;
  let bearScore = 0;

  // RSI
  if (currentRSI < 30) bullScore += 2;
  else if (currentRSI < 40) bullScore += 1;
  if (currentRSI > 70) bearScore += 2;
  else if (currentRSI > 60) bearScore += 1;

  // EMA crossover
  if (ema9[last] > ema21[last] && ema9[last - 1] <= ema21[last - 1]) bullScore += 2;
  if (ema9[last] < ema21[last] && ema9[last - 1] >= ema21[last - 1]) bearScore += 2;

  // MACD
  if (currentHist > 0 && prevHist <= 0) bullScore += 2;
  if (currentHist < 0 && prevHist >= 0) bearScore += 2;
  if (currentMACD > currentSignal) bullScore += 1;
  if (currentMACD < currentSignal) bearScore += 1;

  // Bollinger Bands
  if (!isNaN(bb.lower[last]) && closes[last] <= bb.lower[last]) bullScore += 2;
  if (!isNaN(bb.upper[last]) && closes[last] >= bb.upper[last]) bearScore += 2;

  // Stochastic
  if (currentStochK < 20 && currentStochD < 20) bullScore += 1;
  if (currentStochK > 80 && currentStochD > 80) bearScore += 1;
  if (currentStochK > currentStochD && stoch.k[last - 1] <= (stoch.d[last - 1] || 0)) bullScore += 1;
  if (currentStochK < currentStochD && stoch.k[last - 1] >= (stoch.d[last - 1] || 0)) bearScore += 1;

  // Trend alignment bonus
  if (trendUp) bullScore += 2;
  if (trendDown) bearScore += 2;

  // ── Backtesting validation on last 50 candles ──
  let backtestWins = 0;
  let backtestTotal = 0;
  const testStart = 400;
  const testEnd = 449;

  for (let i = testStart; i < testEnd; i++) {
    const testRSI = rsi[i];
    const testTrendUp = sma20[i] > sma50[i];
    const testTrendDown = sma20[i] < sma50[i];
    const nextClose = closes[i + 1];
    const curClose = closes[i];

    if (testRSI < 35 && testTrendUp) {
      backtestTotal++;
      if (nextClose > curClose) backtestWins++;
    } else if (testRSI > 65 && testTrendDown) {
      backtestTotal++;
      if (nextClose < curClose) backtestWins++;
    }
  }

  const backtestRate = backtestTotal > 0 ? backtestWins / backtestTotal : 0.5;

  // ── Decision ──
  const minScore = 5;
  const scoreDiff = Math.abs(bullScore - bearScore);

  if (scoreDiff < 2) return null; // Too close, no signal

  let direction: "CALL" | "PUT";
  let score: number;

  if (bullScore > bearScore && bullScore >= minScore) {
    direction = "CALL";
    score = bullScore;
  } else if (bearScore > bullScore && bearScore >= minScore) {
    direction = "PUT";
    score = bearScore;
  } else {
    return null;
  }

  // Confidence: base from score + backtest bonus
  const maxScore = 14;
  let confidence = Math.round(60 + (score / maxScore) * 30 + backtestRate * 10);
  confidence = Math.min(95, Math.max(60, confidence));

  // Reject low-confidence signals
  if (confidence < 65) return null;

  // candle_time is UTC+6. Next signal = last candle + 1 min. Output in UTC+5 (subtract 1 hour).
  const lastCandleTime = backtestCandles[last].candle_time; // "2026-02-11 15:17:00" in UTC+6
  const utc6Date = new Date(lastCandleTime.replace(' ', 'T') + '+06:00');
  const nextSignalUtc = new Date(utc6Date.getTime() + 60_000); // +1 minute for future
  // Convert to UTC+5
  const utc5Offset = 5 * 60 * 60_000;
  const utc5Date = new Date(nextSignalUtc.getTime() + utc5Offset - nextSignalUtc.getTimezoneOffset() * 0);
  // Format as HH:mm
  const utc5Actual = new Date(nextSignalUtc.getTime());
  const hh = String(Math.floor((utc5Actual.getTime() % (24*3600000)) / 3600000 + 5) % 24).padStart(2, '0');
  // Simpler: just format from UTC
  const utcMs = nextSignalUtc.getTime();
  const utc5Ms = utcMs + 5 * 3600000;
  const d5 = new Date(utc5Ms);
  const timeStr = d5.getUTCHours().toString().padStart(2, '0') + ':' + d5.getUTCMinutes().toString().padStart(2, '0');

  const pairFormatted = pair.replace('_otc', '_OTC');
  const formattedSignal = `M1;${timeStr};${pairFormatted};${direction}`;

  return {
    pair,
    direction,
    confidence,
    signal_time: timeStr,
    formatted: formattedSignal,
    indicators: {
      rsi: currentRSI.toFixed(1),
      macd: currentHist > 0 ? "Bullish" : "Bearish",
      ema_cross: ema9[last] > ema21[last] ? "Bullish" : "Bearish",
      trend: trendUp ? "Up" : trendDown ? "Down" : "Neutral",
      stochastic: `K:${currentStochK.toFixed(0)} D:${currentStochD?.toFixed(0) || "N/A"}`,
      bollinger: closes[last] <= (bb.lower[last] || 0) ? "Oversold" : closes[last] >= (bb.upper[last] || Infinity) ? "Overbought" : "Normal",
      backtest_rate: `${(backtestRate * 100).toFixed(0)}%`,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request - optional specific pairs
    let selectedPairs = OTC_PAIRS;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.pairs && Array.isArray(body.pairs) && body.pairs.length > 0) {
        selectedPairs = body.pairs;
      }
    }

    const signals: Signal[] = [];
    const errors: string[] = [];

    // Fetch data for each pair
    for (const pair of selectedPairs) {
      try {
        const url = `${API_BASE}?pair=${pair}&timeframe=&limit=500&format=json`;
        const resp = await fetch(url);
        if (!resp.ok) {
          errors.push(`${pair}: HTTP ${resp.status}`);
          continue;
        }
        const json = await resp.json();
        if (!json.success || !json.data?.length) {
          errors.push(`${pair}: No data`);
          continue;
        }

        // Parse candles (API returns newest first, reverse for chronological)
        const candles: Candle[] = json.data
          .map((d: any) => ({
            open: parseFloat(d.open),
            high: parseFloat(d.high),
            low: parseFloat(d.low),
            close: parseFloat(d.close),
            volume: parseInt(d.volume),
            candle_time: d.candle_time,
          }))
          .reverse();

        const sig = generateSignal(candles, pair);
        if (sig) signals.push(sig);
      } catch (e) {
        errors.push(`${pair}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_at: new Date().toISOString(),
        total_pairs_scanned: selectedPairs.length,
        signals_found: signals.length,
        signals,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
