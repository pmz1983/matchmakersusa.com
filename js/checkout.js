/* ═══════════════════════════════════════════════════
   MATCHMAKERS — checkout.js
   Pre-checkout modal + Stripe Checkout integration
   Two independent products. No dependency. No sequence.
   ═══════════════════════════════════════════════════ */

var STRIPE_PK = 'pk_test_51TLpRO0HZcOoiu2G4FQ8bZMISxmT4tAX7LD00SeokHo5vBhtrGuFbKUDVDwyTHDiliSN4P8L2w84XFxegWziGxan00t5SPHetc';

var MM_PRODUCTS = {
  playbook: {
    eyebrow: 'The MatchMakers Playbook',
    product: 'The MatchMakers Playbook',
    price: '$500',
    includes: 'Lifetime access \u00b7 Instant delivery \u00b7 100+ guided scripts \u00b7 9 Intent frameworks \u00b7 Complete 5-phase methodology \u00b7 Hall of Shame \u00b7 Script Builder Framework',
    priceId: 'price_1TLpYq0HZcOoiu2Ga9xib5Re',
    paymentLink: 'https://buy.stripe.com/test_8x28wH7dYdp29qa77h5c400',
    btnBg: '#C9A84C',
    btnColor: '#0B1727'
  },
  dating_coach: {
    eyebrow: 'MatchMakers Dating Coach',
    product: 'MatchMakers Dating Coach',
    price: '$500',
    includes: '30-day AI coaching access \u00b7 Available 24/7 \u00b7 Real-time methodology guidance \u00b7 Trained on 7 years of MatchMakers data \u00b7 Phase-specific support',
    priceId: 'price_1TLpb80HZcOoiu2G0HWMX7MD',
    paymentLink: 'https://buy.stripe.com/test_7sY14feGq2Ko45QfDN5c401',
    btnBg: '#0B1727',
    btnColor: '#C9A84C',
    btnBorder: '1.5px solid rgba(201,168,76,.4)'
  }
};

var _pcmProduct = null;

function openPreCheckout(el) {
  var product = el.getAttribute('data-product');
  var p = MM_PRODUCTS[product];
  if (!p) return;
  _pcmProduct = product;

  document.getElementById('pcm-eyebrow').textContent = p.eyebrow;
  document.getElementById('pcm-product').textContent = p.product;
  document.getElementById('pcm-price').textContent = p.price;
  document.getElementById('pcm-includes').textContent = p.includes;

  var btn = document.getElementById('pcm-proceed');
  btn.style.background = p.btnBg || '#C9A84C';
  btn.style.color = p.btnColor || '#0B1727';
  btn.style.border = p.btnBorder || 'none';
  btn.textContent = 'Continue to Payment \u2192';
  btn.disabled = false;

  document.getElementById('pcm-err').style.display = 'none';
  document.getElementById('pcm-email').value = '';
  document.getElementById('pcm-email').style.borderColor = 'rgba(65,91,124,.4)';

  var modal = document.getElementById('preCheckoutModal');
  modal.style.display = 'flex';
  setTimeout(function () {
    document.getElementById('pcm-email').focus();
  }, 100);
}

function closePreCheckout() {
  document.getElementById('preCheckoutModal').style.display = 'none';
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

  // Redirect to Stripe Payment Link
  // Payment Links are created in Stripe Dashboard > Payment Links
  // They handle the full checkout flow including payment collection
  var p = MM_PRODUCTS[_pcmProduct];
  if (p.paymentLink) {
    window.location.href = p.paymentLink + '?prefilled_email=' + encodeURIComponent(email);
  } else {
    // Fallback if payment link not yet configured
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
