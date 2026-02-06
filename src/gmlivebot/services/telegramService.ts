export interface TelegramSettings {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

const messageCache: { [key: string]: number } = {};

const PROXY_PROVIDERS = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
];

const toMonospace = (text: string) => {
  const map: Record<string, string> = {
    '0': '𝟶', '1': '𝟷', '2': '𝟸', '3': '𝟹', '4': '𝟺', '5': '𝟻', '6': '𝟼', '7': '𝟽', '8': '𝟾', '9': '𝟿',
    ':': '∶', '.': '．'
  };
  return text.split('').map(c => map[c] || c).join('');
};

const toSmallCaps = (text: string) => {
  const map: Record<string, string> = {
    'CALL': '𝙲𝙰𝙻𝙻',
    'PUT': '𝙿𝚄𝚃',
    'PRICE': '𝙿𝚁𝙸𝙲𝙴',
    'MINUTE': '𝙼𝚒𝚗𝚞𝚝𝚎'
  };
  return map[text.toUpperCase()] || text;
};

export const getTelegramSettings = (): TelegramSettings | null => {
  try {
    const stored = localStorage.getItem('tsp_telegram_config');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const saveTelegramSettings = (settings: TelegramSettings) => {
  localStorage.setItem('tsp_telegram_config', JSON.stringify(settings));
};

export const sendTelegramMessage = async (settings: TelegramSettings, text: string, useHtml = false): Promise<boolean> => {
  if (!settings.botToken || !settings.chatId) return false;

  const cacheKey = `${settings.chatId}:${text.substring(0, 30)}`;
  const now = Date.now();
  if (messageCache[cacheKey] && (now - messageCache[cacheKey] < 3000)) {
    return true;
  }
  messageCache[cacheKey] = now;

  const baseUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
  const params = new URLSearchParams({
    chat_id: settings.chatId,
    text: text
  });
  if (useHtml) {
    params.append('parse_mode', 'HTML');
  }

  const targetUrl = `${baseUrl}?${params.toString()}`;

  for (const createProxy of PROXY_PROVIDERS) {
    try {
      const proxyUrl = createProxy(targetUrl);
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(id);

      if (response.ok) {
        console.log(`Telegram Sent!`);
        return true;
      }
    } catch {
      // continue
    }
  }
  return false;
};

export const sendSignalAlert = async (
  settings: TelegramSettings,
  symbol: string,
  type: 'CALL' | 'PUT',
  entryTime: string,
  confidence: number,
  price: number,
  useMtg: boolean = true
) => {
  if (!settings.isEnabled) return;

  const emoji = type === 'CALL' ? '🟢' : '🔴';
  const direction = type === 'CALL' ? toSmallCaps('CALL') : toSmallCaps('PUT');

  const cleanSymbol = symbol.replace(/_otc/gi, '-ᴏᴛᴄ').replace(/-OTCq/g, '-ᴏᴛᴄ').toUpperCase()
    .replace('USDBDT', '𝚄𝚂𝙳𝙱𝙳𝚃')
    .replace('USDINR', '𝚄𝚂𝙳𝙸𝙽𝚁');

  const formattedTime = toMonospace(entryTime);
  const formattedPrice = toMonospace(price.toFixed(5));

  const message = `
💫 𝗔𝗜 𝗕𝗢𝗧 𝗦𝗜𝗚𝗡𝗔𝗟 💫
         𝗤𝗨𝗢𝗧𝗘𝗫
==================
📊 ${cleanSymbol}
⏳ 𝟷 𝙼𝚒𝚗𝚞𝚝𝚎
⏰ ${formattedTime}
${emoji} ${direction}
🎯 𝙿𝚁𝙸𝙲𝙴∶ ${formattedPrice}
==================
🎯 𝗠𝟬 + 𝟭 𝗦𝗧𝗘𝗣 𝗠𝗧𝗚
🏆 UTC,GMT +05:00

🔊 𝗖𝗢𝗡𝗧𝗔𝗖𝗧: @binarysupport
`.trim();

  await sendTelegramMessage(settings, message, false);
};

export const sendResultAlert = async (
  settings: TelegramSettings,
  symbol: string,
  outcome: 'DIRECT_WIN' | 'MTG_WIN' | 'LOSS' | 'TIMEOUT' | 'DOJI',
  signalTime: string,
  stats?: { wins: number; losses: number },
  useMtg: boolean = true
) => {
  if (!settings.isEnabled) return;

  const cleanSymbol = symbol.replace(/_otc/gi, '_𝚘𝚝𝚌').replace(/-OTCq/g, '_𝚘𝚝𝚌').toUpperCase();
  const formattedTime = toMonospace(signalTime);

  let resultLine = "";
  if (outcome === 'DIRECT_WIN') resultLine = "RESULT: DIRECT WIN ✅";
  else if (outcome === 'MTG_WIN') resultLine = "RESULT: MTG WIN ✅";
  else if (outcome === 'DOJI') resultLine = "RESULT: DOJI ⚠️";
  else resultLine = "RESULT: LOSS ❌";

  let statsBlock = "";
  if (stats) {
    const total = stats.wins + stats.losses;
    const rate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
    const rawNet = (stats.wins * 0.80) - (stats.losses * 3.0);
    const isProfit = rawNet >= 0;
    const netEmoji = isProfit ? '🟢' : '🔴';
    const sign = isProfit ? '+' : '';
    const netString = `${sign}${rawNet.toFixed(2)}`;

    statsBlock = `
---------------------------------
🏆 Win: ${stats.wins} | Loss: ${stats.losses} ✠ (${rate}%)
💰 𝚃𝙾𝚃𝙰𝙻 𝙽𝙴𝚃: ${netEmoji} ${netString}
---------------------------------`;
  }

  const message = `
======= 𝗥𝗘𝗦𝗨𝗟𝗧 𝗔𝗟𝗘𝗥𝗧 =======

📊 𝙿𝙰𝙸𝚁:- ${cleanSymbol}
⏰ 𝚃𝚒𝚖𝚎:- ${formattedTime}

🎯 ${resultLine}${statsBlock}

🔊 𝙵𝙴𝙴𝙳𝙱𝙰𝙲𝙺: @binarysupport
`.trim();

  await sendTelegramMessage(settings, message, false);
};
