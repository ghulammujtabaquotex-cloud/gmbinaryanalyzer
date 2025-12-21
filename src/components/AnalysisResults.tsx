import { SignalBadge } from "./SignalBadge";
import { TrendingUp, TrendingDown, Activity, Target, Shield, FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnalysisData {
  pair: string;
  trend: "Uptrend" | "Downtrend" | "Range";
  signal: "CALL" | "PUT" | "NEUTRAL";
  supportZone: string;
  resistanceZone: string;
  explanation: string;
}

interface AnalysisResultsProps {
  data: AnalysisData;
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

export function AnalysisResults({ data }: AnalysisResultsProps) {
  const TrendIcon = data.trend === "Uptrend" ? TrendingUp : data.trend === "Downtrend" ? TrendingDown : Activity;
  const trendColor = data.trend === "Uptrend" ? "text-success" : data.trend === "Downtrend" ? "text-destructive" : "text-warning";
  const isTradeSignal = data.signal === "CALL" || data.signal === "PUT";

  return (
    <div className="space-y-4">
      {/* Signal - Featured prominently */}
      <div 
        className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up"
        style={{ animationDelay: "0ms" }}
      >
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Next Candle Bias</p>
        <SignalBadge signal={data.signal} size="lg" />
        <p className="text-xs text-muted-foreground mt-3">Based on 1-minute timeframe analysis</p>
        
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
          <span className="text-xs uppercase tracking-wider font-medium">Price Action Analysis</span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{data.explanation}</p>
      </div>

      {/* Disclaimer */}
      <div 
        className="p-4 rounded-lg bg-warning/5 border border-warning/20 opacity-0 animate-slide-up"
        style={{ animationDelay: "400ms" }}
      >
        <p className="text-xs text-warning/80 text-center">
          ⚠️ This is analysis only, not financial advice. Past patterns don't guarantee future results. Trade responsibly.
        </p>
      </div>
    </div>
  );
}