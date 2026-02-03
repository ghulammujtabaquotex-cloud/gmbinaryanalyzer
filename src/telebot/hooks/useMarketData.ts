import { useState, useEffect, useCallback, useRef } from 'react';
import { OHLC } from '../types';
import { fetchHistoricalCandles, adjustToTimezone } from '../services/marketService';
import { API_CONFIG } from '../constants';

// Helper to check if two candles are identical (values)
const isSameCandle = (a: OHLC | null, b: OHLC | null) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.time === b.time &&
           Math.abs(a.close - b.close) < 0.000001 &&
           Math.abs(a.high - b.high) < 0.000001 &&
           Math.abs(a.low - b.low) < 0.000001 &&
           Math.abs(a.open - b.open) < 0.000001;
};

export const useMarketData = (symbol: string) => {
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [currentCandle, setCurrentCandle] = useState<OHLC | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [dataError, setDataError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const isFetching = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
        isMounted.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Safety Valve: Force loading off after 5 seconds
  useEffect(() => {
    if (isLoading) {
        const timer = setTimeout(() => {
            if (isMounted.current && isLoading) {
                console.warn("Force stopping loading state due to timeout");
                setIsLoading(false);
            }
        }, 5000);
        return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Reset state when symbol changes
  useEffect(() => {
      setCandles([]);
      setCurrentCandle(null);
      setIsLoading(true);
      setConnectionStatus('connecting');
      setDataError(null);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [symbol]);

  const fetchAndProcessData = useCallback(async (isInitial = false) => {
    if (isFetching.current) return;

    isFetching.current = true;

    try {
      const history = await fetchHistoricalCandles(symbol);

      if (!isMounted.current) return;

      if (history.length > 0) {
        // --- DATA FRESHNESS VALIDATION (STRICT) ---

        const lastCandle = history[history.length - 1];
        const nowUnix = Math.floor(Date.now() / 1000);

        const expectedTimestamp = nowUnix + (6 * 3600);
        const diff = Math.abs(expectedTimestamp - lastCandle.time);

        // Limit: 5 Minutes (300 seconds)
        if (diff > 300) {
             console.error(`[CRITICAL] FAKE DATA DETECTED. Diff: ${diff}s`);
             setDataError("FAKE DATA EXPOSED");
             setCandles([]);
             setCurrentCandle(null);
             setConnectionStatus('error');
             if (isInitial) setIsLoading(false);
             return;
        } else {
             if (dataError) setDataError(null);
        }

        const adjustedHistory = history.map(c => adjustToTimezone(c, API_CONFIG.TIMEZONE_OFFSET_HOURS));

        // 1. Update Candles List safely
        setCandles((prevCandles: OHLC[]) => {
          if (prevCandles.length === 0) return adjustedHistory;

          const lastNew = adjustedHistory[adjustedHistory.length - 1];
          const lastPrev = prevCandles[prevCandles.length - 1];

          if (adjustedHistory.length !== prevCandles.length || !isSameCandle(lastNew, lastPrev)) {
             return adjustedHistory;
          }
          return prevCandles;
        });

        // 2. Update Current Candle
        const lastAdjCandle = adjustedHistory[adjustedHistory.length - 1];
        setCurrentCandle(prev => {
            if (isSameCandle(prev, lastAdjCandle)) return prev;
            return lastAdjCandle;
        });

        setConnectionStatus('connected');
        if (isInitial) setIsLoading(false);
      } else {
          if (isInitial && candles.length === 0) setConnectionStatus('error');
      }
    } catch (error) {
       console.warn("Fetch loop error:", error);
       if (isInitial) setConnectionStatus('error');
    } finally {
      isFetching.current = false;
      if (isInitial && isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [symbol, candles.length, dataError]);

  // CLOCK-ALIGNED POLLING
  useEffect(() => {
    // Immediate initial fetch
    fetchAndProcessData(true);

    const scheduleNextTick = () => {
      if (!isMounted.current) return;

      const now = Date.now();
      const delay = 1000 - (now % 1000);

      timeoutRef.current = setTimeout(() => {
        fetchAndProcessData(false);
        scheduleNextTick();
      }, delay);
    };

    scheduleNextTick();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchAndProcessData]);

  // Manual Refresh Function
  const refetch = useCallback(() => {
      setIsLoading(true);
      setCandles([]);
      setDataError(null);
      fetchAndProcessData(true);
  }, [fetchAndProcessData]);

  return {
    candles,
    currentCandle,
    connectionStatus,
    isLoading,
    refetch,
    dataError
  };
};
