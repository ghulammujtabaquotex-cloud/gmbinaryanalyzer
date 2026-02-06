import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, Search, ChevronDown, Check, Clock, RefreshCw, Menu } from 'lucide-react';
import { AVAILABLE_SYMBOLS } from '../constants';

interface ChartHeaderProps {
  price: number | undefined;
  status: 'connecting' | 'connected' | 'error';
  activeSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onRefresh: () => void;
}

export const ChartHeader: React.FC<ChartHeaderProps> = ({
  price,
  status,
  activeSymbol,
  onSymbolChange,
  onRefresh,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeString = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Karachi',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).format(now);
        setTimeStr(timeString);
      } catch {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const pkTime = new Date(utc + (3600000 * 5));
        setTimeStr(pkTime.toLocaleTimeString('en-GB', { hour12: false }));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredSymbols = AVAILABLE_SYMBOLS.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const activeSymbolInfo = AVAILABLE_SYMBOLS.find(s => s.id === activeSymbol);
  const activeSymbolName = activeSymbolInfo?.name || activeSymbol;
  const isActiveOTC = activeSymbol.toLowerCase().includes('otc') || activeSymbolName.includes('(OTC)');

  const displayName = activeSymbolName
    .replace(/\(OTC\)/g, '')
    .replace(/_otc/gi, '')
    .replace(/-OTCq/g, '')
    .trim();

  return (
    <div className="flex flex-col w-full z-[60]">
      <div className="flex items-center justify-between px-3 py-2 bg-black border-b border-[#1a1a1a] h-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <h1 className="text-xs font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white">
            GM LIVE BOT
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshClick}
              className="p-1 hover:bg-[#1a1a1a] rounded-full text-gray-500 hover:text-white transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            </button>
            <div title={status === 'connected' ? "Connected" : "Disconnected"}>
              {status === 'connected' ? (
                <Wifi className="w-3 h-3 text-green-500" />
              ) : (
                <WifiOff className="w-3 h-3 text-red-500" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 text-gray-200">
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="text-xs font-mono font-bold">{timeStr}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1 bg-black border-b border-[#1a1a1a] relative">
        <div className="relative z-50" ref={searchRef}>
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="flex items-center gap-2 hover:bg-[#1a1a1a] py-1 px-2 rounded transition-colors group border border-transparent hover:border-[#1a1a1a] cursor-pointer"
          >
            <Menu className="w-3 h-3 text-gray-500 group-hover:text-white" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-200">{displayName}</span>
              {isActiveOTC && <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded font-bold">OTC</span>}
              <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isSearchOpen && (
            <div className="absolute top-full left-0 mt-1 w-60 bg-[#050505] border border-[#2a2e39] rounded-lg shadow-2xl z-[100] flex flex-col">
              <div className="p-2 border-b border-[#1a1a1a] bg-[#0a0a0a]">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search asset..."
                    className="w-full bg-[#131722] border border-[#1a1a1a] rounded pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto">
                {filteredSymbols.map((s) => {
                  const isItemOTC = s.id.toLowerCase().includes('otc') || s.name.includes('(OTC)');
                  const cleanName = s.name.replace('(OTC)', '').trim();

                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSymbolChange(s.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#1a1a1a] border-l-2 cursor-pointer ${activeSymbol === s.id ? 'border-blue-500 bg-[#1a1a1a]' : 'border-transparent'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${activeSymbol === s.id ? 'text-white' : 'text-gray-400'}`}>{cleanName}</span>
                        {isItemOTC && (
                          <span className="text-[8px] bg-blue-900/20 text-blue-400 px-1 rounded font-bold">OTC</span>
                        )}
                      </div>
                      {activeSymbol === s.id && <Check className="w-3 h-3 text-blue-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end">
          <span className={`text-sm font-mono font-bold ${!price ? 'text-gray-600' : 'text-white'}`}>
            {price ? price.toFixed(5) : '---'}
          </span>
        </div>
      </div>
    </div>
  );
};
