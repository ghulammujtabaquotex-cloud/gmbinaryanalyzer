import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowLeft, Trophy, Target, TrendingDown, Percent } from "lucide-react";
import { useGlobalResults } from "@/hooks/useGlobalResults";

const Results = () => {
  const navigate = useNavigate();
  const { results, isLoading } = useGlobalResults();

  return (
    <div className="min-h-screen bg-background">
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
                <p className="text-xs text-muted-foreground">Global Results</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analyzer
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-8">
          {/* Title Section */}
          <div className="text-center space-y-4 py-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Global <span className="text-gradient">Trading Results</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Aggregated results from all users. Updated in real-time as traders submit their outcomes.
            </p>
          </div>

          {/* Stats Grid */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading results...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Total Trades */}
              <div className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up" style={{ animationDelay: "0ms" }}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                  <Target className="w-5 h-5" />
                  <span className="text-xs uppercase tracking-wider font-medium">Total Trades</span>
                </div>
                <p className="text-4xl font-bold text-foreground">{results.totalTrades}</p>
              </div>

              {/* Accuracy */}
              <div className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up" style={{ animationDelay: "100ms" }}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                  <Percent className="w-5 h-5" />
                  <span className="text-xs uppercase tracking-wider font-medium">Accuracy</span>
                </div>
                <p className={`text-4xl font-bold ${results.accuracy >= 50 ? "text-success" : "text-destructive"}`}>
                  {results.accuracy}%
                </p>
              </div>

              {/* Wins */}
              <div className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up" style={{ animationDelay: "200ms" }}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                  <Trophy className="w-5 h-5 text-success" />
                  <span className="text-xs uppercase tracking-wider font-medium">Wins</span>
                </div>
                <p className="text-4xl font-bold text-success">{results.wins}</p>
              </div>

              {/* Losses */}
              <div className="p-6 rounded-xl glass-card gradient-border text-center opacity-0 animate-slide-up" style={{ animationDelay: "300ms" }}>
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                  <span className="text-xs uppercase tracking-wider font-medium">Losses</span>
                </div>
                <p className="text-4xl font-bold text-destructive">{results.losses}</p>
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="p-5 rounded-xl glass-card gradient-border opacity-0 animate-slide-up" style={{ animationDelay: "400ms" }}>
            <h3 className="font-semibold text-foreground mb-2">How Results Work</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Only CALL and PUT signals are tracked as trades</li>
              <li>• NEUTRAL signals are informational and not counted</li>
              <li>• Results are submitted by users after each trade</li>
              <li>• Accuracy = (Total Wins / Total Trades) × 100</li>
              <li>• All data is anonymous - no personal info displayed</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6 space-y-4">
          <p className="text-center text-xs text-muted-foreground">
            Results are based on user-submitted outcomes. Past performance does not guarantee future results.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            copyright © GHULAM MUJTABA
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Results;