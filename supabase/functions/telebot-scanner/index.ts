import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// API Configuration
const API_CONFIG = {
  HISTORY_URL: "https://mrbeaxt.site/Qx/Qx.php",
  DEFAULT_LIMIT: 500,
  TIMEZONE_OFFSET_HOURS: -1,
};

const AVAILABLE_SYMBOLS = [
  'AUDNZD_otc', 'Cadchf_otc', 'Eurnzd_otc', 'GBPNZD_otc', 'Nzdcad_otc',
  'NZDCHF_otc', 'Nzdjpy_otc', 'Nzdusd_otc', 'EURUSD', 'BCHUSD_otc',
  'BTCUSD_otc', 'XAUUSD_otc', 'AXP_otc', 'BRLUSD_otc', 'Usdars_otc',
  'Usdbdt_otc', 'Usdcop_otc', 'Usddzd_otc', 'Usdegp_otc', 'Usdidr_otc',
  'Usdinr_otc', 'Usdngn_otc', 'Usdphp_otc', 'Usdpkr_otc', 'Usdtry_otc',
];

interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SignalResult {
  signal: 'CALL' | 'PUT' | 'NEUTRAL';
  confidence: number;
  entryTime: string;
  targetCandleTime: number;
}

// Fetch market data from API
async function fetchMarketData(symbol: string): Promise<OHLC[]> {
  const url = `${API_CONFIG.HISTORY_URL}?asset=${encodeURIComponent(symbol)}&interval=1m&limit=${API_CONFIG.DEFAULT_LIMIT}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (!data?.data || !Array.isArray(data.data)) throw new Error("Invalid data format");
    
    const candles: OHLC[] = data.data.map((c: any) => ({
      time: c.time + (API_CONFIG.TIMEZONE_OFFSET_HOURS * 3600),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    })).sort((a: OHLC, b: OHLC) => a.time - b.time);
    
    return candles;
  } catch (err) {
    console.error(`Failed to fetch ${symbol}:`, err);
    return [];
  }
}

// Format entry time
const formatEntryTime = (unixTime: number): string => {
  return new Date(unixTime * 1000).toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Analyze market using seasonality strategy
function analyzeMarket(candles: OHLC[]): SignalResult {
  if (!candles || candles.length < 50) {
    return { signal: 'NEUTRAL', confidence: 0, entryTime: "---", targetCandleTime: 0 };
  }

  const lastCandle = candles[candles.length - 1];
  const lastTime = lastCandle.time;

  let bestSignal: SignalResult | null = null;
  let highestWinRate = 0;

  // Scan from 2 to 4 minutes ahead
  for (let i = 2; i <= 4; i++) {
    const targetTime = lastTime + (i * 60);
    const targetMinute = Math.floor((targetTime % 3600) / 60);

    let greenCount = 0;
    let redCount = 0;
    let totalMatches = 0;

    for (let j = 0; j < candles.length - 1; j++) {
      const historicalCandle = candles[j];
      const historicalMinute = Math.floor((historicalCandle.time % 3600) / 60);

      if (historicalMinute === targetMinute) {
        totalMatches++;
        if (historicalCandle.close > historicalCandle.open) greenCount++;
        else if (historicalCandle.close < historicalCandle.open) redCount++;
      }
    }

    if (totalMatches < 5) continue;

    const greenRate = (greenCount / totalMatches) * 100;
    const redRate = (redCount / totalMatches) * 100;

    let direction: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
    let winRate = 0;

    if (greenRate >= 75) {
      direction = 'CALL';
      winRate = greenRate;
    } else if (redRate >= 75) {
      direction = 'PUT';
      winRate = redRate;
    }

    if (direction !== 'NEUTRAL' && winRate > highestWinRate) {
      highestWinRate = winRate;
      bestSignal = {
        signal: direction,
        confidence: Math.round(winRate),
        entryTime: formatEntryTime(targetTime),
        targetCandleTime: targetTime
      };
    }
  }

  return bestSignal || { signal: 'NEUTRAL', confidence: 0, entryTime: "---", targetCandleTime: 0 };
}

// Format pair name for display
function formatPair(symbol: string): string {
  return symbol
    .replace(/_otc/i, '')
    .replace(/([A-Z]{3})([A-Z]{3})/i, '$1/$2')
    .toUpperCase();
}

// Get current price from candles
function getCurrentPrice(candles: OHLC[]): string {
  if (candles.length === 0) return "0.00000";
  return candles[candles.length - 1].close.toFixed(5);
}

// Build Telegram message in the new format
function buildTelegramMessage(
  symbol: string,
  direction: 'CALL' | 'PUT',
  entryTime: string,
  price: string
): string {
  const directionEmoji = direction === 'CALL' ? '🟢' : '🔴';
  const formattedPair = formatPair(symbol);
  
  return `💫 𝗔𝗜 𝗕𝗢𝗧 𝗦𝗜𝗚𝗡𝗔𝗟 💫
         𝗤𝗨𝗢𝗧𝗘𝗫
==================
📊 ${formattedPair}
⏳ 1 Minute
⏰ ${entryTime}
${directionEmoji} ${direction}
🎯 PRICE: ${price}
==================
🎯 USE 1 MTG 💰
🏆 UTC,GMT +05:00 

🔊 𝗖𝗢𝗡𝗧𝗔𝗖𝗧: @binarysupport`;
}

// Send signal to Telegram with chart screenshot
async function sendToTelegram(
  botToken: string,
  chatId: string,
  message: string,
  chartImageUrl?: string
): Promise<boolean> {
  try {
    if (chartImageUrl) {
      // Send photo with caption
      const photoUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
      const response = await fetch(photoUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: chartImageUrl,
          caption: message,
          parse_mode: "HTML",
        }),
      });
      const result = await response.json();
      return response.ok && result.ok;
    } else {
      // Send text message
      const textUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(textUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      });
      const result = await response.json();
      return response.ok && result.ok;
    }
  } catch (err) {
    console.error("Telegram send error:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Supabase config" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if TeleBot scanning is enabled
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', 'telebot_scanner')
      .maybeSingle();

    const config = settings?.value as { enabled?: boolean; chat_id?: string } | null;
    const isEnabled = config?.enabled !== false;
    const chatId = config?.chat_id || Deno.env.get("TELEGRAM_CHAT_ID");

    if (!isEnabled) {
      return new Response(
        JSON.stringify({ success: true, message: "TeleBot scanner is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!TELEGRAM_BOT_TOKEN || !chatId) {
      return new Response(
        JSON.stringify({ success: false, error: "Telegram not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("TeleBot Scanner: Starting scan cycle...");

    const signalsFound: Array<{ symbol: string; direction: string; entryTime: string; price: string }> = [];

    // Scan all symbols
    for (const symbol of AVAILABLE_SYMBOLS) {
      console.log(`Scanning ${symbol}...`);
      
      const candles = await fetchMarketData(symbol);
      if (candles.length < 50) {
        console.log(`${symbol}: Not enough data (${candles.length} candles)`);
        continue;
      }

      const analysis = analyzeMarket(candles);
      
      if (analysis.signal !== 'NEUTRAL' && analysis.confidence >= 75) {
        const price = getCurrentPrice(candles);
        
        console.log(`SIGNAL FOUND: ${symbol} - ${analysis.signal} at ${analysis.entryTime} (${analysis.confidence}%)`);
        
        // Build and send message
        const message = buildTelegramMessage(symbol, analysis.signal, analysis.entryTime, price);
        
        const sent = await sendToTelegram(TELEGRAM_BOT_TOKEN, chatId, message);
        
        if (sent) {
          signalsFound.push({
            symbol,
            direction: analysis.signal,
            entryTime: analysis.entryTime,
            price
          });
          
          // Save to signals history
          await supabase.from('signals_history').insert({
            pair: formatPair(symbol),
            direction: analysis.signal,
            signal_time: analysis.entryTime,
          });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
      
      // Small delay between symbols
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`TeleBot Scanner: Completed. Found ${signalsFound.length} signals.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Scan complete. Found ${signalsFound.length} signals.`,
        signals: signalsFound
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("TeleBot Scanner error:", err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
