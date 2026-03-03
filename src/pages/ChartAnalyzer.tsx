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
  const { canAnalyze, remaining, isVip, limitReached, refetch } = useIPUsageTracking();

  const handleAnalyze = async () => {
    if (!selectedPair) {
      toast.error("Please select a currency pair");
      return;
    }
    if (!canAnalyze && !isVip) {
      toast.error("Daily analysis limit reached. Upgrade to VIP for unlimited access.");
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
        return;
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
        // Only count usage for CALL/PUT signals
        if (data.analysis.signal !== "NEUTRAL") {
          refetch();
        }
      }
    } catch (e) {
      toast.error("⚠️ Analysis unavailable - AI API not responding.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSignalColor = (signal: string) => {
    if (signal === "CALL") return "text-emerald-400";
    if (signal === "PUT") return "text-red-400";
    return "text-yellow-400";
  };

  const getSignalIcon = (signal: string) => {
    if (signal === "CALL") return <TrendingUp className="w-8 h-8" />;
    if (signal === "PUT") return <TrendingDown className="w-8 h-8" />;
    return <Minus className="w-8 h-8" />;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 76) return "text-emerald-400";
    if (confidence >= 60) return "text-yellow-400";
    return "text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Chart AI Analyzer</h1>
              <p className="text-xs text-muted-foreground">
                AI-Powered Market Analysis
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl flex-1 space-y-6">
        {/* Pair Selection & Analyze */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Select Currency Pair</label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a pair..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair}>
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isVip ? (
                  <span className="text-primary font-medium">♛ VIP — Unlimited</span>
                ) : (
                  `${remaining} analyses remaining today`
                )}
              </span>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !selectedPair || (limitReached && !isVip)}
              variant="analyze"
              size="lg"
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Analyzing Market Data...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Analyze {selectedPair ? selectedPair.replace("_otc", " OTC") : "Pair"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Result */}
        {analysis && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Signal Card */}
            <Card className={`border-2 ${
              analysis.signal === "CALL" ? "border-emerald-500/50 bg-emerald-500/5" :
              analysis.signal === "PUT" ? "border-red-500/50 bg-red-500/5" :
              "border-yellow-500/50 bg-yellow-500/5"
            }`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Signal</p>
                    <div className={`text-4xl font-black ${getSignalColor(analysis.signal)}`}>
                      {analysis.signal}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedPair.replace("_otc", " OTC")}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className={`text-5xl font-black ${getConfidenceColor(analysis.confidence)}`}>
                      {analysis.confidence}%
                    </div>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Technical Details */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Technical Indicators
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Trend</p>
                    <p className="font-semibold text-foreground">{analysis.trend}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">EMA Status</p>
                    <p className="font-semibold text-foreground capitalize">{analysis.ema_status}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">RSI ({analysis.rsi_value})</p>
                    <p className="font-semibold text-foreground capitalize">{analysis.rsi_status}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">MACD</p>
                    <p className="font-semibold text-foreground capitalize">{analysis.macd_status}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3" /> Support
                    </p>
                    <p className="font-semibold text-emerald-400">{analysis.support_zone}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3" /> Resistance
                    </p>
                    <p className="font-semibold text-red-400">{analysis.resistance_zone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Patterns */}
            {analysis.patterns_detected?.length > 0 && (
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Patterns Detected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analysis.patterns_detected.map((p, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {p}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Explanation */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.explanation}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChartAnalyzer;
