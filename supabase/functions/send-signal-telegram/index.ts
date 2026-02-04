import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  pair: string;
  signal_time: string;
  direction: string;
  price?: string;
  confidence?: number;
}

// Format pair name for display
function formatPair(symbol: string): string {
  return symbol
    .replace(/_otc/i, '')
    .replace(/([A-Z]{3})([A-Z]{3})/i, '$1/$2')
    .toUpperCase();
}

// Build TeleBot format message
function buildTelebotMessage(signal: Signal): string {
  const directionEmoji = signal.direction.toUpperCase() === 'CALL' ? '🟢' : '🔴';
  const formattedPair = formatPair(signal.pair);
  const price = signal.price || "0.00000";
  
  return `💫 𝗔𝗜 𝗕𝗢𝗧 𝗦𝗜𝗚𝗡𝗔𝗟 💫
         𝗤𝗨𝗢𝗧𝗘𝗫
==================
📊 ${formattedPair}
⏳ 1 Minute
⏰ ${signal.signal_time}
${directionEmoji} ${signal.direction.toUpperCase()}
🎯 PRICE: ${price}
==================
🎯 USE 1 MTG 💰
🏆 UTC,GMT +05:00 

🔊 𝗖𝗢𝗡𝗧𝗔𝗖𝗧: @binarysupport`;
}

// Build standard Future Signals format message
function buildStandardMessage(signals: Signal[], userType: string, pakistanTime: string): string {
  let message = `🚀 <b>GM BINARY PRO - SIGNAL ALERT</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📊 <b>New Signals Generated</b>\n`;
  message += `👤 User Type: <b>${userType || 'FREE'}</b>\n`;
  message += `🕐 Time (PKT): <b>${pakistanTime}</b>\n\n`;
  message += `📈 <b>SIGNALS:</b>\n`;
  message += `─────────────────────\n`;

  signals.forEach((signal, index) => {
    const formattedPair = formatPair(signal.pair);
    const directionEmoji = signal.direction.toUpperCase() === 'CALL' ? '🟢' : '🔴';
    message += `${index + 1}. ${directionEmoji} <b>${formattedPair}</b>\n`;
    message += `   ⏰ Time: ${signal.signal_time}\n`;
    message += `   📍 Direction: <b>${signal.direction.toUpperCase()}</b>\n\n`;
  });

  message += `─────────────────────\n`;
  message += `💡 <i>Trade wisely. Signals are for educational purposes.</i>\n`;
  message += `\n🌐 GM Binary Pro`;

  return message;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Missing Telegram credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Telegram not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { signals, userType, format } = await req.json();

    if (!signals || signals.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No signals provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Pakistan time
    const now = new Date();
    const pakistanTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(now);

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    console.log("Sending signals to Telegram:", { signalCount: signals.length, userType, format });

    // Handle TeleBot format - send each signal separately with the new format
    if (format === 'telebot') {
      for (const signal of signals as Signal[]) {
        const message = buildTelebotMessage(signal);
        
        const response = await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "HTML",
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.ok) {
          console.error("Telegram API error for signal:", result);
        } else {
          console.log("TeleBot signal sent successfully:", signal.pair);
        }
        
        // Small delay between messages
        await new Promise(r => setTimeout(r, 300));
      }
      
      return new Response(
        JSON.stringify({ success: true, message: "TeleBot signals sent to Telegram" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Standard format for Future Signals
    const message = buildStandardMessage(signals as Signal[], userType, pakistanTime);

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      console.error("Telegram API error:", result);
      return new Response(
        JSON.stringify({ success: false, error: result.description || "Telegram API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Signals sent to Telegram successfully");
    
    return new Response(
      JSON.stringify({ success: true, message: "Signals sent to Telegram" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error sending signals to Telegram:", err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
