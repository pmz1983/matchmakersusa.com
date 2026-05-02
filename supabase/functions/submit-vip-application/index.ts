// ═══════════════════════════════════════════════════
// MATCHMAKERS — submit-vip-application Edge Function v2
//
// v2 (2026-04-28): Adds Coach + Playbook prerequisite verification gate
// per Atlas dispatch "VIP funnel-form prerequisite verification +
// Hard separation architecture" 2026-04-28. Westley pattern: pre-v2,
// the function accepted any submission. v2 BLOCKS submissions from
// emails that have not paid for BOTH:
//   • dating_coach_and_playbook  ($250 Playbook + 3 bundled Coach msgs)
//   • dating_coach_premium ($500) OR dating_coach_unlimited ($1000)
// Combined: $750+ minimum spend prerequisite.
//
// Verification policy (defense-in-depth):
//   • Server-side (this function): re-verify on submit — catches
//     direct API hits bypassing the website form
//   • Client-side (website /vip/ form): pre-submit check via
//     check-eligibility action='check-vip-prerequisite' — gives
//     UX-friendly redirect to /playbook/ before form unlock
//
// Replaces the fragile mailto:-based VIP application submission
// path. Receives form POST from vip/index.html, validates,
// VERIFIES PREREQUISITE PURCHASE STATE, writes to public.vip_applications,
// and sends a notification email to the configured advisor inbox via Resend.
//
// Schema: see supabase/migrations/20260421000001_create_vip_applications.sql
// Frontend: see vip/index.html submitApplication() (post-Step-3)
//
// Env vars (all already configured in Supabase project; same
// vars used by handle-stripe-webhook):
//   SUPABASE_URL                 — project URL (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY    — service role for DB writes
//                                  (auto-injected)
//   RESEND_API_KEY               — Resend account API key (set
//                                  via Supabase Dashboard secrets;
//                                  same key used by purchase webhook)
//   VIP_NOTIFICATION_EMAIL       — destination inbox for new VIP
//                                  application notifications.
//                                  Optional; defaults to
//                                  customerservice@matchmakersusa.com.
// ═══════════════════════════════════════════════════
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const VIP_NOTIFICATION_EMAIL =
  Deno.env.get("VIP_NOTIFICATION_EMAIL") || "customerservice@matchmakersusa.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CORS — matches check-eligibility allowlist
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

// ── Validation ────────────────────────────────────────────────
const MAX_FIELD_LEN = 2000; // long-form fields
const MAX_NAME_LEN = 100;
const MAX_INTENT_LEN = 80;

interface VipApplicationBody {
  first_name?: string;
  last_name?: string;
  email?: string;
  intent?: string;
  seeking?: string;
  why?: string;
  coach_completion?: string;
  hp?: string; // honeypot — must be empty
}

function trimSafe(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function validateBody(body: VipApplicationBody): { ok: true } | { ok: false; error: string } {
  // Honeypot: bots fill all fields including hidden ones
  if (typeof body.hp === "string" && body.hp.trim() !== "") {
    return { ok: false, error: "Submission rejected." };
  }

  const required: Array<{ key: keyof VipApplicationBody; label: string }> = [
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "intent", label: "Intent" },
    { key: "seeking", label: "What you're looking for" },
    { key: "why", label: "Why VIP" },
    { key: "coach_completion", label: "Dating Coach status" },
  ];

  for (const r of required) {
    const v = body[r.key];
    if (typeof v !== "string" || v.trim().length === 0) {
      return { ok: false, error: `${r.label} is required.` };
    }
  }

  const email = (body.email || "").trim();
  // Minimal RFC-5322-ish check; the form does its own validation too
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  return { ok: true };
}

// ── v2 Prerequisite verification (Coach + Playbook + Upgrade) ────
//
// Returns ok if email has BOTH:
//   • dating_coach_and_playbook  ($250)
//   • dating_coach_premium ($500) OR dating_coach_unlimited ($1000)
// Both with status='completed'. Refunded/disputed purchases do NOT count.
//
// Error envelope shape supports website form's redirect-to-/playbook/
// UX: { ok: false, reason_code: 'no_playbook' | 'no_coach' | 'both_missing',
//       missing_products: string[], reason: string }
//
interface PrereqCheckResult {
  ok: boolean;
  reason_code?: "no_playbook" | "no_coach" | "both_missing" | "db_error";
  missing_products?: string[];
  reason?: string;
}

async function verifyVipPrerequisite(email: string): Promise<PrereqCheckResult> {
  const { data, error } = await supabase
    .from("purchases")
    .select("product, status")
    .eq("email", email)
    .eq("status", "completed");

  if (error) {
    console.error("VIP prerequisite check DB error:", error);
    return {
      ok: false,
      reason_code: "db_error",
      reason: "Could not verify your purchase history. Please try again or contact support@matchmakersusa.com.",
    };
  }

  const products = new Set<string>((data ?? []).map((r: { product: string }) => r.product));
  const hasPlaybook = products.has("dating_coach_and_playbook");
  const hasCoachPremium = products.has("dating_coach_premium");
  const hasCoachUnlimited = products.has("dating_coach_unlimited");
  const hasCoach = hasCoachPremium || hasCoachUnlimited;

  if (hasPlaybook && hasCoach) {
    return { ok: true };
  }

  const missing: string[] = [];
  if (!hasPlaybook) missing.push("dating_coach_and_playbook");
  if (!hasCoach) missing.push("dating_coach_premium_or_unlimited");

  let reason_code: PrereqCheckResult["reason_code"];
  let reason: string;
  if (!hasPlaybook && !hasCoach) {
    reason_code = "both_missing";
    reason = "VIP applications require completion of the MatchMakers Playbook ($250) AND the Dating Coach ($500 Premium or $1,000 Unlimited). Start with the Playbook at /playbook/ to begin your foundation.";
  } else if (!hasPlaybook) {
    reason_code = "no_playbook";
    reason = "VIP applications require the MatchMakers Playbook ($250) as your foundation. Get the Playbook at /playbook/ — your Coach access carries forward.";
  } else {
    reason_code = "no_coach";
    reason = "VIP applications require the Dating Coach ($500 Premium or $1,000 Unlimited) in addition to the Playbook. Add the Coach from /coach/ when ready.";
  }

  return { ok: false, reason_code, missing_products: missing, reason };
}

// ── Rate limiting (best-effort, IP-based, in-memory per cold-start) ──
// Real protection is honeypot + CAPTCHA (future). This is just a
// noisy-bot speed bump. Edge Function instances are short-lived so
// state is non-durable; acceptable for the threat model.
const rateBuckets = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;        // max submissions
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // per hour, per IP

function rateLimitOk(ip: string): boolean {
  if (!ip) return true; // can't rate-limit without an IP; let it through
  const now = Date.now();
  const fresh = (rateBuckets.get(ip) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  if (fresh.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  rateBuckets.set(ip, fresh);
  return true;
}

// ── Notification email ────────────────────────────────────────
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildNotificationHtml(app: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  intent: string;
  seeking: string;
  why: string;
  coach_completion: string;
  prereq_products: string[];
}): string {
  const fullName = htmlEscape(`${app.first_name} ${app.last_name}`);
  const prereqList = htmlEscape(app.prereq_products.join(", "));
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#05090F;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#05090F;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td align="center" style="padding-bottom:24px;">
    <span style="font-size:1.2rem;font-weight:700;color:#EDF2F7;letter-spacing:.02em;">MatchMakers</span><sup style="color:#C9A84C;font-size:.6rem;">™</sup>
  </td></tr>
  <tr><td style="background:#0B1727;border:1px solid rgba(65,91,124,.2);border-radius:12px;padding:32px;">
    <div style="font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#C9A84C;margin-bottom:8px;">New VIP Application</div>
    <h1 style="font-size:1.4rem;font-weight:700;color:#EDF2F7;margin:0 0 6px;">${fullName}</h1>
    <p style="font-size:.85rem;color:#7A95AF;margin:0 0 24px;"><a href="mailto:${htmlEscape(app.email)}" style="color:#C9A84C;text-decoration:none;">${htmlEscape(app.email)}</a></p>

    <div style="background:rgba(201,168,76,.06);border:1px solid rgba(201,168,76,.2);border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <div style="font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9A84C;margin-bottom:4px;">Prerequisite Verified ✓</div>
      <div style="font-size:.78rem;color:#C2D1E0;line-height:1.5;">Coach + Playbook + Upgrade confirmed: ${prereqList}</div>
    </div>

    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A95AF;width:35%;vertical-align:top;">Intent</td>
          <td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.85rem;color:#C2D1E0;line-height:1.5;">${htmlEscape(app.intent)}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A95AF;vertical-align:top;">Looking For</td>
          <td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.85rem;color:#C2D1E0;line-height:1.5;white-space:pre-wrap;">${htmlEscape(app.seeking)}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A95AF;vertical-align:top;">Why VIP</td>
          <td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.85rem;color:#C2D1E0;line-height:1.5;white-space:pre-wrap;">${htmlEscape(app.why)}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A95AF;vertical-align:top;">Dating Coach</td>
          <td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.85rem;color:#C2D1E0;line-height:1.5;">${htmlEscape(app.coach_completion)}</td></tr>
      <tr><td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7A95AF;vertical-align:top;">Application ID</td>
          <td style="padding:10px 0;border-top:1px solid rgba(65,91,124,.15);font-size:.75rem;color:rgba(122,149,175,.7);font-family:'Courier New',monospace;">${htmlEscape(app.id)}</td></tr>
    </table>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(65,91,124,.15);font-size:.72rem;color:rgba(122,149,175,.6);line-height:1.6;">
      Reply directly to this email to reach the applicant, or query the <code>vip_applications</code> table in Supabase to see all submissions.
    </div>
  </td></tr>
  <tr><td align="center" style="padding:20px 0;font-size:.7rem;color:rgba(122,149,175,.5);">
    MatchMakers LLC · matchmakersusa.com
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function buildNotificationText(app: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  intent: string;
  seeking: string;
  why: string;
  coach_completion: string;
  prereq_products: string[];
}): string {
  return `New VIP Application — ${app.first_name} ${app.last_name}

Email:        ${app.email}
Intent:       ${app.intent}
Dating Coach: ${app.coach_completion}
Prerequisite: VERIFIED ✓ (${app.prereq_products.join(", ")})

Looking For:
${app.seeking}

Why VIP:
${app.why}

Application ID: ${app.id}

Reply directly to this email to reach the applicant.
Query vip_applications in Supabase for full submission history.

— MatchMakers LLC`;
}

async function sendNotification(app: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  intent: string;
  seeking: string;
  why: string;
  coach_completion: string;
  prereq_products: string[];
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured — skipping VIP notification email");
    return;
  }
  const subject = `VIP Application — ${app.first_name} ${app.last_name}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MatchMakers <noreply@matchmakersusa.com>",
      to: [VIP_NOTIFICATION_EMAIL],
      reply_to: app.email,
      subject,
      html: buildNotificationHtml(app),
      text: buildNotificationText(app),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error ${res.status}: ${errText}`);
  }
}

// ── Handler ───────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // Rate limit by source IP (best-effort)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "";
  if (!rateLimitOk(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many submissions. Please try again in an hour." }),
      { status: 429, headers },
    );
  }

  // Parse JSON body
  let raw: VipApplicationBody;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), { status: 400, headers });
  }

  // Trim + length-cap before validation
  const body: VipApplicationBody = {
    first_name: trimSafe(raw.first_name, MAX_NAME_LEN),
    last_name: trimSafe(raw.last_name, MAX_NAME_LEN),
    email: trimSafe(raw.email, MAX_NAME_LEN).toLowerCase(),
    intent: trimSafe(raw.intent, MAX_INTENT_LEN),
    seeking: trimSafe(raw.seeking, MAX_FIELD_LEN),
    why: trimSafe(raw.why, MAX_FIELD_LEN),
    coach_completion: trimSafe(raw.coach_completion, MAX_INTENT_LEN),
    hp: typeof raw.hp === "string" ? raw.hp : "",
  };

  const v = validateBody(body);
  if (!v.ok) {
    return new Response(JSON.stringify({ error: v.error }), { status: 400, headers });
  }

  // ── v2 Prerequisite gate (server-enforced; defense-in-depth) ──
  const prereq = await verifyVipPrerequisite(body.email!);
  if (!prereq.ok) {
    console.log(`VIP prereq REJECTED: ${body.email} (reason=${prereq.reason_code}; missing=${prereq.missing_products?.join(",")})`);
    return new Response(
      JSON.stringify({
        error: prereq.reason,
        reason_code: prereq.reason_code,
        missing_products: prereq.missing_products,
        redirect_url: prereq.reason_code === "no_playbook" || prereq.reason_code === "both_missing"
          ? "/playbook/"
          : "/coach/",
      }),
      { status: 403, headers },
    );
  }

  // Capture prereq products for advisor notification
  const { data: prereqRows } = await supabase
    .from("purchases")
    .select("product")
    .eq("email", body.email!)
    .eq("status", "completed");
  const prereqProducts: string[] = Array.from(
    new Set((prereqRows ?? []).map((r: { product: string }) => r.product)),
  );

  // Insert
  const userAgent = req.headers.get("user-agent") || null;
  const { data, error } = await supabase
    .from("vip_applications")
    .insert({
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      intent: body.intent,
      seeking: body.seeking,
      why: body.why,
      coach_completion: body.coach_completion,
      source_ip: ip || null,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("vip_applications insert error:", error);
    return new Response(
      JSON.stringify({ error: "Could not save your application. Please try again." }),
      { status: 500, headers },
    );
  }

  const applicationId = (data as { id: string }).id;
  console.log(`VIP application captured: ${body.email} → ${applicationId} (prereq=${prereqProducts.join(",")})`);

  // Send notification email — best-effort. Application is already saved
  // so a Resend failure does NOT fail the user submission.
  try {
    await sendNotification({
      id: applicationId,
      first_name: body.first_name!,
      last_name: body.last_name!,
      email: body.email!,
      intent: body.intent!,
      seeking: body.seeking!,
      why: body.why!,
      coach_completion: body.coach_completion!,
      prereq_products: prereqProducts,
    });
    console.log(`VIP notification email sent to ${VIP_NOTIFICATION_EMAIL}`);
  } catch (emailErr) {
    console.error("VIP notification email error:", emailErr);
    // Intentionally swallow — row is already in DB; advisor can be
    // notified by polling the table even if Resend is degraded.
  }

  return new Response(
    JSON.stringify({ success: true, application_id: applicationId }),
    { status: 200, headers },
  );
});
