import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Bot,
  Wifi,
  WifiOff,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Play,
  Square,
  Loader2,
  Volume2,
  Copy,
  Check,
  Zap,
  Shield,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";

// ===== CONSTANTS =====

const PAIRS = [
  "EURUSD-OTC", "EURGBP-OTC", "EURJPY-OTC", "EURCAD-OTC", "EURAUD-OTC", "EURCHF-OTC", "EURNZD-OTC",
  "GBPUSD-OTC", "GBPJPY-OTC", "GBPCAD-OTC", "GBPAUD-OTC", "GBPCHF-OTC", "GBPNZD-OTC",
  "USDJPY-OTC", "USDCAD-OTC", "USDCHF-OTC",
  "AUDUSD-OTC", "AUDCAD-OTC", "AUDJPY-OTC", "AUDCHF-OTC", "AUDNZD-OTC",
  "NZDUSD-OTC", "NZDJPY-OTC", "NZDCAD-OTC", "NZDCHF-OTC",
  "CADJPY-OTC", "CADCHF-OTC", "CHFJPY-OTC",
  "BRLUSD-OTC",
];

const API_BASE = "https://ikszeynptbmwkaaldfad.supabase.co/functions/v1/quotex-proxy";
const POLL_INTERVAL = 3000;

// ===== TYPES =====

interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SignalResult {
  signal: "CALL" | "PUT" | "NEUTRAL";
  confidence: number;
  reason: string;
  entryTime: string;
  targetCandleTime: number;
  indicators: {
    structure: string;
    levelStatus: string;
    momentum: string;
    pattern: string;
  };
}

interface TradeSignal {
  id: number;
  symbol: string;
  type: "CALL" | "PUT";
  entryTime: string;
  confidence: number;
  outcome: "PENDING" | "WIN" | "LOSS";
  timestamp: number;
}

// ===== TECHNICAL ANALYSIS ENGINE: Historical Twin Engine v8.2 =====

const calculateEMA = (candles: OHLC[], period: number): number[] => {
  const k = 2 / (period + 1);
  const ema = new Array(candles.length).fill(0);
  if (candles.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  ema[period - 1] = sum / period;
  for (let i = period; i < candles.length; i++) {
    ema[i] = candles[i].close * k + ema[i - 1] * (1 - k);
  }
  return ema;
};

const analyzeMarket = (candles: OHLC[]): SignalResult => {
  const neutral = (reason: string): SignalResult => ({
    signal: "NEUTRAL", confidence: 0, reason,
    entryTime: "---", targetCandleTime: 0,
    indicators: { structure: "---", levelStatus: "---", momentum: "---", pattern: "---" },
  });

  if (!candles || candles.length < 500) return neutral("Gathering Data...");

  const PATTERN_SIZE = 20;
  const SEARCH_LIMIT = 480;
  const currentIdx = candles.length - 1;
  const ema25 = calculateEMA(candles, 25);
  const currentPattern = candles.slice(-PATTERN_SIZE);

  let bestMatchIndex = -1;
  let bestMatchScore = Infinity;

  const searchEndIndex = candles.length - PATTERN_SIZE - 2;
  const searchStartIndex = Math.max(30, searchEndIndex - SEARCH_LIMIT);

  for (let i = searchEndIndex; i >= searchStartIndex; i--) {
    const candidate = candles.slice(i - PATTERN_SIZE + 1, i + 1);
    if (candidate.length !== PATTERN_SIZE) continue;

    let score = 0;
    let colorMismatches = 0;

    for (let j = 0; j < PATTERN_SIZE; j++) {
      const curr = currentPattern[j];
      const hist = candidate[j];
      const currGreen = curr.close >= curr.open;
      const histGreen = hist.close >= hist.open;
      if (currGreen !== histGreen) { colorMismatches++; score += 1000; }
      score += Math.abs(Math.abs(curr.close - curr.open) - Math.abs(hist.close - hist.open));
    }

    if (colorMismatches > 3) continue;
    if (score < bestMatchScore) { bestMatchScore = score; bestMatchIndex = i; }
  }

  if (bestMatchIndex === -1) return neutral("No Twin Found");

  for (let offset = 2; offset <= 4; offset++) {
    const projIdx = bestMatchIndex + offset;
    if (projIdx >= candles.length) break;

    const proj = candles[projIdx];
    const prev = candles[projIdx - 1];
    const histEma = ema25[projIdx - 1];

    const isCall = proj.close > proj.open;
    const isPut = proj.close < proj.open;
    if (!isCall && !isPut) continue;

    const projBody = Math.abs(proj.close - proj.open);
    const prevBody = Math.abs(prev.close - prev.open);
    if (projBody <= 1.1 * prevBody) continue;

    const totalRange = proj.high - proj.low;
    if (totalRange > 0 && (projBody / totalRange) < 0.15) continue;

    if (isCall && prev.close <= histEma) continue;
    if (isPut && prev.close >= histEma) continue;

    const targetTime = candles[currentIdx].time + (offset * 60);
    const d = new Date(targetTime * 1000);
    // PKT time (UTC+5)
    const pktH = (d.getUTCHours() + 5) % 24;
    const entryStr = `${pktH.toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;

    return {
      signal: isCall ? "CALL" : "PUT",
      confidence: 100,
      reason: `Twin Match (Offset +${offset})`,
      entryTime: entryStr,
      targetCandleTime: targetTime,
      indicators: {
        structure: `T+${offset} Candle`,
        levelStatus: isCall ? "> EMA25" : "< EMA25",
        momentum: `Vol ${((projBody / prevBody) * 100).toFixed(0)}%`,
        pattern: "Twin v8.2",
      },
    };
  }

  return neutral(`Pattern Found (Idx ${bestMatchIndex}) but No Valid Setup`);
};

// ===== PARSE CANDLES =====

const parseCandles = (raw: any): OHLC[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => ({
      time: Number(c.time ?? c.t ?? c[0]),
      open: Number(c.open ?? c.o ?? c[1]),
      high: Number(c.high ?? c.h ?? c[2]),
      low: Number(c.low ?? c.l ?? c[3]),
      close: Number(c.close ?? c.c ?? c[4]),
    }))
    .filter((c: OHLC) => !isNaN(c.close) && c.close > 0 && c.time > 0)
    .sort((a: OHLC, b: OHLC) => a.time - b.time);
};

// ===== LIVE BOT COMPONENT =====

const LiveBot = () => {
  const navigate = useNavigate();
  const [selectedPair, setSelectedPair] = useState("EURUSD-OTC");
  const [isRunning, setIsRunning] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [candles, setCandles] = useState<OHLC[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [lastSignal, setLastSignal] = useState<SignalResult | null>(null);
  const [signalHistory, setSignalHistory] = useState<TradeSignal[]>([]);
  const [pktTime, setPktTime] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("Idle");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedSignal, setCopiedSignal] = useState<number | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTargetTime = useRef(0);
  const cooldownUntil = useRef(0);
  const signalIdCounter = useRef(0);
  const isFirstRun = useRef(true);

  // PKT Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      setPktTime(
        `${pkt.getUTCHours().toString().padStart(2, "0")}:${pkt.getUTCMinutes().toString().padStart(2, "0")}:${pkt.getUTCSeconds().toString().padStart(2, "0")}`
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0a0a0f" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "rgba(99,102,241,0.3)", width: 1, style: 2 },
        horzLine: { color: "rgba(99,102,241,0.3)", width: 1, style: 2 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(255,255,255,0.05)",
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.05)",
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update chart when candles change
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const chartData: CandlestickData[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(chartData);
  }, [candles]);

  // Fetch market data
  const fetchData = useCallback(async (pair: string) => {
    try {
      const url = `${API_BASE}?symbol=${pair}&interval=1m&limit=500:qx_vzwz3wsu54chx8zmxpt0vp1yfk9gkxv0`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = data.candles || data;
      const parsed = parseCandles(raw);
      return parsed;
    } catch (e) {
      console.warn("Market data fetch error:", e);
      return null;
    }
  }, []);

  // Play sound
  const playSignalSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        gain2.gain.value = 0.15;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 250);
    } catch {}
  }, [soundEnabled]);

  // Main polling loop
  const startPolling = useCallback(
    (pair: string) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      isFirstRun.current = true;
      lastTargetTime.current = 0;
      cooldownUntil.current = 0;

      setConnectionStatus("connecting");
      setAnalysisStatus("Connecting...");

      const poll = async () => {
        const data = await fetchData(pair);
        if (!data || data.length === 0) {
          setConnectionStatus("error");
          setAnalysisStatus("No Data");
          return;
        }

        setConnectionStatus("connected");
        setCandles(data);
        setCurrentPrice(data[data.length - 1].close);

        // Run analysis
        if (data.length >= 500) {
          setAnalysisStatus("Scanning...");
          const result = analyzeMarket(data);

          if (isFirstRun.current) {
            isFirstRun.current = false;
            setAnalysisStatus("Monitoring");
            setLastSignal(result);
            return;
          }

          setLastSignal(result);

          if (result.confidence >= 60 && result.signal !== "NEUTRAL") {
            if (Date.now() < cooldownUntil.current) {
              setAnalysisStatus("Cooldown");
              return;
            }
            if (result.targetCandleTime <= lastTargetTime.current) return;

            // New signal!
            lastTargetTime.current = result.targetCandleTime;
            cooldownUntil.current = Date.now() + 60000;

            playSignalSound();

            const newSignal: TradeSignal = {
              id: ++signalIdCounter.current,
              symbol: pair,
              type: result.signal as "CALL" | "PUT",
              entryTime: result.entryTime,
              confidence: result.confidence,
              outcome: "PENDING",
              timestamp: Date.now(),
            };

            setSignalHistory((prev) => [newSignal, ...prev].slice(0, 50));

            toast(
              `${result.signal === "CALL" ? "📈" : "📉"} ${result.signal} Signal — ${pair}`,
              {
                description: `Entry: ${result.entryTime} PKT | ${result.reason}`,
                duration: 6000,
              }
            );

            setAnalysisStatus(`${result.signal} @ ${result.entryTime}`);
          } else {
            setAnalysisStatus(
              data.length < 500
                ? `Loading... (${data.length}/500)`
                : result.reason.length > 30
                ? "Scanning..."
                : result.reason
            );
          }
        } else {
          setAnalysisStatus(`Loading... (${data.length}/500)`);
        }
      };

      poll();
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [fetchData, playSignalSound]
  );

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setConnectionStatus("disconnected");
    setAnalysisStatus("Stopped");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleToggle = () => {
    if (isRunning) {
      stopPolling();
      setIsRunning(false);
    } else {
      startPolling(selectedPair);
      setIsRunning(true);
    }
  };

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
    if (isRunning) {
      stopPolling();
      setCandles([]);
      setLastSignal(null);
      startPolling(pair);
    }
  };

  const copySignal = (signal: TradeSignal) => {
    const text = `M1;${signal.symbol.replace("-OTC", "")};${signal.entryTime};${signal.type}`;
    navigator.clipboard.writeText(text);
    setCopiedSignal(signal.id);
    setTimeout(() => setCopiedSignal(null), 2000);
  };

  const getStatusColor = () => {
    if (connectionStatus === "connected") return "bg-emerald-500";
    if (connectionStatus === "connecting") return "bg-amber-500 animate-pulse";
    if (connectionStatus === "error") return "bg-red-500";
    return "bg-muted-foreground";
  };

  const getStatusIcon = () => {
    if (connectionStatus === "connected") return <Wifi className="w-3.5 h-3.5 text-emerald-400" />;
    if (connectionStatus === "connecting") return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
    if (connectionStatus === "error") return <WifiOff className="w-3.5 h-3.5 text-red-400" />;
    return <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0a0a0f] text-foreground overflow-hidden">
      {/* Header */}
      <header className="border-b border-border/30 bg-[#0d0d14] shrink-0">
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          {/* Left */}
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                stopPolling();
                setIsRunning(false);
                navigate("/dashboard");
              }}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 shrink-0">
                <Bot className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-foreground truncate">GM LIVE BOT</h1>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {connectionStatus === "connected" ? "LIVE" : connectionStatus === "connecting" ? "CONNECTING" : connectionStatus === "error" ? "ERROR" : "OFFLINE"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20 border border-border/30">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] font-mono font-bold text-foreground">{pktTime}</span>
              <span className="text-[9px] text-muted-foreground">PKT</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${soundEnabled ? "text-indigo-400" : "text-muted-foreground"}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <Volume2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Controls Row */}
        <div className="px-3 pb-2.5 flex items-center gap-2">
          <Select value={selectedPair} onValueChange={handlePairChange}>
            <SelectTrigger className="h-9 flex-1 text-xs font-bold bg-[#12121a] border-border/30 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {PAIRS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs font-medium">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleToggle}
            size="sm"
            className={`h-9 px-4 font-bold text-xs rounded-lg transition-all ${
              isRunning
                ? "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25"
                : "bg-indigo-500 text-white hover:bg-indigo-500/90 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]"
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 mr-1.5" />
                STOP
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                START
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Chart Area */}
        <div className="flex-1 relative min-h-0">
          {/* Chart */}
          <div ref={chartContainerRef} className="absolute inset-0" />

          {/* Price Overlay */}
          {currentPrice && (
            <div className="absolute top-3 left-3 z-10">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d0d14]/90 backdrop-blur-sm border border-border/30">
                <span className="text-lg font-black font-mono text-foreground">
                  {currentPrice.toFixed(currentPrice < 10 ? 5 : 2)}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold">{selectedPair}</span>
              </div>
            </div>
          )}

          {/* Analysis Status Overlay */}
          <div className="absolute bottom-3 left-3 z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d0d14]/90 backdrop-blur-sm border border-border/30">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] font-bold text-muted-foreground">{analysisStatus}</span>
              {candles.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50">{candles.length} candles</span>
              )}
            </div>
          </div>

          {/* Not running overlay */}
          {!isRunning && candles.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0a0f]/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 text-center px-6">
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                  <Bot className="w-10 h-10 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">GM Live Bot</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Historical Twin Engine v8.2 — Select a pair and press START to begin real-time analysis
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Auto-Scan</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 5 Rules</span>
                  <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> 500 Candles</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signal Panel (Right Sidebar) */}
        <div className="lg:w-80 border-t lg:border-t-0 lg:border-l border-border/30 bg-[#0d0d14] flex flex-col shrink-0 max-h-[40vh] lg:max-h-none overflow-hidden">
          {/* Current Signal */}
          <div className="p-3 border-b border-border/20 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Signal</span>
              {getStatusIcon()}
            </div>

            {lastSignal && lastSignal.signal !== "NEUTRAL" ? (
              <div className={`p-3 rounded-xl border ${
                lastSignal.signal === "CALL"
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {lastSignal.signal === "CALL" ? (
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`text-xl font-black ${
                      lastSignal.signal === "CALL" ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {lastSignal.signal}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-foreground">{lastSignal.entryTime}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="px-2 py-1 rounded bg-background/30">
                    <span className="text-muted-foreground">EMA: </span>
                    <span className="text-foreground font-semibold">{lastSignal.indicators.levelStatus}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-background/30">
                    <span className="text-muted-foreground">Mom: </span>
                    <span className="text-foreground font-semibold">{lastSignal.indicators.momentum}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-background/30 col-span-2">
                    <span className="text-muted-foreground">Engine: </span>
                    <span className="text-foreground font-semibold">{lastSignal.indicators.pattern} • {lastSignal.reason}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl border border-border/20 bg-background/20 text-center">
                <span className="text-xs text-muted-foreground">
                  {!isRunning ? "Bot is idle" : lastSignal?.reason || "Scanning for signals..."}
                </span>
              </div>
            )}
          </div>

          {/* Signal History */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Signal History</span>
                <span className="text-[10px] text-muted-foreground">{signalHistory.length} signals</span>
              </div>

              {signalHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground/50">No signals yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {signalHistory.map((sig) => (
                    <div
                      key={sig.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/20 border border-border/10 hover:border-border/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1 rounded ${
                          sig.type === "CALL" ? "bg-emerald-500/15" : "bg-red-500/15"
                        }`}>
                          {sig.type === "CALL" ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono font-bold text-foreground truncate">
                            <span className={sig.type === "CALL" ? "text-emerald-400" : "text-red-400"}>{sig.type}</span>
                            {" "}{sig.entryTime}
                          </p>
                          <p className="text-[9px] text-muted-foreground truncate">{sig.symbol}</p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copySignal(sig)}
                      >
                        {copiedSignal === sig.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Stats */}
          <div className="p-3 border-t border-border/20 shrink-0">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">
                Engine: <span className="text-indigo-400 font-bold">Twin v8.2</span>
              </span>
              <span className="text-muted-foreground">
                Poll: <span className="text-foreground font-bold">{POLL_INTERVAL / 1000}s</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveBot;
