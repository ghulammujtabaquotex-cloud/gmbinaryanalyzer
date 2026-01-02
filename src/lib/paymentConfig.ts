// Payment configuration
export const PAYMENT_CONFIG = {
  binancePayId: '1050153746',
  vipPrice: 2.5,
  currency: 'USDT',
  vipDurationDays: 30, // 1 month
  vipDailyLimit: 10, // Must match edge function VIP_DAILY_LIMIT
  freeDailyLimit: 3, // Must match edge function FREE_DAILY_LIMIT
  // Pakistani Bank Payment
  pakistanBankPrice: 699,
  pakistanCurrency: 'PKR',
};

export const VIP_FEATURES = [
  '10 analyses per day',
  'Priority signal processing',
  'Advanced multi-timeframe analysis',
  'Personal accuracy statistics',
  'Signal confidence scores',
  'Full signal history access',
  'PDF export for signals',
  'Premium support via WhatsApp',
];
