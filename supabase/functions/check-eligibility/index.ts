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
      .eq("product", "dating_coach_and_playbook")
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
      .in("product", ["dating_coach_and_playbook", "dating_coach_premium", "dating_coach_unlimited"])
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

  // ── Action: check-vip-prerequisite (does this email qualify for VIP application?) ─
  // v2 (2026-04-28): VIP funnel-form gate. Returns eligible=true ONLY if email
  // has BOTH dating_coach_and_playbook AND (dating_coach_premium OR
  // dating_coach_unlimited), both with status='completed'. Combined $750+ spend.
  // Frontend uses this to redirect unqualified applicants BEFORE form unlock;
  // server-side submit-vip-application re-verifies for defense-in-depth.
  if (body.action === "check-vip-prerequisite") {
    const { data, error } = await supabase
      .from("purchases")
      .select("product, status")
      .eq("email", email)
      .eq("status", "completed");

    if (error) {
      console.error("VIP prerequisite check error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
    }

    const products = new Set<string>((data ?? []).map((r: { product: string }) => r.product));
    const hasPlaybook = products.has("dating_coach_and_playbook");
    const hasCoachPremium = products.has("dating_coach_premium");
    const hasCoachUnlimited = products.has("dating_coach_unlimited");
    const hasCoach = hasCoachPremium || hasCoachUnlimited;

    if (hasPlaybook && hasCoach) {
      return new Response(
        JSON.stringify({
          eligible: true,
          owned_products: Array.from(products),
        }),
        { status: 200, headers },
      );
    }

    const missing: string[] = [];
    if (!hasPlaybook) missing.push("dating_coach_and_playbook");
    if (!hasCoach) missing.push("dating_coach_premium_or_unlimited");

    let reason_code: string;
    let reason: string;
    let redirect_url: string;
    if (!hasPlaybook && !hasCoach) {
      reason_code = "both_missing";
      reason = "VIP applications require completion of the MatchMakers Playbook ($250) AND the Dating Coach ($500 Premium or $1,000 Unlimited). Start with the Playbook to begin your foundation.";
      redirect_url = "/playbook/";
    } else if (!hasPlaybook) {
      reason_code = "no_playbook";
      reason = "VIP applications require the MatchMakers Playbook ($250) as your foundation. Get the Playbook — your Coach access carries forward.";
      redirect_url = "/playbook/";
    } else {
      reason_code = "no_coach";
      reason = "VIP applications require the Dating Coach ($500 Premium or $1,000 Unlimited) in addition to the Playbook.";
      redirect_url = "/coach/";
    }

    return new Response(
      JSON.stringify({
        eligible: false,
        reason_code,
        reason,
        missing_products: missing,
        redirect_url,
      }),
      { status: 200, headers },
    );
  }

  // ── Action: verify-code (does this access code exist for a completed purchase?) ─
  // Path-scoped 30-day window: the /redeem/ deep-link redemption path expires 30 days
  // after purchase. The email-lookup path (verify-access) keeps lifetime/permanent
  // semantics — a user past the 30-day window still has access via /playbook/ email
  // sign-in. This fence is on the *redemption surface*, not on the entitlement.
  if (body.action === "verify-code") {
    const code = (body.code || "").trim().toUpperCase();
    if (!code) {
      return new Response(JSON.stringify({ has_access: false, reason: "No code provided." }), { status: 200, headers });
    }

    const { data, error } = await supabase
      .from("purchases")
      .select("id, product, plan, status, access_code, created_at")
      .eq("access_code", code)
      .eq("status", "completed")
      .limit(1);

    if (error) {
      console.error("Code verify error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers });
    }

    if (data && data.length > 0) {
      const purchase = data[0];
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (purchase.created_at && Date.now() - new Date(purchase.created_at).getTime() > thirtyDaysMs) {
        return new Response(
          JSON.stringify({
            has_access: false,
            reason_code: "code_expired",
            reason: "This code is older than 30 days. Please sign in with your purchase email at /playbook/ instead.",
          }),
          { status: 200, headers }
        );
      }
      return new Response(JSON.stringify({ has_access: true, product: purchase.product }), { status: 200, headers });
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

    // Playbook (now: dating_coach_and_playbook) = lifetime access; Phase 2
    // adds messages_remaining for the renamed product (3-msg Coach allowance
    // bundled with the Playbook purchase per Q1 2026-04-27 ratification).
    const responsePayload: Record<string, unknown> = {
      has_access: true,
      access_code: purchase.access_code,
    };
    if (purchase.product === "dating_coach_and_playbook") {
      responsePayload.messages_remaining = purchase.messages_remaining ?? null;
    }
    return new Response(JSON.stringify(responsePayload), { status: 200, headers });
  }

  return new Response(
    JSON.stringify({
      has_access: false,
      reason: "No purchase found for this email.",
    }),
    { status: 200, headers }
  );
});
