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
  callWins: number;
  putWins: number;
  totalCandles: number;
}

interface RequestParams {
  timeframe: number;
  maxMartingale: number;
  minWinPercent: number;
  analysisDays: number;
  startTime: string;
  endTime: string;
  assets: string[];
}

// Supported OTC pairs
const ALL_ASSETS = [
  'BRLUSD_otc',
  'USDBDT_otc',
  'USDARS_otc',
  'USDINR_otc',
  'USDMXN_otc',
  'USDPKR_otc',
  'USDPHP_otc',
  'USDEGP_otc',
  'USDTRY_otc',
  'USDIDR_otc',
  'USDZAR_otc'
];

// Convert UTC timestamp to Pakistan time (UTC+5) and get time slot
function getTimeSlot(timestamp: number, timeframeMinutes: number): string {
  const date = new Date(timestamp * 1000);
  // Add 5 hours for Pakistan timezone
  date.setHours(date.getHours() + 5);
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = Math.floor(date.getMinutes() / timeframeMinutes) * timeframeMinutes;
  const minutesStr = minutes.toString().padStart(2, '0');
  
  return `${hours}:${minutesStr}`;
}

// Determine MTG level based on win rate
function getMtgLevel(winRate: number): number {
  if (winRate >= 85) return 0;
  if (winRate >= 75) return 1;
  if (winRate >= 70) return 2;
  if (winRate >= 65) return 3;
  return 4; // Below threshold
}

// Check if time is within range
function isTimeInRange(timeSlot: string, startTime: string, endTime: string): boolean {
  const [slotH, slotM] = timeSlot.split(':').map(Number);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const slotMinutes = slotH * 60 + slotM;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes <= endMinutes) {
    return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
  } else {
    // Handle overnight range
    return slotMinutes >= startMinutes || slotMinutes <= endMinutes;
  }
}

// Fetch candle data from GAMMA API
async function fetchCandleData(
  asset: string, 
  timeframe: number, 
  days: number
): Promise<CandleData[]> {
  const url = `https://ai.gammaxbd.xyz/api/candles?symbol=${asset}&timeframe=${timeframe}&days=${days}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GM-Binary-Pro/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${asset}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data;
    } else if (data.candles && Array.isArray(data.candles)) {
      return data.candles;
    } else if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching ${asset}:`, error);
    return [];
  }
}

// Generate signals for a single asset
function generateSignalsForAsset(
  asset: string,
  candles: CandleData[],
  params: RequestParams
): GeneratedSignal[] {
  const signals: GeneratedSignal[] = [];
  
  // Group candles by time slot
  const timeSlotStats: Map<string, { callWins: number; putWins: number; total: number }> = new Map();
  
  for (const candle of candles) {
    const timeSlot = getTimeSlot(candle.time, params.timeframe);
    
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
    // If close === open, it's a doji (no clear winner)
  }
  
  // Generate signals for each time slot
  for (const [timeSlot, stats] of timeSlotStats) {
    // Skip if not in time range
    if (!isTimeInRange(timeSlot, params.startTime, params.endTime)) {
      continue;
    }
    
    // Need at least 5 candles for reliable signal
    if (stats.total < 5) {
      continue;
    }
    
    const callWinRate = (stats.callWins / stats.total) * 100;
    const putWinRate = (stats.putWins / stats.total) * 100;
    
    const winRate = Math.max(callWinRate, putWinRate);
    const direction: 'CALL' | 'PUT' = callWinRate >= putWinRate ? 'CALL' : 'PUT';
    
    // Check if meets minimum win percentage
    if (winRate < params.minWinPercent) {
      continue;
    }
    
    const mtgLevel = getMtgLevel(winRate);
    
    // Check if MTG level is within allowed range
    if (mtgLevel > params.maxMartingale) {
      continue;
    }
    
    signals.push({
      pair: asset,
      time: timeSlot,
      direction,
      winRate: Math.round(winRate * 10) / 10,
      mtgLevel,
      callWins: stats.callWins,
      putWins: stats.putWins,
      totalCandles: stats.total
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
    const body = await req.json();
    
    const params: RequestParams = {
      timeframe: body.timeframe || 1,
      maxMartingale: body.maxMartingale ?? 0,
      minWinPercent: body.minWinPercent || 70,
      analysisDays: body.analysisDays || 28,
      startTime: body.startTime || '00:00',
      endTime: body.endTime || '23:59',
      assets: body.assets && body.assets.length > 0 ? body.assets : ALL_ASSETS
    };
    
    console.log('Generating signals with params:', params);
    
    const allSignals: GeneratedSignal[] = [];
    const progress: { asset: string; signalsFound: number; status: string }[] = [];
    
    // Process each asset
    for (const asset of params.assets) {
      console.log(`Analyzing ${asset}...`);
      
      const candles = await fetchCandleData(asset, params.timeframe, params.analysisDays);
      
      if (candles.length === 0) {
        progress.push({
          asset,
          signalsFound: 0,
          status: 'No data available'
        });
        continue;
      }
      
      const signals = generateSignalsForAsset(asset, candles, params);
      
      allSignals.push(...signals);
      
      progress.push({
        asset,
        signalsFound: signals.length,
        status: `Analyzed ${candles.length} candles`
      });
    }
    
    // Sort signals by time
    allSignals.sort((a, b) => {
      const [aH, aM] = a.time.split(':').map(Number);
      const [bH, bM] = b.time.split(':').map(Number);
      return (aH * 60 + aM) - (bH * 60 + bM);
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        signals: allSignals,
        progress,
        summary: {
          totalSignals: allSignals.length,
          assetsAnalyzed: params.assets.length,
          timeframe: params.timeframe,
          analysisDays: params.analysisDays
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
