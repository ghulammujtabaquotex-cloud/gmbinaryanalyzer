import { AlertTriangle } from "lucide-react";

interface UsageWarningProps {
  remaining: number;
  dailyLimit: number;
}

export const UsageWarning = ({ remaining, dailyLimit }: UsageWarningProps) => {
  const usedPercentage = ((dailyLimit - remaining) / dailyLimit) * 100;
  
  let bgColor = "bg-primary/10 border-primary/20";
  let textColor = "text-primary";
  
  if (remaining <= 1) {
    bgColor = "bg-destructive/10 border-destructive/20";
    textColor = "text-destructive";
  } else if (remaining <= 2) {
    bgColor = "bg-amber-500/10 border-amber-500/20";
    textColor = "text-amber-500";
  }

  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${bgColor} border text-sm`}>
      {remaining <= 1 && <AlertTriangle className={`w-4 h-4 ${textColor}`} />}
      <span className={textColor}>
        <span className="font-semibold">{remaining}</span> of {dailyLimit} analysis remaining today
      </span>
      <div className="w-24 h-2 bg-background/50 rounded-full overflow-hidden ml-2">
        <div 
          className={`h-full transition-all duration-300 ${
            remaining <= 1 ? "bg-destructive" : remaining <= 2 ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${usedPercentage}%` }}
        />
      </div>
    </div>
  );
};
