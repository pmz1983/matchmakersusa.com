/* ═══════════════════════════════════════════════════
   CONNECTION CODE — API client (Backend RPC wrappers)
   v3.0 MVP Day 3 — 2026-05-02

   Endpoints (per Backend RPC contract; cross-lane handoff
   per Extended Autonomy v1 §2):
     POST /connection_code_brief
     POST /signup_l1
     POST /schedule_welcome_letter
     POST /create_studio_checkout

   All wrappers return Promises that resolve with parsed JSON
   or reject with { code, message } where:
     code = 'OFFLINE'  — fetch failed (network / DNS)
     code = 'NOT_LIVE' — endpoint returned 404 (Backend not yet deployed)
     code = 'ERROR'    — endpoint returned non-2xx with body
   Callers render Cartier graceful degradation per webcoach §1.9.
   ═══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const SUPABASE_FN_URL = 'https://peamviowxkyaglyjpagc.supabase.co/functions/v1';

  function postJSON(path, payload) {
    return fetch(SUPABASE_FN_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then((res) => {
      if (res.status === 404) {
        return Promise.reject({ code: 'NOT_LIVE', message: 'Endpoint not yet deployed.', status: 404 });
      }
      if (!res.ok) {
        return res.text().then((body) => Promise.reject({ code: 'ERROR', message: body || res.statusText, status: res.status }));
      }
      return res.json();
    }, (err) => {
      return Promise.reject({ code: 'OFFLINE', message: err && err.message ? err.message : 'Network unavailable.' });
    });
  }

  // ── connection_code_brief ──
  // Request:  { intent: { responses, dominant }, phase: { responses, dominant }, signal: { responses } }
  // Response: { brief: { intent_dominant, phase_dominant, signal_state, narrative_paragraphs[], chapter_citations[], generated_at } }
  function generateBrief(state) {
    return postJSON('/connection_code_brief', {
      intent: state.intent,
      phase: state.phase,
      signal: state.signal,
      started_at: state.startedAt,
      completed_at: state.completedAt
    });
  }

  // ── signup_l1 ──
  // Request:  { email, given_name (optional), state }
  // Response: { user_id, memory_store_id, created_at }
  function signupL1(payload) {
    return postJSON('/signup_l1', payload);
  }

  // ── schedule_welcome_letter ──
  // Request:  { user_id, deliver_at_utc (24hr post-signup) }
  // Response: { scheduled: true, scheduled_for }
  function scheduleWelcomeLetter(userId) {
    const deliverAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return postJSON('/schedule_welcome_letter', { user_id: userId, deliver_at_utc: deliverAt });
  }

  // ── create_studio_checkout ──
  // Request:  { tier: 'L2', success_url, cancel_url, user_id (optional) }
  // Response: { checkout_url }
  function createStudioCheckout(payload) {
    return postJSON('/create_studio_checkout', Object.assign({
      tier: 'L2',
      success_url: window.location.origin + '/success/',
      cancel_url: window.location.href
    }, payload || {}));
  }

  global.MMConnectionCodeAPI = {
    generateBrief: generateBrief,
    signupL1: signupL1,
    scheduleWelcomeLetter: scheduleWelcomeLetter,
    createStudioCheckout: createStudioCheckout
  };
})(typeof window !== 'undefined' ? window : this);
