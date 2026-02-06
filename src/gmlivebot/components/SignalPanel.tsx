import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, PlayCircle, ArrowUp, ArrowDown, StopCircle, Zap, BarChart3, Target, Activity, Radar, CheckSquare, AlertTriangle, MinusCircle } from 'lucide-react';
import { analyzeMarket } from '../services/technicalAnalysis';
import { OHLC, SignalResponse } from '../types';
import { AVAILABLE_SYMBOLS } from '../constants';
import { getTelegramSettings, sendResultAlert, sendSignalAlert } from '../services/telegramService';
import { sendSystemNotification } from '../services/notificationService';
import { initBackgroundMode } from '../services/audioService';

interface SignalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  candles: OHLC[];
  candlesRef?: React.MutableRefObject<OHLC[]>;
  currentCandle: OHLC | null;
  isLoading: boolean;
  onSignalFound: (symbol: string, type: 'CALL' | 'PUT', entryTime: string, title?: string, variant?: 'default' | 'warning') => void;
}

interface EnrichedSignal extends SignalResponse { symbol: string; foundAt: number; }

export const SignalPanel: React.FC<SignalPanelProps> = ({ isOpen, onClose, activeSymbol, setActiveSymbol, candles, candlesRef, currentCandle, isLoading, onSignalFound }) => {
  const [uiState, setUiState] = useState<'IDLE' | 'SWITCHING' | 'LOADING' | 'MONITORING' | 'COMPLETED'>('IDLE');
  const [uiResult, setUiResult] = useState<EnrichedSignal | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [stats, setStats] = useState({ wins: 0, losses: 0 });
  const [progress, setProgress] = useState(0);
  const [selectedPairs] = useState<string[]>(AVAILABLE_SYMBOLS.map(s => s.id));

  const isScanningRef = useRef(false);
  const currentIndexRef = useRef(0);
  const pollIntervalRef = useRef<any>(null);
  const monitorIntervalRef = useRef<any>(null);
  const processingResultRef = useRef<EnrichedSignal | null>(null);
  const scanStartTimeRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);

  useEffect(() => {
    const savedWins = parseInt(localStorage.getItem('tsp_win_count') || '0');
    const savedLosses = parseInt(localStorage.getItem('tsp_loss_count') || '0');
    setStats({ wins: savedWins, losses: savedLosses });
  }, [isOpen]);

  const stopScanner = useCallback(() => {
    isScanningRef.current = false;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    setUiState('IDLE');
    setUiResult(null);
    setStatusMessage('Scanner Stopped');
    setProgress(0);
  }, []);

  const finalizeTrade = (outcome: 'DIRECT_WIN' | 'MTG_WIN' | 'LOSS' | 'TIMEOUT' | 'DOJI') => {
    if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    const isWin = outcome === 'DIRECT_WIN' || outcome === 'MTG_WIN';
    const isLoss = outcome === 'LOSS';
    const currentWins = parseInt(localStorage.getItem('tsp_win_count') || '0');
    const currentLosses = parseInt(localStorage.getItem('tsp_loss_count') || '0');
    const newWins = currentWins + (isWin ? 1 : 0);
    const newLosses = currentLosses + (isLoss ? 1 : 0);
    localStorage.setItem('tsp_win_count', newWins.toString());
    localStorage.setItem('tsp_loss_count', newLosses.toString());
    setStats({ wins: newWins, losses: newLosses });

    const res = processingResultRef.current;
    if (res) {
      const settings = getTelegramSettings();
      if (settings && settings.isEnabled) {
        sendResultAlert(settings, res.symbol, outcome, res.entryTime, { wins: newWins, losses: newLosses }, true);
      }
    }
    setStatusMessage(`Result: ${outcome}`);
    setUiState('COMPLETED');
  };

  const startMonitoring = (signal: EnrichedSignal) => {
    if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    monitorIntervalRef.current = setInterval(() => {
      if (!isScanningRef.current) { clearInterval(monitorIntervalRef.current); return; }
      const liveData = candlesRef?.current || [];
      const nowSec = Math.floor(Date.now() / 1000);
      const step = currentStepRef.current;
      const targetTime = signal.targetCandleTime + (step * 60);
      const targetCandle = liveData.find(c => Math.abs(c.time - targetTime) <= 5);

      if (targetCandle) {
        const close = targetCandle.close;
        const open = targetCandle.open;
        const isCall = signal.signal === 'CALL';
        const isDoji = Math.abs(close - open) < 0.000001;
        if (isDoji) { finalizeTrade('DOJI'); return; }
        let isWin = false;
        if (isCall && close > open) isWin = true;
        if (!isCall && close < open) isWin = true;
        if (isWin) { finalizeTrade(step === 0 ? 'DIRECT_WIN' : 'MTG_WIN'); }
        else { if (step === 0) { currentStepRef.current = 1; setStatusMessage("DIRECT LOSS. MONITORING MTG 1..."); } else { finalizeTrade('LOSS'); } }
        return;
      }
      if (nowSec > targetTime + 300 && !targetCandle) { finalizeTrade('TIMEOUT'); return; }
      const wait = targetTime - nowSec;
      if (wait > 0) setStatusMessage(step === 0 ? `Waiting Entry (${wait}s)...` : `Waiting MTG Entry (${wait}s)...`);
      else setStatusMessage('Candle Forming...');
    }, 1000);
  };

  const analyzeData = (symbol: string, data: OHLC[]) => {
    setStatusMessage('Checking patterns...');
    try {
      const analysis = analyzeMarket(data, true);
      const isValid = analysis.signal !== 'NEUTRAL' && analysis.confidence >= 85;
      if (isValid) {
        const enriched: EnrichedSignal = { ...analysis, symbol: symbol, foundAt: Date.now() };
        processingResultRef.current = enriched;
        currentStepRef.current = 0;
        setUiResult(enriched);
        setUiState('MONITORING');
        setStatusMessage('Monitoring Trade (M0)...');
        setProgress(100);
        const settings = getTelegramSettings();
        const currentPrice = data[data.length - 1]?.close || 0;
        if (settings && settings.isEnabled) {
          sendSignalAlert(settings, symbol, analysis.signal as 'CALL'|'PUT', analysis.entryTime, analysis.confidence, currentPrice, true);
        }
        sendSystemNotification(`SIGNAL: ${symbol}`, `${analysis.signal} @ ${analysis.entryTime}`);
        startMonitoring(enriched);
      } else {
        setStatusMessage('No Signal Found');
        setTimeout(() => { if (isScanningRef.current) runScanLoop(); }, 1500);
      }
    } catch { if (isScanningRef.current) runScanLoop(); }
  };

  const runScanLoop = useCallback(async () => {
    if (!isScanningRef.current) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const pairs = selectedPairs.length > 0 ? selectedPairs : AVAILABLE_SYMBOLS.map(s => s.id);
    let idx = currentIndexRef.current;
    if (idx >= pairs.length) idx = 0;
    currentIndexRef.current = idx + 1;
    const symbol = pairs[idx];
    setActiveSymbol(symbol);
    setUiState('SWITCHING');
    setStatusMessage(`Switching to ${symbol.replace(/_otc/gi, '')}...`);
    setProgress(5);
    scanStartTimeRef.current = Date.now();
    retryCountRef.current = 0;

    pollIntervalRef.current = setInterval(() => {
      if (!isScanningRef.current) { clearInterval(pollIntervalRef.current); return; }
      const now = Date.now();
      const elapsed = now - scanStartTimeRef.current;
      const liveData = candlesRef?.current || [];
      const isDataReady = liveData.length >= 20;
      if (!isDataReady) {
        if (elapsed > 2000) {
          const currentRetryCycle = Math.floor((elapsed - 2000) / 3000) + 1;
          if (currentRetryCycle > retryCountRef.current) {
            retryCountRef.current = currentRetryCycle;
            if (retryCountRef.current > 3) { clearInterval(pollIntervalRef.current); runScanLoop(); return; }
            setUiState('LOADING');
            setStatusMessage(`Connection Retry (${retryCountRef.current}/3)...`);
            setProgress(10 + (retryCountRef.current * 10));
          }
        }
        return;
      }
      if (elapsed < 5000) {
        setUiState('LOADING');
        const remaining = Math.ceil((5000 - elapsed) / 1000);
        setStatusMessage(`Analyzing Market... (${remaining}s)`);
        setProgress(40 + ((elapsed / 5000) * 50));
        return;
      }
      clearInterval(pollIntervalRef.current);
      setProgress(100);
      analyzeData(symbol, liveData);
    }, 1000);
  }, [selectedPairs, setActiveSymbol, candlesRef]);

  const handleStart = async () => {
    await initBackgroundMode();
    isScanningRef.current = true;
    currentIndexRef.current = 0;
    currentStepRef.current = 0;
    runScanLoop();
  };

  useEffect(() => { return () => stopScanner(); }, []);

  if (!isOpen) return null;

  const displaySymbolID = uiResult ? uiResult.symbol : activeSymbol;
  const displayName = AVAILABLE_SYMBOLS.find(s => s.id === displaySymbolID)?.name || displaySymbolID;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xs bg-black border border-[#2a2e39] rounded-2xl shadow-2xl flex flex-col relative overflow-hidden max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] bg-[#050505] shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-green-500/10 rounded-lg"><Target className="w-4 h-4 text-green-500" /></div>
            <div>
              <h2 className="text-white font-bold text-xs tracking-wide">AI SCANNER</h2>
              <span className="text-[9px] text-gray-400 font-mono">M0 + 1 STEP MTG</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#1a1a1a] text-gray-500"><X className="w-3.5 h-3.5" /></button>
        </div>

        <div className="p-4 h-[300px] flex flex-col bg-black w-full">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex flex-col overflow-hidden mr-2">
              <span className="text-[9px] text-gray-500 font-bold">STATUS</span>
              <span className="text-xs font-bold text-white tracking-wide truncate">{displayName}</span>
            </div>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${uiState !== 'IDLE' ? 'bg-green-500/10 text-green-400' : 'bg-gray-800/30 text-gray-500'}`}>{uiState}</span>
          </div>

          {(uiState === 'SWITCHING' || uiState === 'LOADING') && (
            <div className="mb-4 shrink-0">
              <div className="h-1 w-full bg-[#1a1a1a] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-[9px] text-center text-gray-600 mt-1.5 font-mono animate-pulse">{statusMessage}</p>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center min-h-0">
            {uiResult ? (
              <div className={`relative p-4 rounded-xl border ${uiResult.signal === 'CALL' ? 'bg-green-500/5 border-green-500/50' : 'bg-red-500/5 border-red-500/50'}`}>
                <div className="flex items-center justify-center gap-3 mb-2">
                  {uiResult.signal === 'CALL' ? <ArrowUp className="w-8 h-8 text-green-500" /> : <ArrowDown className="w-8 h-8 text-red-500" />}
                  <h1 className={`text-3xl font-black leading-none ${uiResult.signal === 'CALL' ? 'text-green-500' : 'text-red-500'}`}>{uiResult.signal}</h1>
                </div>
                <div className="mt-4 flex justify-between items-center bg-black/40 rounded px-3 py-2 border border-gray-800">
                  <span className="text-[10px] text-gray-400 font-bold">ENTRY</span>
                  <span className="text-base font-mono font-bold text-white">{uiResult.entryTime}</span>
                </div>
                <div className="mt-4 p-2 bg-gray-900/50 border border-gray-800 rounded flex items-center justify-center gap-2">
                  {statusMessage.includes('WIN') ? <CheckSquare className="w-3 h-3 text-green-400" /> : statusMessage.includes('LOSS') ? <AlertTriangle className="w-3 h-3 text-red-400" /> : statusMessage.includes('DOJI') ? <MinusCircle className="w-3 h-3 text-gray-400" /> : <Activity className="w-3 h-3 text-blue-400 animate-pulse" />}
                  <span className="text-[10px] text-gray-300 font-bold tracking-wide">{statusMessage}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center opacity-40 h-full gap-2">
                {(uiState === 'SWITCHING' || uiState === 'LOADING') ? <Radar className="w-12 h-12 text-gray-700 animate-pulse" /> : <BarChart3 className="w-12 h-12 text-gray-800" />}
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-[#1a1a1a] bg-[#050505] shrink-0">
          <button
            onClick={uiState !== 'IDLE' ? stopScanner : handleStart}
            className={`w-full py-3 rounded-lg font-black text-xs tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
              uiState !== 'IDLE' ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' : 'bg-[#00E676] text-black hover:bg-[#00c853]'
            }`}
          >
            {uiState !== 'IDLE' ? <StopCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            {uiState !== 'IDLE' ? 'STOP SCANNER' : 'START AUTO-SCAN'}
          </button>
        </div>
      </div>
    </div>
  );
};
