import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Loader2, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Timezone: user UTC+5, API UTC-3 -> offset +8
const TZ_OFFSET = 8;

function shiftTime(timeStr: string, hoursDelta: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  let total = h * 60 + m + hoursDelta * 60;
  total = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

const userToApi = (t: string) => shiftTime(t, -TZ_OFFSET);
const apiToUser = (t: string) => shiftTime(t, TZ_OFFSET);

function convertSignalTimes(list: string[], toUser: boolean): string[] {
  return list.map((sig) => {
    const parts = sig.split(";");
    if (parts.length < 4) return sig;
    const newTime = toUser ? apiToUser(parts[2]) : userToApi(parts[2]);
    return `${parts[0]};${parts[1]};${newTime};${parts.slice(3).join(";")}`;
  });
}

function getTodayUtc5(): string {
  const now = new Date();
  const utc5 = new Date(now.getTime() + 5 * 3600 * 1000);
  return utc5.toISOString().slice(0, 10);
}

function formatResultLine(sig: string): string {
  // sig format from API: TF;ASSET;TIME(api);DIRECTION;RESULT
  const parts = sig.split(";");
  if (parts.length < 5) return sig;
  const tf = parts[0];
  const asset = parts[1];
  const timeUser = apiToUser(parts[2]);
  const direction = parts[3];
  const result = parts[4].toUpperCase();

  let resultDisplay = result;
  if (result === "WIN") resultDisplay = "WIN ✅";
  else if (result === "LOSS" || result === "LOSE") resultDisplay = "LOSS ❌";
  else if (result === "G1") resultDisplay = "G1 ✅¹";
  else if (result === "G2") resultDisplay = "G2 ✅²";
  else if (result.startsWith("G")) resultDisplay = `${result} ✅`;

  return `${tf};${asset};${timeUser};${direction};${resultDisplay}`;
}

const SignalChecker = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(getTodayUtc5());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [stats, setStats] = useState<{ wins: number; gales: number; losses: number; total: number } | null>(null);

  const parseInput = (raw: string): string[] => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 1 && lines[0].includes(",")) {
      return lines[0].split(",").map((s) => s.trim()).filter(Boolean);
    }
    return lines;
  };

  const filterByTime = (signals: string[]): { kept: string[]; removed: number } => {
    const kept: string[] = [];
    let removed = 0;
    for (const sig of signals) {
      const parts = sig.split(";");
      if (parts.length >= 4) {
        const hour = parseInt(parts[2].split(":")[0]);
        if (!isNaN(hour) && hour < 8) { removed++; continue; }
      }
      kept.push(sig);
    }
    return { kept, removed };
  };

  const handleCheck = async () => {
    const raw = parseInput(input);
    if (!raw.length) { toast.error("Koi signals enter karo"); return; }

    const { kept, removed } = filterByTime(raw);
    if (removed > 0) toast.warning(`${removed} signal(s) before 08:00 removed`);
    if (!kept.length) { toast.error("No valid signals (all before 08:00)"); return; }

    setLoading(true); setOutput([]); setStats(null);
    setStatus(`Checking ${kept.length} signal(s)...`);

    try {
      const apiSignals = convertSignalTimes(kept, false);
      const info = { broker: "quotex", date, gale: 1, time: 1 };

      const { data: createData, error: createErr } = await supabase.functions.invoke("signal-checker", {
        body: { action: "create", signals: apiSignals, info },
      });
      if (createErr || !createData?.id) throw new Error(createData?.error || createErr?.message || "Check creation failed");

      const checkId = createData.id;
      setStatus(`🔍 Check ID: ${checkId} — waiting for results...`);

      let result: any = null;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const { data: pollData } = await supabase.functions.invoke("signal-checker", {
          body: { action: "poll", checkId },
        });
        if (pollData?.status === "finished") { result = pollData; break; }
        setStatus(`⏳ Polling... (${i + 1}/40)`);
      }

      if (!result) throw new Error("No result received (timeout)");

      const rawSignals: string[] = result.signals || [];
      const lines: string[] = [];
      let wins = 0, gales = 0, losses = 0;
      for (const sig of rawSignals) {
        if (typeof sig === "string" && sig.startsWith("\n")) {
          lines.push(sig.trim());
          continue;
        }
        const formatted = formatResultLine(sig);
        lines.push(formatted);
        const parts = sig.split(";");
        const r = (parts[4] || "").toUpperCase();
        if (r === "WIN") wins++;
        else if (r === "LOSS" || r === "LOSE") losses++;
        else if (r.startsWith("G")) gales++;
      }

      const total = wins + gales + losses;
      const winPct = total > 0 ? ((wins + gales) / total) * 100 : 0;

      // Append summary
      lines.push("");
      lines.push(`🔰 ${wins}x${gales} | (${winPct.toFixed(1)}%)`);
      lines.push("");
      lines.push(`✅ Win: ${String(wins).padStart(2, "0")}`);
      lines.push(`❌ Loss: ${String(losses).padStart(2, "0")}`);

      setOutput(lines);
      setStats({ wins, gales, losses, total });
      setStatus("");
      toast.success("Results ready!");
    } catch (e: any) {
      toast.error(e.message || "Check failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output.join("\n"));
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Signal Result Checker</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> UTC+5 Timezone
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Verification Date (UTC+5)</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signals">Paste Signals (UTC+5)</Label>
            <Textarea
              id="signals"
              placeholder={"M1;FB-OTC;15:25;CALL\nM1;USDCOP-OTC;15:26;PUT\n..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>M1;PAIR;HH:MM;CALL/PUT</code> — one per line. Signals before 08:00 are ignored.
            </p>
          </div>
          <Button
            onClick={handleCheck}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-500/90 text-black font-semibold"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Verify Results</>}
          </Button>
          {status && <p className="text-sm text-muted-foreground text-center">{status}</p>}
        </Card>

        {output.length > 0 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">✅ Verification Results (UTC+5)</h2>
              <Button variant="outline" size="sm" onClick={copyOutput}>
                <Copy className="w-4 h-4 mr-1" /> Copy
              </Button>
            </div>
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{stats.wins}</div>
                  <div className="text-xs text-muted-foreground">✅ Wins</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.gales}</div>
                  <div className="text-xs text-muted-foreground">✅¹ Gales</div>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-center">
                  <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
                  <div className="text-xs text-muted-foreground">❌ Losses</div>
                </div>
              </div>
            )}
            <pre className="bg-muted/30 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap break-words border border-border/50">
{output.join("\n")}
            </pre>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SignalChecker;
