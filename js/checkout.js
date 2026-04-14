/* ═══════════════════════════════════════════════════
   MATCHMAKERS — checkout.js
   Pre-checkout modal + Stripe Checkout integration
   Playbook-first: Dating Coach requires Playbook purchase
   ═══════════════════════════════════════════════════ */

var STRIPE_PK = 'pk_live_51TLpRD1ihNKVY3uGHhlj9mvYq5zfXgBenCw6HxeJS0cU3Z3ON0epQW5RAc5vTQXkyvwouAVrRY29k15frJW8J9TR00rVq4Kq76';

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
    includes: 'Lifetime access \u00b7 Instant delivery \u00b7 100+ guided scripts \u00b7 9 Intent frameworks \u00b7 Complete 5-phase methodology \u00b7 Hall of Shame \u00b7 Script Builder Framework',
    priceId: 'price_1TLpYq0HZcOoiu2Ga9xib5Re',
    paymentLink: 'https://buy.stripe.com/4gM00baxrdXLfWz60Q2Nq02',
    btnBg: '#C9A84C',
    btnColor: '#0B1727'
  },
  dating_coach: {
    eyebrow: 'MatchMakers Dating Coach',
    product: 'MatchMakers Dating Coach',
    price: '$500',
    includes: '30-day AI coaching access \u00b7 Available 24/7 \u00b7 Real-time methodology guidance \u00b7 Trained on 7 years of MatchMakers data \u00b7 Phase-specific support',
    priceId: 'price_1TLpb80HZcOoiu2G0HWMX7MD',
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
    showPlaybookRequired();
    return;
  }

  _pcmProduct = product;

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

  // Unlock playbook access and proceed to Dating Coach checkout
  localStorage.setItem('pb_access', '1');
  msg.textContent = 'Playbook unlocked! Loading Dating Coach checkout…';
  msg.style.color = '#4CAF50';
  msg.style.display = 'block';
  input.style.borderColor = 'rgba(201,168,76,.5)';

  setTimeout(function () {
    closePreCheckout();
    var coachBtn = document.querySelector('[data-product="dating_coach"]');
    if (coachBtn) openPreCheckout(coachBtn);
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
    localStorage.setItem('pb_access', '1');

    // If buying Dating Coach, unlocking Playbook means proceed to coach checkout
    if (_pcmProduct === 'dating_coach') {
      msg.textContent = 'Playbook unlocked! Proceeding to Dating Coach checkout…';
      msg.style.color = '#4CAF50';
      msg.style.display = 'block';
      setTimeout(function () {
        closePreCheckout();
        // Re-open the modal for Dating Coach — now hasPlaybookAccess() returns true
        var coachBtn = document.querySelector('[data-product="dating_coach"]');
        if (coachBtn) openPreCheckout(coachBtn);
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
  btn.textContent = 'Redirecting to payment\u2026';
  btn.disabled = true;

  var p = MM_PRODUCTS[_pcmProduct];
  if (p.paymentLink) {
    var url = p.paymentLink + '?prefilled_email=' + encodeURIComponent(email);
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
