// Signal Checker - Port of check.py
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://sio.tools";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Content-Type": "application/json",
  "Referer": "https://sio.tools/",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, signals, info, checkId } = await req.json();

    if (action === "create") {
      const r = await fetch(`${BASE_URL}/quotex/check`, {
        method: "POST", headers: HEADERS,
        body: JSON.stringify({ info, signals }),
      });
      if (!r.ok) {
        const txt = await r.text();
        return new Response(JSON.stringify({ error: "create failed", detail: txt }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const d = await r.json();
      return new Response(JSON.stringify({ id: d.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "poll") {
      const r = await fetch(`${BASE_URL}/quotex/check/${checkId}`, { headers: HEADERS });
      if (!r.ok) return new Response(JSON.stringify({ status: "error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const d = await r.json();
      return new Response(JSON.stringify(d), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
