import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Crown, 
  Settings,
  Bot,
  LogOut,
  BarChart3,
  Terminal
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

          <div className="grid md:grid-cols-2 gap-6 mt-8">
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

            {/* LIVE BOT Card - ACTIVE */}
            <div 
              onClick={() => navigate("/live-bot")}
              className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 backdrop-blur-sm p-6 cursor-pointer hover:border-indigo-500/50 hover:shadow-[0_0_30px_-10px_rgba(99,102,241,0.4)] transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-500/20">
                    <Bot className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">LIVE BOT</h3>
                    <p className="text-sm text-indigo-400">Real-Time Scanner</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Live candlestick chart with auto-scanning Twin Engine v8.2 — real-time signal detection.
                </p>
                <Button className="w-full bg-indigo-500 hover:bg-indigo-500/90 text-white font-semibold">
                  <Bot className="w-4 h-4 mr-2" />
                  Open Live Bot
                </Button>
              </div>
            </div>

            {/* Neon Scanner Pro Card - ACTIVE */}
            <div 
              onClick={() => navigate("/neon-scanner")}
              className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 backdrop-blur-sm p-6 cursor-pointer hover:border-fuchsia-500/50 hover:shadow-[0_0_30px_-10px_rgba(217,70,239,0.4)] transition-all duration-300 md:col-span-2"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-fuchsia-500/20">
                    <Terminal className="w-8 h-8 text-fuchsia-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Neon Scanner Pro</h3>
                    <p className="text-sm text-fuchsia-400">Terminal-Style Live Scanner · GLM-5.1 AI</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Continuous 600-candle scanner with original strategy + AI verification (Normal/Anti). 
                  Bring your own Telegram Bot Token & Chat ID for alerts.
                </p>
                <Button className="w-full bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:opacity-90 text-white font-semibold">
                  <Terminal className="w-4 h-4 mr-2" />
                  Open Neon Scanner
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
