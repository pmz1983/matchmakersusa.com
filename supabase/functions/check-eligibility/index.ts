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

  const product = body.product || "dating_coach_premium";

  // Helper: recognize all dating coach product variants
  const isCoachProduct = (p: string) =>
    p === "dating_coach_premium" || p === "dating_coach_unlimited" || p === "dating_coach";

  // ── Action: check-eligibility (can this email BUY the Dating Coach?) ──
  if (body.action === "check-eligibility" || (!body.action && isCoachProduct(product))) {
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

  // ── Action: check-messages (return user's plan and messages_remaining) ─
  if (body.action === "check-messages") {
    // Find the most recent coach purchase (premium or unlimited)
    const { data, error } = await supabase
      .from("purchases")
      .select("id, product, plan, messages_remaining, status, access_code, created_at")
      .eq("email", email)
      .in("product", ["dating_coach_premium", "dating_coach_unlimited"])
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Check-messages error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
    }

    if (data && data.length > 0) {
      const purchase = data[0];
      return new Response(
        JSON.stringify({
          has_plan: true,
          plan: purchase.plan || (purchase.product === "dating_coach_unlimited" ? "unlimited" : "premium"),
          messages_remaining: purchase.messages_remaining ?? null,
          product: purchase.product,
        }),
        { status: 200, headers }
      );
    }

    return new Response(
      JSON.stringify({
        has_plan: false,
        plan: "free",
        messages_remaining: null,
      }),
      { status: 200, headers }
    );
  }

  // ── Action: verify-code (does this access code exist for a completed purchase?) ─
  if (body.action === "verify-code") {
    const code = (body.code || "").trim().toUpperCase();
    if (!code) {
      return new Response(JSON.stringify({ has_access: false, reason: "No code provided." }), { status: 200, headers });
    }

    const { data, error } = await supabase
      .from("purchases")
      .select("id, product, plan, status, access_code")
      .eq("access_code", code)
      .eq("status", "completed")
      .limit(1);

    if (error) {
      console.error("Code verify error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
    }

    if (data && data.length > 0) {
      return new Response(JSON.stringify({ has_access: true, product: data[0].product }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ has_access: false, reason: "Code not found." }), { status: 200, headers });
  }

  // ── Action: verify-access (does this email OWN a specific product?) ───
  // For coach products, check any coach variant
  const productFilter = isCoachProduct(product)
    ? ["dating_coach_premium", "dating_coach_unlimited"]
    : [product];

  const { data, error } = await supabase
    .from("purchases")
    .select("id, product, plan, messages_remaining, status, access_code, created_at")
    .eq("email", email)
    .in("product", productFilter)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Access check error:", error);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
  }

  if (data && data.length > 0) {
    const purchase = data[0];

    // Both Premium and Unlimited have permanent access (no 30-day window)
    if (isCoachProduct(purchase.product)) {
      return new Response(
        JSON.stringify({
          has_access: true,
          access_code: purchase.access_code,
          plan: purchase.plan || (purchase.product === "dating_coach_unlimited" ? "unlimited" : "premium"),
          messages_remaining: purchase.messages_remaining ?? null,
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
