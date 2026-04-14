import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

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

// ── Email Templates ────────────────────────────────────────────────────
function buildEmailHTML(product: string, accessCode: string): string {
  const isPlaybook = product === "playbook";
  const productName = isPlaybook ? "The MatchMakers Playbook" : "MatchMakers Dating Coach";
  const accessDuration = isPlaybook ? "Lifetime access" : "30-day access";
  const nextStepUrl = isPlaybook
    ? "https://matchmakersusa.com/playbook/content/"
    : "https://matchmakersusa.com/";
  const nextStepLabel = isPlaybook ? "Open Your Playbook" : "Start Your First Session";
  const nextStepDesc = isPlaybook
    ? "All 9 chapters, 50+ scripts, and the complete 5-phase methodology are ready for you."
    : "Click the gold orb on any page, enter your access code, and start coaching immediately.";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#05090F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#05090F;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

<!-- Logo -->
<tr><td align="center" style="padding-bottom:32px;">
  <span style="font-size:1.3rem;font-weight:700;color:#EDF2F7;letter-spacing:.02em;">MatchMakers</span><sup style="color:#C9A84C;font-size:.6rem;">™</sup>
</td></tr>

<!-- Card -->
<tr><td style="background:#0B1727;border:1px solid rgba(65,91,124,.2);border-radius:16px;padding:40px 36px;">

  <!-- Product badge -->
  <div style="font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;text-align:center;">${productName}</div>

  <!-- Headline -->
  <h1 style="font-size:1.8rem;font-weight:700;color:#EDF2F7;margin:0 0 8px;text-align:center;line-height:1.2;">
    ${isPlaybook ? "You're In." : "Your Coach Is Ready."}
  </h1>

  <p style="font-size:.9rem;color:#7A95AF;line-height:1.6;text-align:center;margin:0 0 28px;">
    Your purchase is confirmed. ${accessDuration} — starting now.
  </p>

  <!-- Access Code Box -->
  <div style="background:rgba(5,9,15,.6);border:1px solid rgba(201,168,76,.2);border-radius:12px;padding:20px;text-align:center;margin-bottom:28px;">
    <div style="font-size:.65rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#7A95AF;margin-bottom:8px;">Your Access Code</div>
    <div style="font-size:1.5rem;font-weight:700;color:#C9A84C;letter-spacing:.12em;font-family:'Courier New',monospace;">${accessCode}</div>
    <div style="font-size:.72rem;color:#7A95AF;margin-top:6px;">Save this code — you'll need it to access your content.</div>
  </div>

  <!-- Divider -->
  <div style="width:48px;height:1px;background:rgba(201,168,76,.25);margin:0 auto 24px;"></div>

  <!-- Next Steps -->
  <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;margin-bottom:14px;">Next Steps</div>

  <div style="margin-bottom:12px;display:flex;gap:12px;">
    <div style="width:24px;height:24px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);text-align:center;line-height:24px;font-size:.7rem;font-weight:700;color:#C9A84C;flex-shrink:0;">1</div>
    <div style="font-size:.85rem;color:#C2D1E0;line-height:1.5;">${nextStepDesc}</div>
  </div>

  ${isPlaybook ? `<div style="margin-bottom:12px;display:flex;gap:12px;">
    <div style="width:24px;height:24px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);text-align:center;line-height:24px;font-size:.7rem;font-weight:700;color:#C9A84C;flex-shrink:0;">2</div>
    <div style="font-size:.85rem;color:#C2D1E0;line-height:1.5;">Your Playbook purchase unlocks the Dating Coach. When you're ready, add AI coaching for real-time methodology guidance.</div>
  </div>` : `<div style="margin-bottom:12px;display:flex;gap:12px;">
    <div style="width:24px;height:24px;border-radius:50%;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.2);text-align:center;line-height:24px;font-size:.7rem;font-weight:700;color:#C9A84C;flex-shrink:0;">2</div>
    <div style="font-size:.85rem;color:#C2D1E0;line-height:1.5;">Bring real situations — messages, profiles, conversations. Your coach applies the full MatchMakers methodology to your specific context.</div>
  </div>`}

  <!-- CTA Button -->
  <div style="text-align:center;margin-top:28px;">
    <a href="${nextStepUrl}" style="display:inline-block;padding:14px 36px;background:#C9A84C;color:#0B1727;font-size:.82rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;border-radius:10px;">${nextStepLabel}</a>
  </div>

</td></tr>

<!-- Footer -->
<tr><td style="padding:28px 0;text-align:center;">
  <p style="font-size:.72rem;color:rgba(122,149,175,.5);line-height:1.6;margin:0;">
    MatchMakers LLC · matchmakersusa.com<br>
    Questions? Reply to this email or contact support@matchmakersusa.com
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildEmailText(product: string, accessCode: string): string {
  const isPlaybook = product === "playbook";
  const productName = isPlaybook ? "The MatchMakers Playbook" : "MatchMakers Dating Coach";
  const nextStepUrl = isPlaybook
    ? "https://matchmakersusa.com/playbook/content/"
    : "https://matchmakersusa.com/";

  return `${productName} — Purchase Confirmed

Your access code: ${accessCode}

Save this code — you'll need it to access your content.

Next step: ${nextStepUrl}

Questions? Contact support@matchmakersusa.com

— MatchMakers LLC`;
}

async function sendConfirmationEmail(
  to: string,
  product: string,
  accessCode: string
): Promise<void> {
  const isPlaybook = product === "playbook";
  const subject = isPlaybook
    ? "Your MatchMakers Playbook Is Ready"
    : "Your Dating Coach Is Ready";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MatchMakers <noreply@matchmakersusa.com>",
      to: [to],
      subject,
      html: buildEmailHTML(product, accessCode),
      text: buildEmailText(product, accessCode),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errText}`);
  }
}

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

    // ── Send confirmation email ──────────────────────────────────────
    if (RESEND_API_KEY) {
      try {
        await sendConfirmationEmail(email, product, accessCode);
        console.log(`Confirmation email sent to ${email}`);

        // Mark email as sent
        await supabase
          .from("purchases")
          .update({ email_sent: true })
          .eq("stripe_session_id", sessionId);
      } catch (emailErr) {
        // Don't fail the webhook if email fails — purchase is already recorded
        console.error("Email send error:", emailErr);
      }
    } else {
      console.warn("RESEND_API_KEY not configured — skipping confirmation email");
    }

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
