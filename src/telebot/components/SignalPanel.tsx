import React, { useState, useEffect, useRef } from 'react';
import { Radar, TrendingUp, TrendingDown, X, PlayCircle, Clock, AlertTriangle, Target, BarChart3, ArrowUp, ArrowDown, CheckCircle2, Settings, Square, CheckSquare, StopCircle, Hourglass } from 'lucide-react';
import { analyzeMarket } from '../services/technicalAnalysis';
import { OHLC, SignalResponse } from '../types';
import { AVAILABLE_SYMBOLS } from '../constants';
import { playSuccessAlert } from '../services/audioService';
import { supabase } from '@/integrations/supabase/client';

interface SignalPanelProps {
  activeSymbol: string;
  setActiveSymbol: (symbol: string) => void;
  candles: OHLC[];
  isLoading: boolean;
  onSignalFound: (symbol: string, type: 'CALL' | 'PUT', entryTime: string, title?: string, variant?: 'default' | 'warning') => void;
}

interface EnrichedSignal extends SignalResponse {
    symbol: string;
    foundAt: number;
}

type WorkflowState = 'IDLE' | 'SWITCHING_SYMBOL' | 'ANALYZING' | 'TRADED_COOLDOWN';

const getConfidenceConfig = (conf: number) => {
    if (conf >= 85) return { label: "M0 - DIRECT WIN", color: "text-green-400" };
    if (conf >= 75) return { label: "M1 - STRONG", color: "text-yellow-400" };
    return { label: "LOW CONFIDENCE", color: "text-gray-400" };
};

export const SignalPanel: React.FC<SignalPanelProps> = ({ activeSymbol, setActiveSymbol, candles, isLoading, onSignalFound }) => {
  // --- STATE ---
  const [result, setResult] = useState<EnrichedSignal | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState>('IDLE');

  // Auto-Scan Logic
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<string[]>(AVAILABLE_SYMBOLS.map(s => s.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Position
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // --- ACTIONS ---

  const handleNextPair = () => {
      setResult(null);
      setWorkflowState('SWITCHING_SYMBOL');
      setCurrentIndex(prev => {
          if (selectedPairs.length === 0) return 0;
          return (prev + 1) % selectedPairs.length;
      });
  };

  const togglePairSelection = (id: string) => {
      setSelectedPairs(prev =>
          prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      );
  };

  // --- WORKFLOW DRIVER ---

  // 1. Reset/Init when scanning starts
  useEffect(() => {
      if (isScanning && workflowState === 'IDLE') {
          setWorkflowState('SWITCHING_SYMBOL');
      }
      if (!isScanning) {
          setWorkflowState('IDLE');
          setResult(null);
      }
  }, [isScanning]);

  // 2. Switch Symbol Effect
  useEffect(() => {
      if (workflowState === 'SWITCHING_SYMBOL' && isScanning) {
          if (selectedPairs.length === 0) {
              setIsScanning(false);
              alert("No pairs selected!");
              return;
          }

          const nextSymbol = selectedPairs[currentIndex];
          if (activeSymbol !== nextSymbol) {
              setActiveSymbol(nextSymbol);
          }
      }
  }, [workflowState, currentIndex, selectedPairs, isScanning]);

  // 3. Data Listener
  useEffect(() => {
      if (!isScanning) return;

      const targetSymbol = selectedPairs[currentIndex];
      const isDataReady = !isLoading && candles.length > 35 && activeSymbol === targetSymbol;

      if (workflowState === 'SWITCHING_SYMBOL' && isDataReady) {
          const timer = setTimeout(() => {
              setWorkflowState('ANALYZING');
          }, 1200);
          return () => clearTimeout(timer);
      }
  }, [candles, isLoading, activeSymbol, workflowState, currentIndex, selectedPairs, isScanning]);

  // 4. Timeout Guard (Skip if data fails)
  useEffect(() => {
      let timeoutId: ReturnType<typeof setTimeout>;
      if (isScanning && workflowState === 'SWITCHING_SYMBOL') {
          timeoutId = setTimeout(() => {
              handleNextPair();
          }, 4500);
      }
      return () => clearTimeout(timeoutId);
  }, [isScanning, workflowState, currentIndex]);

  // 5. Analyzer Logic
  useEffect(() => {
      if (workflowState === 'ANALYZING') {
          const analysis = analyzeMarket(candles);

          if (analysis.signal !== 'NEUTRAL' && analysis.confidence >= 75) {
              const enriched = { ...analysis, symbol: activeSymbol, foundAt: Date.now() };
              setResult(enriched);

              playSuccessAlert();
              onSignalFound(activeSymbol, analysis.signal, analysis.entryTime, "SIGNAL FOUND", 'default');

              // Send signal to Telegram via edge function
              const sendToTelegram = async () => {
                try {
                  const price = candles.length > 0 ? candles[candles.length - 1].close.toFixed(5) : "0.00000";
                  await supabase.functions.invoke('send-signal-telegram', {
                    body: {
                      signals: [{
                        pair: activeSymbol,
                        signal_time: analysis.entryTime,
                        direction: analysis.signal,
                        price: price,
                        confidence: analysis.confidence
                      }],
                      userType: 'TELEBOT',
                      format: 'telebot'
                    }
                  });
                  console.log('Signal sent to Telegram');
                } catch (err) {
                  console.error('Failed to send to Telegram:', err);
                }
              };
              sendToTelegram();

              setWorkflowState('TRADED_COOLDOWN');
          } else {
              handleNextPair();
          }
      }
  }, [workflowState]);

  // 6. WAIT FOR CANDLE EXPIRY
  useEffect(() => {
    if (workflowState === 'TRADED_COOLDOWN' && result && isScanning) {
        const lastCandle = candles[candles.length - 1];

        if (lastCandle && result.targetCandleTime > 0) {
            if (lastCandle.time > result.targetCandleTime) {
                 const timer = setTimeout(() => {
                     handleNextPair();
                 }, 1000);
                 return () => clearTimeout(timer);
            }
        }
    }
  }, [workflowState, candles, result, isScanning]);

  // --- DRAG LOGIC ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (dx * dx + dy * dy > 5) hasMoved.current = true;
      setPosition({ x: initialPos.current.x + dx, y: initialPos.current.y + dy });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const toggleOpen = () => { if (!hasMoved.current) setIsOpen(!isOpen); };

  const displayName = AVAILABLE_SYMBOLS.find(s => s.id === activeSymbol)?.name || activeSymbol;

  // --- SETTINGS ---
  if (isSettingsOpen) {
      return (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
              <div className="bg-[#1e222d] border border-[#2a2e39] rounded-lg w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl">
                  <div className="p-3 border-b border-[#2a2e39] flex justify-between items-center bg-[#0e1118]">
                      <h3 className="text-white font-bold flex items-center gap-2">Scanner Settings</h3>
                      <button onClick={() => setIsSettingsOpen(false)}><X className="w-4 h-4 text-gray-500 hover:text-white"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      <div className="grid grid-cols-1 gap-1">
                          {AVAILABLE_SYMBOLS.map(s => (
                              <div key={s.id}
                                   onClick={() => togglePairSelection(s.id)}
                                   className={`flex items-center gap-3 p-2 rounded cursor-pointer ${selectedPairs.includes(s.id) ? 'bg-purple-900/20 border-purple-500/50' : 'bg-[#131722]'}`}
                              >
                                  {selectedPairs.includes(s.id) ? <CheckSquare className="w-4 h-4 text-purple-500"/> : <Square className="w-4 h-4 text-gray-600"/>}
                                  <span className="text-sm text-gray-300">{s.name}</span>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="p-3 border-t border-[#2a2e39] bg-[#0e1118]">
                      <button onClick={() => setIsSettingsOpen(false)} className="w-full py-2 bg-purple-600 rounded font-bold text-white">Save</button>
                  </div>
              </div>
          </div>
      );
  }

  // --- COMPACT ICON ---
  if (!isOpen) {
      return (
          <div
            className="fixed z-50 cursor-move"
            style={{ left: position.x, top: position.y }}
            onMouseDown={handleMouseDown}
            onClick={toggleOpen}
          >
              <div className="relative group">
                {isScanning && (
                    <div className="absolute -inset-1 rounded-full bg-purple-500 opacity-50 animate-ping"></div>
                )}
                <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors ${
                    isScanning ? 'bg-[#1e222d] border-purple-500' : 'bg-[#1e222d] border-gray-600'
                }`}>
                    <Target className={`w-6 h-6 ${isScanning ? 'text-purple-500 animate-spin' : 'text-gray-300'}`} />
                </div>
              </div>
          </div>
      );
  }

  // --- MAIN PANEL ---
  return (
    <div
        className="fixed z-50 w-72 bg-[#1e222d] border border-[#2a2e39] rounded shadow-2xl overflow-hidden flex flex-col font-sans"
        style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-2 bg-[#0e1118] border-b border-[#2a2e39] flex justify-between items-center cursor-move" onMouseDown={handleMouseDown}>
        <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-bold text-white">AUTO SCANNER</span>
        </div>
        <div className="flex items-center gap-2">
             <button onClick={() => setIsSettingsOpen(true)}><Settings className="w-3.5 h-3.5 text-gray-500 hover:text-white" /></button>
             <button onClick={() => setIsOpen(false)}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button>
        </div>
      </div>

      <div className="p-4 bg-[#131722]">

        {/* HEADER STATUS */}
        <div className="flex justify-between items-center mb-3">
             <span className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[100px]">{displayName}</span>
             <span className={`text-[10px] font-bold ${isScanning ? 'text-purple-400' : 'text-gray-500'}`}>
                 {workflowState === 'SWITCHING_SYMBOL' ? 'LOADING...' :
                  workflowState === 'ANALYZING' ? 'CALCULATING...' :
                  workflowState === 'TRADED_COOLDOWN' ? 'TRADE ACTIVE' :
                  isScanning ? 'SCANNING...' : 'PAUSED'}
             </span>
        </div>

        {/* PROGRESS BAR */}
        {isScanning && workflowState !== 'TRADED_COOLDOWN' && (
             <div className="w-full h-1 bg-gray-700 rounded-full mb-4 overflow-hidden">
                 <div className="h-full bg-purple-500 animate-pulse w-full"></div>
             </div>
        )}

        {/* RESULTS AREA */}
        {result ? (
            <div className="space-y-4">

                {/* SIGNAL CARD */}
                <div className={`p-4 rounded border-2 ${
                    result.signal === 'CALL' ? 'bg-green-900/20 border-green-500' :
                    'bg-red-900/20 border-red-500'
                }`}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                             <span className={`text-3xl font-black ${result.signal === 'CALL' ? 'text-green-500' : 'text-red-500'}`}>
                                 {result.signal}
                             </span>
                             <span className={`text-[10px] font-bold tracking-wider ${getConfidenceConfig(result.confidence).color}`}>
                                 {getConfidenceConfig(result.confidence).label} ({result.confidence}%)
                             </span>
                        </div>
                        {result.signal === 'CALL' ? <ArrowUp className="w-10 h-10 text-green-500" /> : <ArrowDown className="w-10 h-10 text-red-500" />}
                    </div>

                    {/* ENTRY TIME BOX */}
                    <div className="mt-4 bg-[#0e1118] rounded p-2 border border-[#2a2e39] flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <Clock className="w-5 h-5 text-purple-400" />
                             <span className="text-xs text-gray-400 font-bold">ENTRY TIME:</span>
                         </div>
                         <span className="text-xl font-mono font-bold text-white tracking-widest">
                             {result.entryTime}
                         </span>
                    </div>

                    <div className="mt-2 text-center">
                         <span className="text-[9px] text-gray-500 uppercase">UTC+5 ISLAMABAD TIME</span>
                    </div>
                </div>

                {workflowState === 'TRADED_COOLDOWN' && (
                    <div className="flex items-center justify-center gap-2 p-2 bg-purple-900/20 rounded border border-purple-500/30">
                        <Hourglass className="w-4 h-4 text-purple-400 animate-pulse" />
                        <span className="text-xs font-bold text-purple-300">WAITING FOR ENTRY END...</span>
                    </div>
                )}
            </div>
        ) : (
            <div className="flex flex-col gap-4">
                <div className="h-24 border-2 border-dashed border-[#2a2e39] rounded bg-[#1e222d] flex flex-col items-center justify-center text-center p-4">
                    <Radar className="w-8 h-8 text-gray-600 mb-2" />
                    <span className="text-xs text-gray-400 font-medium">
                        {isScanning
                            ? `Checking ${selectedPairs[currentIndex]?.replace('_otc', '')}...`
                            : "System Ready. Start Auto-Scan."}
                    </span>
                </div>

                <button
                    onClick={() => setIsScanning(!isScanning)}
                    className={`w-full py-3 font-bold text-sm rounded shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                        isScanning
                            ? 'bg-red-500/20 text-red-400 border border-red-500 hover:bg-red-500/30'
                            : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 text-white'
                    }`}
                >
                    {isScanning ? (
                        <> <StopCircle className="w-4 h-4" /> STOP SCANNER </>
                    ) : (
                        <> <PlayCircle className="w-4 h-4" /> START AUTO SCAN </>
                    )}
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
