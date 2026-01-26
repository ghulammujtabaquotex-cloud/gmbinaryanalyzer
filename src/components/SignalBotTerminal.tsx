import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";
import { useEffect, useRef } from "react";

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface SignalBotTerminalProps {
  logs: LogEntry[];
  isGenerating: boolean;
}

export const SignalBotTerminal = ({ logs, isGenerating }: SignalBotTerminalProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-amber-400';
      default: return 'text-cyan-400';
    }
  };

  return (
    <Card className="border-cyan-500/30 bg-black/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-mono">
          <Terminal className="w-4 h-4 text-cyan-500" />
          <span className="text-cyan-500">Terminal Output</span>
          {isGenerating && (
            <span className="ml-auto flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Running...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] p-4" ref={scrollRef}>
          <div className="font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-muted-foreground">
                [system] Ready to generate signals...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={getLogColor(log.type)}>
                  <span className="text-muted-foreground">[{log.timestamp}]</span>{' '}
                  {log.message}
                </div>
              ))
            )}
            {isGenerating && (
              <div className="text-emerald-400 animate-pulse">
                <span className="text-muted-foreground">[processing]</span>{' '}
                █
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
