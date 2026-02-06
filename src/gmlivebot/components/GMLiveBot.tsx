import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { ChartHeader } from './ChartHeader';
import { TradingViewChart, ChartRef } from './TradingViewChart';
import { SignalPanel } from './SignalPanel';
import { NotificationPopup, AlertData } from './NotificationPopup';
import { useMarketData } from '../hooks/useMarketData';
import { AVAILABLE_SYMBOLS } from '../constants';
import { requestNotificationPermission } from '../services/notificationService';
import { useWakeLock } from '../hooks/useWakeLock';

export const GMLiveBot: React.FC = () => {
  const [activeSymbol, setActiveSymbol] = useState(AVAILABLE_SYMBOLS[0].id);
  const [activeAlert, setActiveAlert] = useState<AlertData | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const { candles, candlesRef, currentCandle, connectionStatus, isLoading, refetch } = useMarketData(activeSymbol);
  const chartRef = useRef<ChartRef>(null);

  useWakeLock(true);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const handleScannerSignal = async (
    symbol: string,
    type: 'CALL' | 'PUT',
    entryTime: string,
    title?: string,
    variant?: 'default' | 'warning'
  ) => {
    setActiveAlert({
      symbol: symbol,
      type: type,
      time: new Date().toLocaleTimeString(),
      price: 0,
      entryTime: entryTime,
      title: title,
      variant: variant
    });
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex flex-col items-center">
              <span className="text-gray-200 font-bold text-sm tracking-wide">INITIALIZING</span>
              <span className="text-gray-500 text-xs mt-1">Connecting to Market Data...</span>
            </div>
          </div>
        </div>
      );
    }

    if (candles.length === 0 && !currentCandle) {
      return (
        <div className="flex items-center justify-center h-full w-full bg-black z-10 relative">
          <div className="flex flex-col items-center gap-4 text-red-400 text-center px-4">
            <AlertCircle className="w-12 h-12" />
            <span className="text-lg font-medium">No Data Available</span>
            <p className="text-xs text-gray-500 max-w-[200px] mb-2">Check internet connection or try a different asset.</p>
            <button
              onClick={() => refetch()}
              className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#363a45] text-white rounded text-sm transition-colors border border-gray-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload
            </button>
          </div>
        </div>
      );
    }

    return (
      <TradingViewChart
        ref={chartRef}
        data={candles}
        currentCandle={currentCandle}
        config={{
          symbol: activeSymbol,
          interval: '1m',
          limit: 500,
          timezoneOffset: -1
        }}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-black text-white overflow-hidden select-none font-sans relative">
      <ChartHeader
        price={currentCandle?.close}
        status={connectionStatus}
        activeSymbol={activeSymbol}
        onSymbolChange={setActiveSymbol}
        onRefresh={refetch}
      />

      <main className="flex-1 w-full h-full relative z-0 bg-black">
        {renderContent()}
      </main>

      <NotificationPopup
        alert={activeAlert}
        onClose={() => setActiveAlert(null)}
      />

      <SignalPanel
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        activeSymbol={activeSymbol}
        setActiveSymbol={setActiveSymbol}
        onSignalFound={handleScannerSignal}
        candles={candles}
        candlesRef={candlesRef}
        currentCandle={currentCandle}
        isLoading={isLoading}
      />

      {/* FLOATING SCANNER BUTTON */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
        <button
          onClick={() => setIsScannerOpen(true)}
          className={`flex items-center gap-2 px-6 py-2 rounded-full border shadow-2xl backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
            isScannerOpen
              ? 'bg-blue-500/20 border-blue-500 text-blue-400'
              : 'bg-[#1a1a1a]/90 border-[#333] text-gray-200 hover:border-blue-500 hover:text-white hover:bg-blue-600/20'
          }`}
        >
          <Zap className={`w-4 h-4 ${isScannerOpen ? 'fill-current' : ''}`} />
          <span className="text-xs font-black tracking-widest">AUTO ANALYSIS</span>
        </button>
      </div>
    </div>
  );
};

export default GMLiveBot;
