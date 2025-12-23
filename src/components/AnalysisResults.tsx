import { useRef } from "react";
import { SignalBadge } from "./SignalBadge";
import { TrendingUp, TrendingDown, Activity, Target, Shield, FileText, AlertTriangle, Download, Crown, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export interface AnalysisData {
  pair: string;
  trend: "Uptrend" | "Downtrend" | "Range";
  signal: "CALL" | "PUT" | "NEUTRAL";
  supportZone: string;
  resistanceZone: string;
  explanation: string;
  confidence?: number; // VIP only - 1-10 score
  isVip?: boolean;
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

// Extract confidence from explanation if present
function extractConfidence(explanation: string): number | null {
  const match = explanation.match(/Confidence:\s*(\d+)\/10/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function ConfidenceGauge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 8) return "text-success";
    if (score >= 6) return "text-primary";
    if (score >= 4) return "text-warning";
    return "text-destructive";
  };

  const getLabel = () => {
    if (score >= 8) return "High Confidence";
    if (score >= 6) return "Good Confidence";
    if (score >= 4) return "Moderate";
    return "Low Confidence";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-4 rounded-sm transition-colors",
              i < score 
                ? score >= 8 ? "bg-success" : score >= 6 ? "bg-primary" : score >= 4 ? "bg-warning" : "bg-destructive"
                : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className={cn("font-bold", getColor())}>{score}/10</span>
      <span className="text-xs text-muted-foreground">({getLabel()})</span>
    </div>
  );
}

export function AnalysisResults({ data, isVip = false }: AnalysisResultsProps) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const TrendIcon = data.trend === "Uptrend" ? TrendingUp : data.trend === "Downtrend" ? TrendingDown : Activity;
  const trendColor = data.trend === "Uptrend" ? "text-success" : data.trend === "Downtrend" ? "text-destructive" : "text-warning";
  const isTradeSignal = data.signal === "CALL" || data.signal === "PUT";

  // Extract confidence from explanation for VIP users
  const confidence = data.confidence || extractConfidence(data.explanation);

  const handleExportPDF = async () => {
    if (!resultsRef.current) return;

    try {
      const canvas = await html2canvas(resultsRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add title
      pdf.setFontSize(20);
      pdf.setTextColor(255, 255, 255);
      pdf.text('GM BINARY PRO - Signal Analysis', 10, 15);
      
      // Add date
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, 22);

      // Add image
      pdf.addImage(imgData, 'PNG', 10, 30, imgWidth, imgHeight);

      // Add VIP badge
      pdf.setFontSize(12);
      pdf.setTextColor(255, 200, 0);
      pdf.text('VIP Analysis Report', 10, 35 + imgHeight);

      pdf.save(`gmbinarypro-${data.pair.replace('/', '-')}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
    }
  };

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

      <div ref={resultsRef} className="space-y-4">
        {/* Signal - Featured prominently */}
        <div 
          className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up"
          style={{ animationDelay: "0ms" }}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Next Candle Bias</p>
          <SignalBadge signal={data.signal} size="lg" />
          <p className="text-xs text-muted-foreground mt-3">
            {isVip ? "Advanced multi-timeframe analysis" : "Based on 1-minute timeframe analysis"}
          </p>
          
          {/* Confidence Score - VIP Only */}
          {isVip && confidence && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 mb-2 text-muted-foreground">
                <Gauge className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Signal Confidence</span>
              </div>
              <div className="flex justify-center">
                <ConfidenceGauge score={confidence} />
              </div>
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
              {isVip ? "Advanced Price Action Analysis" : "Price Action Analysis"}
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{data.explanation}</p>
        </div>
      </div>

      {/* PDF Export - VIP Only */}
      {isVip && (
        <div 
          className="flex justify-center opacity-0 animate-slide-up"
          style={{ animationDelay: "350ms" }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="border-primary/50 text-primary hover:bg-primary/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export as PDF
          </Button>
        </div>
      )}

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
