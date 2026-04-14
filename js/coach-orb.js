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

  // ── Intent-aware Suggested Prompts ──
  var PROMPTS_BY_INTENT = {
    'Long-Term': [
      'Help me write an opening message',
      'Review my dating profile',
      'They stopped responding \u2014 what do I do?',
      'How do I move from texting to a real date?'
    ],
    'Marriage': [
      'Help me write an opening message',
      'Review my dating profile',
      'They stopped responding \u2014 what do I do?',
      'How do I move from texting to a real date?'
    ],
    'Fall in Love': [
      'Help me write an opening message',
      'Review my dating profile',
      'They stopped responding \u2014 what do I do?',
      'How do I move from texting to a real date?'
    ],
    'Casual': [
      'Best opening lines for casual dating',
      'How do I keep things fun and light?',
      'They want something serious but I don\'t',
      'When should I suggest meeting up?'
    ],
    'Short-Term': [
      'Best opening lines for casual dating',
      'How do I keep things fun and light?',
      'They want something serious but I don\'t',
      'When should I suggest meeting up?'
    ],
    'Friends': [
      'How do I make genuine connections?',
      'Best ways to start a friendship conversation',
      'How do I set boundaries around just being friends?',
      'Tips for building a social circle'
    ],
    'not_sure': [
      'Help me figure out what I\'m looking for',
      'What should my dating profile say?',
      'I just got out of a relationship',
      'How do dating apps actually work?'
    ],
    'custom': [
      'Help me figure out what I\'m looking for',
      'What should my dating profile say?',
      'I just got out of a relationship',
      'How do dating apps actually work?'
    ]
  };

  // ── Session Summary Config ──
  var SUMMARY_THRESHOLD = 10;   // Generate summary every N message pairs
  var RECENT_KEEP = 5;          // Always keep last N exchanges in full

  // ── State ──
  var cp_history = [];
  var typing = false;
  var intent = '';
  var sessionSummary = '';      // Compressed context from older messages
  var storageReady = false;     // Whether IndexedDB loaded successfully
  var todayMsgCount = 0;        // Today's user message count (persistent)

  // ── DOM References (set during init) ──
  var orbEl, panelEl, lockedPop, backdropEl;
  var messagesEl, inputEl, sendBtn, statusEl, daysEl;
  var onboardEl, chatEl, settingsEl;
  var savedScrollY = 0;

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

  // ── Body Scroll Lock (iOS Safari safe) ──
  function lockBodyScroll() {
    savedScrollY = window.scrollY;
    document.documentElement.style.setProperty('--scroll-y', '-' + savedScrollY + 'px');
    document.body.classList.add('coach-open');
  }

  function unlockBodyScroll() {
    document.body.classList.remove('coach-open');
    document.documentElement.style.removeProperty('--scroll-y');
    window.scrollTo(0, savedScrollY);
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
    if (backdropEl) backdropEl.classList.add('open');
    lockBodyScroll();
    if (inputEl) setTimeout(function() { inputEl.focus(); }, 100);
  }

  function closePanel() {
    if (!orbEl || !panelEl) return;
    orbEl.classList.remove('open');
    panelEl.classList.remove('open');
    if (backdropEl) backdropEl.classList.remove('open');
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

  // ── Get Prompts for Current Intent ──
  function getPromptsForIntent() {
    if (PROMPTS_BY_INTENT[intent]) return PROMPTS_BY_INTENT[intent];
    // Default / fallback
    return PROMPTS_BY_INTENT['not_sure'];
  }

  // ── Welcome Message + Suggested Prompts ──
  function showWelcome() {
    // Check if we have persisted history — show "welcome back" instead
    if (sessionSummary) {
      var msg = 'Welcome back. Last time we were working on: ' + sessionSummary + '\n\nWant to pick up where we left off, or start something new?';
      addMessage('coach', msg);
      cp_history.push({ role: 'assistant', content: msg });
      showSuggestedPrompts();
      return;
    }

    var msg;
    if (intent === 'not_sure') {
      msg = 'No problem \u2014 that\'s actually where a lot of people start. Tell me: are you actively on dating apps right now, or are you thinking about getting started?';
    } else if (intent === 'custom') {
      msg = 'Welcome back \u2014 tell me what you\'re working on, and I\'ll jump right in.';
    } else if (intent) {
      msg = 'Welcome back \u2014 ' + intent + ' Intent. What are you working on today?';
    } else {
      msg = 'Welcome to your Dating Coach. I know the full MatchMakers methodology \u2014 all 5 phases, 50+ scripts, and the Connection Code. What are you working on right now?';
    }
    addMessage('coach', msg);
    cp_history.push({ role: 'assistant', content: msg });
    showSuggestedPrompts();
  }

  // Welcome shown right after onboarding completes (first time)
  function showFirstWelcome() {
    var msg;
    if (intent === 'not_sure') {
      msg = 'No problem \u2014 that\'s actually where a lot of people start. Tell me: are you actively on dating apps right now, or are you thinking about getting started?';
    } else if (intent === 'custom') {
      // Custom intent: the free text was sent as first message, no welcome needed
      return;
    } else if (intent) {
      msg = 'Your context is set \u2014 ' + intent + ' Intent. What are you working on right now?';
    } else {
      msg = 'Welcome to your Dating Coach. What are you working on right now?';
    }
    addMessage('coach', msg);
    cp_history.push({ role: 'assistant', content: msg });
    showSuggestedPrompts();
  }

  function showSuggestedPrompts() {
    if (!messagesEl) return;
    var prompts = getPromptsForIntent();
    var wrap = document.createElement('div');
    wrap.className = 'cp-suggestions';
    wrap.id = 'co-suggestions';
    prompts.forEach(function(p) {
      var btn = document.createElement('button');
      btn.className = 'cp-suggest-btn';
      btn.textContent = p;
      btn.addEventListener('click', function() {
        if (inputEl) { inputEl.value = p; }
        var el = document.getElementById('co-suggestions');
        if (el) el.remove();
        sendMessage();
      });
      wrap.appendChild(btn);
    });
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Build API messages with summary compression ──
  function buildApiMessages() {
    // Filter out leading assistant messages (Anthropic requires user-first)
    var msgs = cp_history.filter(function(m, i) {
      if (i === 0 && m.role === 'assistant') return false;
      return true;
    });

    // If we have a summary and enough messages, prepend summary as system context
    if (sessionSummary && msgs.length > RECENT_KEEP * 2) {
      // Keep only the last RECENT_KEEP exchanges (user+assistant pairs)
      var recentStart = Math.max(0, msgs.length - RECENT_KEEP * 2);
      var recentMsgs = msgs.slice(recentStart);

      // Prepend summary as a user message for context
      var summaryMsg = {
        role: 'user',
        content: '[Previous conversation summary: ' + sessionSummary + ']\n\nContinuing our conversation:'
      };
      // Need to ensure first message is user role
      if (recentMsgs.length > 0 && recentMsgs[0].role === 'assistant') {
        return [summaryMsg].concat(recentMsgs);
      }
      // Merge summary into first user message
      recentMsgs[0] = {
        role: 'user',
        content: '[Previous conversation summary: ' + sessionSummary + ']\n\n' + recentMsgs[0].content
      };
      return recentMsgs;
    }

    return msgs;
  }

  // ── Generate session summary from older messages ──
  function maybeGenerateSummary() {
    // Count user messages since last summary
    var userMsgCount = cp_history.filter(function(m) { return m.role === 'user'; }).length;
    if (userMsgCount < SUMMARY_THRESHOLD) return;
    if (userMsgCount % SUMMARY_THRESHOLD !== 0) return; // Only at thresholds

    // Build summary from all but the last RECENT_KEEP exchanges
    var cutoff = Math.max(0, cp_history.length - RECENT_KEEP * 2);
    if (cutoff < 4) return; // Need enough messages to summarize

    var toSummarize = cp_history.slice(0, cutoff);
    var topics = [];
    toSummarize.forEach(function(m) {
      if (m.role === 'user' && m.content.length > 10) {
        // Extract key phrases (first 80 chars of each user message)
        topics.push(m.content.substring(0, 80).replace(/\n/g, ' '));
      }
    });

    if (topics.length > 0) {
      // Client-side summary: extract topics discussed
      sessionSummary = topics.slice(-5).join('; ');

      // Persist summary
      var sid = getSessionId();
      if (window.CoachStorage) {
        CoachStorage.saveSessionMeta(sid, {
          summary: sessionSummary,
          intent: intent,
          messageCount: cp_history.length,
          lastTopic: topics[topics.length - 1]
        });
      }
    }
  }

  // ── Persist message to IndexedDB ──
  function persistMessage(role, content) {
    if (window.CoachStorage) {
      var sid = getSessionId();
      CoachStorage.saveMessage(sid, role, content);
    }
  }

  // ── Send Message ──
  async function sendMessage() {
    if (typing) return;
    if (!inputEl) return;
    var txt = inputEl.value.trim();
    if (!txt) return;

    // ── Rate limit check (persistent, daily) ──
    todayMsgCount++;
    if (todayMsgCount > 50) {
      addMessage('coach', 'You\'ve reached today\'s message limit (50 messages). Your limit resets at midnight. Need unlimited access? Premium is coming soon.');
      return;
    }

    inputEl.value = '';
    inputEl.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;
    typing = true;
    if (statusEl) statusEl.textContent = 'Thinking...';

    // Remove suggested prompts if still showing
    var sugg = document.getElementById('co-suggestions');
    if (sugg) sugg.remove();

    addMessage('user', txt);
    cp_history.push({ role: 'user', content: txt });
    persistMessage('user', txt);
    showTyping();
    if (orbEl) orbEl.classList.add('thinking');

    var memberCtx = '';
    if (intent) {
      memberCtx =
        '\n\n---\nMEMBER CONTEXT:\nIntent: ' + intent +
        '\nPage: ' + window.location.pathname +
        '\n---';
    } else {
      memberCtx = '\n\n---\nPage: ' + window.location.pathname + '\n---';
    }

    try {
      var sessionId = getSessionId();
      var apiMessages = buildApiMessages();
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
        addMessage('coach', errMsg || 'Something went wrong \u2014 please try again.');
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
      persistMessage('assistant', reply);

      // Check if we should generate a summary
      maybeGenerateSummary();

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
    if (orbEl) orbEl.classList.remove('thinking');
  }

  // ── New Session ──
  function newSession() {
    var currentLabel = intent || 'none';
    if (!confirm('Start a new conversation? Your Intent (' + currentLabel + ') will stay the same. To change it, use Settings.')) return;
    // Clear IndexedDB for current session
    var sid = getSessionId();
    if (window.CoachStorage) {
      CoachStorage.clearSession(sid);
    }
    cp_history = [];
    sessionSummary = '';
    if (messagesEl) messagesEl.innerHTML = '';
    // Generate new session ID
    localStorage.removeItem('dc_session');
    setTimeout(showWelcome, 200);
  }

  // ── Onboarding ──
  function startOnboarding() {
    if (onboardEl) { onboardEl.style.display = 'block'; }
    if (chatEl) { chatEl.style.display = 'none'; }
  }

  function finishOnboarding(sendFreeText) {
    localStorage.setItem('pb_dc_onboarded', '1');
    localStorage.setItem('pb_dc_intent', intent);
    // Clean up removed keys
    localStorage.removeItem('pb_dc_phase');
    localStorage.removeItem('pb_dc_focus');
    if (onboardEl) { onboardEl.style.display = 'none'; }
    if (chatEl) { chatEl.style.display = 'flex'; }

    if (sendFreeText) {
      // Custom intent: send the free text as first message
      if (inputEl) { inputEl.value = sendFreeText; }
      setTimeout(function() { sendMessage(); }, 300);
    } else {
      setTimeout(showFirstWelcome, 300);
    }
  }

  // ── Onboarding: Intent Selection ──
  window.coSelectIntent = function (el, v) {
    // Deselect all intent buttons
    document.querySelectorAll('.co-intent-opt').forEach(function (o) {
      o.classList.remove('sel');
    });
    el.classList.add('sel');
    intent = v;

    // Clear free text if an intent button is selected
    var freetext = document.getElementById('co-freetext');
    if (freetext) freetext.value = '';

    // Enable begin button
    var btn = document.getElementById('co-ob-begin');
    if (btn) btn.disabled = false;
  };

  // ── Onboarding: Free text input handler ──
  function onFreetextInput() {
    var freetext = document.getElementById('co-freetext');
    var btn = document.getElementById('co-ob-begin');
    if (!freetext || !btn) return;

    var hasText = freetext.value.trim().length > 0;

    if (hasText) {
      // Deselect all intent buttons when typing
      document.querySelectorAll('.co-intent-opt').forEach(function (o) {
        o.classList.remove('sel');
      });
      intent = '';
      btn.disabled = false;
    } else {
      // Re-check if an intent button is selected
      var selected = document.querySelector('.co-intent-opt.sel');
      btn.disabled = !selected;
    }
  }

  // ── Onboarding: Begin ──
  window.coStartCoach = function () {
    var freetext = document.getElementById('co-freetext');
    var freetextVal = freetext ? freetext.value.trim() : '';

    if (freetextVal && !intent) {
      // User typed free text instead of selecting a button
      intent = 'custom';
      localStorage.setItem('pb_dc_custom_intent', freetextVal);
      finishOnboarding(freetextVal);
    } else {
      // User selected an intent button
      finishOnboarding(null);
    }
  };

  // ── Settings Panel ──
  window.coOpenSettings = function () {
    if (!settingsEl) settingsEl = document.getElementById('co-settings');
    if (!settingsEl) return;

    // Populate current values
    var intentBtns = settingsEl.querySelectorAll('.cp-settings-opt');
    intentBtns.forEach(function(btn) {
      btn.classList.remove('sel');
      if (btn.getAttribute('data-intent') === intent ||
          btn.textContent.trim() === intent ||
          (intent === 'not_sure' && btn.getAttribute('data-intent') === 'not_sure')) {
        btn.classList.add('sel');
      }
    });

    // Usage (today's count from persistent storage)
    var usageEl = document.getElementById('co-settings-usage');
    if (usageEl) {
      usageEl.textContent = todayMsgCount + ' / 50 messages today';
    }

    // Days
    var settingsDaysEl = document.getElementById('co-settings-days');
    if (settingsDaysEl) {
      var first = parseInt(localStorage.getItem('pb_dc_first') || Date.now(), 10);
      var days = Math.max(0, 30 - Math.floor((Date.now() - first) / 86400000));
      settingsDaysEl.textContent = days > 0 ? days + ' days remaining' : 'Access expired';
    }

    // Show settings, hide chat
    settingsEl.style.display = 'flex';
    if (chatEl) chatEl.style.display = 'none';
    if (onboardEl) onboardEl.style.display = 'none';
  };

  window.coCloseSettings = function () {
    if (settingsEl) settingsEl.style.display = 'none';
    if (chatEl) chatEl.style.display = 'flex';
  };

  window.coChangeIntent = function (el, v) {
    // Update selection UI
    var container = document.getElementById('co-settings-intents');
    if (container) {
      container.querySelectorAll('.cp-settings-opt').forEach(function(btn) {
        btn.classList.remove('sel');
      });
    }
    el.classList.add('sel');

    // Update state
    intent = v;
    localStorage.setItem('pb_dc_intent', intent);

    // Show toast
    showToast('Intent updated to ' + (v === 'not_sure' ? 'Not Sure' : v));

    // Close settings after brief delay
    setTimeout(function() {
      coCloseSettings();
    }, 600);
  };

  window.coClearHistory = function () {
    if (!confirm('Clear all conversation history? This cannot be undone.')) return;
    // Clear IndexedDB completely
    if (window.CoachStorage) {
      CoachStorage.clearAllData();
    }
    cp_history = [];
    sessionSummary = '';
    todayMsgCount = 0;
    if (messagesEl) messagesEl.innerHTML = '';
    // Generate new session ID
    localStorage.removeItem('dc_session');
    showToast('Conversation cleared');
    setTimeout(function() {
      coCloseSettings();
      setTimeout(showWelcome, 200);
    }, 400);
  };

  function showToast(msg) {
    // Create a simple toast notification inside the panel
    var existing = document.getElementById('co-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'co-toast';
    toast.className = 'cp-toast';
    toast.textContent = msg;
    if (panelEl) {
      panelEl.appendChild(toast);
      setTimeout(function() { toast.classList.add('show'); }, 10);
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
      }, 2000);
    }
  }

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

    // Check MMCOACH prefix (case-insensitive, already uppercased)
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

  // ── Load persisted conversation from IndexedDB ──
  async function loadPersistedConversation() {
    if (!window.CoachStorage) return;
    var sid = getSessionId();

    try {
      // Load session metadata (summary)
      var meta = await CoachStorage.loadSessionMeta(sid);
      if (meta && meta.summary) {
        sessionSummary = meta.summary;
      }

      // Load messages
      var msgs = await CoachStorage.loadMessages(sid);
      if (msgs && msgs.length > 0) {
        // Restore history
        cp_history = msgs.map(function(m) {
          return { role: m.role, content: m.content };
        });

        // Render messages in the UI
        msgs.forEach(function(m) {
          addMessage(m.role === 'assistant' ? 'coach' : 'user', m.content);
        });

        storageReady = true;
        return true; // Had persisted messages
      }

      // Load today's message count for rate limiting
      todayMsgCount = await CoachStorage.getMessageCount(sid);

      storageReady = true;
    } catch (err) {
      console.warn('[coach-orb] Failed to load persisted data:', err);
    }
    return false; // No persisted messages
  }

  // ── Initialize Coach Panel (after access confirmed) ──
  function initCoachPanel() {
    updateDaysRemaining();
    // Bug fix 5: refresh days remaining every 60 seconds
    setInterval(updateDaysRemaining, 60000);

    // Bug fix 3: verify intent exists if onboarded
    if (localStorage.getItem('pb_dc_onboarded') && localStorage.getItem('pb_dc_intent')) {
      intent = localStorage.getItem('pb_dc_intent') || '';
      if (chatEl) { chatEl.style.display = 'flex'; }
      if (onboardEl) { onboardEl.style.display = 'none'; }

      // Try to load persisted conversation from IndexedDB
      loadPersistedConversation().then(function(hadMessages) {
        if (!hadMessages && cp_history.length === 0) {
          showWelcome();
        }
        // Load today's rate limit count
        if (window.CoachStorage) {
          CoachStorage.getMessageCount(getSessionId()).then(function(count) {
            todayMsgCount = count;
          });
        }
      });
    } else {
      // Not onboarded, or onboarded but missing intent — show onboarding
      localStorage.removeItem('pb_dc_onboarded');
      startOnboarding();
    }
  }

  // ── Keyboard Shortcuts ──
  function onKeyDown(e) {
    // Escape closes panel or locked popover
    if (e.key === 'Escape') {
      if (settingsEl && settingsEl.style.display !== 'none') {
        coCloseSettings();
        e.preventDefault();
      } else if (isPanelOpen()) {
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
      if (!lockedPop.contains(e.target) && !(orbEl && orbEl.contains(e.target))) {
        hideLockedPop();
      }
    }
  }

  // ── Backdrop click closes panel ──
  function onBackdropClick(e) {
    if (e.target === backdropEl) {
      closePanel();
    }
  }

  // ── Prevent touch scroll from leaking to body ──
  function preventScrollLeak(e) {
    if (!isPanelOpen()) return;
    // Allow scrolling inside messages area and other scrollable children
    var target = e.target;
    while (target && target !== panelEl) {
      if (target === messagesEl || target.classList.contains('cp-onboard') ||
          target.classList.contains('cp-settings-body')) {
        return; // Allow scroll inside these containers
      }
      target = target.parentElement;
    }
    // If not inside a scrollable child, prevent the touch from scrolling
    if (target === panelEl) {
      e.preventDefault();
    }
  }

  // ── Bug fix 2: Storage event listener for cross-tab sync ──
  function onStorageChange(e) {
    if (e.key === 'pb_dc_intent') {
      intent = e.newValue || '';
    }
    if (e.key === 'pb_dc_onboarded') {
      if (e.newValue === '1' && localStorage.getItem('pb_dc_intent')) {
        intent = localStorage.getItem('pb_dc_intent') || '';
        if (chatEl) { chatEl.style.display = 'flex'; }
        if (onboardEl) { onboardEl.style.display = 'none'; }
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

    // Onboarding free text input
    var freetext = document.getElementById('co-freetext');
    if (freetext) {
      freetext.addEventListener('input', onFreetextInput);
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
    var codeInputEl = document.getElementById('co-locked-code');
    if (codeInputEl) {
      codeInputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') onLockedCodeSubmit();
      });
    }

    // Backdrop click to close panel
    if (backdropEl) {
      backdropEl.addEventListener('click', onBackdropClick);
      // Prevent scroll events on backdrop from reaching body
      backdropEl.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    }

    // Prevent touch scroll leaking from panel edges to body
    if (panelEl) {
      panelEl.addEventListener('touchmove', preventScrollLeak, { passive: false });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Click outside locked popover
    document.addEventListener('click', onDocClick);

    // Bug fix 2: cross-tab sync
    window.addEventListener('storage', onStorageChange);
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
    settingsEl = document.getElementById('co-settings');

    // If no orb element on page, bail out
    if (!orbEl) return;

    // Create backdrop element for scroll/click isolation
    backdropEl = document.querySelector('.coach-backdrop');
    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.className = 'coach-backdrop';
      document.body.appendChild(backdropEl);
    }

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
