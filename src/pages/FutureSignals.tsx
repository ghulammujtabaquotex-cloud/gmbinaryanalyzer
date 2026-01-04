import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Zap, Globe, Check, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Signal {
  pair: string;
  signal_time: string;
  direction: string;
}

const TERMINAL_LOGS = [
  '> Initializing secure connection...',
  '> Authenticating user credentials...',
  '> Connected to GM_SERVER_01.',
  '> Syncing with UTC+5 Timezone...',
  '> Decrypting signal stream...',
  '> Analyzing market patterns...',
  '> Fetching future signals...',
];

const FutureSignals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalCount, setGlobalCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [usageInfo, setUsageInfo] = useState({ used: 0, limit: 3, isVip: false });
  const FREE_SIGNAL_LIMIT = 3;
  const VIP_SIGNAL_LIMIT = 20;
  const terminalRef = useRef<HTMLDivElement>(null);

  const openWhatsAppForSignals = () => {
    const message = encodeURIComponent("I need future signals");
    window.open(`https://wa.me/923313063104?text=${message}`, '_blank');
  };

  // Get Pakistan time
  const getPakistanTime = () => {
    const now = new Date();
    const pakistanTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return pakistanTime;
  };

  const getPakistanDate = () => {
    const now = new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
    }).format(now);
  };

  // Fetch global count
  useEffect(() => {
    const fetchGlobalCount = async () => {
      const { data, error } = await supabase.rpc('get_total_signals_generated');
      if (!error && data !== null) {
        setGlobalCount(data);
      }
    };
    fetchGlobalCount();

    // Realtime subscription
    const channel = supabase
      .channel('signals-history-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'signals_history' },
        () => {
          fetchGlobalCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check usage on mount
  useEffect(() => {
    checkUsage();
  }, [user]);

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  };

  const checkUsage = async () => {
    const ip = await getClientIP();
    const today = getPakistanDate();
    
    // Check if user is VIP or admin
    let isVip = false;
    if (user) {
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle();
      isVip = subData?.tier === 'vip';
      
      // Check if admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (roleData) isVip = true;
    }

    const limit = isVip ? VIP_SIGNAL_LIMIT : FREE_SIGNAL_LIMIT;

    const { data } = await supabase.rpc('check_future_signal_usage', {
      p_ip_address: ip,
      p_usage_date: today,
      p_daily_limit: limit,
    });

    if (data && data[0]) {
      setUsageInfo({
        used: data[0].current_count,
        limit,
        isVip,
      });
    }
  };

  const addLog = (text: string) => {
    setLogs((prev) => [...prev, text]);
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const isSignalInWindow = (signalTime: string, currentTime: string): boolean => {
    const signalMinutes = timeToMinutes(signalTime);
    const currentMinutes = timeToMinutes(currentTime);
    
    // Allow signals from 1 minute ago to 120 minutes ahead
    const minTime = currentMinutes - 1;
    const maxTime = currentMinutes + 120;

    // Handle midnight crossing
    if (maxTime >= 1440) {
      // If max crosses midnight
      return signalMinutes >= minTime || signalMinutes <= (maxTime - 1440);
    }
    
    if (minTime < 0) {
      // If min is before midnight
      return signalMinutes >= (1440 + minTime) || signalMinutes <= maxTime;
    }

    return signalMinutes >= minTime && signalMinutes <= maxTime;
  };

  const generateSignals = async () => {
    if (usageInfo.used >= usageInfo.limit) {
      toast.error('Daily limit reached! Upgrade to VIP for more signals.');
      return;
    }

    setIsGenerating(true);
    setLogs([]);
    setSignals([]);

    // Animated logs
    for (let i = 0; i < TERMINAL_LOGS.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      addLog(TERMINAL_LOGS[i]);
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }

    // Wait for "processing"
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const currentTime = getPakistanTime();
      addLog(`> Current time (PKT): ${currentTime}`);

      // Fetch signals from pool
      const { data: poolSignals, error } = await supabase
        .from('future_signals_pool')
        .select('pair, signal_time, direction');

      if (error) throw error;

      // Filter signals within window
      const validSignals = (poolSignals || []).filter((s) =>
        isSignalInWindow(s.signal_time, currentTime)
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (validSignals.length === 0) {
        addLog('');
        addLog('>> SYSTEM ALERT: No signal found.');
        addLog('>> Opening WhatsApp to request signals...');
        
        // Auto open WhatsApp after a delay
        setTimeout(() => {
          openWhatsAppForSignals();
        }, 2000);
      } else {
        addLog('');
        addLog('>> SIGNALS FOUND:');
        addLog('─'.repeat(40));

        const ip = await getClientIP();
        const today = getPakistanDate();

        for (const signal of validSignals) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const formattedPair = signal.pair.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
          addLog(`   ${formattedPair}  ${signal.signal_time}  ${signal.direction}`);
          
          // Save to history
          await supabase.from('signals_history').insert({
            user_id: user?.id || null,
            ip_address: ip,
            pair: signal.pair,
            signal_time: signal.signal_time,
            direction: signal.direction,
          });
        }

        addLog('─'.repeat(40));
        setSignals(validSignals);

        // Increment usage
        await supabase.rpc('increment_future_signal_usage', {
          p_ip_address: ip,
          p_usage_date: today,
        });

        setUsageInfo((prev) => ({ ...prev, used: prev.used + 1 }));
      }

      addLog('');
      addLog('> Session complete. Good luck trading!');
    } catch (err) {
      console.error(err);
      addLog('');
      addLog('>> ERROR: Failed to fetch signals. Please try again.');
    }

    setIsGenerating(false);
  };

  const copySignals = () => {
    if (signals.length === 0) return;
    const text = signals
      .map((s) => `${s.pair.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')} ${s.signal_time} ${s.direction}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Signals copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-[#33ff33] font-mono p-4 md:p-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="text-[#33ff33] hover:bg-[#33ff33]/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Dashboard
        </Button>

        <div className="flex items-center gap-4">
          {/* Global Counter */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#33ff33]/30 rounded-full px-4 py-2">
            <Globe className="h-4 w-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm">Global:</span>
            <span className="text-white font-bold">{globalCount.toLocaleString()}</span>
          </div>

          {/* Usage Info */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#33ff33]/30 rounded-full px-4 py-2">
            {usageInfo.isVip && <Crown className="h-4 w-4 text-yellow-400" />}
            <span className="text-gray-400 text-sm">
              {usageInfo.used}/{usageInfo.limit} uses
            </span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[#33ff33] mb-2 flex items-center justify-center gap-3">
          <Zap className="h-8 w-8" />
          FUTURE SIGNAL GENERATOR
          <Zap className="h-8 w-8" />
        </h1>
        <p className="text-gray-500 text-sm">
          Timezone: Asia/Karachi (UTC+5)
        </p>
      </div>

      {/* Terminal Window */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#0a0a0a] border border-[#33ff33]/40 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(51,255,51,0.1)]">
          {/* Terminal Header */}
          <div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2 border-b border-[#33ff33]/20">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-4 text-gray-400 text-sm">GM_BINARY_TERMINAL_v2.0</span>
          </div>

          {/* Terminal Content */}
          <div
            ref={terminalRef}
            className="p-4 h-[400px] overflow-y-auto text-sm leading-relaxed"
          >
          {logs.length === 0 && !isGenerating && (
              <div className="text-gray-500">
                <p>{'>'} Welcome to GM Binary Pro Signal Generator</p>
                <p>{'>'} Click "Generate Signals" to fetch upcoming trading signals</p>
                <p className="mt-4 text-cyan-400">{'>'} Ready...</p>
              </div>
            )}

            {logs.map((log, index) => (
              <div
                key={index}
                className={`${
                  log.startsWith('>>')
                    ? log.includes('ERROR') || log.includes('ALERT')
                      ? 'text-red-400'
                      : 'text-cyan-400 font-bold'
                    : log.startsWith('   ')
                    ? 'text-yellow-300'
                    : 'text-[#33ff33]'
                } animate-fade-in`}
              >
                {log}
              </div>
            ))}

            {isGenerating && (
              <span className="inline-block w-2 h-4 bg-[#33ff33] animate-pulse ml-1" />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mt-6 justify-center">
          <Button
            onClick={generateSignals}
            disabled={isGenerating || usageInfo.used >= usageInfo.limit}
            className="bg-[#33ff33] text-black hover:bg-[#2de02d] font-bold px-8 py-3 text-lg disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin mr-2">⚙</span>
                GENERATING...
              </>
            ) : usageInfo.used >= usageInfo.limit ? (
              'LIMIT REACHED'
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                GENERATE SIGNALS
              </>
            )}
          </Button>

          {signals.length > 0 && (
            <Button
              onClick={copySignals}
              variant="outline"
              className="border-cyan-400 text-cyan-400 hover:bg-cyan-400/10 font-bold px-6"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  COPIED!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  COPY SIGNALS
                </>
              )}
            </Button>
          )}
        </div>

        {/* Upgrade CTA */}
        {!usageInfo.isVip && usageInfo.used >= usageInfo.limit && (
          <div className="mt-8 text-center">
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-lg p-6">
              <Crown className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-yellow-400 mb-2">
                Upgrade to VIP
              </h3>
              <p className="text-gray-400 mb-4">
                Get 10 signal generations per day + unlimited chart analysis
              </p>
              <Button
                onClick={() => navigate('/pricing')}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold"
              >
                View Pricing
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FutureSignals;
