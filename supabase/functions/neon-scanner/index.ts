// Neon Scanner Pro - Port of live.py logic
// Stateless: returns one analysis per pair per call
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strategy constants (from live.py)
const ACCURACY_THRESHOLD = 61.0;
const MIN_OCCURRENCES = 10;
const RSI_FILTER = true;
const HIGHER_TF_TREND = true;
const TREND_CONFIRMATION = true;
const MARGIN_THRESHOLD = 0.2;
const RSI_PERIOD = 14;
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;

const PAYOUT_API = "https://wzkfqwubrajsxoyzzbob.supabase.co/functions/v1/get-candles?pair=";
const QUOTEX_API = "https://ikszeynptbmwkaaldfad.supabase.co/functions/v1/quotex-proxy?symbol={SYM}&interval=1m&limit=600:qx_vzwz3wsu54chx8zmxpt0vp1yfk9gkxv0";

const GLM_BASE_URL = "https://glmfivepointone.space.z.ai";
const GLM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Content-Type": "application/json",
  "Referer": "https://glmfivepointone.space.z.ai/",
  "Origin": "https://glmfivepointone.space.z.ai",
};
const GLM_SYSTEM_PROMPT = "You are a helpful coding assistant.";

interface Candle { time: number; open: number; high: number; low: number; close: number; volume?: number; }

function determineDirection(o: number, c: number) { return c > o ? "CALL" : "PUT"; }

async function fetchCandles(pair: string): Promise<{ candles: Candle[]; price: number } | null> {
  const formatted = pair.replace(/_/g, "-") + "q";
  const url = QUOTEX_API.replace("{SYM}", formatted);
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.candles || !Array.isArray(data.candles) || data.candles.length === 0) return null;
    return { candles: data.candles, price: data.candles[data.candles.length - 1].close };
  } catch { return null; }
}

async function getPayout(pair: string): Promise<string> {
  try {
    const r = await fetch(PAYOUT_API + pair);
    if (!r.ok) return "!";
    const d = await r.json();
    return d.payout || "!";
  } catch { return "!"; }
}

function calculateRSI(candles: Candle[], period = RSI_PERIOD): number {
  const asc = [...candles].sort((a, b) => a.time - b.time);
  if (asc.length < period + 1) return 50;
  const closes = asc.slice(-period - 1).map(c => +c.close);
  let gains = 0, losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch > 0) gains += ch; else losses += Math.abs(ch);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function aggregateCandles(candles: Candle[], targetMin = 5): Candle[] {
  if (!candles.length) return [];
  const asc = [...candles].sort((a, b) => a.time - b.time);
  const grouped: Candle[] = [];
  let baseTime: Date | null = null;
  let cur: Candle[] = [];
  for (const c of asc) {
    const t = new Date(c.time * 1000);
    if (!baseTime) { baseTime = t; cur = [c]; }
    else if ((t.getTime() - baseTime.getTime()) / 1000 < targetMin * 60) cur.push(c);
    else {
      if (cur.length) {
        grouped.push({
          time: cur[0].time, open: +cur[0].open,
          high: Math.max(...cur.map(x => +x.high)),
          low: Math.min(...cur.map(x => +x.low)),
          close: +cur[cur.length - 1].close,
        });
      }
      baseTime = t; cur = [c];
    }
  }
  if (cur.length) {
    grouped.push({
      time: cur[0].time, open: +cur[0].open,
      high: Math.max(...cur.map(x => +x.high)),
      low: Math.min(...cur.map(x => +x.low)),
      close: +cur[cur.length - 1].close,
    });
  }
  return grouped.sort((a, b) => b.time - a.time);
}

function getHigherTFTrend(c5: Candle[]): string | null {
  if (c5.length < 10) return null;
  const asc = [...c5].sort((a, b) => a.time - b.time);
  const closes = asc.slice(-10).map(c => +c.close);
  const sma5 = closes.slice(-5).reduce((a, b) => a + b) / 5;
  const sma10 = closes.reduce((a, b) => a + b) / 10;
  return sma5 > sma10 ? "CALL" : "PUT";
}

function checkRecentTrend(candles: Candle[], direction: string, lookback = 5): boolean {
  // candles sorted desc by time
  const recent = candles.slice(0, lookback);
  if (recent.length < 3) return true;
  let same = 0;
  for (const c of recent) if (determineDirection(+c.open, +c.close) === direction) same++;
  return same / recent.length >= 0.6;
}

function analyzeOriginal(candles: Candle[]): { direction: string; entryDt: Date; winRate: number } | null {
  if (!candles || candles.length < 20) return null;

  // Enrich (UTC+5) and sort desc
  const enriched = candles.map(c => {
    const dtUtc5 = new Date((c.time + 5 * 3600) * 1000);
    return { ...c, candleTime: dtUtc5 };
  }).sort((a, b) => b.time - a.time);

  const latestTime = enriched[0].candleTime;
  const rsi = RSI_FILTER ? calculateRSI(candles) : null;
  const htTrend = HIGHER_TF_TREND ? getHigherTFTrend(aggregateCandles(candles, 5)) : null;

  // Group by hour-then-minute (lookback 10h)
  const grouped: Record<number, Record<string, string[]>> = {};
  for (const c of enriched) {
    const diffH = (latestTime.getTime() - c.candleTime.getTime()) / 3600000;
    if (diffH < 0 || diffH >= 10) continue;
    const hour = c.candleTime.getUTCHours();
    const minute = String(c.candleTime.getUTCMinutes()).padStart(2, "0");
    const dir = determineDirection(+c.open, +c.close);
    grouped[hour] ??= {};
    grouped[hour][minute] ??= [];
    grouped[hour][minute].push(dir);
  }

  const nowUtc5 = new Date(Date.now() + 5 * 3600 * 1000);
  nowUtc5.setUTCSeconds(0, 0);

  for (const offset of [2, 3]) {
    const target = new Date(nowUtc5.getTime() + offset * 60000);
    const targetMin = String(target.getUTCMinutes()).padStart(2, "0");

    const all: string[] = [];
    for (const h of Object.keys(grouped)) {
      const m = grouped[+h][targetMin];
      if (m) all.push(...m);
    }
    if (all.length < MIN_OCCURRENCES) continue;
    const calls = all.filter(x => x === "CALL").length;
    const puts = all.length - calls;
    const margin = Math.abs(calls - puts) / all.length;
    const direction = calls >= puts ? "CALL" : "PUT";
    const winRate = (Math.max(calls, puts) / all.length) * 100;

    if (winRate < ACCURACY_THRESHOLD || margin < MARGIN_THRESHOLD) continue;
    if (RSI_FILTER && rsi !== null) {
      if (direction === "CALL" && rsi > RSI_OVERBOUGHT) continue;
      if (direction === "PUT" && rsi < RSI_OVERSOLD) continue;
    }
    if (HIGHER_TF_TREND && htTrend && direction !== htTrend) continue;
    if (TREND_CONFIRMATION && !checkRecentTrend(enriched, direction, 5)) continue;

    return { direction, entryDt: target, winRate };
  }
  return null;
}

// ---------- GLM-5.1 AI verification ----------
async function createGlmChat(): Promise<string | null> {
  try {
    const r = await fetch(`${GLM_BASE_URL}/api/chats`, {
      method: "POST", headers: GLM_HEADERS, body: JSON.stringify({ title: "AI Signal Analysis" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.chat?.id ?? null;
  } catch { return null; }
}

async function sendGlmMessage(chatId: string, msg: string): Promise<boolean> {
  try {
    const r = await fetch(`${GLM_BASE_URL}/api/chat`, {
      method: "POST", headers: GLM_HEADERS,
      body: JSON.stringify({
        chatId, messages: [{ role: "user", content: msg }],
        fileContent: null, fileName: null, systemPrompt: GLM_SYSTEM_PROMPT,
      }),
    });
    return r.ok;
  } catch { return false; }
}

async function getGlmReply(chatId: string): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < 30000) {
    try {
      const r = await fetch(`${GLM_BASE_URL}/api/chats`, { headers: GLM_HEADERS });
      if (r.ok) {
        const d = await r.json();
        const chat = (d.chats || []).find((c: any) => c.id === chatId);
        if (chat) {
          const msgs = chat.messages || [];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") return msgs[i].content;
          }
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

async function getAiDecision(candles: Candle[], chatId: string | null): Promise<{ direction: string | null; confidence: number; reason: string; chatId: string | null }> {
  if (candles.length < 20) return { direction: null, confidence: 0, reason: "Insufficient candles", chatId };
  const recent = candles.slice(-50);
  const lines = ["Index, Time, Open, High, Low, Close, Volume"];
  recent.forEach((c, i) => {
    const dt = new Date(c.time * 1000).toISOString().substr(11, 5);
    lines.push(`${i + 1}, ${dt}, ${(+c.open).toFixed(5)}, ${(+c.high).toFixed(5)}, ${(+c.low).toFixed(5)}, ${(+c.close).toFixed(5)}, ${c.volume ?? 0}`);
  });
  const candlesData = lines.join("\n");

  const prompt = `Act as a strict quantitative trading analyst.
Analyze ONLY the provided candle data. Choose either CALL or PUT (NEVER "NO TRADE").

CHART DATA (1-minute candles):
${candlesData}

Output EXACTLY:
Signal: [CALL or PUT]
Confidence Score: [0-100]%
Brief Reason: [2-4 sentences explaining structure, momentum, S/R reaction]`;

  let cid = chatId;
  if (!cid) cid = await createGlmChat();
  if (!cid) return { direction: null, confidence: 0, reason: "Chat error", chatId: null };
  let sent = await sendGlmMessage(cid, prompt);
  if (!sent) {
    cid = await createGlmChat();
    if (!cid) return { direction: null, confidence: 0, reason: "Send failed", chatId: null };
    sent = await sendGlmMessage(cid, prompt);
    if (!sent) return { direction: null, confidence: 0, reason: "Send failed", chatId: cid };
  }
  const reply = await getGlmReply(cid);
  if (!reply) return { direction: null, confidence: 0, reason: "No reply", chatId: cid };

  const sigM = reply.match(/Signal:\s*(CALL|PUT)/i);
  let direction = sigM ? sigM[1].toUpperCase() : null;
  const confM = reply.match(/Confidence\s*Score:\s*(\d+)/i);
  const confidence = confM ? parseInt(confM[1]) : 0;
  const reasonM = reply.match(/Brief Reason:\s*([\s\S]*)$/i);
  const reason = reasonM ? reasonM[1].trim() : "No reason";
  if (!direction) direction = reply.toUpperCase().includes("PUT") ? "PUT" : "CALL";
  return { direction, confidence, reason, chatId: cid };
}

// Telegram (user-supplied token + chat id)
async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = body.action || "scan";

    if (action === "scan") {
      const { pair, verificationMode = "off", glmChatId = null, telegram = null } = body;
      if (!pair) return new Response(JSON.stringify({ error: "pair required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const fetched = await fetchCandles(pair);
      if (!fetched) return new Response(JSON.stringify({ status: "no_data", pair }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { candles, price } = fetched;
      const result = analyzeOriginal(candles);
      if (!result) return new Response(JSON.stringify({ status: "no_signal", pair, candleCount: candles.length, price }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      let aiDirection: string | null = null, aiConfidence = 0, aiReason = "";
      let newChatId = glmChatId;
      let trade = true;
      const modeLabel = verificationMode === "off" ? "No AI" : verificationMode === "ai" ? "AI Normal" : "AI Anti";

      if (verificationMode === "ai" || verificationMode === "anti") {
        const ai = await getAiDecision(candles, glmChatId);
        aiDirection = ai.direction; aiConfidence = ai.confidence; aiReason = ai.reason; newChatId = ai.chatId;
        if (!aiDirection) trade = false;
        else if (verificationMode === "ai" && aiDirection !== result.direction) trade = false;
        else if (verificationMode === "anti" && aiDirection === result.direction) trade = false;
      }

      const payout = await getPayout(pair);

      if (trade && telegram?.token && telegram?.chatId) {
        const dirText = result.direction;
        const entryT = result.entryDt.toISOString().substr(11, 5);
        let msg = `\`\`\`\nGM AI SIGNAL (${modeLabel})\n\nPair: ${pair}\nTimeframe: 1 Minute\nEntry: ${entryT}\nDirection: ${dirText}\nPrice: ${price.toFixed(4)}\nPayout: ${payout}\n`;
        if (modeLabel === "AI Normal" && aiReason) {
          msg += `AI Reason: ${aiReason}\nAI Confidence: ${aiConfidence}%\n`;
        }
        msg += `\nSafety Margin Follow Rules\n\`\`\``;
        await sendTelegram(telegram.token, telegram.chatId, msg);
      }

      return new Response(JSON.stringify({
        status: trade ? "signal" : "ai_rejected",
        pair, price, payout, modeLabel,
        direction: result.direction,
        entryTime: result.entryDt.toISOString().substr(11, 5),
        winRate: Math.round(result.winRate),
        ai: { direction: aiDirection, confidence: aiConfidence, reason: aiReason },
        glmChatId: newChatId,
        candleCount: candles.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check_result") {
      const { pair, entryTime, direction, candleOffset = 0 } = body;
      // entryTime is "HH:MM" UTC+5; build target ts in UTC
      const fetched = await fetchCandles(pair);
      if (!fetched) return new Response(JSON.stringify({ status: "no_data" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const candles = fetched.candles;
      const today = new Date();
      const utc5 = new Date(today.getTime() + 5 * 3600 * 1000);
      const [hh, mm] = entryTime.split(":").map(Number);
      utc5.setUTCHours(hh, mm + candleOffset, 0, 0);
      const targetUtcSec = Math.floor((utc5.getTime() - 5 * 3600 * 1000) / 1000);
      const candle = candles.find((c: Candle) => Math.abs(c.time - targetUtcSec) < 30);
      if (!candle) return new Response(JSON.stringify({ status: "candle_not_ready" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const win = direction === "CALL" ? +candle.close > +candle.open : +candle.close < +candle.open;
      return new Response(JSON.stringify({ status: "ok", win, candle }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("neon-scanner error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
