import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings2, Play, Square } from "lucide-react";

export interface SignalConfig {
  timeframe: number;
  maxMartingale: number;
  minWinPercent: number;
  analysisDays: number;
  startTime: string;
  endTime: string;
  assets: string[];
}

interface SignalBotConfigProps {
  config: SignalConfig;
  onConfigChange: (config: SignalConfig) => void;
  onGenerate: () => void;
  onStop: () => void;
  isGenerating: boolean;
}

const ALL_ASSETS = [
  { id: 'BRLUSD_otc', name: 'BRL/USD' },
  { id: 'USDBDT_otc', name: 'USD/BDT' },
  { id: 'USDARS_otc', name: 'USD/ARS' },
  { id: 'USDINR_otc', name: 'USD/INR' },
  { id: 'USDMXN_otc', name: 'USD/MXN' },
  { id: 'USDPKR_otc', name: 'USD/PKR' },
  { id: 'USDPHP_otc', name: 'USD/PHP' },
  { id: 'USDEGP_otc', name: 'USD/EGP' },
  { id: 'USDTRY_otc', name: 'USD/TRY' },
  { id: 'USDIDR_otc', name: 'USD/IDR' },
  { id: 'USDZAR_otc', name: 'USD/ZAR' },
];

const TIMEFRAMES = [
  { value: 1, label: '1 min' },
  { value: 2, label: '2 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
];

export const SignalBotConfig = ({
  config,
  onConfigChange,
  onGenerate,
  onStop,
  isGenerating
}: SignalBotConfigProps) => {
  const handleAssetToggle = (assetId: string) => {
    const newAssets = config.assets.includes(assetId)
      ? config.assets.filter(a => a !== assetId)
      : [...config.assets, assetId];
    onConfigChange({ ...config, assets: newAssets });
  };

  const handleSelectAll = () => {
    if (config.assets.length === ALL_ASSETS.length) {
      onConfigChange({ ...config, assets: [] });
    } else {
      onConfigChange({ ...config, assets: ALL_ASSETS.map(a => a.id) });
    }
  };

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings2 className="w-5 h-5 text-amber-500" />
          Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timeframe */}
        <div className="space-y-2">
          <Label>Timeframe</Label>
          <Select
            value={config.timeframe.toString()}
            onValueChange={(v) => onConfigChange({ ...config, timeframe: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEFRAMES.map(tf => (
                <SelectItem key={tf.value} value={tf.value.toString()}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Analysis Days */}
        <div className="space-y-2">
          <Label>Analysis Days: {config.analysisDays}</Label>
          <Slider
            value={[config.analysisDays]}
            onValueChange={([v]) => onConfigChange({ ...config, analysisDays: v })}
            min={7}
            max={40}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>7 days</span>
            <span>40 days</span>
          </div>
        </div>

        {/* Minimum Win % */}
        <div className="space-y-2">
          <Label>Minimum Win %: {config.minWinPercent}%</Label>
          <Slider
            value={[config.minWinPercent]}
            onValueChange={([v]) => onConfigChange({ ...config, minWinPercent: v })}
            min={65}
            max={100}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>65%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Max Martingale */}
        <div className="space-y-2">
          <Label>Max Martingale Level: M{config.maxMartingale}</Label>
          <Select
            value={config.maxMartingale.toString()}
            onValueChange={(v) => onConfigChange({ ...config, maxMartingale: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">M0 (85%+ only)</SelectItem>
              <SelectItem value="1">M1 (75%+ allowed)</SelectItem>
              <SelectItem value="2">M2 (70%+ allowed)</SelectItem>
              <SelectItem value="3">M3 (65%+ allowed)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time Range */}
        <div className="space-y-2">
          <Label>Time Range (PKT UTC+5)</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="time"
                value={config.startTime}
                onChange={(e) => onConfigChange({ ...config, startTime: e.target.value })}
                className="w-full"
              />
            </div>
            <span className="flex items-center text-muted-foreground">to</span>
            <div className="flex-1">
              <Input
                type="time"
                value={config.endTime}
                onChange={(e) => onConfigChange({ ...config, endTime: e.target.value })}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Asset Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Assets ({config.assets.length}/{ALL_ASSETS.length})</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 text-xs"
            >
              {config.assets.length === ALL_ASSETS.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-background/50 rounded-lg">
            {ALL_ASSETS.map(asset => (
              <div key={asset.id} className="flex items-center gap-2">
                <Checkbox
                  id={asset.id}
                  checked={config.assets.includes(asset.id)}
                  onCheckedChange={() => handleAssetToggle(asset.id)}
                />
                <label htmlFor={asset.id} className="text-sm cursor-pointer">
                  {asset.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          {isGenerating ? (
            <Button
              onClick={onStop}
              variant="destructive"
              className="w-full"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Generation
            </Button>
          ) : (
            <Button
              onClick={onGenerate}
              disabled={config.assets.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              <Play className="w-4 h-4 mr-2" />
              Generate Signals
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
