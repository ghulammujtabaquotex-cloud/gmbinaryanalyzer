import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Save, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { toast } from "sonner";

export interface GeneratedSignal {
  pair: string;
  time: string;
  direction: 'CALL' | 'PUT';
  winRate: number;
  mtgLevel: number;
  callWins: number;
  putWins: number;
  totalCandles: number;
}

interface SignalBotResultsProps {
  signals: GeneratedSignal[];
  onSaveToPool: () => void;
  isSaving: boolean;
}

export const SignalBotResults = ({ 
  signals, 
  onSaveToPool, 
  isSaving 
}: SignalBotResultsProps) => {
  const copyToClipboard = () => {
    if (signals.length === 0) {
      toast.error("No signals to copy");
      return;
    }

    const text = signals.map(s => 
      `${s.pair} | ${s.time} | ${s.direction} | ${s.winRate}% | M${s.mtgLevel}`
    ).join('\n');

    navigator.clipboard.writeText(text);
    toast.success(`Copied ${signals.length} signals to clipboard`);
  };

  const getMtgColor = (level: number) => {
    switch (level) {
      case 0: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 1: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 2: return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 3: return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-emerald-500" />
            Generated Signals ({signals.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={signals.length === 0}
              className="border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveToPool}
              disabled={signals.length === 0 || isSaving}
              className="border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save to Pool'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No signals generated yet</p>
            <p className="text-sm">Configure parameters and click Generate</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead>Time (PKT)</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>MTG</TableHead>
                  <TableHead className="text-right">Stats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal, idx) => (
                  <TableRow key={`${signal.pair}-${signal.time}-${idx}`}>
                    <TableCell className="font-medium">
                      {signal.pair.replace('_otc', '')}
                    </TableCell>
                    <TableCell className="font-mono">
                      {signal.time}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={signal.direction === 'CALL' 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                          : 'bg-red-500/20 text-red-400 border-red-500/50'
                        }
                      >
                        {signal.direction === 'CALL' 
                          ? <TrendingUp className="w-3 h-3 mr-1" />
                          : <TrendingDown className="w-3 h-3 mr-1" />
                        }
                        {signal.direction}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={
                        signal.winRate >= 85 ? 'text-emerald-400' :
                        signal.winRate >= 75 ? 'text-blue-400' :
                        signal.winRate >= 70 ? 'text-amber-400' :
                        'text-red-400'
                      }>
                        {signal.winRate}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={getMtgColor(signal.mtgLevel)}
                      >
                        M{signal.mtgLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {signal.callWins}C / {signal.putWins}P / {signal.totalCandles}T
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
