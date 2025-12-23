import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, TrendingUp, TrendingDown, Clock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface UserAccuracy {
  total_signals: number;
  wins: number;
  losses: number;
  pending: number;
  accuracy: number;
}

export function PersonalStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserAccuracy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('get_user_accuracy', { p_user_id: user.id });

        if (error) {
          console.error('Error fetching stats:', error);
          return;
        }

        if (data && data.length > 0) {
          setStats(data[0]);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="animate-pulse text-muted-foreground text-center">Loading stats...</div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total_signals === 0) {
    return (
      <Card className="glass-card border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            Your Personal Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No signals recorded yet. Your personal accuracy statistics will appear here after you start using the analyzer.
          </p>
        </CardContent>
      </Card>
    );
  }

  const accuracyColor = stats.accuracy >= 70 ? "text-success" : stats.accuracy >= 50 ? "text-warning" : "text-destructive";

  return (
    <Card className="glass-card border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Your Personal Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {/* Total Signals */}
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-foreground">{stats.total_signals}</div>
            <div className="text-xs text-muted-foreground">Total Signals</div>
          </div>

          {/* Accuracy */}
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <Trophy className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className={cn("text-2xl font-bold", accuracyColor)}>{stats.accuracy}%</div>
            <div className="text-xs text-muted-foreground">Accuracy</div>
          </div>

          {/* Wins */}
          <div className="text-center p-3 rounded-lg bg-success/10">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-success" />
            <div className="text-2xl font-bold text-success">{stats.wins}</div>
            <div className="text-xs text-muted-foreground">Wins</div>
          </div>

          {/* Losses */}
          <div className="text-center p-3 rounded-lg bg-destructive/10">
            <TrendingDown className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <div className="text-2xl font-bold text-destructive">{stats.losses}</div>
            <div className="text-xs text-muted-foreground">Losses</div>
          </div>

          {/* Pending */}
          <div className="text-center p-3 rounded-lg bg-warning/10">
            <Clock className="w-5 h-5 mx-auto mb-1 text-warning" />
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
