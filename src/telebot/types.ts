export enum CandleType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH'
}

export interface OHLC {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TickData {
  time: number; // Unix timestamp in seconds or milliseconds
  price: number;
  symbol?: string;
}

export interface ChartConfig {
  symbol: string;
  interval: string;
  limit: number;
  timezoneOffset: number; // Hours to offset (e.g., 5 for UTC+5)
}

// Supabase Table Types
export interface DatabaseCandle {
  id?: number;
  symbol: string;
  time: string; // ISO string
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SignalResponse {
  signal: 'CALL' | 'PUT' | 'NEUTRAL';
  confidence: number;
  reason: string;
  timestamp: number;
  entryTime: string; // HH:mm formatted time (UTC+5)
  targetCandleTime: number; // Unix timestamp of the specific candle to trade
  // Updated for Price Action Engine
  indicators: {
    structure: string; // e.g., "Bullish (HH/HL)"
    levelStatus: string; // e.g., "At Support", "At Resistance", "No Level"
    momentum: string; // e.g., "Slowing Down", "Increasing"
    pattern: string; // e.g., "Bullish Engulfing", "Pinbar rejection"
  };
}

export interface TradeSignal {
    id?: number;
    symbol: string;
    signal_type: 'CALL' | 'PUT';
    entry_time: number; // The timestamp of the candle the signal is FOR
    outcome: 'PENDING' | 'WIN' | 'LOSS' | 'MTG_PENDING' | 'MTG_WIN' | 'MTG_LOSS';
    confidence: number;
}

export interface PotentialSignal {
    symbol: string;
    type: 'CALL' | 'PUT';
    time: number; // Timestamp of the FORMING candle
    confidence: number;
}

export interface AlertData {
  symbol: string;
  type: 'CALL' | 'PUT';
  time: string;
  price?: number;
  entryTime?: string;
  title?: string;
  variant?: 'default' | 'warning';
}
