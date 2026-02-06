export const API_CONFIG = {
  HISTORY_URL: "https://mrbeaxt.site/Qx/Qx.php",
  get TICK_STREAM_URL() { return ""; },
  DEFAULT_SYMBOL: 'Nzdusd_otc',
  DEFAULT_INTERVAL: '1m',
  DEFAULT_LIMIT: 500,
  TIMEZONE_OFFSET_HOURS: -1,
};

export const AVAILABLE_SYMBOLS = [
  // --- OTC PAIRS ---
  { id: 'AUDNZD_otc', name: 'AUD/NZD (OTC)' },
  { id: 'Cadchf_otc', name: 'CAD/CHF (OTC)' },
  { id: 'Eurnzd_otc', name: 'EUR/NZD (OTC)' },
  { id: 'GBPNZD_otc', name: 'GBP/NZD (OTC)' },
  { id: 'Nzdcad_otc', name: 'NZD/CAD (OTC)' },
  { id: 'NZDCHF_otc', name: 'NZD/CHF (OTC)' },
  { id: 'Nzdjpy_otc', name: 'NZD/JPY (OTC)' },
  { id: 'Nzdusd_otc', name: 'NZD/USD (OTC)' },
  // --- MAJORS (NON-OTC) ---
  { id: 'EURUSD', name: 'EUR/USD' },
  // --- CRYPTO (OTC) ---
  { id: 'BCHUSD_otc', name: 'BCH/USD (OTC)' },
  { id: 'BTCUSD_otc', name: 'BTC/USD (OTC)' },
  // --- COMMODITIES (OTC) ---
  { id: 'XAUUSD_otc', name: 'Gold (OTC)' },
  { id: 'AXP_otc', name: 'American Express (OTC)' },
  // --- EMERGING & EXOTIC (OTC) ---
  { id: 'BRLUSD_otc', name: 'BRL/USD (OTC)' },
  { id: 'Usdars_otc', name: 'USD/ARS (OTC)' },
  { id: 'Usdbdt_otc', name: 'USD/BDT (OTC)' },
  { id: 'Usdcop_otc', name: 'USD/COP (OTC)' },
  { id: 'Usddzd_otc', name: 'USD/DZD (OTC)' },
  { id: 'Usdegp_otc', name: 'USD/EGP (OTC)' },
  { id: 'Usdidr_otc', name: 'USD/IDR (OTC)' },
  { id: 'Usdinr_otc', name: 'USD/INR (OTC)' },
  { id: 'Usdngn_otc', name: 'USD/NGN (OTC)' },
  { id: 'Usdphp_otc', name: 'USD/PHP (OTC)' },
  { id: 'Usdpkr_otc', name: 'USD/PKR (OTC)' },
  { id: 'Usdtry_otc', name: 'USD/TRY (OTC)' },
];

export const CHART_COLORS = {
  BACKGROUND: '#000000',
  GRID: 'rgba(255, 255, 255, 0.05)',
  TEXT: '#d1d4dc',
  UP_COLOR: '#00E676',
  DOWN_COLOR: '#FF1744',
  BORDER_VISIBLE: false,
  WICK_UP: '#00E676',
  WICK_DOWN: '#FF1744',
};
