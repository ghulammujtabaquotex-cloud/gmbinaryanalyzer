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

export interface BotConfig {
  id?: number;
  user_id: string;
  is_active: boolean;
  telegram_token: string;
  telegram_chat_id: string;
  selected_pairs: string[];
  updated_at?: string;
}

export interface SignalResponse {
  signal: 'CALL' | 'PUT' | 'NEUTRAL';
  confidence: number;
  reason: string;
  timestamp: number;
  entryTime: string;
  targetCandleTime: number;
  indicators: {
    structure: string;
    levelStatus: string;
    momentum: string;
    pattern: string;
  };
}

export interface TradeSignal {
  id?: number;
  user_id?: string;
  symbol: string;
  signal_type: 'CALL' | 'PUT';
  entry_time: number;
  outcome: 'PENDING' | 'WIN' | 'LOSS' | 'MTG_PENDING' | 'MTG_WIN' | 'MTG_LOSS';
  confidence: number;
}

export interface PotentialSignal {
  symbol: string;
  type: 'CALL' | 'PUT';
  time: number;
  confidence: number;
}
