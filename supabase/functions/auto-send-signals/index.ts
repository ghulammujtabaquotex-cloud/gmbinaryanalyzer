import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signal {
  id: string;
  pair: string;
  signal_time: string;
  direction: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Missing Telegram configuration");
      return new Response(
        JSON.stringify({ error: "Telegram not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Supabase not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if telegram auto-send is enabled
    const { data: settingData, error: settingError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("id", "telegram_auto_send")
      .maybeSingle();

    if (settingError) {
      console.error("Error fetching telegram setting:", settingError);
    }

    const telegramEnabled = settingData?.value?.enabled !== false;
    
    if (!telegramEnabled) {
      console.log("Telegram auto-send is disabled");
      return new Response(
        JSON.stringify({ message: "Telegram auto-send is disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current Pakistan time (UTC+5)
    const now = new Date();
    const pakistanOffset = 5 * 60 * 60 * 1000;
    const pakistanTime = new Date(now.getTime() + pakistanOffset);
    
    const currentHours = pakistanTime.getUTCHours();
    const currentMinutes = pakistanTime.getUTCMinutes();
    
    // Calculate time 2 minutes from now
    let targetMinutes = currentMinutes + 2;
    let targetHours = currentHours;
    
    if (targetMinutes >= 60) {
      targetMinutes -= 60;
      targetHours += 1;
      if (targetHours >= 24) {
        targetHours = 0;
      }
    }
    
    const targetTimeStr = `${targetHours.toString().padStart(2, '0')}:${targetMinutes.toString().padStart(2, '0')}`;
    const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
    
    console.log(`Current Pakistan time: ${currentTimeStr}, Looking for signals at: ${targetTimeStr}`);

    // Query signals that are exactly 2 minutes away and haven't been sent
    const { data: signals, error: fetchError } = await supabase
      .from("future_signals_pool")
      .select("id, pair, signal_time, direction")
      .eq("signal_time", targetTimeStr)
      .eq("telegram_sent", false);

    if (fetchError) {
      console.error("Error fetching signals:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch signals" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!signals || signals.length === 0) {
      console.log("No signals to send at this time");
      return new Response(
        JSON.stringify({ message: "No signals to send", currentTime: currentTimeStr, targetTime: targetTimeStr }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${signals.length} signals to send`);

    // Format signals for Telegram - one message per signal
    const messages = signals.map((s: Signal) => {
      const formattedPair = s.pair.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
      const directionEmoji = s.direction === 'CALL' ? '🟢' : '🔴';
      const directionText = s.direction === 'CALL' ? 'UP' : 'DOWN';
      
      return `𒆜•——‼️ G╎M╎x╎B╎o╎t‼️——•𒆜

📊 PAIR: "${formattedPair}" (QUOTEX) 

✔️ ENTRY TIME: ${s.signal_time} (+5 UTC) 🇵🇰

⏳ Time: M 1

🚨 TRADE DIRECTION: ${directionText} ${directionEmoji}

🦅 1 STEP MTG

⚡️ TRY TO USE SAFETY MARGIN 👍

𒆜•———‼️ D  ╎R╎A╎C╎O ‼️———•𒆜`;
    });

    // Send each signal as a separate message to Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    for (const message of messages) {
      const telegramResponse = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
        }),
      });

      if (!telegramResponse.ok) {
        const errText = await telegramResponse.text();
        console.error("Telegram API error:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to send Telegram message" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Sent ${messages.length} Telegram messages successfully`);

    // Mark signals as sent
    const signalIds = signals.map((s: Signal) => s.id);
    const { error: updateError } = await supabase
      .from("future_signals_pool")
      .update({ telegram_sent: true })
      .in("id", signalIds);

    if (updateError) {
      console.error("Error marking signals as sent:", updateError);
    } else {
      console.log(`Marked ${signalIds.length} signals as sent`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        signalsSent: signals.length,
        signals: signals 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
