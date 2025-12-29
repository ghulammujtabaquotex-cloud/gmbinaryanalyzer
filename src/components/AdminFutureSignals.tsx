import { useState, useEffect } from 'react';
import { Trash2, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ParsedSignal {
  pair: string;
  signal_time: string;
  direction: string;
}

const AdminFutureSignals = () => {
  const [inputText, setInputText] = useState('');
  const [parsedSignals, setParsedSignals] = useState<ParsedSignal[]>([]);
  const [existingSignals, setExistingSignals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchExistingSignals();
  }, []);

  const fetchExistingSignals = async () => {
    const { data, error } = await supabase
      .from('future_signals_pool')
      .select('*')
      .order('signal_time', { ascending: true });

    if (!error && data) {
      setExistingSignals(data);
    }
  };

  const parseSignals = (text: string): ParsedSignal[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    const signals: ParsedSignal[] = [];
    
    // Regex: pair time direction
    // Matches: EURUSD 10:00 CALL, EUR/USD 10:00 PUT, EURUSD 9:30 UP
    const regex = /([A-Z]{3,6}[\/\-]?[A-Z]{3,6})\s+(\d{1,2}:\d{2})\s+(CALL|PUT|UP|DOWN)/gi;

    for (const line of lines) {
      const match = regex.exec(line);
      regex.lastIndex = 0; // Reset regex state
      
      if (match) {
        let pair = match[1].toUpperCase().replace(/[\/\-]/g, '');
        const time = match[2].padStart(5, '0'); // Ensure HH:MM format
        let direction = match[3].toUpperCase();
        
        // Normalize direction
        if (direction === 'UP') direction = 'CALL';
        if (direction === 'DOWN') direction = 'PUT';

        signals.push({
          pair,
          signal_time: time,
          direction,
        });
      }
    }

    return signals;
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    const parsed = parseSignals(text);
    setParsedSignals(parsed);
  };

  const uploadSignals = async () => {
    if (parsedSignals.length === 0) {
      toast.error('No valid signals to upload');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('future_signals_pool').insert(
        parsedSignals.map((s) => ({
          pair: s.pair,
          signal_time: s.signal_time,
          direction: s.direction,
        }))
      );

      if (error) throw error;

      toast.success(`${parsedSignals.length} signals uploaded successfully!`);
      setInputText('');
      setParsedSignals([]);
      fetchExistingSignals();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload signals');
    }
    setIsLoading(false);
  };

  const clearAllSignals = async () => {
    if (!confirm('Are you sure you want to delete ALL future signals?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('future_signals_pool')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      toast.success('All signals cleared!');
      setExistingSignals([]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear signals');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Future Signals Manager</h2>
        <Button
          variant="destructive"
          onClick={clearAllSignals}
          disabled={isLoading || existingSignals.length === 0}
          size="sm"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All Signals
        </Button>
      </div>

      {/* Input Area */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Paste Signals (one per line)
          </label>
          <Textarea
            value={inputText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={`Example format:\nEURUSD 10:00 CALL\nGBPUSD 10:05 PUT\nUSDJPY 10:15 CALL`}
            className="min-h-[200px] font-mono text-sm bg-background"
          />
        </div>

        {/* Preview */}
        {parsedSignals.length > 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-green-500 mb-3">
              <CheckCircle className="h-4 w-4" />
              <span>{parsedSignals.length} signals parsed</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm font-mono">
              {parsedSignals.map((s, i) => (
                <div
                  key={i}
                  className="bg-background/50 rounded px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-foreground">{s.pair}</span>
                  <span className="text-muted-foreground">{s.signal_time}</span>
                  <span
                    className={
                      s.direction === 'CALL' ? 'text-green-500' : 'text-red-500'
                    }
                  >
                    {s.direction}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inputText && parsedSignals.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span>No valid signals found. Check the format.</span>
          </div>
        )}

        <Button
          onClick={uploadSignals}
          disabled={isLoading || parsedSignals.length === 0}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload {parsedSignals.length} Signals
        </Button>
      </div>

      {/* Existing Signals */}
      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Current Signal Pool ({existingSignals.length})
        </h3>
        {existingSignals.length === 0 ? (
          <p className="text-muted-foreground text-sm">No signals in pool</p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-muted-foreground">Pair</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Direction</th>
                </tr>
              </thead>
              <tbody>
                {existingSignals.map((signal) => (
                  <tr key={signal.id} className="border-b border-border/50">
                    <td className="p-2 font-mono text-foreground">{signal.pair}</td>
                    <td className="p-2 text-muted-foreground">{signal.signal_time}</td>
                    <td
                      className={`p-2 font-semibold ${
                        signal.direction === 'CALL' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {signal.direction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFutureSignals;
