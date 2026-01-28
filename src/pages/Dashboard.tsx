import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Zap, 
  Trophy, 
  Crown, 
  Settings,
  Bot
} from "lucide-react";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useEffect } from "react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isVip } = useIPUsageTracking();
  const { user, isLoading } = useAuth();
  const { isAdmin } = useAdmin();

  // Redirect to login if not authenticated
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
              
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl flex-1">
        <div className="space-y-8">
          {/* Hero Section */}

          {/* Hero Section */}
          <div className="text-center space-y-4 py-4">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Professional <span className="text-gradient">Trading Dashboard</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Choose your trading tool below
            </p>
          </div>


          {/* Trading Tools Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {/* Signal Generator Bot Card - FIRST */}
            <div 
              onClick={() => navigate("/signal-bot")}
              className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 backdrop-blur-sm p-6 cursor-pointer hover:border-amber-500/50 hover:shadow-[0_0_30px_-10px_rgba(245,158,11,0.4)] transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500/20">
                    <Zap className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Signal Bot</h3>
                    <p className="text-sm text-amber-500">Future Signals</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Access the future signal generator for AI-powered trading predictions and market analysis.
                </p>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                  <Zap className="w-4 h-4 mr-2" />
                  Open Signal Bot
                </Button>
              </div>
            </div>

            {/* LIVE BOT Card */}
            <div 
              onClick={() => navigate("/live-bot")}
              className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 backdrop-blur-sm p-6 cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_30px_-10px_rgba(6,182,212,0.4)] transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-cyan-500/20">
                    <Bot className="w-8 h-8 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">LIVE BOT</h3>
                    <p className="text-sm text-cyan-500">Real-Time Trading</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Access our advanced live trading bot with real-time market analysis, automated signals, and instant execution.
                </p>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white">
                  <Bot className="w-4 h-4 mr-2" />
                  Launch Bot
                </Button>
              </div>
            </div>

            {/* Chart Analyzer Card */}
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
                    <h3 className="text-xl font-bold text-foreground">Chart Analyzer</h3>
                    <p className="text-sm text-primary">AI Powered</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Upload your trading chart and get instant AI analysis with support, resistance, and next candle prediction.
                </p>
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
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
