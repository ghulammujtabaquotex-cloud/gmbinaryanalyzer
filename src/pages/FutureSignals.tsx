import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Sparkles,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { toast } from "sonner";

const PAIRS = [
  "EURUSD-OTC", "EURGBP-OTC", "EURJPY-OTC", "EURCAD-OTC", "EURAUD-OTC", "EURCHF-OTC", "EURNZD-OTC",
  "GBPUSD-OTC", "GBPJPY-OTC", "GBPCAD-OTC", "GBPAUD-OTC", "GBPCHF-OTC", "GBPNZD-OTC",
  "USDJPY-OTC", "USDCAD-OTC", "USDCHF-OTC",
  "AUDUSD-OTC", "AUDCAD-OTC", "AUDJPY-OTC", "AUDCHF-OTC", "AUDNZD-OTC",
  "NZDUSD-OTC", "NZDJPY-OTC", "NZDCAD-OTC", "NZDCHF-OTC",
  "CADJPY-OTC", "CADCHF-OTC", "CHFJPY-OTC",
  "BRLUSD-OTC",
  "USDEGP-OTC", "USDPKR-OTC", "USDARS-OTC", "USDBDT-OTC",
];

interface FutureSignal {
  time: string;
  direction: "CALL" | "PUT";
  confidence: number;
}

interface FutureSignalsResult {
  signals: FutureSignal[];
  analysis_summary: string;
  market_bias: "BULLISH" | "BEARISH" | "MIXED";
  key_levels: { support: string; resistance: string };
  pair: string;
  remaining: number;
  dailyLimit: number;
  generatedAt: string;
  validUntil: string;
}

const FutureSignals = () => {
  const navigate = useNavigate();
  const [selectedPair, setSelectedPair] = useState("");
  const [result, setResult] = useState<FutureSignalsResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { canAnalyze, remaining, dailyLimit, isVip, isAdmin, refetch } = useIPUsageTracking();

  const handleGenerate = async () => {
    if (!selectedPair) {
      toast.error("Please select a currency pair");
      return;
    }
    if (!canAnalyze) {
      toast.error("Daily limit reached. Upgrade to VIP for more.");
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-future-signals", {
        body: { pair: selectedPair },
      });

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

  const formatSignalText = (signal: FutureSignal, pair: string) => {
    return `M1;${pair.replace("-OTC", "")};${signal.time};${signal.direction}`;
  };

  const copyAllSignals = () => {
    if (!result) return;
    const text = result.signals.map(s => formatSignalText(s, result.pair)).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success("All signals copied!");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copySingleSignal = (index: number) => {
    if (!result) return;
    const text = formatSignalText(result.signals[index], result.pair);
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Signal copied!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-50 bg-background/90">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-xl">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground tracking-tight">Future Signals</h1>
                <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
                  AI Signal Generator
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">PRO</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl flex-1 space-y-5">
        {/* Control Card */}
        <Card className="border-border/50 bg-gradient-to-b from-card to-card/50 backdrop-blur-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-500/60 to-amber-500/20" />
          <CardContent className="p-5 space-y-5">
            {/* Pair Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency Pair</label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-full h-12 text-base font-semibold rounded-xl border-border/60 bg-background/60">
                  <SelectValue placeholder="Select a pair..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair} className="font-medium">
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Usage Info */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isAdmin ? (
                    <span className="text-amber-400 font-semibold">👑 Admin — Unlimited</span>
                  ) : isVip ? (
                    <span className="text-amber-400 font-semibold">♛ VIP — {remaining} / {dailyLimit}</span>
                  ) : (
                    <>{remaining} / {dailyLimit} remaining</>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Shield className="w-3 h-3" />
                Deep Analysis
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedPair || !canAnalyze}
              size="lg"
              className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-500/90 hover:to-orange-500/90 text-black shadow-[0_0_40px_-8px_rgba(245,158,11,0.5)] transition-all duration-300"
            >
              {isGenerating ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Generating Signals...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5" />
                  <span>Generate Future Signals</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Summary Card */}
            <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Market Analysis</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black ${
                        result.market_bias === "BULLISH" ? "text-emerald-400" :
                        result.market_bias === "BEARISH" ? "text-red-400" : "text-amber-400"
                      }`}>
                        {result.market_bias}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{selectedPair}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase">Valid</p>
                    <p className="text-sm font-bold text-foreground">{result.generatedAt} — {result.validUntil}</p>
                    <p className="text-[10px] text-muted-foreground">PKT (UTC+5)</p>
                  </div>
                </div>

                {/* Key Levels */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1">
                    <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3" /> Support
                    </p>
                    <p className="text-sm font-bold text-emerald-400">{result.key_levels.support}</p>
                  </div>
                  <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 space-y-1">
                    <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3" /> Resistance
                    </p>
                    <p className="text-sm font-bold text-red-400">{result.key_levels.resistance}</p>
                  </div>
                </div>

                <p className="text-sm text-foreground/70 leading-relaxed">{result.analysis_summary}</p>
              </CardContent>
            </Card>

            {/* Copy All Button */}
            <div className="flex justify-end">
              <Button
                onClick={copyAllSignals}
                variant="outline"
                size="sm"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                {copiedAll ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedAll ? "Copied!" : "Copy All Signals"}
              </Button>
            </div>

            {/* Signals List */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
              <div className="divide-y divide-border/30">
                {result.signals.map((signal, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        signal.direction === "CALL" ? "bg-emerald-500/15" : "bg-red-500/15"
                      }`}>
                        {signal.direction === "CALL" ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-mono font-bold text-foreground">
                          M1;{selectedPair.replace("-OTC", "")};{signal.time};
                          <span className={signal.direction === "CALL" ? "text-emerald-400" : "text-red-400"}>
                            {signal.direction}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Confidence: <span className={`font-semibold ${
                            signal.confidence >= 80 ? "text-emerald-400" :
                            signal.confidence >= 70 ? "text-amber-400" : "text-muted-foreground"
                          }`}>{signal.confidence}%</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                      onClick={() => copySingleSignal(index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Disclaimer */}
            <p className="text-center text-[10px] text-muted-foreground/60 px-4">
              ⚠️ Trading signals are for educational purposes only. Past performance does not guarantee future results.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default FutureSignals;
