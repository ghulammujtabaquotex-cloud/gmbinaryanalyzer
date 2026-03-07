import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ShieldCheck,
  Activity,
  Target,
  Sparkles,
  Clock,
  Cpu,
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

interface AnalysisResult {
  signal: "CALL" | "PUT" | "NEUTRAL";
  confidence: number;
  trend: string;
  patterns_detected: string[];
  support_zone: string;
  resistance_zone: string;
  ema_status: string;
  rsi_value: number;
  rsi_status: string;
  macd_status: string;
  explanation: string;
}

const ChartAnalyzer = () => {
  const navigate = useNavigate();
  const [selectedPair, setSelectedPair] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { canAnalyze, remaining, dailyLimit, isVip, isAdmin, limitReached, refetch } = useIPUsageTracking();

  const handleAnalyze = async () => {
    if (!selectedPair) {
      toast.error("Please select a currency pair");
      return;
    }
    if (!canAnalyze) {
      toast.error("Daily analysis limit reached. Upgrade to VIP for more access.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-chart", {
        body: { pair: selectedPair },
      });

      if (error) {
        toast.error(error.message || "Analysis failed");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        if (data.limitReached) refetch();
        return;
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        // Always refetch usage after successful analysis since backend incremented it
        refetch();
      }
    } catch (e) {
      toast.error("⚠️ Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSignalColor = (signal: string) => {
    if (signal === "CALL") return "text-emerald-400";
    if (signal === "PUT") return "text-red-400";
    return "text-yellow-400";
  };

  const getSignalBg = (signal: string) => {
    if (signal === "CALL") return "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40";
    if (signal === "PUT") return "from-red-500/20 to-red-500/5 border-red-500/40";
    return "from-yellow-500/20 to-yellow-500/5 border-yellow-500/40";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 76) return "text-emerald-400";
    if (confidence >= 60) return "text-yellow-400";
    return "text-muted-foreground";
  };

  const getConfidenceBar = (confidence: number) => {
    if (confidence >= 76) return "bg-emerald-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-muted-foreground";
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
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Cpu className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground tracking-tight">GM Chart AI</h1>
                <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">
                  Technical Analysis Engine
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl flex-1 space-y-5">
        {/* Analysis Control Card */}
        <Card className="border-border/50 bg-gradient-to-b from-card to-card/50 backdrop-blur-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-primary/20" />
          <CardContent className="p-5 space-y-5">
            {/* Pair Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currency Pair</label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-full h-12 text-base font-semibold rounded-xl border-border/60 bg-background/60">
                  <SelectValue placeholder="Select a pair to analyze..." />
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
                    <span className="text-primary font-semibold">👑 Admin — Unlimited</span>
                  ) : isVip ? (
                    <span className="text-primary font-semibold">♛ VIP — {remaining} / {dailyLimit}</span>
                  ) : (
                    <>{remaining} / {dailyLimit} remaining</>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Market Open
              </div>
            </div>

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !selectedPair || (!canAnalyze)}
              size="lg"
              className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] transition-all duration-300"
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing {selectedPair}...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5" />
                  <span>Analyze {selectedPair || "Pair"}</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Result */}
        {analysis && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
            {/* Signal Hero Card */}
            <Card className={`border-2 bg-gradient-to-br ${getSignalBg(analysis.signal)} overflow-hidden`}>
              <CardContent className="p-0">
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Signal Result</p>
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                          analysis.signal === "CALL" ? "bg-emerald-500/20" :
                          analysis.signal === "PUT" ? "bg-red-500/20" : "bg-yellow-500/20"
                        }`}>
                          {analysis.signal === "CALL" ? <TrendingUp className="w-7 h-7 text-emerald-400" /> :
                           analysis.signal === "PUT" ? <TrendingDown className="w-7 h-7 text-red-400" /> :
                           <Minus className="w-7 h-7 text-yellow-400" />}
                        </div>
                        <div>
                          <div className={`text-4xl font-black tracking-tight ${getSignalColor(analysis.signal)}`}>
                            {analysis.signal}
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">{selectedPair}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className={`text-5xl font-black tracking-tighter ${getConfidenceColor(analysis.confidence)}`}>
                        {analysis.confidence}%
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Confidence</p>
                      <div className="w-24 h-2 rounded-full bg-muted/30 overflow-hidden ml-auto">
                        <div 
                          className={`h-full rounded-full ${getConfidenceBar(analysis.confidence)} transition-all duration-1000`} 
                          style={{ width: `${analysis.confidence}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Trend Banner */}
                <div className="px-6 py-3 bg-background/40 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">TREND</span>
                  <span className={`text-sm font-bold ${
                    analysis.trend === "BULLISH" ? "text-emerald-400" :
                    analysis.trend === "BEARISH" ? "text-red-400" : "text-muted-foreground"
                  }`}>{analysis.trend}</span>
                </div>
              </CardContent>
            </Card>

            {/* Technical Indicators Grid */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                  <Activity className="w-4 h-4 text-primary" />
                  Technical Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">EMA Cross</p>
                    <p className={`text-sm font-bold capitalize ${
                      analysis.ema_status === "bullish" ? "text-emerald-400" :
                      analysis.ema_status === "bearish" ? "text-red-400" : "text-muted-foreground"
                    }`}>{analysis.ema_status}</p>
                  </div>
                  <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">RSI (14)</p>
                    <p className={`text-sm font-bold ${
                      analysis.rsi_status === "oversold" ? "text-emerald-400" :
                      analysis.rsi_status === "overbought" ? "text-red-400" : "text-muted-foreground"
                    }`}>{analysis.rsi_value} — <span className="capitalize">{analysis.rsi_status}</span></p>
                  </div>
                  <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">MACD</p>
                    <p className={`text-sm font-bold capitalize ${
                      analysis.macd_status === "bullish" ? "text-emerald-400" :
                      analysis.macd_status === "bearish" ? "text-red-400" : "text-muted-foreground"
                    }`}>{analysis.macd_status}</p>
                  </div>
                  <div className="rounded-xl bg-muted/20 border border-border/30 p-3.5 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Momentum</p>
                    <p className="text-sm font-bold text-foreground">{analysis.trend === "SIDEWAYS" ? "Weak" : "Active"}</p>
                  </div>
                </div>

                {/* S/R Levels */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3.5 space-y-1">
                    <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3" /> Support
                    </p>
                    <p className="text-sm font-bold text-emerald-400">{analysis.support_zone}</p>
                  </div>
                  <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3.5 space-y-1">
                    <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3 h-3" /> Resistance
                    </p>
                    <p className="text-sm font-bold text-red-400">{analysis.resistance_zone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patterns */}
            {analysis.patterns_detected?.length > 0 && (
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-2 px-5 pt-5">
                  <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Patterns Detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <div className="flex flex-wrap gap-2">
                    {analysis.patterns_detected.map((p, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                        {p}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Explanation */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Analysis Summary</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{analysis.explanation}</p>
              </CardContent>
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

export default ChartAnalyzer;
