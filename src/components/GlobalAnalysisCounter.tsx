import { useState, useEffect } from "react";
import { Activity, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function GlobalAnalysisCounter() {
  const [count, setCount] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    // Initial fetch
    fetchCount();

    // Set up real-time subscription for ip_usage (all chart analyses)
    const channel = supabase
      .channel('global-analysis-counter')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ip_usage'
        },
        () => {
          // Refetch count and show update animation
          fetchCount();
          triggerUpdateAnimation();
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    // Periodic refresh every 30 seconds as backup
    const interval = setInterval(fetchCount, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchCount = async () => {
    try {
      // Sum all request_count from ip_usage to get total analyses
      const { data, error } = await supabase
        .from('ip_usage')
        .select('request_count');

      if (!error && data) {
        const total = data.reduce((sum, row) => sum + (row.request_count || 0), 0);
        setCount(total);
      }
    } catch (err) {
      console.error('Error fetching count:', err);
    }
  };

  const triggerUpdateAnimation = () => {
    setJustUpdated(true);
    setTimeout(() => setJustUpdated(false), 1000);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  if (count === null) {
    return null;
  }

  return (
    <div className="flex justify-center mb-4">
      <div 
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-gradient-to-r from-primary/20 via-success/20 to-primary/20",
          "border border-primary/30",
          "shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)]",
          "animate-fade-in",
          justUpdated && "animate-pulse scale-105"
        )}
      >
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isLive ? "bg-success" : "bg-warning"
            )} />
            {isLive && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-success animate-ping opacity-75" />
            )}
          </div>
          <span className="text-xs font-medium text-success uppercase tracking-wider">
            {isLive ? "Live" : "Sync"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border/50" />

        {/* Counter */}
        <div className="flex items-center gap-2">
          <Activity className={cn(
            "w-4 h-4 text-primary",
            justUpdated && "animate-bounce"
          )} />
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "font-bold text-lg tabular-nums text-foreground transition-all duration-300",
              justUpdated && "text-success scale-110"
            )}>
              {formatNumber(count)}
            </span>
            <span className="text-xs text-muted-foreground">signals</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border/50" />

        {/* Analysis badge */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">
            Global Analysis
          </span>
        </div>
      </div>
    </div>
  );
}