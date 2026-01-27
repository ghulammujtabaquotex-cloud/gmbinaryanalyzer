import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandleData {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
}

interface GeneratedSignal {
  pair: string;
  time: string;
  direction: 'CALL' | 'PUT';
  winRate: number;
  mtgLevel: number;
}

// Fixed configuration values
const TIMEFRAME_MINUTES = 1;
const MIN_WIN_PERCENT = 70;
const MAX_MARTINGALE = 0; // M0 only (85%+)
const CANDLES_LIMIT = 600;

// All supported OTC pairs with their API symbols
const ALL_PAIRS = [
  { symbol: 'NZDUSD-OTCq', name: 'NZD/USD' },
  { symbol: 'GBPUSD-OTCq', name: 'GBP/USD' },
  { symbol: 'EURNZD-OTCq', name: 'EUR/NZD' },
  { symbol: 'AUDNZD-OTCq', name: 'AUD/NZD' },
  { symbol: 'GBPCAD-OTCq', name: 'GBP/CAD' },
  { symbol: 'GBPNZD-OTCq', name: 'GBP/NZD' },
  { symbol: 'EURAUD-OTCq', name: 'EUR/AUD' },
  { symbol: 'EURJPY-OTCq', name: 'EUR/JPY' },
  { symbol: 'EURSGD-OTCq', name: 'EUR/SGD' },
  { symbol: 'NZDCAD-OTCq', name: 'NZD/CAD' },
  { symbol: 'GBPJPY-OTCq', name: 'GBP/JPY' },
  { symbol: 'AUDUSD-OTCq', name: 'AUD/USD' },
  { symbol: 'GBPAUD-OTCq', name: 'GBP/AUD' },
  { symbol: 'USDZAR-OTCq', name: 'USD/ZAR' },
  { symbol: 'GBPCHF-OTCq', name: 'GBP/CHF' },
  { symbol: 'EURUSD-OTCq', name: 'EUR/USD' },
  { symbol: 'USDINR-OTCq', name: 'USD/INR' },
  { symbol: 'USDARS-OTCq', name: 'USD/ARS' },
  { symbol: 'AUDCAD-OTCq', name: 'AUD/CAD' },
  { symbol: 'USDBRL-OTCq', name: 'USD/BRL' },
  { symbol: 'USDPKR-OTCq', name: 'USD/PKR' },
  { symbol: 'NZDCHF-OTCq', name: 'NZD/CHF' },
  { symbol: 'USDCAD-OTCq', name: 'USD/CAD' },
  { symbol: 'USDNGN-OTCq', name: 'USD/NGN' },
  { symbol: 'AUDJPY-OTCq', name: 'AUD/JPY' },
  { symbol: 'AUDCHF-OTCq', name: 'AUD/CHF' },
  { symbol: 'CADCHF-OTCq', name: 'CAD/CHF' },
  { symbol: 'CHFJPY-OTCq', name: 'CHF/JPY' },
  { symbol: 'EURCAD-OTCq', name: 'EUR/CAD' },
  { symbol: 'EURCHF-OTCq', name: 'EUR/CHF' },
  { symbol: 'EURGBP-OTCq', name: 'EUR/GBP' },
  { symbol: 'NZDJPY-OTCq', name: 'NZD/JPY' },
  { symbol: 'USDCHF-OTCq', name: 'USD/CHF' },
  { symbol: 'USDCOP-OTCq', name: 'USD/COP' },
  { symbol: 'USDDZD-OTCq', name: 'USD/DZD' },
  { symbol: 'USDEGP-OTCq', name: 'USD/EGP' },
  { symbol: 'USDIDR-OTCq', name: 'USD/IDR' },
  { symbol: 'USDJPY-OTCq', name: 'USD/JPY' },
  { symbol: 'USDMXN-OTCq', name: 'USD/MXN' },
  { symbol: 'USDPHP-OTCq', name: 'USD/PHP' },
  { symbol: 'CADJPY-OTCq', name: 'CAD/JPY' },
];

// Convert UTC timestamp to Pakistan time (UTC+5) and get time slot
function getTimeSlot(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  // Add 5 hours for Pakistan timezone
  date.setHours(date.getHours() + 5);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

// Determine MTG level based on win rate
function getMtgLevel(winRate: number): number {
  if (winRate >= 85) return 0;
  if (winRate >= 75) return 1;
  if (winRate >= 70) return 2;
  if (winRate >= 65) return 3;
  return 4; // Below threshold
}

// Fetch candle data from xcharts.live API
async function fetchCandleData(symbol: string): Promise<CandleData[]> {
  const url = `https://xcharts.live/api/market/quotex/?symbol=${symbol}&interval=1m&limit=${CANDLES_LIMIT}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GM-Binary-Pro/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${symbol}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data.map((c: any) => ({
        time: c.time,
        open: c.open,
        close: c.close,
        high: c.high,
        low: c.low
      }));
    } else if (data.data && Array.isArray(data.data)) {
      return data.data.map((c: any) => ({
        time: c.time,
        open: c.open,
        close: c.close,
        high: c.high,
        low: c.low
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return [];
  }
}

// Generate future signals based on historical data
function generateSignalsForPair(
  pairName: string,
  candles: CandleData[],
  lastCandleTime: number
): GeneratedSignal[] {
  const signals: GeneratedSignal[] = [];
  
  if (candles.length < 10) {
    return signals;
  }
  
  // Group candles by time slot (HH:MM)
  const timeSlotStats: Map<string, { callWins: number; putWins: number; total: number }> = new Map();
  
  for (const candle of candles) {
    const timeSlot = getTimeSlot(candle.time);
    
    if (!timeSlotStats.has(timeSlot)) {
      timeSlotStats.set(timeSlot, { callWins: 0, putWins: 0, total: 0 });
    }
    
    const stats = timeSlotStats.get(timeSlot)!;
    stats.total++;
    
    // CALL win = close > open (price went up)
    // PUT win = close < open (price went down)
    if (candle.close > candle.open) {
      stats.callWins++;
    } else if (candle.close < candle.open) {
      stats.putWins++;
    }
  }
  
  // Get last candle time in Pakistan timezone to determine future signals
  const lastDate = new Date(lastCandleTime * 1000);
  lastDate.setHours(lastDate.getHours() + 5); // Convert to PKT
  
  const currentHour = lastDate.getHours();
  const currentMinute = lastDate.getMinutes();
  
  // Generate signals for the next 60 minutes from last candle time
  for (let i = 1; i <= 60; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setMinutes(futureDate.getMinutes() + i);
    
    const timeSlot = `${futureDate.getHours().toString().padStart(2, '0')}:${futureDate.getMinutes().toString().padStart(2, '0')}`;
    
    const stats = timeSlotStats.get(timeSlot);
    if (!stats || stats.total < 3) continue;
    
    const callWinRate = (stats.callWins / stats.total) * 100;
    const putWinRate = (stats.putWins / stats.total) * 100;
    
    const winRate = Math.max(callWinRate, putWinRate);
    const direction: 'CALL' | 'PUT' = callWinRate >= putWinRate ? 'CALL' : 'PUT';
    
    // Check if meets minimum win percentage
    if (winRate < MIN_WIN_PERCENT) continue;
    
    const mtgLevel = getMtgLevel(winRate);
    
    // Check if MTG level is within allowed range
    if (mtgLevel > MAX_MARTINGALE) continue;
    
    signals.push({
      pair: pairName,
      time: timeSlot,
      direction,
      winRate: Math.round(winRate * 10) / 10,
      mtgLevel
    });
  }
  
  return signals;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('Starting signal generation with fixed params...');
    console.log(`Timeframe: ${TIMEFRAME_MINUTES}min | Min Win: ${MIN_WIN_PERCENT}% | Max MTG: M${MAX_MARTINGALE}`);
    
    const allSignals: GeneratedSignal[] = [];
    const progress: { pair: string; signalsFound: number; status: string; candlesReceived: number }[] = [];
    
    // Process all pairs in parallel (batch of 5 to avoid rate limiting)
    const batchSize = 5;
    let globalLastCandleTime = 0;
    
    for (let i = 0; i < ALL_PAIRS.length; i += batchSize) {
      const batch = ALL_PAIRS.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (pair) => {
          console.log(`Analyzing ${pair.name}...`);
          
          const candles = await fetchCandleData(pair.symbol);
          
          if (candles.length === 0) {
            return {
              pair: pair.name,
              signalsFound: 0,
              status: 'No data available',
              candlesReceived: 0,
              signals: [] as GeneratedSignal[],
              lastCandleTime: 0
            };
          }
          
          // Get last candle time (most recent)
          const lastCandleTime = Math.max(...candles.map(c => c.time));
          
          const signals = generateSignalsForPair(pair.name, candles, lastCandleTime);
          
          return {
            pair: pair.name,
            signalsFound: signals.length,
            status: `Analyzed ${candles.length} candles`,
            candlesReceived: candles.length,
            signals,
            lastCandleTime
          };
        })
      );
      
      for (const result of batchResults) {
        if (result.lastCandleTime > globalLastCandleTime) {
          globalLastCandleTime = result.lastCandleTime;
        }
        progress.push({
          pair: result.pair,
          signalsFound: result.signalsFound,
          status: result.status,
          candlesReceived: result.candlesReceived
        });
        allSignals.push(...result.signals);
      }
    }
    
    // Sort signals by time
    allSignals.sort((a, b) => {
      const [aH, aM] = a.time.split(':').map(Number);
      const [bH, bM] = b.time.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });
    
    // Get current time in PKT for reference
    const lastCandleDate = new Date(globalLastCandleTime * 1000);
    lastCandleDate.setHours(lastCandleDate.getHours() + 5);
    const lastCandleTimeStr = `${lastCandleDate.getHours().toString().padStart(2, '0')}:${lastCandleDate.getMinutes().toString().padStart(2, '0')}`;
    
    console.log(`Generation complete! Total signals: ${allSignals.length}`);
    console.log(`Last candle time (PKT): ${lastCandleTimeStr}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        signals: allSignals,
        progress,
        summary: {
          totalSignals: allSignals.length,
          pairsAnalyzed: ALL_PAIRS.length,
          timeframe: TIMEFRAME_MINUTES,
          minWinPercent: MIN_WIN_PERCENT,
          lastCandleTime: lastCandleTimeStr
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error: unknown) {
    console.error('Error generating signals:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate signals';
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
