import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cpu, Crown } from "lucide-react";
import { SignalBotConfig, SignalConfig } from "@/components/SignalBotConfig";
import { SignalBotResults, GeneratedSignal } from "@/components/SignalBotResults";
import { SignalBotTerminal, LogEntry } from "@/components/SignalBotTerminal";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SignalBot = () => {
  const navigate = useNavigate();
  const { isVip } = useIPUsageTracking();
  
  const [config, setConfig] = useState<SignalConfig>({
    timeframe: 1,
    maxMartingale: 0,
    minWinPercent: 70,
    analysisDays: 28,
    startTime: '00:00',
    endTime: '23:59',
    assets: [
      'BRLUSD_otc',
      'USDBDT_otc',
      'USDARS_otc',
      'USDINR_otc',
      'USDMXN_otc',
      'USDPKR_otc',
      'USDPHP_otc',
      'USDEGP_otc',
      'USDTRY_otc',
      'USDIDR_otc',
      'USDZAR_otc'
    ]
  });
  
  const [signals, setSignals] = useState<GeneratedSignal[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  }, []);

  const generateSignals = async () => {
    if (config.assets.length === 0) {
      toast.error("Please select at least one asset");
      return;
    }

    setIsGenerating(true);
    setSignals([]);
    setLogs([]);
    
    const controller = new AbortController();
    setAbortController(controller);

    addLog('Starting signal generation...', 'info');
    addLog(`Timeframe: ${config.timeframe} min | Days: ${config.analysisDays} | Min Win: ${config.minWinPercent}%`, 'info');
    addLog(`Analyzing ${config.assets.length} assets...`, 'info');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-signals`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          body: JSON.stringify(config),
          signal: controller.signal
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate signals');
      }

      // Log progress for each asset
      for (const prog of data.progress || []) {
        if (prog.signalsFound > 0) {
          addLog(`${prog.asset}: Found ${prog.signalsFound} signals`, 'success');
        } else {
          addLog(`${prog.asset}: ${prog.status}`, 'warning');
        }
      }

      setSignals(data.signals || []);
      
      addLog(`Generation complete! Total signals: ${data.signals?.length || 0}`, 'success');
      toast.success(`Generated ${data.signals?.length || 0} signals`);

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

  const saveToPool = async () => {
    if (signals.length === 0) {
      toast.error("No signals to save");
      return;
    }

    setIsSaving(true);
    addLog('Saving signals to pool...', 'info');

    try {
      // Prepare signals for insertion
      const signalsToInsert = signals.map(s => ({
        pair: s.pair,
        signal_time: s.time,
        direction: s.direction,
        confidence: Math.round(s.winRate)
      }));

      const { error } = await supabase
        .from('future_signals_pool')
        .insert(signalsToInsert);

      if (error) throw error;

      addLog(`Saved ${signals.length} signals to pool`, 'success');
      toast.success(`Saved ${signals.length} signals to the pool`);

    } catch (error: any) {
      addLog(`Save failed: ${error.message}`, 'error');
      toast.error(error.message || "Failed to save signals");
    } finally {
      setIsSaving(false);
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
                <p className="text-xs text-muted-foreground">AI-Powered Signal Analysis</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Config */}
          <div className="lg:col-span-1 space-y-6">
            <SignalBotConfig
              config={config}
              onConfigChange={setConfig}
              onGenerate={generateSignals}
              onStop={stopGeneration}
              isGenerating={isGenerating}
            />
          </div>

          {/* Right Column - Terminal & Results */}
          <div className="lg:col-span-2 space-y-6">
            <SignalBotTerminal
              logs={logs}
              isGenerating={isGenerating}
            />
            <SignalBotResults
              signals={signals}
              onSaveToPool={saveToPool}
              isSaving={isSaving}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default SignalBot;
