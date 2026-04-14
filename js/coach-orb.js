/* ═══════════════════════════════════════════════════
   MATCHMAKERS — coach-orb.js
   Floating Dating Coach orb + panel + chat
   Site-wide overlay (independent of playbook page)
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Constants ──
  var COACH_PROXY = 'https://peamviowxkyaglyjpagc.supabase.co/functions/v1/coach-proxy';
  var HISTORY_CAP = 40;
  var TOOLTIP_DURATION = 5000;
  var MOBILE_BP = 760;
  var TEXTAREA_MAX = 100;

  // ── State ──
  var cp_history = [];
  var typing = false;
  var intent = '';
  var phase = '';
  var focus = '';

  // ── DOM References (set during init) ──
  var orbEl, panelEl, lockedPop;
  var messagesEl, inputEl, sendBtn, statusEl, daysEl;
  var onboardEl, chatEl;

  // ── Helpers ──
  function isMobile() {
    return window.innerWidth <= MOBILE_BP;
  }

  function getSessionId() {
    var s = localStorage.getItem('dc_session');
    if (!s) {
      s = 'dc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      localStorage.setItem('dc_session', s);
    }
    return s;
  }

  function hasAccess() {
    return localStorage.getItem('pb_dc_access') === '1';
  }

  function lockBodyScroll() {
    if (isMobile()) {
      document.body.style.overflow = 'hidden';
    }
  }

  function unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  // ── Days Remaining ──
  function updateDaysRemaining() {
    if (!daysEl) return;
    var first = parseInt(localStorage.getItem('pb_dc_first') || Date.now(), 10);
    var days = Math.max(0, 30 - Math.floor((Date.now() - first) / 86400000));
    daysEl.textContent = days > 0 ? days + 'd remaining' : 'Access expired';
  }

  // ── Orb State ──
  function refreshOrbState() {
    if (!orbEl) return;
    if (hasAccess()) {
      orbEl.classList.add('active');
      orbEl.classList.remove('locked');
    } else {
      orbEl.classList.add('locked');
      orbEl.classList.remove('active');
    }
  }

  // ── Tooltip (first-time activation) ──
  function maybeShowTooltip() {
    if (!hasAccess()) return;
    if (localStorage.getItem('coach_tooltip_shown') === '1') return;
    var tip = document.getElementById('coach-orb-tooltip');
    if (!tip) return;
    tip.classList.add('show');
    localStorage.setItem('coach_tooltip_shown', '1');
    setTimeout(function () {
      tip.classList.remove('show');
    }, TOOLTIP_DURATION);
  }

  // ── Panel Open / Close ──
  function openPanel() {
    if (!orbEl || !panelEl) return;
    orbEl.classList.add('open');
    panelEl.classList.add('open');
    lockBodyScroll();
    if (inputEl) inputEl.focus();
  }

  function closePanel() {
    if (!orbEl || !panelEl) return;
    orbEl.classList.remove('open');
    panelEl.classList.remove('open');
    unlockBodyScroll();
  }

  function isPanelOpen() {
    return panelEl && panelEl.classList.contains('open');
  }

  // ── Locked Popover ──
  function showLockedPop() {
    if (lockedPop) lockedPop.classList.add('show');
  }

  function hideLockedPop() {
    if (lockedPop) lockedPop.classList.remove('show');
  }

  // ── Orb Click Handler ──
  function onOrbClick(e) {
    e.stopPropagation();
    if (hasAccess()) {
      if (isPanelOpen()) {
        closePanel();
      } else {
        openPanel();
      }
    } else {
      if (lockedPop && lockedPop.classList.contains('show')) {
        hideLockedPop();
      } else {
        showLockedPop();
      }
    }
  }

  // ── Chat Messages ──
  function addMessage(role, text) {
    if (!messagesEl) return;
    var row = document.createElement('div');
    row.className = 'cp-msg ' + role;

    var av = document.createElement('div');
    av.className = 'cp-msg-av';
    av.textContent = role === 'coach' ? 'M' : 'You';

    var bubble = document.createElement('div');
    bubble.className = 'cp-msg-bubble';
    bubble.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    row.appendChild(av);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    if (!messagesEl) return;
    var row = document.createElement('div');
    row.className = 'cp-msg coach';
    row.id = 'co-typing-ind';
    row.innerHTML =
      '<div class="cp-msg-av">M</div>' +
      '<div class="cp-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById('co-typing-ind');
    if (t) t.remove();
  }

  // ── Welcome Message ──
  function showWelcome() {
    var msg = intent || phase
      ? 'Your context is set \u2014 ' + intent + ' Intent, ' + phase + '. What are you working on right now?'
      : 'Welcome to your Dating Coach. What are you working on right now?';
    addMessage('coach', msg);
    cp_history.push({ role: 'assistant', content: msg });
  }

  // ── Send Message ──
  async function sendMessage() {
    if (typing) return;
    if (!inputEl) return;
    var txt = inputEl.value.trim();
    if (!txt) return;

    inputEl.value = '';
    inputEl.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;
    typing = true;
    if (statusEl) statusEl.textContent = 'Thinking...';

    addMessage('user', txt);
    cp_history.push({ role: 'user', content: txt });
    showTyping();

    var memberCtx = '';
    if (intent || phase) {
      memberCtx =
        '\n\n---\nMEMBER CONTEXT:\nIntent: ' + (intent || 'Not specified') +
        '\nPhase: ' + (phase || 'Not specified') +
        '\nFocus: ' + (focus || 'Not specified') +
        '\nPage: ' + window.location.pathname +
        '\n---';
    } else {
      memberCtx = '\n\n---\nPage: ' + window.location.pathname + '\n---';
    }

    try {
      var sessionId = getSessionId();
      // Anthropic API requires first message to be 'user' role
      // Filter history to ensure valid message sequence
      var apiMessages = cp_history.filter(function(m, i) {
        if (i === 0 && m.role === 'assistant') return false; // skip welcome message
        return true;
      });
      var res = await fetch(COACH_PROXY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ context: memberCtx, messages: apiMessages })
      });
      var data = await res.json();

      // Handle all error response formats (our Edge Function, Supabase gateway, etc.)
      var errMsg = data.error || data.message || null;
      if (errMsg || data.code) {
        hideTyping();
        addMessage('coach', errMsg || 'Something went wrong — please try again.');
        typing = false;
        if (sendBtn) sendBtn.disabled = false;
        if (statusEl) statusEl.textContent = 'Ready';
        return;
      }

      var reply = (data && data.content && data.content[0] && data.content[0].text) || '';
      if (!reply) {
        hideTyping();
        addMessage('coach', 'I wasn\'t able to generate a response. Could you try rephrasing your question? The more specific you are about your situation, the better I can help.');
        typing = false;
        if (sendBtn) sendBtn.disabled = false;
        if (statusEl) statusEl.textContent = 'Ready';
        return;
      }
      hideTyping();
      addMessage('coach', reply);
      cp_history.push({ role: 'assistant', content: reply });

      if (cp_history.length > HISTORY_CAP) {
        cp_history = cp_history.slice(-HISTORY_CAP);
      }
    } catch (e) {
      hideTyping();
      addMessage('coach', 'Connection error \u2014 try again in a moment.');
    }

    typing = false;
    if (sendBtn) sendBtn.disabled = false;
    if (statusEl) statusEl.textContent = 'Ready';
  }

  // ── New Session ──
  function newSession() {
    if (!confirm('Clear conversation history?')) return;
    cp_history = [];
    if (messagesEl) messagesEl.innerHTML = '';
    setTimeout(showWelcome, 200);
  }

  // ── Onboarding ──
  function startOnboarding() {
    if (onboardEl) { onboardEl.style.display = 'block'; }
    if (chatEl) { chatEl.style.display = 'none'; }
  }

  function finishOnboarding() {
    localStorage.setItem('pb_dc_onboarded', '1');
    localStorage.setItem('pb_dc_intent', intent);
    localStorage.setItem('pb_dc_phase', phase);
    localStorage.setItem('pb_dc_focus', focus);
    if (onboardEl) { onboardEl.style.display = 'none'; }
    if (chatEl) { chatEl.style.display = 'flex'; }
    setTimeout(showWelcome, 300);
  }

  function selectOnboardOption(groupClass, el, value) {
    document.querySelectorAll('.' + groupClass).forEach(function (o) {
      o.classList.remove('sel');
    });
    el.classList.add('sel');
    return value;
  }

  // Expose onboarding handlers globally
  window.coSelectIntent = function (el, v) {
    intent = selectOnboardOption('co-intent-opt', el, v);
    var btn = document.getElementById('co-ob-btn1');
    if (btn) btn.disabled = false;
  };

  window.coSelectPhase = function (el, v) {
    phase = selectOnboardOption('co-phase-opt', el, v);
    var btn = document.getElementById('co-ob-btn2');
    if (btn) btn.disabled = false;
  };

  window.coSelectFocus = function (el, v) {
    focus = selectOnboardOption('co-focus-opt', el, v);
    var btn = document.getElementById('co-ob-btn3');
    if (btn) btn.disabled = false;
  };

  window.coObNext = function (step) {
    document.querySelectorAll('.cp-ob-step').forEach(function (s) {
      s.classList.remove('active');
    });
    var next = document.getElementById('co-ob-step' + step);
    if (next) next.classList.add('active');
    for (var i = 1; i <= 3; i++) {
      var pip = document.getElementById('co-pip' + i);
      if (pip) {
        pip.className = 'cp-ob-pip' + (i < step ? ' done' : (i === step ? ' active' : ''));
      }
    }
  };

  window.coStartCoach = function () {
    finishOnboarding();
  };

  // ── Auto-resize Textarea ──
  function autoResizeInput() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, TEXTAREA_MAX) + 'px';
  }

  // ── Locked Popover: Code Entry ──
  function onLockedCodeSubmit() {
    var codeInput = document.getElementById('co-locked-code');
    var errEl = document.getElementById('co-locked-err');
    if (!codeInput || !errEl) return;

    var code = codeInput.value.trim().toUpperCase();
    if (!code) {
      errEl.textContent = 'Enter your access code.';
      errEl.style.display = 'block';
      return;
    }

    // Check MMCOACH prefix
    var isValidCoach = code.startsWith('MMCOACH');

    // Check promo codes via lookupPromo if available
    var isValidPromo = false;
    if (typeof lookupPromo === 'function') {
      var promo = lookupPromo(code);
      isValidPromo = promo && promo.type === 'free';
    }

    if (isValidCoach || isValidPromo) {
      localStorage.setItem('pb_dc_access', '1');
      if (!localStorage.getItem('pb_dc_first')) {
        localStorage.setItem('pb_dc_first', Date.now().toString());
      }
      errEl.textContent = '';
      errEl.style.display = 'none';
      hideLockedPop();
      refreshOrbState();
      maybeShowTooltip();
      initCoachPanel();
    } else {
      errEl.textContent = 'Code not recognized. Please check your code and try again.';
      errEl.style.display = 'block';
      codeInput.style.borderColor = 'rgba(229,115,115,.5)';
    }
  }

  // ── Locked Popover: Purchase Button ──
  function onLockedPurchase() {
    if (typeof openPreCheckout === 'function') {
      var fakeEl = document.createElement('button');
      fakeEl.setAttribute('data-product', 'dating_coach');
      openPreCheckout(fakeEl);
    } else {
      window.location.href = '/coach/';
    }
  }

  // ── Locked Popover: Toggle code entry ──
  function toggleLockedCodeEntry() {
    var area = document.getElementById('co-locked-code-area');
    if (area) {
      area.classList.toggle('show');
    }
  }

  // ── Initialize Coach Panel (after access confirmed) ──
  function initCoachPanel() {
    updateDaysRemaining();

    if (localStorage.getItem('pb_dc_onboarded')) {
      intent = localStorage.getItem('pb_dc_intent') || '';
      phase = localStorage.getItem('pb_dc_phase') || '';
      focus = localStorage.getItem('pb_dc_focus') || '';
      if (chatEl) { chatEl.style.display = 'flex'; }
      if (onboardEl) { onboardEl.style.display = 'none'; }
      // Only show welcome if no messages yet
      if (cp_history.length === 0) {
        showWelcome();
      }
    } else {
      startOnboarding();
    }
  }

  // ── Keyboard Shortcuts ──
  function onKeyDown(e) {
    // Escape closes panel or locked popover
    if (e.key === 'Escape') {
      if (isPanelOpen()) {
        closePanel();
        e.preventDefault();
      } else if (lockedPop && lockedPop.classList.contains('visible')) {
        hideLockedPop();
        e.preventDefault();
      }
    }
  }

  function onInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter: default textarea newline behavior
  }

  // ── Click Outside ──
  function onDocClick(e) {
    // Close locked popover if clicking outside it and outside orb
    if (lockedPop && lockedPop.classList.contains('show')) {
      if (!lockedPop.contains(e.target) && !orbEl.contains(e.target)) {
        hideLockedPop();
      }
    }
    // Close panel if clicking outside panel and outside orb
    if (isPanelOpen()) {
      if (!panelEl.contains(e.target) && !orbEl.contains(e.target)) {
        closePanel();
      }
    }
  }

  // ── Bind Events ──
  function bindEvents() {
    if (orbEl) {
      orbEl.addEventListener('click', onOrbClick);
    }

    // Panel close button
    var closeBtn = document.querySelector('.cp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePanel();
      });
    }

    // Send button
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        sendMessage();
      });
    }

    // Textarea: auto-resize + keyboard
    if (inputEl) {
      inputEl.addEventListener('input', autoResizeInput);
      inputEl.addEventListener('keydown', onInputKeyDown);
    }

    // New session button
    var newSessBtn = document.getElementById('co-new-session');
    if (newSessBtn) {
      newSessBtn.addEventListener('click', newSession);
    }

    // Locked popover: purchase
    var purchaseBtn = document.getElementById('co-locked-buy');
    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', onLockedPurchase);
    }

    // Locked popover: "Already have a code?" link
    var codeLink = document.getElementById('co-locked-code-link');
    if (codeLink) {
      codeLink.addEventListener('click', function (e) {
        e.preventDefault();
        toggleLockedCodeEntry();
      });
    }

    // Locked popover: code submit button
    var codeSubmitBtn = document.getElementById('co-locked-code-submit');
    if (codeSubmitBtn) {
      codeSubmitBtn.addEventListener('click', onLockedCodeSubmit);
    }

    // Locked popover: code input Enter key
    var codeInput = document.getElementById('co-locked-code');
    if (codeInput) {
      codeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') onLockedCodeSubmit();
      });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Click outside to close
    document.addEventListener('click', onDocClick);
  }

  // ── Expose globals for inline handlers if needed ──
  window.coSend = sendMessage;
  window.coNewSession = newSession;

  // ── Init ──
  function init() {
    // Grab DOM references
    orbEl = document.querySelector('.coach-orb');
    panelEl = document.querySelector('.coach-panel');
    lockedPop = document.querySelector('.coach-locked-pop');
    messagesEl = document.getElementById('co-messages');
    inputEl = document.getElementById('co-input');
    sendBtn = document.getElementById('co-send-btn');
    statusEl = document.getElementById('co-status');
    daysEl = document.getElementById('co-days');
    onboardEl = document.getElementById('co-onboard');
    chatEl = document.getElementById('co-chat');

    // If no orb element on page, bail out
    if (!orbEl) return;

    // Set orb state (active vs locked)
    refreshOrbState();

    // Bind all event handlers
    bindEvents();

    // If user has access, initialize the coach panel
    if (hasAccess()) {
      initCoachPanel();
      maybeShowTooltip();
    }
  }

  // ── Boot ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
