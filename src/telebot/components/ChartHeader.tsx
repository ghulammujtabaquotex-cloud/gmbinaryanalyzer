import React, { useState, useEffect, useRef } from 'react';
import { Activity, Wifi, WifiOff, Search, ChevronDown, Check, Clock, RefreshCw, Menu } from 'lucide-react';
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
  onRefresh
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clock Logic (UTC+5)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Karachi', // UTC+5
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      setTimeStr(new Intl.DateTimeFormat('en-US', options).format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
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

  // Handle visual refresh spin
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

  // Robust OTC Detection
  const isActiveOTC = activeSymbol.toLowerCase().includes('otc') || activeSymbolName.includes('(OTC)');

  // Clean display name
  const displayName = activeSymbolName
    .replace(/\(OTC\)/g, '')
    .replace(/_otc/gi, '')
    .replace(/-OTCq/g, '')
    .trim();

  return (
    <div className="flex flex-col w-full z-[60]">

      {/* TOP ROW: Branding, Status, Clock */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0e1118] border-b border-[#2a2e39] h-12">

          {/* BRANDING */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
            <h1 className="text-sm font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-white">
                TELEBOT
            </h1>
          </div>

          {/* RIGHT SIDE: Tools & Clock */}
          <div className="flex items-center gap-4">
             {/* Status Indicators */}
             <div className="flex items-center gap-2 pr-4 border-r border-[#2a2e39]">
                <button
                    onClick={handleRefreshClick}
                    className="p-1 hover:bg-[#2a2e39] rounded text-gray-500 hover:text-white transition-colors"
                    title="Refresh Data"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
                </button>
                <div title={status === 'connected' ? "Connected" : "Disconnected"}>
                    {status === 'connected' ? (
                    <Wifi className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                    <WifiOff className="w-3.5 h-3.5 text-red-500" />
                    )}
                </div>
             </div>

             {/* CLOCK (UTC+5) */}
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-gray-200">
                    <Clock className="w-3 h-3 text-purple-500" />
                    <span className="text-sm font-mono font-bold leading-none">{timeStr}</span>
                </div>
                <span className="text-[9px] text-gray-600 font-bold tracking-wider">UTC+5 ISLAMABAD</span>
             </div>
          </div>
      </div>

      {/* BOTTOM ROW: Pair Selector & Price */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#131722] border-b border-[#2a2e39] shadow-md relative">

            {/* PAIR SELECTOR */}
            <div className="relative z-50" ref={searchRef}>
                <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className="flex items-center gap-2 hover:bg-[#2a2e39] py-1 px-3 rounded transition-colors group border border-transparent hover:border-[#2a2e39]"
                >
                    <Menu className="w-4 h-4 text-gray-500 group-hover:text-white" />
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] text-gray-500 leading-none">Asset</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-bold text-gray-200">{displayName}</span>
                            {isActiveOTC && <span className="text-[9px] bg-purple-900/40 text-purple-400 px-1 rounded font-bold">OTC</span>}
                            <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isSearchOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </button>

                 {/* Dropdown */}
                {isSearchOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-[#1e222d] border border-[#2a2e39] rounded shadow-2xl z-[100] flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Search Header */}
                        <div className="p-2 border-b border-[#2a2e39] bg-[#1e222d]">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search asset..."
                                    className="w-full bg-[#131722] border border-[#2a2e39] rounded pl-8 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="max-h-60 overflow-y-auto">
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
                                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#2a2e39] border-l-2 ${activeSymbol === s.id ? 'border-purple-500 bg-[#2a2e39]/50' : 'border-transparent'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-300">{cleanName}</span>
                                        {isItemOTC && (
                                            <span className="text-[9px] bg-purple-900/40 text-purple-400 px-1 rounded font-bold">OTC</span>
                                        )}
                                    </div>
                                    {activeSymbol === s.id && <Check className="w-3 h-3 text-purple-500" />}
                                </button>
                            )})}
                        </div>
                    </div>
                )}
            </div>

            {/* CURRENT PRICE */}
            <div className="flex flex-col items-end px-2">
                 <span className="text-[9px] text-gray-500 uppercase tracking-wide">Market Price</span>
                 <span className={`text-lg font-mono font-bold ${!price ? 'text-gray-600' : 'text-white'}`}>
                    {price ? price.toFixed(5) : '---'}
                 </span>
            </div>
      </div>
    </div>
  );
};
