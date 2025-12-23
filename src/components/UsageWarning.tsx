import { AlertTriangle, Crown, Zap, TrendingUp, BarChart3, FileText, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { PAYMENT_CONFIG } from "@/lib/paymentConfig";

interface UsageWarningProps {
  remaining: number;
  dailyLimit: number;
  isVip?: boolean;
}

const VIP_QUICK_FEATURES = [
  { icon: Zap, label: "20/day" },
  { icon: TrendingUp, label: "Priority" },
  { icon: BarChart3, label: "Multi-TF" },
  { icon: FileText, label: "PDF Export" },
  { icon: MessageCircle, label: "Support" },
];

export const UsageWarning = ({ remaining, dailyLimit, isVip }: UsageWarningProps) => {
  if (isVip) {
    const usedPercentage = ((dailyLimit - remaining) / dailyLimit) * 100;
    
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border border-primary/30 p-4 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-lg font-bold text-primary">VIP MEMBER</span>
            <Crown className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {VIP_QUICK_FEATURES.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30"
              >
                <feature.icon className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{feature.label}</span>
              </div>
            ))}
          </div>
          {/* Show actual remaining count for VIP */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-primary/80">
                <span className="font-bold text-primary">{remaining}</span> of {dailyLimit} analyses remaining today
              </span>
            </div>
            <div className="w-full max-w-xs mx-auto h-2 bg-background/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show broker signup message for free users
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-lg bg-primary/10 border-primary/20 border text-sm text-center">
      <span className="text-muted-foreground">
        OR CREATE ACCOUNT WITH THIS LINK{" "}
        <a
          href="https://broker-qx.pro/sign-up/?lid=1416949"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-bold hover:underline"
        >
          CLICK HERE
        </a>{" "}
        AND SEND TRADER ID: WHATSAPP +923313063104
      </span>
    </div>
  );
};
