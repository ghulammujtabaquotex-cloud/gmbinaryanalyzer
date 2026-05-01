import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Square, Terminal, Zap, Trophy, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useIPUsageTracking } from "@/hooks/useIPUsageTracking";
import { usePublicAccess } from "@/hooks/usePublicAccess";
import AccessGate from "@/components/AccessGate";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const DEFAULT_PAIRS = [
  "USDBDT_OTC","USDARS_OTC","USDINR_OTC","USDMXN_OTC","USDNGN_OTC","USDEGP_OTC",
  "USDPKR_OTC","USDIDR_OTC","BRLUSD_OTC","NZDUSD_OTC","GBPNZD_OTC","EURNZD_OTC",
  "NZDCAD_OTC","CADCHF_OTC","NZDJPY_OTC","NZDCHF_OTC","AUDNZD_OTC","BTCUSD_OTC",
  "XAUUSD_OTC","EURUSD_OTC","GBPUSD_OTC","USDJPY_OTC","EURJPY_OTC","AUDUSD_OTC",
  "USDCAD_OTC","USDCHF_OTC","EURGBP_OTC","EURCHF_OTC","GBPJPY_OTC","AUDJPY_OTC",
  "GBPCAD_OTC","EURCAD_OTC","AUDCAD_OTC","USDDZD_OTC"
];

type LogLine = { t: string; type: "info" | "ok" | "warn" | "err" | "sig"; msg: string };

const NeonScannerPro = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin } = useAdmin();
  const { isVip } = useIPUsageTracking();
  const { publicAccess, loading: accessLoading } = usePublicAccess();

  const [pairsInput, setPairsInput] = useState("");
  const [verificationMode, setVerificationMode] = useState<"off" | "ai" | "anti">("off");
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [stats, setStats] = useState({ wins: 0, losses: 0 });
  const [currentPair, setCurrentPair] = useState("");

  const runningRef = useRef(false);
  const pairIndexRef = useRef(0);
  const glmChatIdRef = useRef<string | null>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const log = (type: LogLine["type"], msg: string) => {
    const t = new Date().toLocaleTimeString("en-PK", { hour12: false, timeZone: "Asia/Karachi" });
    setLogs(prev => [...prev.slice(-300), { t, type, msg }]);
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const sleepUntilUtc5 = async (targetUtc5: Date) => {
    while (runningRef.current) {
      const nowUtc5 = new Date(Date.now() + 5 * 3600 * 1000);
      if (nowUtc5 >= targetUtc5) break;
      await sleep(500);
    }
  };

  const handleResult = async (pair: string, entryTime: string, direction: string) => {
    log("info", `[*] Monitoring ${pair} entry at ${entryTime} ...`);
    // Wait for 1st candle close (entry + 1 min)
    const [hh, mm] = entryTime.split(":").map(Number);
    const close1 = new Date(Date.now() + 5 * 3600 * 1000);
    close1.setUTCHours(hh, mm + 1, 5, 0);
    log("info", `Waiting for 1st candle close ${String(close1.getUTCHours()).padStart(2,"0")}:${String(close1.getUTCMinutes()).padStart(2,"0")}:00 ...`);
    await sleepUntilUtc5(close1);
    if (!runningRef.current) return;

    let res = await supabase.functions.invoke("neon-scanner", {
      body: { action: "check_result", pair, entryTime, direction, candleOffset: 0 },
    });
    if (res.data?.win === true) {
      setStats(s => ({ ...s, wins: s.wins + 1 }));
      log("sig", `✅ DIRECT WIN — ${pair} @ ${entryTime}`);
      if (tgEnabled && tgToken && tgChatId) {
        await supabase.functions.invoke("neon-scanner", { body: { action: "scan", pair: "_dummy_" } }).catch(() => {});
      }
      return;
    }
    if (res.data?.win === false) {
      // Martingale: wait close2
      const close2 = new Date(Date.now() + 5 * 3600 * 1000);
      close2.setUTCHours(hh, mm + 2, 5, 0);
      log("warn", `[!] First loss, waiting MTG candle close ${String(close2.getUTCHours()).padStart(2,"0")}:${String(close2.getUTCMinutes()).padStart(2,"0")}:00 ...`);
      await sleepUntilUtc5(close2);
      if (!runningRef.current) return;
      res = await supabase.functions.invoke("neon-scanner", {
        body: { action: "check_result", pair, entryTime, direction, candleOffset: 1 },
      });
      if (res.data?.win === true) {
        setStats(s => ({ ...s, wins: s.wins + 1 }));
        log("sig", `✅ MARTINGALE WIN — ${pair} @ ${entryTime}`);
      } else {
        setStats(s => ({ ...s, losses: s.losses + 1 }));
        log("err", `❌ LOSS — ${pair} @ ${entryTime}`);
      }
    } else {
      log("warn", `[!] Result candle not ready, skipping`);
    }
  };

  const startScanner = async () => {
    if (tgEnabled && (!tgToken.trim() || !tgChatId.trim())) {
      toast({ title: "Telegram error", description: "Bot Token aur Chat ID dono required hain", variant: "destructive" });
      return;
    }
    const pairs = pairsInput.trim()
      ? pairsInput.split(",").map(p => p.trim().toUpperCase()).filter(Boolean)
      : DEFAULT_PAIRS;

    setLogs([]);
    setStats({ wins: 0, losses: 0 });
    pairIndexRef.current = 0;
    glmChatIdRef.current = null;
    runningRef.current = true;
    setRunning(true);

    log("ok", `[+] Scanner started — ${pairs.length} pairs, mode: ${verificationMode.toUpperCase()}, Telegram: ${tgEnabled ? "ON" : "OFF"}`);

    while (runningRef.current) {
      const pair = pairs[pairIndexRef.current];
      pairIndexRef.current = (pairIndexRef.current + 1) % pairs.length;
      setCurrentPair(pair);
      log("info", `═══ Scanning: ${pair} ═══`);

      try {
        const { data, error } = await supabase.functions.invoke("neon-scanner", {
          body: {
            action: "scan", pair, verificationMode,
            glmChatId: glmChatIdRef.current,
            telegram: tgEnabled ? { token: tgToken, chatId: tgChatId } : null,
          },
        });
        if (error) { log("err", `[!] ${error.message}`); await sleep(800); continue; }
        if (data?.glmChatId) glmChatIdRef.current = data.glmChatId;

        if (data?.status === "no_data") log("err", `[!] No data for ${pair}`);
        else if (data?.status === "no_signal") log("warn", `⏩ No signal (${data.candleCount} candles, price ${data.price?.toFixed?.(5)})`);
        else if (data?.status === "ai_rejected") log("warn", `❌ AI rejected — orig:${data.direction} ai:${data.ai?.direction} conf:${data.ai?.confidence}%`);
        else if (data?.status === "signal") {
          log("sig", `🚀 SIGNAL ${data.pair} | ${data.direction} | ${data.entryTime} | Payout ${data.payout} | Win% ${data.winRate} | Mode: ${data.modeLabel}`);
          if (data.ai?.reason) log("info", `[AI] ${data.ai.reason} (${data.ai.confidence}%)`);

          // Build entry datetime (UTC+5) from HH:MM
          const direction = data.direction;
          const entryTime: string = data.entryTime;
          // Run result handler in parallel so scanner keeps moving
          handleResult(pair, entryTime, direction);
        }
      } catch (e: any) {
        log("err", `[!] ${e.message || e}`);
      }
      await sleep(400);
    }
    log("warn", "[x] Scanner stopped");
    setRunning(false);
    setCurrentPair("");
  };

  const stopScanner = () => {
    runningRef.current = false;
  };

  if (authLoading || accessLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin text-4xl">⚙</div></div>;
  }
  if (!user) return null;
  if (!publicAccess && !isVip && !isAdmin) return <AccessGate toolName="Neon Scanner Pro" />;

  const total = stats.wins + stats.losses;
  const winRate = total ? ((stats.wins / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
            <div className="p-2 rounded-lg bg-fuchsia-500/10">
              <Terminal className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Neon Scanner Pro</h1>
              <p className="text-xs text-muted-foreground">GM BINARY — 600 candles · GLM-5.1 AI</p>
            </div>
          </div>
          <Badge variant={running ? "default" : "secondary"} className={running ? "bg-fuchsia-500" : ""}>
            {running ? `● LIVE · ${currentPair}` : "● IDLE"}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl flex-1 grid lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="space-y-4">
          <Card className="p-4 space-y-4 border-fuchsia-500/20">
            <h3 className="font-bold text-fuchsia-400 flex items-center gap-2"><Zap className="w-4 h-4" /> Configuration</h3>

            <div className="space-y-2">
              <Label>Pairs (comma separated, empty = all 34)</Label>
              <Input
                placeholder="USDBDT_OTC,USDPKR_OTC,..."
                value={pairsInput}
                onChange={(e) => setPairsInput(e.target.value)}
                disabled={running}
              />
            </div>

            <div className="space-y-2">
              <Label>Verification Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["off","ai","anti"] as const).map(m => (
                  <Button
                    key={m}
                    size="sm"
                    variant={verificationMode === m ? "default" : "outline"}
                    onClick={() => setVerificationMode(m)}
                    disabled={running}
                    className={verificationMode === m ? "bg-fuchsia-500 hover:bg-fuchsia-600" : ""}
                  >
                    {m === "off" ? "OFF" : m === "ai" ? "AI Normal" : "AI Anti"}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {verificationMode === "off" && "All original signals accepted"}
                {verificationMode === "ai" && "Trade only when AI agrees with original"}
                {verificationMode === "anti" && "Trade only when AI disagrees (contrarian)"}
              </p>
            </div>
          </Card>

          <Card className="p-4 space-y-4 border-fuchsia-500/20">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-fuchsia-400">Telegram Alerts</h3>
              <Switch checked={tgEnabled} onCheckedChange={setTgEnabled} disabled={running} />
            </div>
            {tgEnabled && (
              <>
                <div className="space-y-2">
                  <Label>Bot Token</Label>
                  <Input
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    disabled={running}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chat ID</Label>
                  <Input
                    placeholder="-1001234567890"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    disabled={running}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Aap khud apna bot token aur chat ID daleen — koi default nahi hai.
                </p>
              </>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {!running ? (
              <Button onClick={startScanner} className="col-span-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:opacity-90 h-12 font-bold">
                <Play className="w-4 h-4 mr-2" /> START SCANNER
              </Button>
            ) : (
              <Button onClick={stopScanner} variant="destructive" className="col-span-2 h-12 font-bold">
                <Square className="w-4 h-4 mr-2" /> STOP SCANNER
              </Button>
            )}
          </div>

          <Card className="p-4 border-fuchsia-500/20">
            <h3 className="font-bold text-fuchsia-400 flex items-center gap-2 mb-3"><Trophy className="w-4 h-4" /> Stats</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded bg-green-500/10">
                <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
              <div className="p-2 rounded bg-red-500/10">
                <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
              <div className="p-2 rounded bg-fuchsia-500/10">
                <div className="text-2xl font-bold text-fuchsia-400">{winRate}%</div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Console */}
        <Card className="lg:col-span-2 p-0 border-fuchsia-500/20 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-black/40">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-muted-foreground ml-2 font-mono">gm-neon-scanner ~ live</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setLogs([])} disabled={!logs.length}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div ref={logBoxRef} className="flex-1 overflow-y-auto bg-black/80 p-4 font-mono text-xs min-h-[500px] max-h-[70vh]">
            {logs.length === 0 && (
              <div className="text-muted-foreground/60 italic">
                {`╔════════════════════════════════════════════════════════════╗
║         GM BINARY SOCKET – NEON SCANNER PRO               ║
╚════════════════════════════════════════════════════════════╝

[+] Real-time 1-Minute Signal Scanner (600 candles)
[+] Live API + Advanced AI Price Action (GLM-5.1)
[+] Offsets: 2 & 3 minutes · Accuracy ≥ 61%

Press START to begin scanning...`}
              </div>
            )}
            {logs.map((l, i) => (
              <div key={i} className="leading-relaxed">
                <span className="text-muted-foreground">[{l.t}]</span>{" "}
                <span className={
                  l.type === "ok" ? "text-green-400" :
                  l.type === "err" ? "text-red-400" :
                  l.type === "warn" ? "text-yellow-400" :
                  l.type === "sig" ? "text-fuchsia-400 font-bold" :
                  "text-cyan-300"
                }>{l.msg}</span>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default NeonScannerPro;
