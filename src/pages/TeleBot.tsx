import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Bot, Loader2, Wrench, ShieldAlert, RefreshCw, Globe, Send, Activity, ShieldCheck, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";

// Telebot components
import { ChartHeader } from "@/telebot/components/ChartHeader";
import { TradingViewChart } from "@/telebot/components/TradingViewChart";
import { SignalPanel } from "@/telebot/components/SignalPanel";
import { NotificationPopup } from "@/telebot/components/NotificationPopup";
import { useMarketData } from "@/telebot/hooks/useMarketData";
import { useTradeManager } from "@/telebot/hooks/useTradeManager";
import { API_CONFIG, AVAILABLE_SYMBOLS } from "@/telebot/constants";
import { AlertData } from "@/telebot/types";

const TeleBot = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  
  // Telebot state
  const [activeSymbol, setActiveSymbol] = useState(AVAILABLE_SYMBOLS[0].id);
  const [activeAlert, setActiveAlert] = useState<AlertData | null>(null);

  const { candles, currentCandle, connectionStatus, isLoading, refetch, dataError } = useMarketData(activeSymbol);

  const handleSignalFound = (type: 'CALL' | 'PUT', entryTime: string) => {
    // Background signal handler
  };

  const handleSignalPanelFound = (
    symbol: string,
    type: 'CALL' | 'PUT',
    entryTime: string,
    title?: string,
    variant?: 'default' | 'warning'
  ) => {
    setActiveAlert({
      symbol,
      type,
      time: new Date().toLocaleTimeString(),
      entryTime,
      title,
      variant
    });
  };

  useTradeManager(candles, currentCandle, activeSymbol, handleSignalFound);

  // Loading states
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-[#131722] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#131722] flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 bg-[#1e222d] border-[#2a2e39]">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-4">Access Denied</h2>
            <p className="text-gray-400 mb-6">Please login to access this page.</p>
            <Button onClick={() => navigate('/auth')} className="bg-purple-500 hover:bg-purple-600">Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin - Show maintenance message
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#131722] flex flex-col">
        <header className="border-b border-[#2a2e39] bg-[#0e1118] sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Bot className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">TELEBOT</h1>
              <p className="text-xs text-gray-500">Telegram Bot Manager</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5 bg-[#1e222d]">
            <CardContent className="p-8 text-center">
              <div className="p-4 rounded-full bg-purple-500/20 w-fit mx-auto mb-6">
                <Wrench className="w-12 h-12 text-purple-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Under Maintenance</h2>
              <p className="text-gray-400 mb-2">This feature is currently under maintenance and not available to the public.</p>
              <div className="mt-6 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-xs text-purple-400">Status: <span className="font-semibold">Maintenance Mode</span></p>
              </div>
              <Button onClick={() => navigate("/dashboard")} className="mt-6 bg-purple-500 hover:bg-purple-600">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Admin view - Full TELEBOT
  const displaySymbol = AVAILABLE_SYMBOLS.find(s => s.id === activeSymbol)?.name || activeSymbol;

  const renderContent = () => {
    if (dataError) {
      return (
        <div className="flex items-center justify-center h-full bg-[#131722] relative overflow-hidden">
          <div className="absolute inset-0 bg-red-500/5 animate-pulse z-0"></div>
          <div className="z-10 flex flex-col items-center gap-6 p-8 border-2 border-red-500/50 rounded-2xl bg-[#0e1118] max-w-md text-center">
            <ShieldAlert className="w-20 h-20 text-red-500 animate-bounce" />
            <div>
              <h1 className="text-3xl font-black text-red-500 tracking-widest uppercase mb-2">FAKE DATA EXPOSED</h1>
              <p className="text-gray-400 text-sm">Security protocols have detected manipulated data.</p>
            </div>
            <button onClick={refetch} className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> RECONNECT
            </button>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-400 text-sm">Loading {displaySymbol}...</span>
          </div>
        </div>
      );
    }

    return (
      <TradingViewChart
        data={candles}
        currentCandle={currentCandle}
        config={{ symbol: activeSymbol, interval: API_CONFIG.DEFAULT_INTERVAL, limit: API_CONFIG.DEFAULT_LIMIT, timezoneOffset: API_CONFIG.TIMEZONE_OFFSET_HOURS }}
      />
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#131722] text-white overflow-hidden select-none">
      <ChartHeader
        price={currentCandle?.close}
        status={dataError ? 'error' : connectionStatus}
        activeSymbol={activeSymbol}
        onSymbolChange={setActiveSymbol}
        onRefresh={refetch}
      />

      <main className="flex-1 w-full h-full relative">
        {renderContent()}
      </main>

      {!dataError && (
        <>
          <NotificationPopup alert={activeAlert} onClose={() => setActiveAlert(null)} />
          <SignalPanel
            activeSymbol={activeSymbol}
            setActiveSymbol={setActiveSymbol}
            onSignalFound={handleSignalPanelFound}
            candles={candles}
            isLoading={isLoading}
          />
        </>
      )}

      <footer className="h-7 bg-[#0e1118] border-t border-[#2a2e39] flex items-center justify-between px-3 z-40 shrink-0 text-[10px]">
        <div className="flex items-center gap-4">
          <a href="https://chat.whatsapp.com/LqDeKcUo89c3Hu5CWjaAM9" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group hover:text-white text-[#8b919d]">
            <Globe className="w-3 h-3 group-hover:text-green-400" />
            <span className="font-semibold tracking-wide">GM COMMUNITY</span>
          </a>
          <div className="h-3 w-[1px] bg-[#2a2e39]"></div>
          <div className="flex items-center gap-1.5 text-[#8b919d]">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            <span>SECURE</span>
          </div>
        </div>
        <a href="https://t.me/binarysupport" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white text-[#8b919d]">
          <span className="font-semibold">@binarysupport</span>
          <Send className="w-3 h-3" />
        </a>
      </footer>
    </div>
  );
};

export default TeleBot;
