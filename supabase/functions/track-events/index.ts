/* ═══════════════════════════════════════════════════
   MATCHMAKERS — track-events Edge Function
   Receives batched analytics events from the website
   Stores in Supabase `analytics_events` table
   ═══════════════════════════════════════════════════ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const events = body.events;

    if (!Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: "No events provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cap batch size to prevent abuse
    const batch = events.slice(0, 100);

    // Map to DB rows
    const rows = batch.map((evt: any) => ({
      event: (evt.event || "unknown").slice(0, 64),
      visitor_id: (evt.visitor_id || "").slice(0, 64),
      session_id: (evt.session_id || "").slice(0, 64),
      page: (evt.page || "").slice(0, 256),
      properties: evt.properties || {},
      utm: evt.utm || null,
      referrer: (evt.referrer || "").slice(0, 512),
      event_timestamp: evt.timestamp || new Date().toISOString(),
    }));

    // Insert into Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("analytics_events")
      .insert(rows);

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Storage error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Parse error:", e);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
