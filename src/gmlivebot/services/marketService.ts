import { API_CONFIG } from '../constants';
import { OHLC, TickData } from '../types';

const PROXY_PROVIDERS = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => url
];

export const fetchHistoricalCandles = async (symbol: string): Promise<OHLC[]> => {
  const cacheBuster = `&_t=${Date.now()}`;
  const targetUrl = `${API_CONFIG.HISTORY_URL}?pair=${symbol}&timeframe=&limit=${API_CONFIG.DEFAULT_LIMIT}&format=json${cacheBuster}`;

  const fetchWithTimeout = async (url: string, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Received HTML response instead of JSON');
      }

      const text = await response.text();
      clearTimeout(id);

      try {
        return JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON response');
      }
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  for (const createProxyUrl of PROXY_PROVIDERS) {
    try {
      const proxyUrl = createProxyUrl(targetUrl);
      const timeout = proxyUrl.includes('corsproxy') ? 8000 : 5000;

      const data = await fetchWithTimeout(proxyUrl, timeout);
      const processed = processData(data);

      if (processed.length > 0) {
        return processed;
      }
    } catch {
      continue;
    }
  }

  console.warn(`All fetch strategies failed for ${symbol}.`);
  return [];
};

const parseApiTime = (timeVal: string | number): number => {
  try {
    if (typeof timeVal === 'number') {
      return timeVal > 10000000000 ? Math.floor(timeVal / 1000) : timeVal;
    }

    if (typeof timeVal === 'string') {
      const parts = timeVal.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[\sT](\d{1,2}):(\d{1,2}):(\d{1,2})/);

      if (parts) {
        const year = parseInt(parts[1]);
        const month = parseInt(parts[2]) - 1;
        const day = parseInt(parts[3]);
        const hour = parseInt(parts[4]);
        const minute = parseInt(parts[5]);
        const second = parseInt(parts[6]);

        return Math.floor(Date.UTC(year, month, day, hour - 6, minute, second) / 1000);
      }

      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        return Math.floor(d.getTime() / 1000);
      }
    }
  } catch (e) {
    console.error("Time Parse Error", e);
  }
  return 0;
};

const processData = (rawData: any): OHLC[] => {
  let items: any[] = [];

  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (rawData && rawData.data && Array.isArray(rawData.data)) {
    items = rawData.data;
  } else if (rawData && rawData.candles && Array.isArray(rawData.candles)) {
    items = rawData.candles;
  } else if (rawData && typeof rawData === 'object') {
    if (rawData.candle_time || rawData.pair || rawData.id) {
      items = [rawData];
    }
  }

  if (items.length > 2000) {
    items = items.slice(-2000);
  }

  const candles: OHLC[] = items.map((item: any) => {
    let finalTime = 0;
    let open = 0, high = 0, low = 0, close = 0;

    const timeVal = item.candle_time || item.time || item.timestamp || item.t;
    finalTime = parseApiTime(timeVal);

    open = parseFloat(item.open || item.o || 0);
    high = parseFloat(item.high || item.h || 0);
    low = parseFloat(item.low || item.l || 0);
    close = parseFloat(item.close || item.c || 0);

    if (high === 0 || isNaN(high)) high = Math.max(open, close);
    if (low === 0 || isNaN(low)) low = Math.min(open, close);

    return { time: finalTime, open, high, low, close };
  });

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
