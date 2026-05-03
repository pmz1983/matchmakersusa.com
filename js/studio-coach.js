/* ═══════════════════════════════════════════════════════════════════════════
   MATCHMAKERS — studio-coach.js
   Studio Coach surface (/studio/coach/) — fit-to-page chat
   Wires the 5-affordance input row to the coach-proxy EF
   Mission-critical hot-fix sprint per Paul §5 directive 2026-05-03
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COACH_PROXY = 'https://peamviowxkyaglyjpagc.supabase.co/functions/v1/coach-proxy';
  var STORAGE_KEY = 'studio_coach_messages';
  var HISTORY_CAP = 30;
  var TURN_TIMEOUT_MS = 60000;

  var inputEl, sendBtn, surfaceEl, emptyEl, counterEl;
  var messages = [];
  var inFlight = false;

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) messages = JSON.parse(raw) || [];
    } catch (e) { messages = []; }
  }

  function saveHistory() {
    try {
      var trimmed = messages.slice(-HISTORY_CAP);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {}
  }

  function ensureMessagesEl() {
    var el = document.getElementById('studio-coach-messages');
    if (!el) {
      el = document.createElement('div');
      el.id = 'studio-coach-messages';
      el.className = 'studio-coach-messages';
      el.setAttribute('role', 'log');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-label', 'Coach conversation');
      surfaceEl.insertBefore(el, document.querySelector('.studio-coach-input-row'));
    }
    return el;
  }

  function renderEmpty() {
    if (messages.length === 0) {
      if (emptyEl) emptyEl.style.display = '';
      var el = document.getElementById('studio-coach-messages');
      if (el) el.style.display = 'none';
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
      var listEl = ensureMessagesEl();
      listEl.style.display = '';
    }
  }

  function appendMessage(role, content) {
    var listEl = ensureMessagesEl();
    var row = document.createElement('div');
    row.className = 'studio-coach-msg studio-coach-msg--' + role;
    var bubble = document.createElement('div');
    bubble.className = 'studio-coach-msg__bubble';
    bubble.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
    row.appendChild(bubble);
    listEl.appendChild(row);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function appendTyping() {
    var listEl = ensureMessagesEl();
    var row = document.createElement('div');
    row.id = 'studio-coach-typing';
    row.className = 'studio-coach-msg studio-coach-msg--coach studio-coach-msg--typing';
    var bubble = document.createElement('div');
    bubble.className = 'studio-coach-msg__bubble';
    bubble.innerHTML = '<span class="studio-coach-typing-dot"></span><span class="studio-coach-typing-dot"></span><span class="studio-coach-typing-dot"></span>';
    row.appendChild(bubble);
    listEl.appendChild(row);
    listEl.scrollTop = listEl.scrollHeight;
  }

  function removeTyping() {
    var t = document.getElementById('studio-coach-typing');
    if (t && t.parentNode) t.parentNode.removeChild(t);
  }

  function rerenderAll() {
    var listEl = ensureMessagesEl();
    listEl.innerHTML = '';
    messages.forEach(function (m) { appendMessage(m.role, m.content); });
    renderEmpty();
  }

  function setSendEnabled(enabled) {
    if (!sendBtn) return;
    sendBtn.disabled = !enabled;
    if (enabled) sendBtn.classList.remove('studio-coach-input-row__btn--disabled');
    else sendBtn.classList.add('studio-coach-input-row__btn--disabled');
  }

  function bumpCounter() {
    if (!counterEl) return;
    var listEl = ensureMessagesEl();
    var userTurns = (listEl.querySelectorAll('.studio-coach-msg--user') || []).length;
    counterEl.textContent = userTurns + ' turn' + (userTurns === 1 ? '' : 's') + ' this session';
  }

  async function sendMessage(text) {
    if (inFlight) return;
    var trimmed = String(text || '').trim();
    if (!trimmed) return;

    messages.push({ role: 'user', content: trimmed });
    appendMessage('user', trimmed);
    renderEmpty();
    saveHistory();
    bumpCounter();
    inputEl.value = '';
    setSendEnabled(false);
    inFlight = true;

    appendTyping();

    var apiMessages = messages
      .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
      .slice(-HISTORY_CAP)
      .map(function (m) {
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
      });

    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, TURN_TIMEOUT_MS);

    try {
      var res = await fetch(COACH_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { surface: 'studio-coach' }, messages: apiMessages }),
        signal: ctrl.signal
      });
      clearTimeout(to);
      var data = {};
      try { data = await res.json(); } catch (e) {}
      removeTyping();

      var errMsg = data.error || data.message || null;
      if (errMsg || data.code || !res.ok) {
        var hint = errMsg || 'The Coach is recalibrating. Please retry shortly.';
        appendMessage('coach', hint);
        if (window.Sentry) {
          try { Sentry.captureMessage('studio-coach error: ' + (errMsg || res.status), 'warning'); } catch (e) {}
        }
        return;
      }

      var reply = (data && data.content && data.content[0] && data.content[0].text) || '';
      if (!reply) reply = 'The Coach is recalibrating. Please retry shortly.';
      messages.push({ role: 'assistant', content: reply });
      appendMessage('coach', reply);
      saveHistory();
    } catch (err) {
      removeTyping();
      var msg = (err && err.name === 'AbortError')
        ? 'The Coach took too long to respond. Please retry.'
        : 'The Coach is recalibrating. Please retry shortly.';
      appendMessage('coach', msg);
      if (window.Sentry) {
        try { Sentry.captureException(err); } catch (e) {}
      }
    } finally {
      inFlight = false;
      setSendEnabled(true);
      inputEl.focus();
    }
  }

  function init() {
    surfaceEl = document.querySelector('.studio-coach-surface');
    if (!surfaceEl) return;
    inputEl = document.querySelector('.studio-coach-input-row__field');
    sendBtn = document.querySelector('.studio-coach-input-row__btn--send');
    emptyEl = document.querySelector('.studio-coach-empty');
    counterEl = document.querySelector('.studio-coach-counter');

    if (!inputEl || !sendBtn) return;

    loadHistory();
    rerenderAll();
    bumpCounter();

    function tryEnable() {
      setSendEnabled(!!inputEl.value.trim() && !inFlight);
    }
    setSendEnabled(false);

    inputEl.addEventListener('input', tryEnable);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage(inputEl.value);
      }
    });
    sendBtn.addEventListener('click', function () { sendMessage(inputEl.value); });

    inputEl.placeholder = 'Ask the Coach…';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
