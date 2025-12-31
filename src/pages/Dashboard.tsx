import { useNavigate } from "react-router-dom";
import { UsageWarning } from "@/components/UsageWarning";
import { GlobalAnalysisCounter } from "@/components/GlobalAnalysisCounter";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Zap, 
  Trophy, 
  Crown, 
  Settings, 
  Lock
} from "lucide-react";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const { remaining, dailyLimit, isLoading: usageLoading, isVip } = useIPUsageTracking();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();


  if (usageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.4)]">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">GM BINARY PRO</h1>
                <p className="text-xs text-muted-foreground">Professional Trading Suite</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Admin Panel Link */}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Settings className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              
              {/* Results Link */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/results")}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trophy className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Results</span>
              </Button>
              
              {/* VIP / Pricing Link */}
              <Button
                variant={isVip ? "ghost" : "outline"}
                size="sm"
                onClick={() => navigate("/pricing")}
                className={isVip 
                  ? "text-primary hover:text-primary/80" 
                  : "border-primary/50 text-primary hover:bg-primary/10"
                }
              >
                <Crown className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">{isVip ? "VIP" : "Upgrade"}</span>
              </Button>
              
              {/* Auth Link */}
              {!user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/auth")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        <div className="space-y-8">
          {/* Global Analysis Counter - Live Badge */}
          <GlobalAnalysisCounter />

          {/* Hero Section */}
          <div className="text-center space-y-4 py-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Professional <span className="text-gradient">Trading Dashboard</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Choose your trading tool below
            </p>
          </div>

          {/* Usage Warning - Show only for free users */}
          {!isVip && (
            <div className="flex justify-center">
              <UsageWarning remaining={remaining} dailyLimit={dailyLimit} isVip={isVip} />
            </div>
          )}

          {/* Trading Tools Grid - Future Signals FIRST, then Chart Analyzer */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Future Signals Card - ACTIVE (First) */}
            <div 
              onClick={() => navigate("/future-signals")}
              className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 backdrop-blur-sm p-6 cursor-pointer hover:border-emerald-500/50 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.4)] transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/20">
                    <Zap className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Future Signals</h3>
                    <p className="text-sm text-emerald-500">Live & Active</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Generate upcoming trading signals with our professional terminal interface. Pakistan timezone optimized.
                </p>
                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  <Zap className="w-4 h-4 mr-2" />
                  Open Generator
                </Button>
              </div>
            </div>

            {/* Chart Analyzer Card - Shows lock on click (Second) */}
            <div 
              onClick={() => toast.error("UNDER MAINTENANCE - Coming back soon")}
              className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 cursor-pointer hover:border-primary/30 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10 relative">
                    <BarChart3 className="w-8 h-8 text-primary" />
                    <Lock className="w-4 h-4 text-muted-foreground absolute -bottom-1 -right-1" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Chart Analyzer</h3>
                    <p className="text-sm text-muted-foreground">AI-powered analysis</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Upload your trading chart and get instant AI analysis with support, resistance, and next candle prediction.
                </p>
                <Button variant="outline" className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analyze Chart
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <div className="text-center text-xs text-muted-foreground space-y-2">
            <p>
              <strong>Disclaimer:</strong> Trading signals are for educational purposes only. 
              Past performance does not guarantee future results.
            </p>
            <p>© 2024 GM Binary Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
