import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Cpu, Crown, Play, Square, Terminal, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { toast } from "sonner";

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'signal';
}

interface GeneratedSignal {
  pair: string;
  time: string;
  direction: 'CALL' | 'PUT';
  winRate: number;
  mtgLevel: number;
}

const SignalBot = () => {
  const navigate = useNavigate();
  const { isVip } = useIPUsageTracking();
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const generateSignals = async () => {
    setIsGenerating(true);
    setLogs([]);
    
    const controller = new AbortController();
    setAbortController(controller);

    addLog('Initializing Signal Generator Bot...', 'info');
    addLog('Timeframe: 1 min | Min Win: 70% | MTG: M0', 'info');
    addLog('Fetching data from 41 OTC pairs...', 'info');
    addLog('', 'info');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signals`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify({}),
          signal: controller.signal
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate signals');
      }

      // Log progress for each pair
      for (const prog of data.progress || []) {
        if (prog.signalsFound > 0) {
          addLog(`✓ ${prog.pair}: ${prog.candlesReceived} candles → ${prog.signalsFound} signals`, 'success');
        } else if (prog.candlesReceived > 0) {
          addLog(`○ ${prog.pair}: ${prog.candlesReceived} candles → No qualifying signals`, 'warning');
        } else {
          addLog(`✗ ${prog.pair}: No data available`, 'error');
        }
      }

      addLog('', 'info');
      addLog('═══════════════════════════════════════════════', 'info');
      addLog(`GENERATION COMPLETE | Last Candle: ${data.summary?.lastCandleTime || 'N/A'} PKT`, 'success');
      addLog('═══════════════════════════════════════════════', 'info');
      addLog('', 'info');

      // Display generated signals in terminal
      const signals: GeneratedSignal[] = data.signals || [];
      
      if (signals.length > 0) {
        addLog(`GENERATED SIGNALS (${signals.length} total):`, 'success');
        addLog('─────────────────────────────────────────────', 'info');
        addLog('PAIR              TIME    DIRECTION', 'info');
        addLog('─────────────────────────────────────────────', 'info');
        
        for (const signal of signals) {
          const pairPadded = signal.pair.padEnd(16, ' ');
          const directionColor = signal.direction === 'CALL' ? 'success' : 'error';
          addLog(`${pairPadded}  ${signal.time}   ${signal.direction}`, 'signal');
        }
        
        addLog('─────────────────────────────────────────────', 'info');
      } else {
        addLog('No signals found matching criteria (70%+ win rate, M0)', 'warning');
      }

      toast.success(`Generated ${signals.length} signals`);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        addLog('Generation stopped by user', 'warning');
        toast.info("Signal generation stopped");
      } else {
        addLog(`Error: ${error.message}`, 'error');
        toast.error(error.message || "Failed to generate signals");
      }
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'signal': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  // VIP gate check
  if (!isVip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="p-4 rounded-full bg-amber-500/20 w-fit mx-auto">
            <Crown className="w-12 h-12 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold">VIP Access Required</h1>
          <p className="text-muted-foreground">
            The Signal Generator Bot is a premium feature available exclusively for VIP members.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button 
              onClick={() => navigate("/pricing")}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to VIP
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Cpu className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Signal Generator Bot</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Signal Analysis • 41 OTC Pairs</p>
              </div>
            </div>
            
            {/* Generate/Stop Button */}
            <div>
              {isGenerating ? (
                <Button
                  onClick={stopGeneration}
                  variant="destructive"
                  size="sm"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={generateSignals}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Generate Signals
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Terminal Only */}
      <main className="container mx-auto px-4 py-6">
        <Card className="border-green-500/30 bg-black/90">
          <CardHeader className="pb-2 border-b border-green-500/20">
            <CardTitle className="flex items-center gap-2 text-sm font-mono text-green-400">
              <Terminal className="w-4 h-4" />
              Terminal Output
              {isGenerating && (
                <Loader2 className="w-4 h-4 animate-spin ml-auto" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-220px)]" ref={scrollRef}>
              <div className="p-4 font-mono text-sm space-y-0.5">
                {logs.length === 0 ? (
                  <div className="text-gray-500">
                    <p>GM Binary Pro Signal Generator v2.0</p>
                    <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                    <p>Fixed Configuration:</p>
                    <p>  • Timeframe: 1 minute</p>
                    <p>  • Minimum Win Rate: 70%</p>
                    <p>  • Martingale Level: M0 (85%+ only)</p>
                    <p>  • Candles Analyzed: 600 per pair</p>
                    <p>  • Total Pairs: 41 OTC assets</p>
                    <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
                    <p className="text-green-400 mt-4">Press "Generate Signals" to start analysis...</p>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={getLogColor(log.type)}>
                      {log.message ? (
                        <span>
                          <span className="text-gray-600">[{log.timestamp}]</span> {log.message}
                        </span>
                      ) : (
                        <br />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SignalBot;
