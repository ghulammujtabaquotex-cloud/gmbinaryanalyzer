import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  
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
  Clock,
  Crosshair,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { usePublicAccess } from "@/hooks/usePublicAccess";
import AccessGate from "@/components/AccessGate";
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
  const { enabled: publicAccess, isLoading: accessLoading } = usePublicAccess();

  // Gate: when public access is OFF, only VIP & Admin can use the tool
  if (!accessLoading && !publicAccess && !isVip && !isAdmin) {
    return <AccessGate toolName="Future Signals" />;
  }

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
  const progressPercent = isGenerating ? ((currentPairIdx + 1) / selectedPairs.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl h-9 w-9 hover:bg-accent">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                    <Crosshair className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <h1 className="text-base font-bold text-foreground">Future Signals</h1>
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Probability Engine • M1</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Activity className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {isAdmin ? "ADMIN" : isVip ? "VIP" : "FREE"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-2xl flex-1 space-y-5">
        {/* Pair Selection Card */}
        <div className="rounded-2xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden">
          {/* Top accent line */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

          <div className="p-4 space-y-4">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Select Pairs</span>
                {selectedPairs.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {selectedPairs.length} selected
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-[10px] h-7 px-3 text-primary hover:text-primary hover:bg-primary/10 font-semibold"
              >
                {selectedPairs.length === PAIRS.length ? "Clear All" : "Select All"}
              </Button>
            </div>

            {/* Pair Grid */}
            <div className="grid grid-cols-2 gap-2">
              {PAIRS.map(pair => {
                const selected = selectedPairs.includes(pair);
                return (
                  <button
                    key={pair}
                    onClick={() => togglePair(pair)}
                    className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-300 group ${
                      selected
                        ? "border-primary/40 bg-primary/[0.06] shadow-[0_0_20px_-8px_hsl(var(--primary)/0.3)]"
                        : "border-border/30 bg-background/50 hover:border-border/50 hover:bg-accent/30"
                    }`}
                  >
                    <Checkbox
                      checked={selected}
                      className="pointer-events-none data-[state=checked]:bg-primary data-[state=checked]:border-primary border-muted-foreground/30"
                    />
                    <span className={`text-xs font-semibold tracking-wide transition-colors ${
                      selected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    }`}>
                      {pair}
                    </span>
                    {selected && (
                      <div className="absolute top-1 right-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Usage Info */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {isAdmin ? (
                  <span className="text-primary font-semibold">👑 Unlimited</span>
                ) : isVip ? (
                  <span className="text-primary font-semibold">♛ {remaining}/{dailyLimit}</span>
                ) : (
                  <span>{remaining}/{dailyLimit} remaining</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Shield className="w-3 h-3" />
                30K candles deep analysis
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedPairs.length === 0 || !canAnalyze}
              className="w-full h-12 text-sm font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)] transition-all disabled:opacity-30 disabled:shadow-none"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing {selectedPairs[currentPairIdx]} ({currentPairIdx + 1}/{selectedPairs.length})</span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Generate {selectedPairs.length > 0 ? `${selectedPairs.length} Pair${selectedPairs.length > 1 ? "s" : ""}` : "Signals"}
                  </span>
                </div>
              )}
            </Button>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-1.5">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Processing 30,000 candles for {selectedPairs[currentPairIdx]}...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Header */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/15">
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{totalSignals} Total Signals</p>
                    <p className="text-[10px] text-muted-foreground">{results.length} pair{results.length > 1 ? "s" : ""} analyzed</p>
                  </div>
                </div>
                {totalSignals > 0 && (
                  <Button
                    onClick={copyAllSignals}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    {copiedAll === "ALL" ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                    {copiedAll === "ALL" ? "Copied!" : "Copy All"}
                  </Button>
                )}
              </div>
            </div>

            {/* Per-Pair Results */}
            {results.map((result) => {
              const isExpanded = expandedPair === result.pair;
              const biasIcon = result.market_bias === "BULLISH"
                ? <TrendingUp className="w-3 h-3" />
                : result.market_bias === "BEARISH"
                ? <TrendingDown className="w-3 h-3" />
                : <Activity className="w-3 h-3" />;
              const biasColor = result.market_bias === "BULLISH"
                ? "text-emerald-400 bg-emerald-500/10"
                : result.market_bias === "BEARISH"
                ? "text-red-400 bg-red-500/10"
                : "text-amber-400 bg-amber-500/10";

              return (
                <div key={result.pair} className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden transition-all duration-300">
                  {/* Pair Header */}
                  <button
                    onClick={() => setExpandedPair(isExpanded ? null : result.pair)}
                    className="w-full p-4 flex items-center justify-between hover:bg-accent/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/15">
                        <Target className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">{result.pair}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${biasColor}`}>
                            {biasIcon}
                            {result.market_bias}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{result.signals.length} signals</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-400">{result.backtest.winRate}%</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-border/20 animate-in fade-in slide-in-from-top-2 duration-300">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 divide-x divide-border/20 border-b border-border/20">
                        {[
                          { label: "Win Rate", value: `${result.backtest.winRate}%`, color: "text-emerald-400" },
                          { label: "Trades", value: result.backtest.totalTrades, color: "text-foreground" },
                          { label: "Wins", value: result.backtest.wins, color: "text-emerald-400" },
                          { label: "Losses", value: result.backtest.losses, color: "text-red-400" },
                        ].map(stat => (
                          <div key={stat.label} className="p-3 text-center">
                            <p className={`text-base font-black ${stat.color}`}>{stat.value}</p>
                            <p className="text-[8px] text-muted-foreground uppercase tracking-widest mt-0.5">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* S/R Levels + Meta */}
                      <div className="p-3.5 space-y-2.5 border-b border-border/20">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15 p-2.5">
                            <p className="text-[8px] font-bold text-emerald-400/50 uppercase tracking-widest">Support</p>
                            <p className="text-sm font-bold text-emerald-400 mt-0.5">{result.key_levels.support}</p>
                          </div>
                          <div className="rounded-xl bg-red-500/[0.04] border border-red-500/15 p-2.5">
                            <p className="text-[8px] font-bold text-red-400/50 uppercase tracking-widest">Resistance</p>
                            <p className="text-sm font-bold text-red-400 mt-0.5">{result.key_levels.resistance}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-3 h-3 text-primary" />
                            {result.candlesAnalyzed.toLocaleString()} candles
                          </div>
                          <span className="text-muted-foreground/50">{result.generatedAt} – {result.validUntil}</span>
                          {result.backtest.maxConsecutiveLosses > 0 && (
                            <span className="text-amber-400 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Max loss streak: {result.backtest.maxConsecutiveLosses}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Copy pair signals */}
                      {result.signals.length > 0 && (
                        <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/20 bg-muted/[0.03]">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {result.signals.length} Signals
                          </span>
                          <Button
                            onClick={() => copyAllForPair(result)}
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-primary hover:bg-primary/10 font-semibold"
                          >
                            {copiedAll === result.pair ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                            {copiedAll === result.pair ? "Copied!" : "Copy All"}
                          </Button>
                        </div>
                      )}

                      {/* Signals List */}
                      {result.signals.length > 0 ? (
                        <div className="divide-y divide-border/10 max-h-80 overflow-y-auto">
                          {result.signals.map((signal, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/10 transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  signal.direction === "CALL"
                                    ? "bg-emerald-500/10 border border-emerald-500/20"
                                    : "bg-red-500/10 border border-red-500/20"
                                }`}>
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
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                      signal.confidence >= 75
                                        ? "text-emerald-400 bg-emerald-500/10"
                                        : signal.confidence >= 65
                                        ? "text-amber-400 bg-amber-500/10"
                                        : "text-muted-foreground bg-muted/30"
                                    }`}>
                                      {signal.confidence}%
                                    </span>
                                    <span className="text-[9px] text-muted-foreground/60 truncate max-w-[150px]">
                                      {signal.reason}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-primary/10"
                                onClick={() => copySingle(result.pair, i, signal)}
                              >
                                {copiedIndex === `${result.pair}-${i}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center">
                          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-foreground">No high-confidence signals</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Below confluence threshold for this pair</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-center text-[9px] text-muted-foreground/40 px-4 pb-4">
              ⚠️ Statistical probability analysis. Past performance ≠ future results. Trade responsibly.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default FutureSignals;
