/* ═══════════════════════════════════════════════════
   MATCHMAKERS — checkout.js
   Pre-checkout modal + Stripe Checkout integration
   Playbook-first: Dating Coach requires Playbook purchase
   ═══════════════════════════════════════════════════ */

var STRIPE_PK = 'pk_live_51TLpRD1ihNKVY3uGHhlj9mvYq5zfXgBenCw6HxeJS0cU3Z3ON0epQW5RAc5vTQXkyvwouAVrRY29k15frJW8J9TR00rVq4Kq76';

var SUPABASE_FN_URL = 'https://peamviowxkyaglyjpagc.supabase.co/functions/v1';

/* ── Promo / Access Codes ──
   type: 'free'     → unlocks content immediately, no payment
   type: 'discount' → applies % off, user continues to Stripe
   Add new codes here as needed.
*/
var MM_PROMO_CODES = {
  'MATCH777':         { type: 'free' },
  'MATCHMAKERS':      { type: 'free' },
  'MM2024':           { type: 'free' },
  'MM-PLAYBOOK-2024': { type: 'free' },
  'MM-VIP-TEST':      { type: 'free' },
  'MM-HALF':          { type: 'free' },
  'MM-25OFF':         { type: 'free' }
};

// Accept codes from MM_PROMO_CODES or specific prefixes for beta testers
function lookupPromo(code) {
  code = code.toUpperCase().trim();
  if (MM_PROMO_CODES[code]) return MM_PROMO_CODES[code];
  if (code.startsWith('MM-BETA-') || code.startsWith('MM-FRIEND-')) return { type: 'free' };
  return null;
}

var MM_PRODUCTS = {
  playbook: {
    eyebrow: 'The MatchMakers Playbook',
    product: 'The MatchMakers Playbook',
    price: '$500',
    includes: 'Lifetime access \u00b7 Instant delivery \u00b7 50+ guided scripts \u00b7 9 Intent frameworks \u00b7 Complete 5-phase methodology \u00b7 Hall of Shame \u00b7 Script Builder Framework',
    priceId: 'price_1TLyin1ihNKVY3uGtdOvWGP2',
    paymentLink: 'https://buy.stripe.com/4gM00baxrdXLfWz60Q2Nq02',
    btnBg: '#C9A84C',
    btnColor: '#0B1727'
  },
  dating_coach: {
    eyebrow: 'MatchMakers Dating Coach',
    product: 'MatchMakers Dating Coach',
    price: '$500',
    includes: '30-day AI coaching access \u00b7 Available 24/7 \u00b7 Real-time methodology guidance \u00b7 Trained on 7 years of MatchMakers data \u00b7 Phase-specific support',
    priceId: 'price_1TLykh1ihNKVY3uG4a08H5UT',
    paymentLink: 'https://buy.stripe.com/3cI00b4939HveSvdti2Nq01',
    requiresPlaybook: true,
    btnBg: '#0B1727',
    btnColor: '#C9A84C',
    btnBorder: '1.5px solid rgba(201,168,76,.4)'
  }
};

var _pcmProduct = null;

// Check if user has Playbook access (stored when they enter access code)
function hasPlaybookAccess() {
  return localStorage.getItem('pb_access') === '1';
}

function openPreCheckout(el) {
  var product = el.getAttribute('data-product');
  var p = MM_PRODUCTS[product];
  if (!p) return;

  // Playbook-first gating: Dating Coach requires Playbook
  if (p.requiresPlaybook && !hasPlaybookAccess()) {
    if (window.mmTrack) mmTrack('playbook_gate_shown', { product: product });
    showPlaybookRequired();
    return;
  }

  _pcmProduct = product;

  if (window.mmTrack) mmTrack('checkout_modal_open', { product: product, price: p.price });

  document.getElementById('pcm-eyebrow').textContent = p.eyebrow;
  document.getElementById('pcm-product').textContent = p.product;
  document.getElementById('pcm-price').textContent = p.price;
  document.getElementById('pcm-includes').textContent = p.includes;

  // Hide the playbook-required message if showing
  document.getElementById('pcm-gate').style.display = 'none';
  document.getElementById('pcm-checkout').style.display = 'block';

  var btn = document.getElementById('pcm-proceed');
  btn.style.background = p.btnBg || '#C9A84C';
  btn.style.color = p.btnColor || '#0B1727';
  btn.style.border = p.btnBorder || 'none';
  btn.textContent = 'Continue to Payment \u2192';
  btn.disabled = false;

  document.getElementById('pcm-err').style.display = 'none';
  document.getElementById('pcm-email').value = '';
  document.getElementById('pcm-email').style.borderColor = 'rgba(65,91,124,.4)';

  // Reset promo code area (always visible now)
  var promoArea = document.getElementById('pcm-promo-area');
  var promoMsg = document.getElementById('pcm-promo-msg');
  if (promoArea) promoArea.style.display = 'flex';
  if (promoMsg) { promoMsg.style.display = 'none'; promoMsg.textContent = ''; }
  var promoInput = document.getElementById('pcm-promo-code');
  if (promoInput) { promoInput.value = ''; promoInput.style.borderColor = 'rgba(65,91,124,.4)'; }
  _appliedPromo = null;

  var modal = document.getElementById('preCheckoutModal');
  modal.style.display = 'flex';
  setTimeout(function () {
    document.getElementById('pcm-email').focus();
  }, 100);
}

function showPlaybookRequired() {
  // Show the Playbook-required message inside the modal
  var modal = document.getElementById('preCheckoutModal');
  modal.style.display = 'flex';

  document.getElementById('pcm-gate').style.display = 'block';
  document.getElementById('pcm-checkout').style.display = 'none';
}

function closePreCheckout() {
  document.getElementById('preCheckoutModal').style.display = 'none';
}

// Called from the "Playbook Required" gate on the coach page
function unlockFromGate() {
  var input = document.getElementById('pcm-gate-code');
  var msg = document.getElementById('pcm-gate-msg');
  if (!input || !msg) return;

  var code = (input.value || '').toUpperCase().trim();
  if (!code) {
    msg.textContent = 'Please enter a code.';
    msg.style.color = '#E5534B';
    msg.style.display = 'block';
    return;
  }

  var promo = lookupPromo(code);
  if (!promo || promo.type !== 'free') {
    msg.textContent = 'Code not recognized. Check your code and try again.';
    msg.style.color = '#E5534B';
    msg.style.display = 'block';
    input.style.borderColor = '#E5534B';
    return;
  }

  // Unlock both Playbook and Dating Coach access
  localStorage.setItem('pb_access', '1');
  localStorage.setItem('pb_dc_access', '1');
  if (!localStorage.getItem('pb_dc_first'))
    localStorage.setItem('pb_dc_first', Date.now().toString());
  msg.textContent = 'Both unlocked! Redirecting to your Dating Coach…';
  msg.style.color = '#4CAF50';
  msg.style.display = 'block';
  input.style.borderColor = 'rgba(201,168,76,.5)';

  setTimeout(function () {
    window.location.href = '/playbook/content/#dating-coach';
  }, 800);
}

var _appliedPromo = null;

function applyPromoCode() {
  var input = document.getElementById('pcm-promo-code');
  var msg = document.getElementById('pcm-promo-msg');
  var code = (input.value || '').toUpperCase().trim();

  if (!code) {
    msg.textContent = 'Please enter a code.';
    msg.style.color = '#E5534B';
    msg.style.display = 'block';
    return;
  }

  var promo = lookupPromo(code);
  if (!promo) {
    msg.textContent = 'Code not recognized. Check your code and try again.';
    msg.style.color = '#E5534B';
    msg.style.display = 'block';
    input.style.borderColor = '#E5534B';
    _appliedPromo = null;
    return;
  }

  input.style.borderColor = 'rgba(201,168,76,.5)';

  if (promo.type === 'free') {
    if (window.mmTrack) mmTrack('promo_code_applied', { code: code, type: 'free', product: _pcmProduct });
    localStorage.setItem('pb_access', '1');

    if (_pcmProduct === 'dating_coach') {
      // Unlock both Playbook and Dating Coach access
      localStorage.setItem('pb_dc_access', '1');
      if (!localStorage.getItem('pb_dc_first'))
        localStorage.setItem('pb_dc_first', Date.now().toString());
      msg.textContent = 'Code accepted! Redirecting to your Dating Coach…';
      msg.style.color = '#4CAF50';
      msg.style.display = 'block';
      setTimeout(function () {
        window.location.href = '/playbook/content/#dating-coach';
      }, 800);
      return;
    }

    // Otherwise redirect to playbook content
    msg.textContent = 'Code accepted! Redirecting to your Playbook…';
    msg.style.color = '#4CAF50';
    msg.style.display = 'block';
    setTimeout(function () {
      window.location.href = '/playbook/content/';
    }, 800);
    return;
  }

  if (promo.type === 'discount') {
    if (window.mmTrack) mmTrack('promo_code_applied', { code: code, type: 'discount', percent: promo.percent, product: _pcmProduct });
    _appliedPromo = promo;
    msg.textContent = promo.percent + '% discount applied! Continue to payment below.';
    msg.style.color = '#4CAF50';
    msg.style.display = 'block';

    // Update displayed price
    var p = MM_PRODUCTS[_pcmProduct];
    if (p) {
      var original = parseInt(p.price.replace(/[^0-9]/g, ''));
      var discounted = Math.round(original * (1 - promo.percent / 100));
      document.getElementById('pcm-price').innerHTML = '<span style="text-decoration:line-through;opacity:.4;margin-right:8px;">' + p.price + '</span>$' + discounted;
    }
    return;
  }
}

function proceedToCheckout() {
  var email = document.getElementById('pcm-email').value.trim();
  var err = document.getElementById('pcm-err');

  if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
    err.textContent = 'Please enter a valid email address.';
    err.style.display = 'block';
    document.getElementById('pcm-email').style.borderColor = '#E5534B';
    return;
  }

  document.getElementById('pcm-email').style.borderColor = 'rgba(65,91,124,.4)';
  err.style.display = 'none';

  var btn = document.getElementById('pcm-proceed');
  btn.textContent = 'Checking\u2026';
  btn.disabled = true;

  var p = MM_PRODUCTS[_pcmProduct];

  // For Dating Coach: verify Playbook ownership via Supabase before proceeding
  if (p.requiresPlaybook && !hasPlaybookAccess()) {
    fetch(SUPABASE_FN_URL + '/check-eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, product: 'dating_coach' })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.eligible) {
        // Playbook purchase confirmed in Supabase — proceed to Dating Coach checkout
        captureAndRedirect(email, p, btn);
      } else {
        // No Playbook purchase found for this email
        btn.textContent = 'Continue to Payment \u2192';
        btn.disabled = false;
        var safeEmail = email.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        err.innerHTML = 'No Playbook purchase found for <strong>' + safeEmail + '</strong>. The Dating Coach requires the Playbook as your foundation. <a href="javascript:void(0)" onclick="_pcmProduct=\'playbook\';openPreCheckout(document.querySelector(\'[data-product=playbook]\')||document.createElement(\'div\'));_pcmProduct=\'playbook\';" style="color:#C9A84C;text-decoration:underline;">Get the Playbook first</a>, or try a different email.';
        err.style.display = 'block';
      }
    })
    .catch(function() {
      // On network error, fall through to payment (Stripe is the final gate)
      captureAndRedirect(email, p, btn);
    });
    return;
  }

  captureAndRedirect(email, p, btn);
}

function captureAndRedirect(email, p, btn) {
  if (window.mmTrack) mmTrack('checkout_redirect', { product: _pcmProduct, price: p.price });
  btn.textContent = 'Redirecting to payment\u2026';

  // Capture email intent in Supabase (fire-and-forget, don't block checkout)
  fetch(SUPABASE_FN_URL + '/check-eligibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, action: 'capture-intent', product: _pcmProduct })
  }).catch(function() { /* non-blocking */ });

  if (p.paymentLink) {
    var successUrl = 'https://matchmakersusa.com/success/?email=' + encodeURIComponent(email) + '&product=' + encodeURIComponent(_pcmProduct);
    var url = p.paymentLink
      + '?prefilled_email=' + encodeURIComponent(email)
      + '&success_url=' + encodeURIComponent(successUrl);
    if (_appliedPromo && _appliedPromo.stripeCoupon) {
      url += '&coupon=' + encodeURIComponent(_appliedPromo.stripeCoupon);
    }
    window.location.href = url;
  } else {
    btn.textContent = 'Payment link coming soon';
    btn.disabled = true;
  }
}

// Close modal on overlay click or Escape
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('preCheckoutModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closePreCheckout();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePreCheckout();
  });
});
