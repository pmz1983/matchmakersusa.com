# Architecture — matchmakersusa.com

## Stack

- **Type:** Static HTML + vanilla JS. No build system.
- **Hosting:** GitHub Pages, custom domain `matchmakersusa.com` (`CNAME` file at repo root).
- **Repo:** `github.com/pmz1983/matchmakersusa.com`, branch `main`.
- **Deploy:** every push to `main` deploys. No staging. No CI beyond GitHub Pages' own build (bypassed via `.nojekyll`).

## File layout

```
/
├── index.html              # Homepage (~72 KB) — hero, pricing, CTAs
├── 404.html
├── CNAME                   # Custom domain binding
├── .nojekyll               # Bypass GitHub Pages Jekyll build
├── robots.txt
├── sitemap.xml
├── assessment/             # /assessment page
├── coach/                  # /coach page
├── guide/                  # /guide page
├── playbook/
│   ├── index.html          # /playbook landing
│   ├── playbook-pdf.html   # PDF-style rendering
│   └── content/            # Gated content (access code required)
├── playbook-pdf/           # PDF build tooling (Puppeteer render) — produces MatchMakers-Playbook.pdf
├── success/                # Post-purchase confirmation + access code display
├── privacy-policy/
├── terms-of-service/
├── vip/
├── migration/              # Firebase → Supabase migration scripts (dev-only, not served)
├── pdf/
├── css/style.css           # Single stylesheet (~66 KB)
├── img/                    # Image assets + OG image
├── js/
│   ├── main.js
│   ├── analytics.js        # GA4 wiring
│   ├── checkout.js         # Email capture + eligibility check + Stripe redirect
│   ├── coach-orb.js        # Floating coach chat widget (AI)
│   ├── coach-storage.js
│   ├── assessment.js
│   └── playbook-content.js # Access code + email verification content gate
└── supabase/               # Shared with iOS session — see C-3
    ├── functions/          # Edge Functions (4)
    ├── migrations/         # Schema migrations
    └── config.toml
```

## Design system

- **Dark navy:** `#050A10`
- **Gold:** `#C9A84C`
- **Headers:** Cormorant Garamond
- **Body:** Outfit
- **Supporting:** DM Sans

## Integrations

| System | Purpose | Status |
|---|---|---|
| Supabase (`peamviowxkyaglyjpagc`, US East) | DB + Edge Functions + Storage | Live |
| Stripe Payment Links | Checkout — Playbook, Coach Premium, Coach Unlimited | Live but **deprecating** (`D-001`) |
| Easy Pay Direct (planned) | Replacement processor | Not yet integrated |
| Resend | Transactional email (access codes, receipts). Domain verified via GoDaddy. | Live |
| Railway (backend server) | Stripe webhook intake → Google Sheets ledger + PostHog forward | Live |
| GA4 (`G-W3EJNGC0JR`) | Web analytics | Live (commit `f8a2951`) |
| PostHog | Product analytics + session replay | Planned, not installed (`R-005`) |
| Google Sheets | Revenue ledger | Live, no backup (`R-004`) |

## Edge Functions (in `supabase/functions/`)

1. **`handle-stripe-webhook`** (432 lines) — verifies Stripe signature, writes to `purchases` table, generates access code, sends Resend email with code. Has idempotency guard.
2. **`check-eligibility`** (196 lines) — takes email → checks Playbook ownership → returns eligibility for Coach purchase. Also captures `checkout_intents`.
3. **`coach-proxy`** (639 lines) — AI dating coach proxy with tiered rate limiting (free / premium / unlimited).
4. **`track-events`** (84 lines) — analytics event batching.

## Supabase tables

- `purchases` — payment records (email, product, access_code, amount, stripe_session_id, created_at)
- `checkout_intents` — pre-purchase email capture
- `analytics_events` — batched events from `track-events`

Row Level Security is applied to all three.

## Purchase flow (current — Stripe)

1. User clicks Playbook or Coach CTA on site → email modal captures email
2. `js/checkout.js` calls `check-eligibility` Edge Function
   - Playbook → always allowed
   - Coach → blocked unless `purchases` has a Playbook row for that email
3. Client redirects to Stripe Payment Link with `?prefilled_email=...`
4. Stripe → `handle-stripe-webhook` Edge Function:
   - Verifies signature
   - Inserts `purchases` row
   - Generates access code
   - Calls Resend API with access code email
5. User lands on `/success/` showing access code
6. User enters code at `/playbook/content/` → `playbook-content.js` validates against Supabase → content renders

## Stripe Payment Links (to deprecate)

- Playbook $250: `https://buy.stripe.com/00wbITcFzdXL11F88Y2Nq03`
- Coach Premium $500: `https://buy.stripe.com/3cI00b4939HveSvdti2Nq01`
- Coach Unlimited $1,000: `https://buy.stripe.com/14AeV5493bPD4dRcpe2Nq05`

## Webhook endpoint (Supabase)

`https://peamviowxkyaglyjpagc.supabase.co/functions/v1/handle-stripe-webhook`
Events: `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`

## Gotchas

- `.nojekyll` and `CNAME` at repo root are **load-bearing**. Do not delete.
- `index.html` and `css/style.css` are large — use `Grep` + targeted `Read`, not full-file reads.
- `supabase/` is shared with the iOS repo session. Treat as read-only from here (`C-3`).
- `node_modules/` and `playbook-pdf/node_modules/` are tooling, not shipped. Ensure `.gitignore` covers them.
