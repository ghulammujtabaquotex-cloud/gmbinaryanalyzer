import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type SignalType = "CALL" | "PUT" | "NEUTRAL";

interface SignalBadgeProps {
  signal: SignalType;
  size?: "sm" | "md" | "lg";
}

export function SignalBadge({ signal, size = "md" }: SignalBadgeProps) {
  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const Icon = signal === "CALL" ? TrendingUp : signal === "PUT" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-bold uppercase tracking-wider border transition-all duration-300",
        sizeClasses[size],
        signal === "CALL" && "signal-call",
        signal === "PUT" && "signal-put",
        signal === "NEUTRAL" && "signal-neutral"
      )}
    >
      <Icon className={iconSizes[size]} />
      {signal}
    </div>
  );
}
