/* ═══════════════════════════════════════════════════
   MATCHMAKERS — checkout.js
   Pre-checkout modal + product configuration
   ═══════════════════════════════════════════════════ */

var MM_PRODUCTS = {
  playbook: {
    eyebrow: 'The MatchMakers Playbook',
    product: 'The MatchMakers Playbook',
    price: '$500',
    includes: 'Lifetime access \u00b7 PDF download \u00b7 100+ guided scripts \u2014 7 real situations, 3 steps each \u00b7 Complete 5-phase curriculum \u00b7 Intent through Commitment',
    priceId: 'price_playbook_500',
    btnBg: '#C9A84C',
    btnColor: '#0B1727'
  },
  dating_coach: {
    eyebrow: 'MatchMakers Dating Coach',
    product: 'MatchMakers Dating Coach',
    price: '+$500 upgrade',
    includes: 'The MatchMakers Playbook included free ($500 value) \u00b7 30-day AI advisor access \u00b7 Available 24/7 \u00b7 Trained on 7 years of MatchMakers data',
    priceId: 'price_dc_1000',
    btnBg: '#0B1727',
    btnColor: '#C9A84C',
    btnBorder: '1.5px solid rgba(201,168,76,.4)'
  },
  dc_upgrade: {
    eyebrow: 'Dating Coach \u2014 Playbook Owner Upgrade',
    product: 'MatchMakers Dating Coach',
    price: '$500',
    includes: 'Your $500 Playbook credit applied \u00b7 30-day AI advisor access \u00b7 Available 24/7 \u00b7 Starts immediately after purchase',
    priceId: 'price_dc_upgrade_500',
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

  // Redirect to checkout
  // TODO: Replace with Stripe Checkout Session URL when Stripe is configured
  window.location.href = 'https://matchmakersusa.com/checkout?product=' +
    encodeURIComponent(_pcmProduct) + '&email=' + encodeURIComponent(email);
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
