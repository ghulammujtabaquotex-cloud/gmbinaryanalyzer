import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Crown, Zap, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SignalResult {
  pair: string;
  direction: 'CALL' | 'PUT';
  confidence: number;
  signal_time: string;
  formatted: string;
  indicators: Record<string, string>;
}

interface GenerateResponse {
  success: boolean;
  generated_at: string;
  total_pairs_scanned: number;
  signals_found: number;
  signals: SignalResult[];
  errors?: string[];
}

const OTC_PAIRS = [
  "USDEGP_otc", "USDBDT_otc", "USDARS_otc", "USDBRL_otc",
  "USDCOP_otc", "USDMXN_otc", "USDIDR_otc", "USDINR_otc",
  "USDPKR_otc", "USDTRY_otc", "EURUSD_otc", "GBPUSD_otc",
  "USDJPY_otc", "AUDUSD_otc", "USDCAD_otc", "NZDUSD_otc",
];

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(OTC_PAIRS);
  const [scanStats, setScanStats] = useState<{ scanned: number; found: number } | null>(null);

  const togglePair = (pair: string) => {
    setSelectedPairs(prev =>
      prev.includes(pair) ? prev.filter(p => p !== pair) : [...prev, pair]
    );
  };

  const selectAll = () => setSelectedPairs([...OTC_PAIRS]);
  const deselectAll = () => setSelectedPairs([]);

  const generateSignals = async () => {
    if (selectedPairs.length === 0) {
      toast.error('Select at least one pair');
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-signals', {
        body: { pairs: selectedPairs },
      });

      if (error) throw error;

      const response = data as GenerateResponse;
      setSignals(response.signals || []);
      setLastGenerated(response.generated_at);
      setScanStats({ scanned: response.total_pairs_scanned, found: response.signals_found });

      if (response.errors?.length) {
        toast.warning(`${response.errors.length} pair(s) had errors`);
      }

      toast.success(`Found ${response.signals_found} signal(s) from ${response.total_pairs_scanned} pairs`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate signals');
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading states
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-card max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">Please login to access this page.</p>
            <Button onClick={() => navigate('/auth')}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-card max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Admin Access Required</h2>
            <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-gradient">Admin Panel</h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        {/* Future Signal Generator Box */}
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-background">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Zap className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Future Signal Generator</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    RSI · MA · MACD · Bollinger · Stochastic · 450 Candle Backtest
                  </p>
                </div>
              </div>
              <Button
                onClick={generateSignals}
                disabled={isGenerating}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> Generate Signals</>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Pair Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">OTC Pairs</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">All</Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">None</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {OTC_PAIRS.map(pair => (
                  <Badge
                    key={pair}
                    variant={selectedPairs.includes(pair) ? "default" : "outline"}
                    className={`cursor-pointer transition-all text-xs ${
                      selectedPairs.includes(pair)
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30'
                        : 'hover:border-amber-500/30'
                    }`}
                    onClick={() => togglePair(pair)}
                  >
                    {pair.replace('_otc', '').toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Scan Stats */}
            {scanStats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Scanned: <strong className="text-foreground">{scanStats.scanned}</strong></span>
                <span>Signals: <strong className="text-amber-400">{scanStats.found}</strong></span>
                {lastGenerated && (
                  <span>Time: <strong className="text-foreground">{new Date(lastGenerated).toLocaleTimeString()}</strong></span>
                )}
              </div>
            )}

            {/* Formatted Signal Output */}
            {signals.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-black/30 p-4 font-mono text-sm space-y-1">
                <p className="text-xs text-muted-foreground mb-2 font-sans">Signal Output (UTC+5)</p>
                {signals.map((sig, i) => (
                  <div
                    key={i}
                    className={sig.direction === 'CALL' ? 'text-emerald-400' : 'text-red-400'}
                  >
                    {sig.formatted}
                  </div>
                ))}
              </div>
            )}

            {/* Signals Results Cards */}
            {signals.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {signals.map((sig, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-4 space-y-3 ${
                      sig.direction === 'CALL'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {sig.direction === 'CALL' ? (
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        )}
                        <span className="font-bold text-foreground">
                          {sig.pair.replace('_otc', '').toUpperCase()}
                        </span>
                      </div>
                      <Badge className={
                        sig.direction === 'CALL'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-red-500/20 text-red-400 border-red-500/50'
                      }>
                        {sig.direction} {sig.confidence}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      {Object.entries(sig.indicators).map(([key, val]) => (
                        <div key={key} className="flex justify-between gap-1">
                          <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-foreground font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {sig.formatted}
                    </p>
                  </div>
                ))}
              </div>
            ) : lastGenerated ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No strong signals found. Try again later or with different pairs.
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Select pairs and click "Generate Signals" to scan the market.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
