import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Zap,
  Loader2,
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
  Layers,
  Clock,
  Crosshair,
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

interface PairResult {
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
  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [results, setResults] = useState<PairResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPairIdx, setCurrentPairIdx] = useState(0);
  const [copiedAll, setCopiedAll] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const { canAnalyze, remaining, dailyLimit, isVip, isAdmin, refetch } = useIPUsageTracking();

  const togglePair = (pair: string) => {
    setSelectedPairs(prev =>
      prev.includes(pair) ? prev.filter(p => p !== pair) : [...prev, pair]
    );
  };

  const selectAll = () => {
    setSelectedPairs(prev => prev.length === PAIRS.length ? [] : [...PAIRS]);
  };

  const handleGenerate = async () => {
    if (selectedPairs.length === 0) {
      toast.error("Select at least one pair");
      return;
    }
    if (!canAnalyze) {
      toast.error("Daily limit reached. Upgrade to VIP for more.");
      return;
    }

    setIsGenerating(true);
    setResults([]);
    const allResults: PairResult[] = [];

    for (let i = 0; i < selectedPairs.length; i++) {
      const pair = selectedPairs[i];
      setCurrentPairIdx(i);

      try {
        const { data, error } = await supabase.functions.invoke("generate-future-signals", {
          body: { pair },
        });

        if (error) {
          toast.error(`${pair}: ${error.message || "Failed"}`);
          continue;
        }
        if (data?.error) {
          toast.error(`${pair}: ${data.error}`);
          if (data.limitReached) { refetch(); break; }
          continue;
        }
        if (data?.signals) {
          allResults.push(data);
        }
      } catch {
        toast.error(`${pair}: Generation failed`);
      }
    }

    setResults(allResults);
    refetch();
    if (allResults.length > 0) {
      setExpandedPair(allResults[0].pair);
      const totalSignals = allResults.reduce((s, r) => s + r.signals.length, 0);
      toast.success(`${totalSignals} signals across ${allResults.length} pairs!`);
    }
    setIsGenerating(false);
  };

  const formatSignalText = (s: Signal, pair: string) => `M1;${pair};${s.time};${s.direction}`;

  const copyAllForPair = (result: PairResult) => {
    const text = result.signals.map(s => formatSignalText(s, result.pair)).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(result.pair);
    toast.success(`${result.pair} signals copied!`);
    setTimeout(() => setCopiedAll(null), 2000);
  };

  const copyAllSignals = () => {
    const text = results.flatMap(r => r.signals.map(s => formatSignalText(s, r.pair))).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll("ALL");
    toast.success("All signals copied!");
    setTimeout(() => setCopiedAll(null), 2000);
  };

  const copySingle = (pair: string, i: number, signal: Signal) => {
    navigator.clipboard.writeText(formatSignalText(signal, pair));
    setCopiedIndex(`${pair}-${i}`);
    toast.success("Signal copied!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const totalSignals = results.reduce((s, r) => s + r.signals.length, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-xl sticky top-0 z-50 bg-background/95">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 border border-violet-500/20">
                  <Crosshair className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground tracking-tight">Probability Engine</h1>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    Next 1H • Multi-Pair • Backtested
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
              <Activity className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                {isAdmin ? "ADMIN" : isVip ? "VIP" : "FREE"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-2xl flex-1 space-y-4">
        {/* Pair Selection */}
        <Card className="border-border/40 bg-card/80 overflow-hidden">
          <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500/20" />
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Select Pairs</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-[10px] h-7 px-2.5 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
              >
                {selectedPairs.length === PAIRS.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PAIRS.map(pair => {
                const selected = selectedPairs.includes(pair);
                return (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-200 ${
                      selected
                        ? "border-violet-500/50 bg-violet-500/10 shadow-[0_0_12px_-4px_rgba(139,92,246,0.3)]"
                        : "border-border/40 bg-background/40 hover:border-border/60 hover:bg-muted/20"
                    }`}
                  >
                    <Checkbox checked={selected} className="pointer-events-none data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500" />
                    <span className={`text-xs font-semibold tracking-wide ${selected ? "text-violet-300" : "text-muted-foreground"}`}>
                      {pair}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Usage & Generate */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {isAdmin ? (
                  <span className="text-violet-400 font-semibold">👑 Unlimited</span>
                ) : isVip ? (
                  <span className="text-violet-400 font-semibold">♛ {remaining}/{dailyLimit}</span>
                ) : (
                  <span>{remaining}/{dailyLimit} left</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Shield className="w-3 h-3" />
                30K Candles / Pair
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedPairs.length === 0 || !canAnalyze}
              className="w-full h-12 text-sm font-bold rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-[0_0_30px_-6px_rgba(139,92,246,0.5)] transition-all disabled:opacity-40"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing {selectedPairs[currentPairIdx]} ({currentPairIdx + 1}/{selectedPairs.length})...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4" />
                  <span>Generate {selectedPairs.length > 0 ? `(${selectedPairs.length} pair${selectedPairs.length > 1 ? "s" : ""})` : "Signals"}</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-foreground">
                  {totalSignals} Signals • {results.length} Pair{results.length > 1 ? "s" : ""}
                </span>
              </div>
              {totalSignals > 0 && (
                <Button onClick={copyAllSignals} variant="outline" size="sm" className="h-7 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
                  {copiedAll === "ALL" ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedAll === "ALL" ? "Copied!" : "Copy All"}
                </Button>
              )}
            </div>

            {/* Per-Pair Results */}
            {results.map((result) => {
              const isExpanded = expandedPair === result.pair;
              const biasColor = result.market_bias === "BULLISH" ? "text-emerald-400" : result.market_bias === "BEARISH" ? "text-red-400" : "text-amber-400";

              return (
                <Card key={result.pair} className="border-border/40 bg-card/80 overflow-hidden">
                  {/* Pair Header - clickable */}
                  <button
                    onClick={() => setExpandedPair(isExpanded ? null : result.pair)}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 flex items-center justify-center border border-violet-500/20">
                        <Target className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">{result.pair}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold ${biasColor}`}>{result.market_bias}</span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground">{result.signals.length} signals</span>
                          <span className="text-[10px] text-muted-foreground">•</span>
                          <span className="text-[10px] text-muted-foreground">{result.generatedAt}–{result.validUntil}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-1">
                        <p className="text-xs font-bold text-emerald-400">{result.backtest.winRate}%</p>
                        <p className="text-[9px] text-muted-foreground">win rate</p>
                      </div>
                      <svg className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-border/30 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Stats Row */}
                      <div className="grid grid-cols-4 gap-px bg-border/20 border-b border-border/30">
                        {[
                          { label: "Win Rate", value: `${result.backtest.winRate}%`, color: "text-emerald-400" },
                          { label: "Trades", value: result.backtest.totalTrades, color: "text-foreground" },
                          { label: "Wins", value: result.backtest.wins, color: "text-emerald-400" },
                          { label: "Losses", value: result.backtest.losses, color: "text-red-400" },
                        ].map(stat => (
                          <div key={stat.label} className="bg-card p-2.5 text-center">
                            <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                            <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* S/R + Info */}
                      <div className="p-3 space-y-2 border-b border-border/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-2">
                            <p className="text-[8px] font-bold text-emerald-400/60 uppercase">Support</p>
                            <p className="text-xs font-bold text-emerald-400">{result.key_levels.support}</p>
                          </div>
                          <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-2">
                            <p className="text-[8px] font-bold text-red-400/60 uppercase">Resistance</p>
                            <p className="text-xs font-bold text-red-400">{result.key_levels.resistance}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Trophy className="w-3 h-3 text-violet-400" />
                          {result.candlesAnalyzed.toLocaleString()} candles analyzed
                          {result.backtest.maxConsecutiveLosses > 0 && (
                            <span className="ml-2 text-amber-400">
                              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                              Max consec. loss: {result.backtest.maxConsecutiveLosses}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Copy for this pair */}
                      {result.signals.length > 0 && (
                        <div className="px-3 py-2 flex items-center justify-between border-b border-border/30">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">{result.signals.length} Signals</span>
                          <Button onClick={() => copyAllForPair(result)} variant="ghost" size="sm" className="h-6 text-[10px] text-violet-400 hover:bg-violet-500/10">
                            {copiedAll === result.pair ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                            {copiedAll === result.pair ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      )}

                      {/* Signals List */}
                      {result.signals.length > 0 ? (
                        <div className="divide-y divide-border/20 max-h-80 overflow-y-auto">
                          {result.signals.map((signal, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-muted/5 transition-colors group">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${signal.direction === "CALL" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                                  {signal.direction === "CALL" ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-mono font-bold text-foreground">
                                    M1;{result.pair};{signal.time};
                                    <span className={signal.direction === "CALL" ? "text-emerald-400" : "text-red-400"}>
                                      {signal.direction}
                                    </span>
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-bold ${
                                      signal.confidence >= 75 ? "text-emerald-400" :
                                      signal.confidence >= 65 ? "text-amber-400" : "text-muted-foreground"
                                    }`}>{signal.confidence}%</span>
                                    <span className="text-[8px] text-muted-foreground truncate max-w-[160px]">{signal.reason}</span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                onClick={() => copySingle(result.pair, i, signal)}
                              >
                                {copiedIndex === `${result.pair}-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-1.5" />
                          <p className="text-xs font-semibold text-foreground">No signals found</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Below confluence threshold for this pair.</p>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}

            <p className="text-center text-[9px] text-muted-foreground/50 px-4">
              ⚠️ Statistical probability analysis. Past performance ≠ future results. Trade responsibly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default FutureSignals;
