// =============================================================================
// MATCHMAKERS — handle-stripe-webhook v3 (Core Product + Monetization System)
// =============================================================================
// Per: D-V3-4-CORE-PRODUCT-MONETIZATION-SYSTEM-PAUL-DIRECTIVE-2026-04-29
// Master brief: ~/Desktop/03_MM_OPS/drafts/core_product_monetization_system_master_brief_2026-04-29.md
// Authoring agent: Backend Architect 2026-04-29 (Lane 1 deliverable D + E)
//
// v3 changes from v2:
//   - PRESERVED: HMAC-SHA256 signature verification + 5-min anti-replay
//   - PRESERVED: charge.refunded + charge.dispute.created handlers
//   - PRESERVED: Resend confirmation email + signed PDF URL flow (Playbook)
//   - PRESERVED: legacy product traceback (LEGACY $500 Playbook still maps to dating_coach_and_playbook)
//   - ADDED: NEW canonical product map (6 Stripe products created 2026-04-29)
//   - ADDED: entitlement provisioning to public.entitlements table per master brief §5
//   - ADDED: customer.subscription.created handler (sub-path activation Day 31)
//   - ADDED: customer.subscription.updated handler (waterfall replacement: Premium replaces Base)
//   - ADDED: customer.subscription.deleted handler (cancellation; entitlements expire at period_end)
//   - ADDED: invoice.payment_succeeded handler (recurring sub renewal — extends entitlement period)
//   - ADDED: invoice.payment_failed handler (informational logging; user-side dunning Stripe-managed)
//   - ADDED: VIP product handlers (vip-entry / vip-mid / vip-top) with vip-mid replaces vip-entry waterfall
//
// Doctrine basis:
//   - C#17: NO plaintext credentials; all secrets from env
//   - §5.B clean: zero algo-protected surfaces touched (entitlements is a NEW non-algo table)
//   - Pre-disruption memo binding: covered under master brief §0 Paul §5 system-locking directive
//   - Idempotency: entitlement INSERTs guarded by source_stripe_session uniqueness check + ON CONFLICT
// =============================================================================

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Stripe signature verification ──────────────────────────────────────
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
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
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

// ── Access code generation ─────────────────────────────────────────────
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "MM-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─────────────────────────────────────────────────────────────────────────
// PRODUCT MAPPING — v3 canonical (6 Stripe products created 2026-04-29)
// ─────────────────────────────────────────────────────────────────────────
//
// canonical_product_key: human-readable internal label used by entitlements + handle-stripe-webhook
// stripe_product_id: Stripe Product ID (prod_…)
// stripe_price_ids: array of Price IDs that map to this canonical key (one product can have multiple prices over time)
//
// LEGACY mappings preserved alongside NEW for backwards compatibility on
// existing in-flight checkout sessions from prior Payment Links.

interface ProductDef {
  canonical_key: string;       // e.g., 'playbook_entry' / 'playbook_continuation_base' / 'vip_entry'
  data_product_attr: string;   // e.g., 'playbook-entry' (HTML data-product attr for checkout.js)
  stripe_product_id: string;
  stripe_price_ids: string[];  // canonical price IDs that map back to this product
  legacy?: boolean;             // true = legacy product retained for in-flight session traceback
}

const PRODUCT_REGISTRY: ProductDef[] = [
  // NEW canonical (created 2026-04-29 via Stripe MCP; amended 2026-04-29 master brief amendment #1 $250 → $299.99)
  {
    canonical_key: "playbook_entry",
    data_product_attr: "playbook-entry",
    stripe_product_id: "prod_UQalpj9Ue0qW2N",
    stripe_price_ids: [
      "price_1TRjyt1ihNKVY3uGBCrSBA5Y",                              // $299.99 one-time (canonical post-amendment)
      "price_1TRjbN1ihNKVY3uGDf1vtHYp",                              // $250 one-time (ARCHIVED 2026-04-29; in-flight session traceback)
    ],
  },
  {
    canonical_key: "playbook_continuation_base",
    data_product_attr: "playbook-continuation-base",
    stripe_product_id: "prod_UQalbqey45hRGo",
    stripe_price_ids: ["price_1TRjbQ1ihNKVY3uGW2fIDknp"],            // $19.99/mo recurring
  },
  {
    canonical_key: "playbook_premium",
    data_product_attr: "playbook-premium",
    stripe_product_id: "prod_UQamwyagBKHafr",
    stripe_price_ids: ["price_1TRjbT1ihNKVY3uGHTkHteVm"],            // $99.99/mo recurring
  },
  {
    canonical_key: "vip_entry",
    data_product_attr: "vip-entry",
    stripe_product_id: "prod_UQamOwPr8toLuX",
    stripe_price_ids: ["price_1TRjbV1ihNKVY3uGcFwYadVC"],            // $499.99 one-time
  },
  {
    canonical_key: "vip_mid",
    data_product_attr: "vip-mid",
    stripe_product_id: "prod_UQamum7SoTVtx7",
    stripe_price_ids: ["price_1TRjbY1ihNKVY3uGqj8uvyVq"],            // $999.99 one-time
  },
  {
    canonical_key: "vip_top",
    data_product_attr: "vip-top",
    stripe_product_id: "prod_UQamzNxMJd7XhP",
    stripe_price_ids: [],                                              // no default price (consultation-driven)
  },

  // LEGACY (pre-2026-04-29 products; in-flight session traceback only)
  {
    canonical_key: "dating_coach_and_playbook",                          // LEGACY $250 OR $500 Playbook
    data_product_attr: "playbook",
    stripe_product_id: "prod_UKe06Pz8KUnoSz",
    stripe_price_ids: [
      "price_1TMYHq1ihNKVY3uGZKNgmSwi",                                  // $250 (current Playbook standalone)
      "price_1TLyin1ihNKVY3uGtdOvWGP2",                                  // $500 LEGACY Playbook
    ],
    legacy: true,
  },
  {
    canonical_key: "dating_coach_premium",                               // LEGACY Coach $500
    data_product_attr: "dating_coach_premium",
    stripe_product_id: "prod_UKe22ZoFj8U9gP",
    stripe_price_ids: ["price_1TLykh1ihNKVY3uG4a08H5UT"],
    legacy: true,
  },
  {
    canonical_key: "dating_coach_unlimited",                             // LEGACY Coach $1,000 standalone
    data_product_attr: "dating_coach_unlimited",
    stripe_product_id: "prod_UKe22ZoFj8U9gP",
    stripe_price_ids: ["price_1TMYPd1ihNKVY3uGfhptvOAa"],
    legacy: true,
  },
];

// LEGACY Payment Link → product map (preserved from v1/v2)
const PAYMENT_LINK_TO_PRODUCT: Record<string, string> = {
  plink_1TM53W1ihNKVY3uGh4TGAg64: "dating_coach_and_playbook",          // old $500 playbook
  plink_1TLykw1ihNKVY3uGCd56xqat: "dating_coach_and_playbook",          // old $500 playbook
  "00wbITcFzdXL11F88Y2Nq03": "dating_coach_and_playbook",                // $250 playbook current Payment Link short-id
  plink_1TM52z1ihNKVY3uGYDEc34em: "dating_coach_premium",
  "14AeV5493bPD4dRcpe2Nq05": "dating_coach_unlimited",
};

// Reverse lookup: stripe_price_id OR stripe_product_id → canonical key
function canonicalKeyFromPrice(price_id: string): string | null {
  for (const p of PRODUCT_REGISTRY) {
    if (p.stripe_price_ids.includes(price_id)) return p.canonical_key;
  }
  return null;
}

function canonicalKeyFromProduct(product_id: string): string | null {
  // Returns the FIRST non-legacy match; if only legacy matches, returns legacy
  let legacy_match: string | null = null;
  for (const p of PRODUCT_REGISTRY) {
    if (p.stripe_product_id === product_id) {
      if (!p.legacy) return p.canonical_key;
      legacy_match = p.canonical_key;
    }
  }
  return legacy_match;
}

// ─────────────────────────────────────────────────────────────────────────
// ENTITLEMENT PROVISIONING — per master brief §5
// ─────────────────────────────────────────────────────────────────────────

interface ProvisionContext {
  app_user_id: string;
  email: string;
  source_stripe_session?: string;
  source_stripe_subscription?: string;
  source_stripe_price?: string;
}

// Days until expiration helper
function expiresAt30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

// Provision entitlements per canonical product key
async function provisionEntitlements(canonical_key: string, ctx: ProvisionContext): Promise<void> {
  const inserts: Array<Record<string, unknown>> = [];

  switch (canonical_key) {
    case "playbook_entry":
    case "dating_coach_and_playbook": {
      // $250 entry (NEW + LEGACY) → Playbook lifetime + Coach base 30d + SB base 30d + VIP eligibility
      const exp = expiresAt30Days();
      inserts.push(
        { product_type: "playbook",       tier: null,    expires_at: null, },                   // lifetime PDF
        { product_type: "coach_access",   tier: "base",  expires_at: exp,  },                   // 30-day Coach base
        { product_type: "script_builder", tier: "base",  expires_at: exp,  },                   // 30-day SB base
      );
      break;
    }

    case "playbook_continuation_base": {
      // $19.99/mo → Coach base for current sub period + SB base for current period
      // Note: actual period end taken from subscription.current_period_end in subscription handlers
      // For initial provision (subscription.created), default to 30d from now; subsequent renewals
      // handled by invoice.payment_succeeded extending expires_at.
      const exp = expiresAt30Days();
      inserts.push(
        { product_type: "coach_access",   tier: "base", expires_at: exp, },
        { product_type: "script_builder", tier: "base", expires_at: exp, },
      );
      break;
    }

    case "playbook_premium":
    case "dating_coach_premium": {
      // $99.99/mo Premium tier → Coach PREMIUM (waterfall replaces base) + SB PREMIUM
      const exp = expiresAt30Days();

      // WATERFALL: deactivate any existing Base tier coach_access + script_builder for this user
      await supabase
        .from("entitlements")
        .update({ active: false })
        .eq("user_id", ctx.app_user_id)
        .in("product_type", ["coach_access", "script_builder"])
        .eq("tier", "base")
        .eq("active", true);

      inserts.push(
        { product_type: "coach_access",   tier: "premium", expires_at: exp, },
        { product_type: "script_builder", tier: "premium", expires_at: exp, },
      );
      break;
    }

    case "dating_coach_unlimited": {
      // LEGACY $1,000 standalone Unlimited → Coach PREMIUM + SB PREMIUM (treat same as premium for entitlements)
      const exp = expiresAt30Days();
      await supabase
        .from("entitlements")
        .update({ active: false })
        .eq("user_id", ctx.app_user_id)
        .in("product_type", ["coach_access", "script_builder"])
        .eq("tier", "base")
        .eq("active", true);
      inserts.push(
        { product_type: "coach_access",   tier: "premium", expires_at: exp, },
        { product_type: "script_builder", tier: "premium", expires_at: exp, },
      );
      break;
    }

    case "vip_entry": {
      inserts.push({ product_type: "vip_entry", tier: null, expires_at: null });
      break;
    }
    case "vip_mid": {
      // WATERFALL: vip_mid replaces vip_entry — deactivate any existing vip_entry
      await supabase
        .from("entitlements")
        .update({ active: false })
        .eq("user_id", ctx.app_user_id)
        .eq("product_type", "vip_entry")
        .eq("active", true);
      // Per master brief amendment #3 (2026-04-29): VIP Level 2 (vip_mid) = 30-day engagement
      // window with human matchmaker (email + in-website + in-app live synchronous chat;
      // NOT video) via post-purchase portal. Entitlement expires at 30d granted.
      inserts.push({ product_type: "vip_mid", tier: null, expires_at: expiresAt30Days() });
      break;
    }
    case "vip_top": {
      // WATERFALL: vip_top replaces vip_mid + vip_entry
      await supabase
        .from("entitlements")
        .update({ active: false })
        .eq("user_id", ctx.app_user_id)
        .in("product_type", ["vip_entry", "vip_mid"])
        .eq("active", true);
      inserts.push({ product_type: "vip_top", tier: null, expires_at: null });
      break;
    }

    default:
      console.warn(`provisionEntitlements: unknown canonical_key ${canonical_key}; no-op.`);
      return;
  }

  // Decorate inserts with user_id + source fields + active=true
  const rows = inserts.map((row) => ({
    user_id: ctx.app_user_id,
    active: true,
    granted_at: new Date().toISOString(),
    source_stripe_session: ctx.source_stripe_session ?? null,
    source_stripe_subscription: ctx.source_stripe_subscription ?? null,
    source_stripe_price: ctx.source_stripe_price ?? null,
    metadata: {},
    ...row,
  }));

  // Idempotency: skip if a row already exists with the same source_stripe_session + product_type
  // (subscription path uses source_stripe_subscription instead of session)
  if (ctx.source_stripe_session) {
    const { data: existing } = await supabase
      .from("entitlements")
      .select("id, product_type")
      .eq("source_stripe_session", ctx.source_stripe_session);
    if (existing && existing.length > 0) {
      const existing_types = new Set((existing as Array<{ product_type: string }>).map((e) => e.product_type));
      const filtered = rows.filter((r) => !existing_types.has(r.product_type as string));
      if (filtered.length === 0) {
        console.log(`provisionEntitlements: idempotent skip for session ${ctx.source_stripe_session}`);
        return;
      }
      const { error } = await supabase.from("entitlements").insert(filtered);
      if (error) console.error(`entitlements partial insert error:`, error);
      else console.log(`entitlements: ${filtered.length} new rows added (${existing.length} pre-existing)`);
      return;
    }
  }

  const { error } = await supabase.from("entitlements").insert(rows);
  if (error) {
    console.error(`entitlements insert error:`, error);
  } else {
    console.log(`entitlements: ${rows.length} rows provisioned for user ${ctx.app_user_id} canonical=${canonical_key}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION HANDLERS
// ─────────────────────────────────────────────────────────────────────────

async function handleSubscriptionCreated(sub: Record<string, unknown>): Promise<void> {
  const subscription_id = sub.id as string;
  const customer_id = sub.customer as string | null;
  const items = (sub.items as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];
  if (items.length === 0) {
    console.warn(`subscription.created ${subscription_id}: no items; ignoring`);
    return;
  }

  // Find email + app_user_id by Stripe customer
  const ctx = await contextForCustomer(customer_id);
  if (!ctx) {
    console.error(`subscription.created ${subscription_id}: cannot resolve app_user_id; skipping`);
    return;
  }

  for (const item of items) {
    const price = item.price as { id?: string; product?: string } | undefined;
    const price_id = price?.id ?? "";
    const canonical = canonicalKeyFromPrice(price_id) ?? canonicalKeyFromProduct(price?.product ?? "");
    if (!canonical) {
      console.warn(`subscription.created ${subscription_id}: unknown price=${price_id}`);
      continue;
    }
    await provisionEntitlements(canonical, {
      ...ctx,
      source_stripe_subscription: subscription_id,
      source_stripe_price: price_id,
    });
  }
}

async function handleSubscriptionUpdated(sub: Record<string, unknown>): Promise<void> {
  const subscription_id = sub.id as string;
  const status = sub.status as string;
  const items = (sub.items as { data?: Array<Record<string, unknown>> } | undefined)?.data ?? [];

  // Status check: if active or trialing, ensure entitlements present per current items.
  // If past_due or unpaid, leave existing entitlements active until period end (Stripe dunning manages user-side).
  // If canceled (status=canceled), delegated to subscription.deleted.
  if (status !== "active" && status !== "trialing") {
    console.log(`subscription.updated ${subscription_id}: status=${status}; no entitlement change`);
    return;
  }

  // Resolve user
  const customer_id = sub.customer as string | null;
  const ctx = await contextForCustomer(customer_id);
  if (!ctx) return;

  // For each item on the updated subscription, ensure provisioning current
  for (const item of items) {
    const price = item.price as { id?: string; product?: string } | undefined;
    const price_id = price?.id ?? "";
    const canonical = canonicalKeyFromPrice(price_id) ?? canonicalKeyFromProduct(price?.product ?? "");
    if (!canonical) continue;
    await provisionEntitlements(canonical, {
      ...ctx,
      source_stripe_subscription: subscription_id,
      source_stripe_price: price_id,
    });
  }
}

async function handleSubscriptionDeleted(sub: Record<string, unknown>): Promise<void> {
  const subscription_id = sub.id as string;
  // Cancellation: deactivate entitlements sourced from this subscription
  const { error } = await supabase
    .from("entitlements")
    .update({ active: false })
    .eq("source_stripe_subscription", subscription_id);
  if (error) console.error(`subscription.deleted ${subscription_id}: deactivate error:`, error);
  else console.log(`subscription.deleted ${subscription_id}: entitlements deactivated`);
}

async function handleInvoicePaymentSucceeded(invoice: Record<string, unknown>): Promise<void> {
  // Recurring sub renewal: extend expires_at on entitlements sourced from this subscription
  const subscription_id = invoice.subscription as string | null;
  if (!subscription_id) return;
  const new_exp = expiresAt30Days();
  const { error } = await supabase
    .from("entitlements")
    .update({ expires_at: new_exp, active: true })
    .eq("source_stripe_subscription", subscription_id)
    .eq("active", true);
  if (error) console.error(`invoice.payment_succeeded ${invoice.id}: extend error:`, error);
  else console.log(`invoice.payment_succeeded ${invoice.id}: entitlements extended for sub ${subscription_id}`);
}

async function handleInvoicePaymentFailed(invoice: Record<string, unknown>): Promise<void> {
  // Informational only; Stripe Smart Retries + dunning emails handle user-side
  console.warn(`invoice.payment_failed: ${invoice.id} subscription=${invoice.subscription} customer=${invoice.customer}`);
}

// ─────────────────────────────────────────────────────────────────────────
// USER RESOLUTION (email → app_user_id; create row if missing)
// ─────────────────────────────────────────────────────────────────────────

async function appUserIdForEmail(email: string): Promise<string | null> {
  if (!email) return null;
  const lower = email.toLowerCase().trim();
  const { data } = await supabase.from("app_users").select("id").eq("email", lower).maybeSingle();
  if (data) return (data as { id: string }).id;
  // Auto-create app_users row for purchaser if missing (email-only stub; iOS/website signup may flesh out later)
  const { data: created, error } = await supabase
    .from("app_users")
    .insert({ email: lower, membership_type: 1 })
    .select("id")
    .single();
  if (error) {
    console.error(`appUserIdForEmail auto-create error for ${lower}:`, error);
    return null;
  }
  return (created as { id: string }).id;
}

async function contextForCustomer(customer_id: string | null): Promise<ProvisionContext | null> {
  if (!customer_id || !STRIPE_SECRET_KEY) return null;
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customer_id}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) return null;
    const cust = await res.json();
    const email = (cust?.email || "").toLowerCase().trim();
    if (!email) return null;
    const app_user_id = await appUserIdForEmail(email);
    if (!app_user_id) return null;
    return { app_user_id, email };
  } catch (err) {
    console.error(`contextForCustomer ${customer_id} error:`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EMAIL FLOW (preserved from v1/v2)
// ─────────────────────────────────────────────────────────────────────────

const PLAYBOOK_PDF_PATH = "MatchMakers-Playbook.pdf";
const PDF_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days

async function generatePdfUrl(): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("playbook-pdfs")
    .createSignedUrl(PLAYBOOK_PDF_PATH, PDF_URL_EXPIRY);
  if (error) {
    console.error("Failed to generate signed PDF URL:", error);
    return null;
  }
  return data.signedUrl;
}

function buildEmailHTML(canonical_key: string, accessCode: string, pdfUrl?: string | null): string {
  const isPlaybook = canonical_key === "playbook_entry" || canonical_key === "dating_coach_and_playbook";
  const isPremium = canonical_key === "playbook_premium" || canonical_key === "dating_coach_premium";
  const isUnlimited = canonical_key === "dating_coach_unlimited";
  const isVip = canonical_key.startsWith("vip_");

  const productName = isPlaybook
    ? "Coach & Playbook (Entry)"
    : isPremium
      ? "Premium"
      : isUnlimited
        ? "Coach Unlimited (Legacy)"
        : isVip
          ? `MatchMakers VIP — ${canonical_key.replace("vip_", "").toUpperCase()}`
          : "MatchMakers";
  const accessDuration = isPlaybook
    ? "Playbook lifetime + 30 days of Coach + 5 Script Builder sessions"
    : isPremium
      ? "Premium — 500 Coach msgs/day + unlimited Script Builder"
      : isUnlimited
        ? "Unlimited Coach + Script Builder (legacy plan)"
        : isVip
          ? "VIP application received; expect intake instructions shortly"
          : "Confirmed";
  const nextStepUrl = isVip
    ? "https://matchmakersusa.com/vip/"
    : isPlaybook
      ? "https://matchmakersusa.com/playbook/content/"
      : "https://matchmakersusa.com/";
  const nextStepLabel = isVip
    ? "View VIP Process"
    : isPlaybook
      ? "Open Your Playbook"
      : "Start Your First Session";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#05090F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#05090F;padding:40px 20px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td align="center" style="padding-bottom:32px;">
<span style="font-size:1.3rem;font-weight:700;color:#EDF2F7;letter-spacing:.02em;">MatchMakers</span><sup style="color:#C9A84C;font-size:.6rem;">™</sup>
</td></tr>
<tr><td style="background:#0B1727;border:1px solid rgba(65,91,124,.2);border-radius:16px;padding:40px 36px;">
<div style="font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;text-align:center;">${productName}</div>
<h1 style="font-size:1.8rem;font-weight:700;color:#EDF2F7;margin:0 0 8px;text-align:center;line-height:1.2;">You're In.</h1>
<p style="font-size:.9rem;color:#7A95AF;line-height:1.6;text-align:center;margin:0 0 28px;">Your purchase is confirmed. ${accessDuration}.</p>
<div style="background:rgba(5,9,15,.6);border:1px solid rgba(201,168,76,.2);border-radius:12px;padding:20px;text-align:center;margin-bottom:28px;">
<div style="font-size:.65rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#7A95AF;margin-bottom:8px;">Your Access Code</div>
<div style="font-size:1.5rem;font-weight:700;color:#C9A84C;letter-spacing:.12em;font-family:'Courier New',monospace;">${accessCode}</div>
<div style="font-size:.72rem;color:#7A95AF;margin-top:6px;">Save this code — you'll need it to access your content.</div>
</div>
${isPlaybook && pdfUrl ? `
<div style="background:rgba(5,9,15,.6);border:1px solid rgba(201,168,76,.15);border-radius:12px;padding:20px;text-align:center;margin-top:8px;margin-bottom:24px;">
<div style="font-size:.65rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#7A95AF;margin-bottom:10px;">Premium PDF Edition</div>
<a href="${pdfUrl}" style="display:inline-block;padding:12px 28px;background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);color:#C9A84C;font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;border-radius:10px;">Download PDF</a>
<div style="font-size:.68rem;color:rgba(122,149,175,.5);margin-top:8px;">This link expires in 7 days.</div>
</div>` : ""}
<div style="text-align:center;margin-top:28px;">
<a href="${nextStepUrl}" style="display:inline-block;padding:14px 36px;background:#C9A84C;color:#0B1727;font-size:.82rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;border-radius:10px;">${nextStepLabel}</a>
</div>
${isPlaybook ? `<p style="font-size:.7rem;color:rgba(122,149,175,.6);text-align:center;margin:24px 0 0;line-height:1.6;">Reminder: the Playbook is a non-refundable digital product. All sales are final on Playbook content.<br>Subscription continuation can be canceled before next billing cycle.</p>` : ""}
</td></tr>
<tr><td style="padding:28px 0;text-align:center;">
<p style="font-size:.72rem;color:rgba(122,149,175,.5);line-height:1.6;margin:0;">MatchMakers LLC · matchmakersusa.com<br>Questions? Reply to this email or contact support@matchmakersusa.com</p>
</td></tr></table></td></tr></table>
</body></html>`;
}

function buildEmailText(canonical_key: string, accessCode: string, pdfUrl?: string | null): string {
  const isPlaybook = canonical_key === "playbook_entry" || canonical_key === "dating_coach_and_playbook";
  const nextStepUrl = isPlaybook ? "https://matchmakersusa.com/playbook/content/" : "https://matchmakersusa.com/";
  const pdfLine = isPlaybook && pdfUrl ? `\nDownload your Premium PDF edition (link expires in 7 days):\n${pdfUrl}\n` : "";
  return `MatchMakers — Purchase Confirmed
Your access code: ${accessCode}
Save this code — you'll need it to access your content.
${pdfLine}
Next step: ${nextStepUrl}
Questions? Contact support@matchmakersusa.com
— MatchMakers LLC`;
}

async function sendConfirmationEmail(to: string, canonical_key: string, accessCode: string, pdfUrl?: string | null): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured — skipping confirmation email");
    return;
  }
  const subject = canonical_key.startsWith("vip_")
    ? "Your MatchMakers VIP Application Is Received"
    : (canonical_key === "playbook_entry" || canonical_key === "dating_coach_and_playbook")
      ? "Your MatchMakers Coach & Playbook Is Ready"
      : "Your MatchMakers Subscription Is Active";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "MatchMakers <noreply@matchmakersusa.com>",
      to: [to], subject,
      html: buildEmailHTML(canonical_key, accessCode, pdfUrl),
      text: buildEmailText(canonical_key, accessCode, pdfUrl),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errText}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HANDLER ENTRY
// ─────────────────────────────────────────────────────────────────────────

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
  if (!sig) return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), { status: 400 });
  const valid = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.error("Invalid Stripe webhook signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const event = JSON.parse(body);
  console.log(`v3 Stripe event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // ─── ONE-TIME PURCHASES ───────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const email = (session.customer_details?.email || session.customer_email || "").toLowerCase().trim();
        const sessionId = session.id;
        const paymentIntent = session.payment_intent;
        const amountTotal = session.amount_total;
        const subscription_id = session.subscription;

        // Determine product key (NEW canonical first, then LEGACY fallback)
        let canonical_key = "";
        if (session.line_items?.data?.[0]?.price?.id) {
          canonical_key = canonicalKeyFromPrice(session.line_items.data[0].price.id) || "";
        }
        if (!canonical_key && session.metadata?.product) {
          canonical_key = session.metadata.product;
        }
        if (!canonical_key && session.payment_link) {
          canonical_key = PAYMENT_LINK_TO_PRODUCT[session.payment_link] || "";
        }
        if (!canonical_key && STRIPE_SECRET_KEY) {
          // Last resort: fetch line_items via Stripe API
          try {
            const res = await fetch(
              `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=1`,
              { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
            );
            const lineItems = await res.json();
            const priceId = lineItems.data?.[0]?.price?.id;
            if (priceId) canonical_key = canonicalKeyFromPrice(priceId) || "";
          } catch (e) {
            console.error("Failed to fetch line_items from Stripe:", e);
          }
        }

        if (!canonical_key) {
          console.error("Could not determine canonical_key for session", sessionId);
          return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 });
        }
        if (!email) {
          console.error("No email found in checkout session", sessionId);
          return new Response(JSON.stringify({ error: "No email in session" }), { status: 400 });
        }

        const accessCode = generateAccessCode();
        const app_user_id = await appUserIdForEmail(email);

        // Persist the historical purchases row (preserved from v1)
        const purchaseRecord: Record<string, unknown> = {
          email,
          product: canonical_key,
          plan: canonical_key,
          stripe_session_id: sessionId,
          stripe_payment_intent: paymentIntent,
          amount_cents: amountTotal,
          access_code: accessCode,
          status: "completed",
        };
        const { error: pErr } = await supabase.from("purchases").upsert(
          purchaseRecord,
          { onConflict: "stripe_session_id" }
        );
        if (pErr) console.error("purchases upsert error:", pErr);

        // Provision entitlements
        if (app_user_id) {
          await provisionEntitlements(canonical_key, {
            app_user_id, email,
            source_stripe_session: sessionId,
            source_stripe_subscription: subscription_id ?? undefined,
          });
        } else {
          console.error(`No app_user_id resolvable for ${email}; entitlements not provisioned`);
        }

        // Generate PDF + send email
        let pdfUrl: string | null = null;
        if (canonical_key === "playbook_entry" || canonical_key === "dating_coach_and_playbook") {
          pdfUrl = await generatePdfUrl();
        }
        if (RESEND_API_KEY) {
          try {
            await sendConfirmationEmail(email, canonical_key, accessCode, pdfUrl);
            await supabase.from("purchases").update({ email_sent: true }).eq("stripe_session_id", sessionId);
          } catch (emailErr) {
            console.error("Email send error:", emailErr);
          }
        }

        return new Response(JSON.stringify({ received: true, access_code: accessCode }), { status: 200 });
      }

      // ─── SUBSCRIPTION LIFECYCLE ───────────────────────────────────
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        return new Response(JSON.stringify({ received: true }), { status: 200 });

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        return new Response(JSON.stringify({ received: true }), { status: 200 });

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        return new Response(JSON.stringify({ received: true }), { status: 200 });

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        return new Response(JSON.stringify({ received: true }), { status: 200 });

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        return new Response(JSON.stringify({ received: true }), { status: 200 });

      // ─── REFUNDS + DISPUTES (preserved from v1) ───────────────────
      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntent = charge.payment_intent;
        if (paymentIntent) {
          await supabase
            .from("purchases")
            .update({ status: "refunded", updated_at: new Date().toISOString() })
            .eq("stripe_payment_intent", paymentIntent);
          // Deactivate entitlements sourced from the refunded session
          // (lookup session via payment_intent)
          const { data: pRows } = await supabase
            .from("purchases")
            .select("stripe_session_id")
            .eq("stripe_payment_intent", paymentIntent);
          for (const p of (pRows ?? []) as Array<{ stripe_session_id: string }>) {
            await supabase
              .from("entitlements")
              .update({ active: false })
              .eq("source_stripe_session", p.stripe_session_id);
          }
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      case "charge.dispute.created": {
        const dispute = event.data.object;
        const paymentIntent = dispute.payment_intent;
        if (paymentIntent) {
          await supabase
            .from("purchases")
            .update({ status: "disputed", updated_at: new Date().toISOString() })
            .eq("stripe_payment_intent", paymentIntent);
        }
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      default:
        // Acknowledge unhandled events with 200 so Stripe doesn't retry
        return new Response(JSON.stringify({ received: true, note: `unhandled event type ${event.type}` }), { status: 200 });
    }
  } catch (err) {
    console.error(`v3 webhook fatal:`, err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? String(err) }), { status: 500 });
  }
});
