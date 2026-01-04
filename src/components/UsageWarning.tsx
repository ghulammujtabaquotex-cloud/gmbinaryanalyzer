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
  const usedPercentage = ((dailyLimit - remaining) / dailyLimit) * 100;

  // VIP/Admin users see a compact VIP status bar
  if (isVip) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 p-4">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-amber-500" />
            <span className="text-lg font-semibold text-amber-500">VIP Member</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{remaining}</span> of {dailyLimit} analyses remaining today
              </span>
            </div>
            <div className="w-full max-w-xs mx-auto h-2 bg-background/50 rounded-full overflow-hidden border border-amber-500/30">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 transition-all duration-300"
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Free users see usage + promotional text
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-xl bg-muted/50 border border-border p-4">
        {/* Usage stats */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-lg font-semibold text-foreground">Free Plan</span>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground">{remaining}</span> of {dailyLimit} analyses remaining today
            </span>
          </div>
          <div className="w-full max-w-xs mx-auto h-2 bg-background/50 rounded-full overflow-hidden border border-border">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${usedPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Promotional text */}
        <div className="space-y-2 text-center text-sm">
          <p className="text-muted-foreground">
            Want premium features?{" "}
            <Link to="/pricing" className="text-primary font-bold hover:underline">
              BUY PLAN
            </Link>
          </p>
          <p className="text-muted-foreground">
            OR CREATE ACCOUNT WITH THIS LINK{" "}
            <a
              href="https://broker-qx.pro/sign-up/?lid=1416949"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-bold hover:underline"
            >
              CLICK HERE
            </a>{" "}
            AND SEND TRADER ID:{" "}
            <a
              href="https://wa.me/923313063104"
              target="_blank"
              rel="noopener noreferrer"
              className="text-success font-bold hover:underline"
            >
              WhatsApp +923313063104
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
