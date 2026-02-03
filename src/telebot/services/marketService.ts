import { API_CONFIG } from '../constants';
import { OHLC, TickData } from '../types';

/**
 * Fetches historical candle data with robust error handling and proxy fallback.
 */

// List of proxies to try in order.
const PROXY_PROVIDERS = [
    // 1. CorsProxy.io (Fast, reliable)
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    // 2. AllOrigins (Good backup)
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    // 3. CodeTabs (Alternative)
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    // 4. ThingProxy (Final fallback)
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`
];

export const fetchHistoricalCandles = async (symbol: string): Promise<OHLC[]> => {
  // Add timestamp to bust cache
  const cacheBuster = `&_t=${Date.now()}`;
  const targetUrl = `${API_CONFIG.HISTORY_URL}?pair=${symbol}&timeframe=&limit=${API_CONFIG.DEFAULT_LIMIT}&format=json${cacheBuster}`;

  // Helper for timeout
  const fetchWithTimeout = async (url: string, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
          signal: controller.signal,
          headers: {
              'Accept': 'application/json'
          }
      });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      return await response.json();
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  // 1. Try Direct Fetch first (might work on some networks/localhost)
  try {
      const data = await fetchWithTimeout(targetUrl, 2500);
      return processData(data);
  } catch (e) {
      // Ignore and move to proxies
  }

  // 2. Iterate through Proxy Waterfall
  for (const createProxyUrl of PROXY_PROVIDERS) {
      try {
          const proxyUrl = createProxyUrl(targetUrl);
          // Give proxies a bit more time (6s)
          const data = await fetchWithTimeout(proxyUrl, 6000);
          const processed = processData(data);

          // Double check we actually got data before returning
          if (processed.length > 0) {
              return processed;
          }
      } catch (e) {
          continue;
      }
  }

  console.warn(`All fetch strategies failed for ${symbol}`);
  return [];
};

// Helper to process the JSON format
const processData = (rawData: any): OHLC[] => {
    let items: any[] = [];

    // 1. Handle Array of Objects (Standard History)
    if (Array.isArray(rawData)) {
        items = rawData;
    }
    // 2. Handle { data: [...] } wrapper
    else if (rawData && rawData.data && Array.isArray(rawData.data)) {
        items = rawData.data;
    }
    // 3. Handle { candles: [...] } wrapper
    else if (rawData && rawData.candles && Array.isArray(rawData.candles)) {
        items = rawData.candles;
    }
    // 4. Handle Single Object (The specific format user provided)
    else if (rawData && typeof rawData === 'object') {
        if (rawData.candle_time || rawData.pair || rawData.id) {
            items = [rawData];
        }
    }

    // SAFETY: If response is huge, slice it
    if (items.length > 2000) {
        items = items.slice(-2000);
    }

    const candles: OHLC[] = items.map((item: any) => {
      // Data normalization
      let finalTime = 0;
      let open = 0, high = 0, low = 0, close = 0;

      // Handle the specific format: { "candle_time": "2026-02-03 18:13:00", ... }
      let timeVal = item.candle_time || item.time || item.timestamp || item.t;

      if (typeof timeVal === 'string') {
         const dateStr = timeVal.replace(' ', 'T') + (timeVal.includes('Z') ? '' : 'Z');
         const parsed = new Date(dateStr).getTime();
         if (!isNaN(parsed)) {
             finalTime = Math.floor(parsed / 1000);
         }
      } else if (typeof timeVal === 'number') {
        finalTime = timeVal > 10000000000 ? Math.floor(timeVal / 1000) : timeVal;
      }

      // Parse prices (safely handle strings and numbers)
      open = parseFloat(item.open || item.o || 0);
      high = parseFloat(item.high || item.h || 0);
      low = parseFloat(item.low || item.l || 0);
      close = parseFloat(item.close || item.c || 0);

      // Fallback for High/Low if missing
      if (high === 0 || isNaN(high)) high = Math.max(open, close);
      if (low === 0 || isNaN(low)) low = Math.min(open, close);

      return {
        time: finalTime,
        open,
        high,
        low,
        close,
      };
    });

    // Filter invalid data and sort
    return candles
      .filter(c => c.time > 0 && !isNaN(c.close) && c.close > 0)
      .sort((a, b) => a.time - b.time);
};

export const aggregateTickToCandle = (
  tick: TickData,
  currentCandle: OHLC | null
): { candle: OHLC; isNew: boolean } => {
  const tickTimeSec = Math.floor(tick.time);
  const tickMinuteStart = tickTimeSec - (tickTimeSec % 60);

  if (!currentCandle) {
    return {
      candle: {
        time: tickMinuteStart,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
      },
      isNew: true
    };
  }

  if (currentCandle.time === tickMinuteStart) {
    return {
      candle: {
        ...currentCandle,
        high: Math.max(currentCandle.high, tick.price),
        low: Math.min(currentCandle.low, tick.price),
        close: tick.price,
      },
      isNew: false
    };
  } else if (tickMinuteStart > currentCandle.time) {
    return {
      candle: {
        time: tickMinuteStart,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
      },
      isNew: true
    };
  }

  return { candle: currentCandle, isNew: false };
};

export const adjustToTimezone = (ohlc: OHLC, offsetHours: number): OHLC => {
  const offsetSeconds = offsetHours * 3600;
  return {
    ...ohlc,
    time: ohlc.time + offsetSeconds,
  };
};
