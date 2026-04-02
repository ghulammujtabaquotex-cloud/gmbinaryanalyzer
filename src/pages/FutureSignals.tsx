import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Zap,
  Loader2,
  Clock,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  BarChart3,
  Activity,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { toast } from "sonner";

const PAIRS = [
  "USDPKR-OTC",
  "USDBDT-OTC",
  "USDINR-OTC",
  "BRLUSD-OTC",
  "USDARS-OTC",
  "USDMXN-OTC",
  "EURNZD-OTC",
  "NZDCAD-OTC",
];

interface Signal {
  time: string;
  direction: "CALL" | "PUT";
  confidence: number;
  reason: string;
}

interface BacktestData {
  winRate: string;
  totalTrades: number;
  wins: number;
  losses: number;
  maxConsecutiveLosses: number;
}

interface Result {
  signals: Signal[];
  analysis_summary: string;
  market_bias: string;
  key_levels: { support: string; resistance: string };
  backtest: BacktestData;
  pair: string;
  remaining: number;
  dailyLimit: number;
  generatedAt: string;
  validUntil: string;
  candlesAnalyzed: number;
}

const FutureSignals = () => {
  const navigate = useNavigate();
  const [selectedPair, setSelectedPair] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { canAnalyze, remaining, dailyLimit, isVip, isAdmin, refetch } = useIPUsageTracking();

  // Get current PKT time for defaults
  const getPKTNow = () => {
    const now = new Date();
    const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const h = pkt.getUTCHours();
    const m = pkt.getUTCMinutes();
    return { h, m };
  };

  const handleGenerate = async () => {
    if (!selectedPair) {
      toast.error("Select a currency pair");
      return;
    }
    if (!canAnalyze) {
      toast.error("Daily limit reached. Upgrade to VIP for more.");
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const body: any = { pair: selectedPair };
      if (startTime && endTime) {
        body.startTime = startTime;
        body.endTime = endTime;
      }

      const { data, error } = await supabase.functions.invoke("generate-future-signals", { body });

      if (error) {
        toast.error(error.message || "Generation failed");
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        if (data.limitReached) refetch();
        return;
      }
      if (data?.signals) {
        setResult(data);
        refetch();
        toast.success(`${data.signals.length} signals generated!`);
      }
    } catch {
      toast.error("⚠️ Signal generation failed. Try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatSignalText = (s: Signal, pair: string) =>
    `M1;${pair};${s.time};${s.direction}`;

  const copyAllSignals = () => {
    if (!result) return;
    const text = result.signals.map(s => formatSignalText(s, result.pair)).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success("All signals copied!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copySingleSignal = (i: number) => {
    if (!result) return;
    navigator.clipboard.writeText(formatSignalText(result.signals[i], result.pair));
    setCopiedIndex(i);
    toast.success("Signal copied!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const { h, m } = getPKTNow();
  const defaultStart = `${String(h).padStart(2, '0')}:${String(m + 1 >= 60 ? 0 : m + 1).padStart(2, '0')}`;
  const defaultEnd = `${String((h + 1) % 24).padStart(2, '0')}:${String(m + 1 >= 60 ? 0 : m + 1).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-50 bg-background/90">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Future Signal Generator</h1>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Probability Engine • Backtested
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">DATA-DRIVEN</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-2xl flex-1 space-y-4">
        {/* Control Card */}
        <Card className="border-border/50 bg-gradient-to-b from-card to-card/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500/60 to-amber-500/20" />
          <CardContent className="p-4 space-y-4">
            {/* Pair */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Currency Pair</label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-full h-11 text-sm font-semibold rounded-xl border-border/60 bg-background/60">
                  <SelectValue placeholder="Select pair..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PAIRS.map(p => (
                    <SelectItem key={p} value={p} className="font-medium">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Start Time (PKT)</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  placeholder={defaultStart}
                  className="h-11 rounded-xl bg-background/60 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">End Time (PKT)</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder={defaultEnd}
                  className="h-11 rounded-xl bg-background/60 text-sm font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Leave empty for next 1 hour from now (PKT UTC+5)</p>

            {/* Usage */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isAdmin ? (
                    <span className="text-amber-400 font-semibold">👑 Admin — Unlimited</span>
                  ) : isVip ? (
                    <span className="text-amber-400 font-semibold">♛ VIP — {remaining}/{dailyLimit}</span>
                  ) : (
                    <>{remaining}/{dailyLimit} remaining</>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Shield className="w-3 h-3" />
                30K Candles
              </div>
            </div>

            {/* Generate */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedPair || !canAnalyze}
              size="lg"
              className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500/90 hover:to-orange-500/90 text-black shadow-[0_0_40px_-8px_rgba(245,158,11,0.5)] transition-all"
            >
              {isGenerating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing 30K Candles...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5" />
                  <span>Generate Signals</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Backtest Card */}
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Backtest Results (Out-of-Sample)</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center p-2 rounded-lg bg-background/40">
                    <p className="text-lg font-black text-emerald-400">{result.backtest.winRate}%</p>
                    <p className="text-[9px] text-muted-foreground uppercase">Win Rate</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/40">
                    <p className="text-lg font-black text-foreground">{result.backtest.totalTrades}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">Trades</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/40">
                    <p className="text-lg font-black text-emerald-400">{result.backtest.wins}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">Wins</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-background/40">
                    <p className="text-lg font-black text-red-400">{result.backtest.losses}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">Losses</p>
                  </div>
                </div>
                {result.backtest.maxConsecutiveLosses > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Max consecutive losses: {result.backtest.maxConsecutiveLosses}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Market Analysis */}
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Market Bias</p>
                    <span className={`text-xl font-black ${
                      result.market_bias === "BULLISH" ? "text-emerald-400" :
                      result.market_bias === "BEARISH" ? "text-red-400" : "text-amber-400"
                    }`}>{result.market_bias}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{result.candlesAnalyzed.toLocaleString()} candles analyzed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase">Time Range (PKT)</p>
                    <p className="text-sm font-bold text-foreground">{result.generatedAt} — {result.validUntil}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                    <p className="text-[9px] font-semibold text-emerald-400/70 uppercase flex items-center gap-1">
                      <Target className="w-3 h-3" /> Support
                    </p>
                    <p className="text-sm font-bold text-emerald-400">{result.key_levels.support}</p>
                  </div>
                  <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-2.5">
                    <p className="text-[9px] font-semibold text-red-400/70 uppercase flex items-center gap-1">
                      <Target className="w-3 h-3" /> Resistance
                    </p>
                    <p className="text-sm font-bold text-red-400">{result.key_levels.resistance}</p>
                  </div>
                </div>

                <p className="text-xs text-foreground/70 leading-relaxed">{result.analysis_summary}</p>
              </CardContent>
            </Card>

            {/* Copy All */}
            {result.signals.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-foreground">{result.signals.length} Signals</span>
                </div>
                <Button onClick={copyAllSignals} variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  {copiedAll ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  {copiedAll ? "Copied!" : "Copy All"}
                </Button>
              </div>
            )}

            {/* Signals List */}
            {result.signals.length > 0 ? (
              <Card className="border-border/50 bg-card/80 overflow-hidden">
                <div className="divide-y divide-border/30">
                  {result.signals.map((signal, i) => (
                    <div key={i} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${signal.direction === "CALL" ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
                          {signal.direction === "CALL" ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-mono font-bold text-foreground">
                            M1;{result.pair};{signal.time};
                            <span className={signal.direction === "CALL" ? "text-emerald-400" : "text-red-400"}>
                              {signal.direction}
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold ${
                              signal.confidence >= 75 ? "text-emerald-400" :
                              signal.confidence >= 65 ? "text-amber-400" : "text-muted-foreground"
                            }`}>{signal.confidence}% confidence</span>
                            <span className="text-[9px] text-muted-foreground truncate max-w-[180px]">{signal.reason}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                        onClick={() => copySingleSignal(i)}
                      >
                        {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="border-border/50 bg-card/80">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">No High-Probability Signals Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    The probability engine couldn't find signals meeting the confluence threshold. Try a different pair or time range.
                  </p>
                </CardContent>
              </Card>
            )}

            <p className="text-center text-[9px] text-muted-foreground/60 px-4">
              ⚠️ Signals based on statistical probability analysis. Past performance ≠ future results. Trade responsibly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default FutureSignals;
