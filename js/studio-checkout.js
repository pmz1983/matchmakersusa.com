/* ═══════════════════════════════════════════════════
   STUDIO CHECKOUT — L1→L2 Stripe checkout
   v3.0 MVP Day 3 — 2026-05-02

   Flow:
     1. User clicks "Begin where you arrive." on /studio/
     2. Pull cc-state-v1 (if present) → forward user_id when sign-up has happened
     3. POST /create_studio_checkout → { checkout_url }
     4. Redirect to Stripe Checkout Session
     5. On Stripe success → /success/ ; on cancel → back to /studio/
   ═══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  function getCCState() {
    try {
      const raw = localStorage.getItem('cc-state-v1');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function setStatus(text, state) {
    const el = document.querySelector('[data-checkout-status]');
    if (!el) return;
    el.textContent = text || '';
    if (state) el.setAttribute('data-state', state);
    else el.removeAttribute('data-state');
  }

  function disableCTA(disabled) {
    const btn = document.querySelector('[data-action="studio-checkout"]');
    if (!btn) return;
    if (disabled) btn.setAttribute('disabled', '');
    else btn.removeAttribute('disabled');
  }

  function bindCheckout() {
    const btn = document.querySelector('[data-action="studio-checkout"]');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (!global.MMConnectionCodeAPI) {
        setStatus('A moment, please. The gateway is preparing.', 'error');
        return;
      }

      disableCTA(true);
      setStatus('A moment, please. The Coach is opening the gateway.');

      const ccState = getCCState();
      const payload = {};
      if (ccState && ccState.signup && ccState.signup.user_id) {
        payload.user_id = ccState.signup.user_id;
      }

      global.MMConnectionCodeAPI.createStudioCheckout(payload)
        .then((res) => {
          if (res && res.checkout_url) {
            window.location.assign(res.checkout_url);
          } else {
            setStatus('The gateway returned an unexpected response. Please return shortly.', 'error');
            disableCTA(false);
          }
        })
        .catch((err) => {
          // Cartier graceful degradation — Backend RPC not yet live or offline.
          const msg = (err && err.code === 'NOT_LIVE')
            ? 'The Studio gateway is being prepared. The Coach will hold the read until it returns. Please return shortly.'
            : 'The Coach is briefly unavailable. The gateway returns when service does.';
          setStatus(msg, 'error');
          disableCTA(false);
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCheckout);
  } else {
    bindCheckout();
  }
})(typeof window !== 'undefined' ? window : this);
