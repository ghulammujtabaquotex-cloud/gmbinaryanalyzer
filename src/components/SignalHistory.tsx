import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SignalHistoryItem {
  id: string;
  pair: string;
  trend: string;
  signal: string;
  support_zone: string | null;
  resistance_zone: string | null;
  explanation: string | null;
  confidence: number | null;
  result: string | null;
  created_at: string;
}

export function SignalHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<SignalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('signal_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching history:', error);
          return;
        }

        setHistory(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const getSignalIcon = (signal: string) => {
    if (signal === 'CALL') return <TrendingUp className="w-4 h-4 text-success" />;
    if (signal === 'PUT') return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-warning" />;
  };

  const getResultBadge = (result: string | null) => {
    if (!result) return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/50">Awaiting</Badge>;
    if (result.toUpperCase() === 'WIN') return <Badge className="bg-success text-success-foreground">WIN</Badge>;
    return <Badge variant="destructive">LOSS</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="animate-pulse text-muted-foreground text-center">Loading history...</div>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="glass-card border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Signal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No signal history yet. Your analysis history will appear here as you use the analyzer.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayedHistory = isExpanded ? history : history.slice(0, 5);

  return (
    <Card className="glass-card border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Signal History ({history.length})
          </CardTitle>
          {history.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-primary"
            >
              {isExpanded ? (
                <>Show Less <ChevronUp className="w-4 h-4 ml-1" /></>
              ) : (
                <>Show All <ChevronDown className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className={cn(isExpanded ? "h-[400px]" : "h-auto")}>
          <div className="space-y-2">
            {displayedHistory.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "p-3 rounded-lg bg-muted/30 cursor-pointer transition-colors hover:bg-muted/50",
                  expandedItem === item.id && "bg-muted/50"
                )}
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSignalIcon(item.signal)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-foreground">{item.pair}</span>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          item.signal === 'CALL' ? "border-success/50 text-success" :
                          item.signal === 'PUT' ? "border-destructive/50 text-destructive" :
                          "border-warning/50 text-warning"
                        )}>
                          {item.signal}
                        </Badge>
                        {item.confidence && (
                          <span className="text-xs text-muted-foreground">
                            Conf: {item.confidence}/10
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                  {getResultBadge(item.result)}
                </div>

                {/* Expanded details */}
                {expandedItem === item.id && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Trend:</span>{" "}
                        <span className="text-foreground">{item.trend}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Support:</span>{" "}
                        <span className="text-success font-mono">{item.support_zone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resistance:</span>{" "}
                        <span className="text-destructive font-mono">{item.resistance_zone || 'N/A'}</span>
                      </div>
                    </div>
                    {item.explanation && (
                      <div className="text-muted-foreground text-xs mt-2">
                        {item.explanation.slice(0, 200)}...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
