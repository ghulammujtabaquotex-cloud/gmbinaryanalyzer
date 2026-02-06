import { useState, useEffect, useCallback, useRef } from 'react';
import { OHLC } from '../types';
import { fetchHistoricalCandles, adjustToTimezone } from '../services/marketService';
import { API_CONFIG } from '../constants';
import { useWorkerTimer } from './useWorkerTimer';

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

  const candlesRef = useRef<OHLC[]>([]);
  const isMounted = useRef(true);
  const isFetching = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        if (isMounted.current && isLoading) {
          console.warn("Force stopping loading state due to timeout");
          setIsLoading(false);
        }
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  useEffect(() => {
    setCandles([]);
    candlesRef.current = [];
    setCurrentCandle(null);
    setIsLoading(true);
    setConnectionStatus('connecting');
  }, [symbol]);

  const fetchAndProcessData = useCallback(async (isInitial = false) => {
    if (isFetching.current) return;

    isFetching.current = true;

    try {
      const history = await fetchHistoricalCandles(symbol);

      if (!isMounted.current) return;

      if (history.length > 0) {
        const adjustedHistory = history.map(c => adjustToTimezone(c, API_CONFIG.TIMEZONE_OFFSET_HOURS));

        candlesRef.current = adjustedHistory;

        setCandles((prevCandles: OHLC[]) => {
          if (prevCandles.length === 0) return adjustedHistory;

          const lastNew = adjustedHistory[adjustedHistory.length - 1];
          const lastPrev = prevCandles[prevCandles.length - 1];

          if (adjustedHistory.length !== prevCandles.length || !isSameCandle(lastNew, lastPrev)) {
            return adjustedHistory;
          }
          return prevCandles;
        });

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
  }, [symbol, candles.length]);

  useEffect(() => {
    fetchAndProcessData(true);
  }, [fetchAndProcessData]);

  useWorkerTimer(() => {
    fetchAndProcessData(false);
  }, true);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setCandles([]);
    candlesRef.current = [];
    fetchAndProcessData(true);
  }, [fetchAndProcessData]);

  return {
    candles,
    candlesRef,
    currentCandle,
    connectionStatus,
    isLoading,
    refetch,
    dataError: null
  };
};
