import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { Activity, Wifi, WifiOff, Clock } from 'lucide-react';

interface TickData {
  symbol: string;
  price: number;
  timestamp: number;
}

interface OHLCCandle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

const LiveChart = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const currentCandleRef = useRef<OHLCCandle | null>(null);
  const candlesRef = useRef<OHLCCandle[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');
  const [tickCount, setTickCount] = useState(0);

  // Convert timestamp to UTC+5 and get minute-aligned time
  const getMinuteTime = (timestamp: number): number => {
    // Add 5 hours for UTC+5
    const utc5Offset = 5 * 60 * 60 * 1000;
    const adjustedTime = timestamp + utc5Offset;
    // Align to minute
    return Math.floor(adjustedTime / 60000) * 60;
  };

  // Format time for display
  const formatTime = (timestamp: number): string => {
    const utc5Offset = 5 * 60 * 60 * 1000;
    const date = new Date(timestamp + utc5Offset);
    return date.toISOString().substr(11, 8);
  };

  const processTick = (tick: TickData) => {
    const minuteTime = getMinuteTime(tick.timestamp) as Time;
    const price = tick.price;

    setCurrentPrice(price);
    setLastUpdate(formatTime(tick.timestamp));
    setTickCount(prev => prev + 1);

    if (!currentCandleRef.current || currentCandleRef.current.time !== minuteTime) {
      // New candle - save previous if exists
      if (currentCandleRef.current && candlestickSeriesRef.current) {
        candlesRef.current.push({ ...currentCandleRef.current });
      }

      // Create new candle
      currentCandleRef.current = {
        time: minuteTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      // Update current candle
      currentCandleRef.current.high = Math.max(currentCandleRef.current.high, price);
      currentCandleRef.current.low = Math.min(currentCandleRef.current.low, price);
      currentCandleRef.current.close = price;
    }

    // Update chart
    if (candlestickSeriesRef.current && currentCandleRef.current) {
      candlestickSeriesRef.current.update(currentCandleRef.current);
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket('wss://xcharts.live/api/market/quotex/tick_stream/?symbols=EURUSD-OTCq');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[LiveChart] WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message formats
          if (data.price && data.timestamp) {
            processTick({
              symbol: data.symbol || 'EURUSD-OTCq',
              price: parseFloat(data.price),
              timestamp: data.timestamp * 1000, // Convert to ms if in seconds
            });
          } else if (data.data) {
            // Nested data format
            const tickData = data.data;
            if (tickData.price) {
              processTick({
                symbol: tickData.symbol || 'EURUSD-OTCq',
                price: parseFloat(tickData.price),
                timestamp: (tickData.timestamp || Date.now() / 1000) * 1000,
              });
            }
          } else if (typeof data === 'object') {
            // Try to extract price from various formats
            const price = data.bid || data.ask || data.last || data.close;
            if (price) {
              processTick({
                symbol: 'EURUSD-OTCq',
                price: parseFloat(price),
                timestamp: (data.time || data.timestamp || Date.now() / 1000) * 1000,
              });
            }
          }
        } catch (e) {
          console.error('[LiveChart] Parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[LiveChart] WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('[LiveChart] WebSocket closed, reconnecting in 3s...');
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };
    } catch (error) {
      console.error('[LiveChart] Connection error:', error);
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0a0f' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: '#6366f1',
          width: 1,
          style: 2,
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: '#2d3748',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#2d3748',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series (v4+ API)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Connect to WebSocket
    connectWebSocket();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 backdrop-blur-sm p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Live Chart</h3>
              <p className="text-sm text-blue-500">EUR/USD OTC • 1M</p>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground font-mono">{lastUpdate}</span>
              <span className="text-xs text-muted-foreground/60">UTC+5</span>
            </div>
            
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              isConnected 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>Connecting...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Price Display */}
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Price</p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {currentPrice ? currentPrice.toFixed(5) : '---.-----'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Ticks</p>
            <p className="text-lg font-semibold font-mono text-blue-400">{tickCount.toLocaleString()}</p>
          </div>
        </div>

        {/* Chart Container */}
        <div 
          ref={chartContainerRef} 
          className="w-full h-[400px] rounded-lg overflow-hidden border border-border/30"
        />

        {/* Chart Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
              <span>Bullish</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-red-500"></div>
              <span>Bearish</span>
            </div>
          </div>
          <p>1-Minute Candlesticks • Real-time tick aggregation</p>
        </div>
      </div>
    </div>
  );
};

export default LiveChart;
