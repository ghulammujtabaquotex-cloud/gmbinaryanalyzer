import React, { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { AVAILABLE_SYMBOLS } from '../constants';
import { AlertData } from '../types';

interface NotificationPopupProps {
  alert: AlertData | null;
  onClose: () => void;
}

export const NotificationPopup: React.FC<NotificationPopupProps> = ({ alert, onClose }) => {
  const [show, setShow] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (alert) {
      setShow(true);
      const timer = setTimeout(() => {
         setShow(false);
         setTimeout(() => {
             if (onCloseRef.current) onCloseRef.current();
         }, 500);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  if (!alert) return null;

  const symbolInfo = AVAILABLE_SYMBOLS.find(s => s.id === alert.symbol);
  // Robust replacement for OTC variants
  const displayName = symbolInfo
      ? symbolInfo.name
      : alert.symbol.replace(/_otc/gi, ' (OTC)').replace(/-OTCq/g, ' (OTC)');

  const isCall = alert.type === 'CALL';
  const isWarning = alert.variant === 'warning';

  // Determine colors based on Warning vs Default (Call/Put)
  let bgColor = 'bg-[#1e222d]';
  let iconBg = isCall ? 'bg-green-500/10' : 'bg-red-500/10';
  let iconColor = isCall ? 'text-green-500' : 'text-red-500';
  let progressBarGradient = isCall ? 'from-green-500 to-green-300' : 'from-red-500 to-red-300';
  let typeTextColor = isCall ? 'text-green-400' : 'text-red-400';

  if (isWarning) {
      iconBg = 'bg-yellow-500/10';
      iconColor = 'text-yellow-500';
      progressBarGradient = 'from-yellow-500 to-orange-500';
      typeTextColor = 'text-yellow-400';
  }

  const titleText = alert.title || alert.type;

  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-500 ease-in-out ${show ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'}`}>
       <div className={`relative overflow-hidden ${bgColor} border ${isWarning ? 'border-yellow-500/50' : 'border-[#2a2e39]'} shadow-2xl rounded-2xl w-[90vw] max-w-sm backdrop-blur-xl`}>

          {/* Progress Bar */}
          <div className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${progressBarGradient} transition-all duration-[4000ms] ease-linear ${show ? 'w-full' : 'w-0'}`} />

          <div className="flex items-center p-3 gap-3">
             {/* Icon */}
             <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
                {isWarning ? (
                    <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
                ) : isCall ? (
                    <TrendingUp className={`w-5 h-5 ${iconColor}`} />
                ) : (
                    <TrendingDown className={`w-5 h-5 ${iconColor}`} />
                )}
             </div>

             {/* Content */}
             <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                    <h4 className="text-white font-bold text-sm truncate">{displayName}</h4>
                    <span className="text-[10px] text-gray-500 font-mono">{alert.time}</span>
                </div>
                <div className="flex items-center justify-between">
                     <span className={`text-base font-black tracking-wider ${typeTextColor}`}>
                        {titleText}
                     </span>

                     {alert.entryTime && (
                         <div className="flex items-center gap-1 bg-[#2a2e39] px-2 py-0.5 rounded-full border border-gray-700/50">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] text-gray-300 font-mono font-bold">{alert.entryTime}</span>
                         </div>
                     )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};
