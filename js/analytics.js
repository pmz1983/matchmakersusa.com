/* ═══════════════════════════════════════════════════
   MATCHMAKERS — analytics.js
   Lightweight event tracking → Supabase
   Batched, non-blocking, privacy-respecting
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  var ENDPOINT = 'https://peamviowxkyaglyjpagc.supabase.co/functions/v1/track-events';
  var FLUSH_INTERVAL = 5000;   // Batch flush every 5s
  var MAX_QUEUE = 50;          // Force flush at this size
  var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min inactivity = new session

  // ── Anonymous Visitor ID (persistent, no PII) ──
  function getVisitorId() {
    var id = localStorage.getItem('mm_vid');
    if (!id) {
      id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('mm_vid', id);
    }
    return id;
  }

  // ── Session ID (resets after 30 min inactivity) ──
  function getSessionId() {
    var now = Date.now();
    var sid = sessionStorage.getItem('mm_sid');
    var lastActivity = parseInt(sessionStorage.getItem('mm_last') || '0');

    if (!sid || (now - lastActivity) > SESSION_TIMEOUT) {
      sid = 's_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('mm_sid', sid);
    }
    sessionStorage.setItem('mm_last', now.toString());
    return sid;
  }

  // ── URL sanitizer: strip non-UTM query params before logging (S-022) ──
  // Stripe/EPD redirects to /success?email=...&product=... so the raw URL
  // can leak PII into page_view events. Allow only marketing UTM params.
  function sanitizeUrl(u) {
    try {
      var url = new URL(u);
      var allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      var clean = new URLSearchParams();
      url.searchParams.forEach(function (v, k) {
        if (allowed.indexOf(k) !== -1) clean.append(k, v);
      });
      url.search = clean.toString();
      return url.toString();
    } catch (e) {
      // Defensive fallback: drop the query entirely
      return window.location.origin + window.location.pathname;
    }
  }

  // ── UTM & Referrer capture (first-touch) ──
  function captureAttribution() {
    if (localStorage.getItem('mm_utm')) return;
    var params = new URLSearchParams(window.location.search);
    var utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = params.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      localStorage.setItem('mm_utm', JSON.stringify(utm));
    }
    if (document.referrer && !document.referrer.includes('matchmakersusa.com')) {
      localStorage.setItem('mm_ref', document.referrer);
    }
  }

  // ── Event queue ──
  var queue = [];
  var visitorId = getVisitorId();

  function track(event, properties) {
    var evt = {
      event: event,
      visitor_id: visitorId,
      session_id: getSessionId(),
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
      properties: properties || {}
    };

    // Attach attribution on first event
    var utm = localStorage.getItem('mm_utm');
    var ref = localStorage.getItem('mm_ref');
    if (utm) evt.utm = JSON.parse(utm);
    if (ref) evt.referrer = ref;

    queue.push(evt);

    if (queue.length >= MAX_QUEUE) flush();
  }

  function flush() {
    if (queue.length === 0) return;

    var batch = queue.splice(0);

    // Use sendBeacon for reliability (survives page unload)
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true
      }).catch(function () { /* non-blocking */ });
    }
  }

  // Flush on interval
  setInterval(flush, FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  // ── Automatic page view ──
  captureAttribution();
  track('page_view', {
    title: document.title,
    url: sanitizeUrl(window.location.href)
  });

  // ── Track time on page ──
  var pageStart = Date.now();
  window.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      track('page_engagement', {
        duration_sec: Math.round((Date.now() - pageStart) / 1000)
      });
    }
  });

  // ── Track scroll depth ──
  var maxScroll = 0;
  var scrollMilestones = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', function () {
    var h = document.documentElement;
    var pct = Math.round(window.scrollY / (h.scrollHeight - h.clientHeight) * 100);
    if (pct > maxScroll) maxScroll = pct;
    [25, 50, 75, 100].forEach(function (m) {
      if (!scrollMilestones[m] && maxScroll >= m) {
        scrollMilestones[m] = true;
        track('scroll_depth', { depth: m });
      }
    });
  }, { passive: true });

  // ── Auto-track CTA clicks ──
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-product], .hp-cta, .cta-main, .hero-cta, a[href*="stripe"], .clp-btn');
    if (btn) {
      track('cta_click', {
        text: (btn.textContent || '').trim().slice(0, 80),
        product: btn.getAttribute('data-product') || '',
        href: btn.getAttribute('href') || '',
        element: btn.tagName.toLowerCase() + (btn.className ? '.' + btn.className.split(' ')[0] : '')
      });
    }
  });

  // ── Expose global API ──
  window.mmTrack = track;
  window.mmFlush = flush;

})();
