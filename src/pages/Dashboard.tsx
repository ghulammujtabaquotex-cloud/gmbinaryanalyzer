import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Zap, 
  Crown, 
  Settings,
  Bot,
  LogOut,
  Lock,
  ExternalLink
} from "lucide-react";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useEffect } from "react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isVip } = useIPUsageTracking();
  const { user, isLoading, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin text-4xl">⚙</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
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

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        <div className="space-y-8">
          <div className="text-center space-y-4 py-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Professional <span className="text-gradient">Trading Dashboard</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Choose your trading tool below
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {/* Chart AI Analyzer Card - ACTIVE */}
            <div 
              onClick={() => navigate("/chart-analyzer")}
              className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm p-6 cursor-pointer hover:border-primary/50 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.4)] transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/20">
                    <BarChart3 className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Chart AI Analyzer</h3>
                    <p className="text-sm text-primary">AI-Powered Analysis</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Select any pair and get instant AI-powered chart analysis with signals, patterns, and technical indicators.
                </p>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Open Analyzer
                </Button>
              </div>
            </div>

            {/* Future Signals Card - ACTIVE */}
            <div 
              onClick={() => navigate("/future-signals")}
              className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 backdrop-blur-sm p-6 cursor-pointer hover:border-amber-500/50 hover:shadow-[0_0_30px_-10px_rgba(245,158,11,0.4)] transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500/20">
                    <Zap className="w-8 h-8 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Future Signals</h3>
                    <p className="text-sm text-amber-400">AI Signal Generator</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Generate precise future trading signals with deep multi-timeframe analysis and advanced price action.
                </p>
                <Button className="w-full bg-amber-500 hover:bg-amber-500/90 text-black font-semibold">
                  <Zap className="w-4 h-4 mr-2" />
                  Open Generator
                </Button>
              </div>
            </div>

            {/* LIVE BOT Card - DISABLED */}
            <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm p-6 opacity-60 relative overflow-hidden">
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3 p-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground text-center">Currently Disabled</p>
                <a 
                  href="https://t.me/BINARYSUPPORT" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Contact Admin @BINARYSUPPORT
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-muted/30">
                    <Bot className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-muted-foreground">LIVE BOT</h3>
                    <p className="text-sm text-muted-foreground">Real-Time Trading</p>
                  </div>
                </div>
                <p className="text-muted-foreground/60">
                  Access our advanced live trading bot with real-time market analysis.
                </p>
                <Button disabled className="w-full" variant="secondary">
                  <Bot className="w-4 h-4 mr-2" />
                  Disabled
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
