import { SignalBadge } from "./SignalBadge";
import { TrendingUp, TrendingDown, Activity, Target, Shield, FileText, AlertTriangle, Crown, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnalysisData {
  pair: string;
  trend: "Uptrend" | "Downtrend" | "Range";
  signal: "CALL" | "PUT" | "NEUTRAL";
  supportZone: string;
  resistanceZone: string;
  explanation: string;
  winProbability?: number; // 0-100%
  isVip?: boolean;
  signalHistoryId?: string;
}

interface AnalysisResultsProps {
  data: AnalysisData;
  isVip?: boolean;
}

function ResultCard({ 
  icon: Icon, 
  label, 
  value, 
  className,
  delay = 0 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div 
      className={cn(
        "p-4 rounded-xl glass-card gradient-border opacity-0 animate-slide-up",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-foreground font-semibold">{value}</div>
    </div>
  );
}

// Extract win probability from explanation if present
function extractWinProbability(explanation: string): number | null {
  const match = explanation.match(/Win probability:\s*(\d+)%/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Fallback to old confidence format and convert
  const confMatch = explanation.match(/Confidence:\s*(\d+)\/10/i);
  if (confMatch) {
    return parseInt(confMatch[1], 10) * 10;
  }
  return null;
}

function WinProbabilityGauge({ probability }: { probability: number }) {
  const getColor = () => {
    if (probability >= 80) return "text-success";
    if (probability >= 70) return "text-primary";
    if (probability >= 60) return "text-warning";
    return "text-destructive";
  };

  const getBgColor = () => {
    if (probability >= 80) return "bg-success";
    if (probability >= 70) return "bg-primary";
    if (probability >= 60) return "bg-warning";
    return "bg-destructive";
  };

  const getLabel = () => {
    if (probability >= 85) return "Very High";
    if (probability >= 75) return "High";
    if (probability >= 65) return "Good";
    if (probability >= 55) return "Moderate";
    return "Low";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn("text-2xl font-bold", getColor())}>{probability}%</span>
        <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-muted">
          {getLabel()}
        </span>
      </div>
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", getBgColor())}
          style={{ width: `${probability}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Probability of next candle going in signal direction
      </p>
    </div>
  );
}

export function AnalysisResults({ data, isVip = false }: AnalysisResultsProps) {
  const TrendIcon = data.trend === "Uptrend" ? TrendingUp : data.trend === "Downtrend" ? TrendingDown : Activity;
  const trendColor = data.trend === "Uptrend" ? "text-success" : data.trend === "Downtrend" ? "text-destructive" : "text-warning";
  const isTradeSignal = data.signal === "CALL" || data.signal === "PUT";

  // Get win probability
  const winProbability = data.winProbability || extractWinProbability(data.explanation);

  return (
    <div className="space-y-4">
      {/* VIP Badge */}
      {isVip && (
        <div 
          className="flex items-center justify-center gap-2 p-2 rounded-lg bg-primary/20 border border-primary/30 opacity-0 animate-fade-in"
          style={{ animationDelay: "0ms" }}
        >
          <Crown className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">VIP Premium Analysis</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Signal - Featured prominently */}
        <div 
          className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up"
          style={{ animationDelay: "0ms" }}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Next Candle Bias</p>
          <SignalBadge signal={data.signal} size="lg" />
          <p className="text-xs text-muted-foreground mt-3">
            Based on advanced price action analysis
          </p>
          
          {/* Win Probability - Show for ALL users when signal is CALL/PUT */}
          {isTradeSignal && winProbability && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 mb-3 text-muted-foreground">
                <Percent className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Win Probability</span>
              </div>
              <WinProbabilityGauge probability={winProbability} />
            </div>
          )}
          
          {/* MTG line - only for CALL/PUT signals */}
          {isTradeSignal && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 text-warning">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm font-medium">Optional: 1 STEP MTG (Own Risk)</p>
              </div>
            </div>
          )}
        </div>

        {/* Grid of details */}
        <div className="grid grid-cols-2 gap-3">
          <ResultCard 
            icon={Activity} 
            label="Trading Pair" 
            value={<span className="font-mono text-primary">{data.pair}</span>}
            delay={100}
          />
          <ResultCard 
            icon={TrendIcon} 
            label="Current Trend" 
            value={<span className={trendColor}>{data.trend}</span>}
            delay={150}
          />
          <ResultCard 
            icon={Shield} 
            label="Support Zone" 
            value={<span className="font-mono text-success">{data.supportZone}</span>}
            delay={200}
          />
          <ResultCard 
            icon={Target} 
            label="Resistance Zone" 
            value={<span className="font-mono text-destructive">{data.resistanceZone}</span>}
            delay={250}
          />
        </div>

        {/* Explanation */}
        <div 
          className="p-5 rounded-xl glass-card gradient-border opacity-0 animate-slide-up"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <FileText className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider font-medium">
              Price Action Analysis
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{data.explanation}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div 
        className="p-4 rounded-lg bg-warning/5 border border-warning/20 opacity-0 animate-slide-up"
        style={{ animationDelay: "350ms" }}
      >
        <p className="text-xs text-warning/80 text-center">
          ⚠️ This is analysis only, not financial advice. Past patterns don't guarantee future results. Trade responsibly.
        </p>
      </div>
    </div>
  );
}