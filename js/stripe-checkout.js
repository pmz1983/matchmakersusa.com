/* /js/stripe-checkout.js — Stripe Checkout hosted-page redirect wiring
   Per BROKEN_CTAS_WAVE_1_CYCLE_2_SPEC v1 2026-05-06 §3.3
   Backend integration per BACKEND_CROSS_LANE_REQUIREMENTS_BRIEF v1 §1
*/

(function () {
  // Stripe publishable key — Backend SPEC 4 supplies via build-time env injection.
  // Until Backend deploys the Edge Function, the button surfaces an inquiry-fallback
  // message rather than a Stripe.js error.
  const STRIPE_PUBLISHABLE_KEY = window.STRIPE_PUBLISHABLE_KEY || '';

  const checkoutButtons = document.querySelectorAll('[data-stripe-checkout]');
  const statusEl = document.getElementById('purchase-status');
  if (!checkoutButtons.length) return;

  const stripeReady = typeof Stripe === 'function' && STRIPE_PUBLISHABLE_KEY;
  const stripe = stripeReady ? Stripe(STRIPE_PUBLISHABLE_KEY) : null;

  // URL query param tier pre-selection (?tier=core / ?tier=personalized / ?tier=studio / ?tier=studio-ai)
  const urlParams = new URLSearchParams(window.location.search);
  const tierParam = urlParams.get('tier');
  if (tierParam === 'core' || tierParam === 'studio') {
    const btn = document.querySelector('[data-stripe-checkout="studio_core"]');
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else if (tierParam === 'personalized' || tierParam === 'studio-ai') {
    const btn = document.querySelector('[data-stripe-checkout="studio_personalized"]');
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  checkoutButtons.forEach((button) => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const sku = button.dataset.stripeCheckout;
      const tierLabel = button.dataset.tierLabel;

      const originalLabel = button.innerHTML;
      button.disabled = true;
      button.textContent = 'Opening checkout…';
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.removeAttribute('data-status');
      }

      try {
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: sku,
            success_url: window.location.origin + '/account/?tier=' + (sku === 'studio_personalized' ? 'studio-ai' : 'studio') + '&session_id={CHECKOUT_SESSION_ID}',
            cancel_url: window.location.origin + '/studio/purchase/?canceled=true'
          })
        });

        if (!response.ok) {
          throw new Error('Checkout session creation failed: ' + response.status);
        }

        const data = await response.json();
        const sessionId = data.sessionId;

        if (!stripe || !sessionId) {
          throw new Error('Stripe not initialized or sessionId missing');
        }

        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) throw new Error(error.message);
      } catch (err) {
        button.disabled = false;
        button.innerHTML = originalLabel;
        if (statusEl) {
          statusEl.innerHTML = 'Checkout couldn&rsquo;t open. Please try again, or reach the <a href="/contact/" style="color: var(--color-heritage-gold-text); border-bottom: 1px solid var(--color-heritage-gold-soft);">Inquiry</a> if it persists.';
        }
        if (window.Sentry) Sentry.captureException(err);
      }
    });
  });

  // Handle ?canceled=true return from Stripe Checkout cancel
  if (urlParams.get('canceled') === 'true' && statusEl) {
    statusEl.textContent = 'Checkout canceled. You can try again anytime.';
  }
})();
