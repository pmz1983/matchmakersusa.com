import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Stripe signature verification ──────────────────────────────────────
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc: Record<string, string>, part: string) => {
      const [key, val] = part.split("=");
      acc[key] = val;
      return acc;
    },
    {} as Record<string, string>
  );

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject timestamps older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === signature;
}

// ── Generate a unique 8-char access code ────────────────────────────────
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 confusion
  let code = "MM-";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Product mapping from Stripe Payment Link IDs ────────────────────────
// Payment Link URLs contain these IDs after /b/
// Playbook: https://buy.stripe.com/4gM00baxrdXLfWz60Q2Nq02
// Coach:    https://buy.stripe.com/3cI00b4939HveSvdti2Nq01
const PAYMENT_LINK_TO_PRODUCT: Record<string, string> = {
  plink_1TM53W1ihNKVY3uGh4TGAg64: "playbook",
  plink_1TLykw1ihNKVY3uGCd56xqat: "playbook",
  plink_1TM52z1ihNKVY3uGYDEc34em: "dating_coach",
};

// Fallback: map by price ID
const PRICE_TO_PRODUCT: Record<string, string> = {
  price_1TLyin1ihNKVY3uGtdOvWGP2: "playbook",
  price_1TLykh1ihNKVY3uG4a08H5UT: "dating_coach",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "content-type, stripe-signature" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  }

  // Verify webhook signature
  const valid = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.error("Invalid Stripe webhook signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const event = JSON.parse(body);
  console.log(`Stripe event: ${event.type} (${event.id})`);

  // ── Handle checkout.session.completed ────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
    const sessionId = session.id;
    const paymentIntent = session.payment_intent;
    const amountTotal = session.amount_total; // in cents

    // Determine product: try metadata first, then payment_link ID, then price ID
    let product = session.metadata?.product || "";

    // Try payment_link field (set when checkout originated from a Payment Link)
    if (!product && session.payment_link) {
      product = PAYMENT_LINK_TO_PRODUCT[session.payment_link] || "";
    }

    // Try line_items price ID if available
    if (!product && session.line_items?.data?.[0]?.price?.id) {
      product = PRICE_TO_PRODUCT[session.line_items.data[0].price.id] || "";
    }

    // Last resort: use the Stripe API to retrieve the session with line_items
    if (!product) {
      try {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          const res = await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=1`,
            { headers: { Authorization: `Bearer ${stripeKey}` } }
          );
          const lineItems = await res.json();
          const priceId = lineItems.data?.[0]?.price?.id;
          if (priceId) {
            product = PRICE_TO_PRODUCT[priceId] || "";
          }
        }
      } catch (e) {
        console.error("Failed to fetch line_items from Stripe:", e);
      }
    }

    if (!product) {
      console.error("Could not determine product for session", sessionId);
    }

    if (!email) {
      console.error("No email found in checkout session", sessionId);
      return new Response(JSON.stringify({ error: "No email in session" }), { status: 400 });
    }

    if (!product || !["playbook", "dating_coach"].includes(product)) {
      console.error("Unknown product for session", sessionId, product);
      return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 });
    }

    const accessCode = generateAccessCode();

    // Idempotent insert — skip if session_id already recorded
    const { data, error } = await supabase.from("purchases").upsert(
      {
        email,
        product,
        stripe_session_id: sessionId,
        stripe_payment_intent: paymentIntent,
        amount_cents: amountTotal,
        access_code: accessCode,
        status: "completed",
      },
      { onConflict: "stripe_session_id" }
    );

    if (error) {
      console.error("DB insert error:", error);
      return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    console.log(`Purchase recorded: ${email} → ${product} (${accessCode})`);

    // TODO: Trigger confirmation email with access code + PDF download link
    // This will be added when email delivery is set up

    return new Response(JSON.stringify({ received: true, access_code: accessCode }), { status: 200 });
  }

  // ── Handle refunds ───────────────────────────────────────────────────
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntent = charge.payment_intent;

    if (paymentIntent) {
      const { error } = await supabase
        .from("purchases")
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("stripe_payment_intent", paymentIntent);

      if (error) {
        console.error("Refund update error:", error);
      } else {
        console.log(`Refund recorded for payment_intent: ${paymentIntent}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  // ── Handle disputes ──────────────────────────────────────────────────
  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object;
    const paymentIntent = dispute.payment_intent;

    if (paymentIntent) {
      const { error } = await supabase
        .from("purchases")
        .update({ status: "disputed", updated_at: new Date().toISOString() })
        .eq("stripe_payment_intent", paymentIntent);

      if (error) {
        console.error("Dispute update error:", error);
      } else {
        console.log(`Dispute flagged for payment_intent: ${paymentIntent}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  // Acknowledge all other event types
  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
