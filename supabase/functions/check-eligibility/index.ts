import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://matchmakersusa.com",
  "https://www.matchmakersusa.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { email?: string; product?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const email = (body.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers });
  }

  // ── Action: capture-intent (email lead capture before checkout) ────────
  if (body.action === "capture-intent") {
    const product = body.product || "unknown";
    const { error } = await supabase.from("checkout_intents").insert({ email, product });
    if (error) {
      console.error("Intent capture error:", error);
    }
    // Don't block checkout on intent capture failure
    return new Response(JSON.stringify({ captured: true }), { status: 200, headers });
  }

  const product = body.product || "dating_coach";

  // ── Action: check-eligibility (can this email BUY the Dating Coach?) ──
  if (body.action === "check-eligibility" || (!body.action && product === "dating_coach")) {
    // Check if this email has a completed Playbook purchase
    const { data, error } = await supabase
      .from("purchases")
      .select("id, status, access_code")
      .eq("email", email)
      .eq("product", "playbook")
      .eq("status", "completed")
      .limit(1);

    if (error) {
      console.error("Eligibility check error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
    }

    if (data && data.length > 0) {
      return new Response(
        JSON.stringify({
          eligible: true,
          reason: "Playbook purchase confirmed",
        }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({
        eligible: false,
        reason: "Playbook purchase required. The Dating Coach builds on the Playbook methodology.",
      }),
      { status: 200, headers }
    );
  }

  // ── Action: verify-access (does this email OWN a specific product?) ───
  const { data, error } = await supabase
    .from("purchases")
    .select("id, status, access_code, created_at")
    .eq("email", email)
    .eq("product", product)
    .eq("status", "completed")
    .limit(1);

  if (error) {
    console.error("Access check error:", error);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }

  if (data && data.length > 0) {
    const purchase = data[0];

    // For dating_coach, check 30-day window
    if (product === "dating_coach") {
      const purchaseDate = new Date(purchase.created_at);
      const now = new Date();
      const daysSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSincePurchase > 30) {
        return new Response(
          JSON.stringify({
            has_access: false,
            reason: "Your 30-day Dating Coach access has expired.",
            expired: true,
          }),
          { status: 200, headers }
        );
      }

      return new Response(
        JSON.stringify({
          has_access: true,
          access_code: purchase.access_code,
          days_remaining: Math.ceil(30 - daysSincePurchase),
        }),
        { status: 200, headers }
      );
    }

    // Playbook = lifetime access
    return new Response(
      JSON.stringify({
        has_access: true,
        access_code: purchase.access_code,
      }),
      { status: 200, headers }
    );
  }

  return new Response(
    JSON.stringify({
      has_access: false,
      reason: "No purchase found for this email.",
    }),
    { status: 200, headers }
  );
});
