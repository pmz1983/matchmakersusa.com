/* /js/compass.js — Connection Compass canvas wiring
   Per COACH_CONSOLIDATION_MASTER_SPEC v1 2026-05-06 §3.4 + §3.5
        APPLE_5_1_2_I_THIRD_PARTY_AI_CONSENT_MODAL_SPEC v1 2026-05-06 §4.3
   Backend integration per BACKEND_CROSS_LANE_REQUIREMENTS_BRIEF v1 §1 + §4 + §11
*/

(function () {
  const form = document.querySelector('[data-compass-canvas-form]');
  const output = document.querySelector('[data-compass-canvas-output]');
  if (!form || !output) return;

  const intentChips = form.querySelectorAll('[data-intent]');
  let selectedIntent = null;

  intentChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const isPressed = chip.getAttribute('aria-pressed') === 'true';
      intentChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      if (!isPressed) {
        chip.setAttribute('aria-pressed', 'true');
        selectedIntent = chip.dataset.intent;
      } else {
        selectedIntent = null;
      }
    });
  });

  // Intent pre-selection from URL (?intent=script / ?intent=suitability / ?intent=chapter)
  const urlParams = new URLSearchParams(window.location.search);
  const intentParam = urlParams.get('intent');
  if (intentParam) {
    const chip = form.querySelector(`[data-intent="${intentParam}"]`);
    if (chip) {
      chip.setAttribute('aria-pressed', 'true');
      selectedIntent = intentParam;
    }
  }

  // ── Apple 5.1.2(i) third-party AI consent modal ──────────────────────────
  const CONSENT_KEY = 'mm_compass_consent_v1';
  const modal = document.getElementById('ai-consent-modal');
  const acceptBtn = modal ? modal.querySelector('[data-ai-consent="accept"]') : null;
  const declineBtn = modal ? modal.querySelector('[data-ai-consent="decline"]') : null;

  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'accepted';
    } catch (e) {
      return false;
    }
  }

  function persistConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch (e) {
      // localStorage unavailable; fall back to in-memory consent for this session
      window.__mm_compass_consent_session = value;
    }
  }

  function openConsentModal(onAccept) {
    if (!modal) {
      // No modal in DOM; fall back to plain confirm so the gate still fires
      if (window.confirm('The Compass uses Anthropic Claude (third-party AI). Your input is processed by Anthropic under their Commercial Terms (no model training). Continue?')) {
        persistConsent('accepted');
        onAccept();
      }
      return;
    }
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const onAcceptClick = () => {
      persistConsent('accepted');
      closeModal();
      onAccept();
    };
    const onDeclineClick = () => {
      persistConsent('declined');
      closeModal();
    };

    function closeModal() {
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      acceptBtn.removeEventListener('click', onAcceptClick);
      declineBtn.removeEventListener('click', onDeclineClick);
    }

    acceptBtn.addEventListener('click', onAcceptClick);
    declineBtn.addEventListener('click', onDeclineClick);
  }

  // ── Compass canvas form submission ───────────────────────────────────────
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputEl = form.querySelector('#compass-input');
    const input = inputEl ? inputEl.value.trim() : '';
    if (!input) return;

    const proceed = () => submitToCompass(input);
    if (hasConsent()) {
      proceed();
    } else {
      openConsentModal(proceed);
    }
  });

  async function submitToCompass(input) {
    output.innerHTML = '<p class="v3-body v3-body--ghost"><em>The Compass is reading&hellip;</em></p>';

    try {
      const response = await fetch('/api/compass/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input,
          intent: selectedIntent
        })
      });

      if (!response.ok) {
        // Backend orchestrator not yet wired or entitlement gate fired
        if (response.status === 403) {
          output.innerHTML = `
            <p class="v3-body"><em>The Compass canvas is part of Studio. <a href="/studio/purchase/" style="color: var(--color-heritage-gold-text); border-bottom: 1px solid var(--color-heritage-gold-soft);">Open Studio &mdash; $299</a> to engage the methodology in conversation.</em></p>
          `;
          return;
        }
        if (response.status === 404) {
          output.innerHTML = `
            <p class="v3-body"><em>The Compass orchestrator is being readied. The canvas is live; the routing engine deploys with the Backend cohort. Reach the <a href="/contact/" style="color: var(--color-heritage-gold-text); border-bottom: 1px solid var(--color-heritage-gold-soft);">Inquiry</a> if you need access sooner.</em></p>
            <p class="v3-body" style="margin-top: 1rem;"><em>If you need clinical care or crisis support &mdash; <a href="/crisis/" style="color: var(--color-heritage-gold-text); border-bottom: 1px solid var(--color-heritage-gold-soft);">Crisis Referral &rarr;</a></em></p>
          `;
          return;
        }
        throw new Error('Compass orchestrator returned ' + response.status);
      }

      const data = await response.json();

      output.innerHTML = renderCompassOutput(data);

      if (data.crisis_referral_active) {
        renderCrisisReferralBypass(output, data.crisis_referral);
      }
    } catch (err) {
      output.innerHTML = `
        <p class="v3-body"><em>The Compass couldn&rsquo;t complete this read. Please try again, or reach the <a href="/contact/" style="color: var(--color-heritage-gold-text); border-bottom: 1px solid var(--color-heritage-gold-soft);">Inquiry</a> if it persists.</em></p>
        <p class="v3-body" style="margin-top: 1rem;"><em>If you need clinical care or crisis support &mdash; <a href="/crisis/" style="color: var(--color-heritage-gold-text); border-bottom: 1px solid var(--color-heritage-gold-soft);">Crisis Referral &rarr;</a></em></p>
      `;
      if (window.Sentry) Sentry.captureException(err);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderCompassOutput(data) {
    const citations = Array.isArray(data.citations) ? data.citations : [];
    const trailChips = citations.map((c) => `
      <a href="/playbook/content/${encodeURIComponent(c.chapter_id || '')}#${encodeURIComponent(c.passage_anchor || '')}"
         class="v3-methodology-trail-chip"
         data-citation-id="${escapeHtml(c.id || '')}">
        <span class="v3-methodology-trail-chip__icon" aria-hidden="true"></span>
        <span class="v3-methodology-trail-chip__label">Grounded in: ${escapeHtml(c.chapter_name || '')} &middot; ${escapeHtml(c.framework_name || '')}</span>
      </a>
    `).join('');

    const ch = data.surfaced_chapter;
    const applyActions = ch ? `
      <ul class="v3-compass-apply-actions" role="list" aria-label="Apply this chapter">
        <li class="v3-compass-apply-action">
          <p class="v3-compass-apply-action__label"><em>Read</em></p>
          <p class="v3-compass-apply-action__body">
            <a href="/playbook/content/${encodeURIComponent(ch.id)}">Open the chapter passage in full &rarr;</a>
          </p>
        </li>
        <li class="v3-compass-apply-action">
          <p class="v3-compass-apply-action__label"><em>Ask</em></p>
          <p class="v3-compass-apply-action__body">
            <button type="button" data-compass-action="ask" data-chapter-id="${escapeHtml(ch.id)}">
              Bring a question into this chapter &rarr;
            </button>
          </p>
        </li>
        <li class="v3-compass-apply-action">
          <p class="v3-compass-apply-action__label"><em>Apply</em></p>
          <p class="v3-compass-apply-action__body">
            <button type="button" data-compass-action="apply" data-chapter-id="${escapeHtml(ch.id)}">
              Apply this chapter to my situation &rarr;
            </button>
          </p>
        </li>
        <li class="v3-compass-apply-action">
          <p class="v3-compass-apply-action__label"><em>Save to my system</em></p>
          <p class="v3-compass-apply-action__body">
            <button type="button" data-compass-action="save" data-chapter-id="${escapeHtml(ch.id)}">
              Save to your Lifetime Methodology Vector &rarr;
            </button>
          </p>
        </li>
      </ul>
    ` : '';

    const patternBlock = data.pattern_surfacing ? `
      <p class="v3-body" style="margin-bottom: 1rem;"><em>The same word has surfaced in your reflections ${escapeHtml(String(data.pattern_surfacing.occurrence_count || ''))} times: <strong>${escapeHtml(data.pattern_surfacing.word || '')}</strong>. ${escapeHtml(data.pattern_surfacing.observation || '')}</em></p>
    ` : '';

    return `
      <div class="v3-compass-output-payload">
        ${patternBlock}
        <div class="v3-body">${data.read_html || ''}</div>
        ${trailChips}
        ${applyActions}
        <p class="v3-body v3-body--ghost" style="margin-top: 1.5rem;"><em>Saved to your Compass thread. Three months from now, the Compass remembers.</em></p>
      </div>
    `;
  }

  function renderCrisisReferralBypass(outputEl, crisisData) {
    const bypass = document.createElement('div');
    bypass.className = 'v3-compass-crisis-bypass';
    bypass.innerHTML = `
      <p class="v3-body" style="background: rgba(203,163,114,0.15); padding: 1rem; border-left: 3px solid var(--color-heritage-gold); margin-bottom: 1.5rem;">
        <em>What you brought touches on something the methodology can&rsquo;t hold &mdash; clinical care or crisis. The Crisis Referral directory is one tap away. You&rsquo;re not alone in this.</em>
      </p>
      <p style="text-align: center; margin: 1rem 0 1.5rem;">
        <a href="/crisis/" class="v3-cta-cobalt-glass">Open Crisis Referral &rarr;</a>
      </p>
    `;
    outputEl.insertBefore(bypass, outputEl.firstChild);
  }

  // ── Delegated handlers for Apply This Chapter actions ────────────────────
  document.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-compass-action]');
    if (!button) return;
    e.preventDefault();
    const action = button.dataset.compassAction;
    const chapterId = button.dataset.chapterId;

    switch (action) {
      case 'ask': {
        const inputEl = document.getElementById('compass-input');
        if (inputEl) {
          inputEl.value = `[Chapter: ${chapterId}] `;
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
      case 'apply': {
        try {
          const response = await fetch('/api/compass/apply-chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_id: chapterId, action: 'apply' })
          });
          if (!response.ok) throw new Error('Apply failed: ' + response.status);
          const data = await response.json();
          if (output) {
            output.innerHTML = `
              <p class="v3-body"><strong>Applied to your situation:</strong></p>
              <div class="v3-body">${data.application_read_html || ''}</div>
              <p class="v3-body v3-body--ghost" style="margin-top: 1rem;"><em>Saved to your Lifetime Methodology Vector. The Compass will surface this when the same shape appears.</em></p>
            `;
            output.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } catch (err) {
          if (window.Sentry) Sentry.captureException(err);
        }
        break;
      }
      case 'save': {
        try {
          const response = await fetch('/api/compass/save-chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapter_id: chapterId })
          });
          if (response.ok) {
            button.disabled = true;
            button.innerHTML = 'Saved &checkmark;';
          }
        } catch (err) {
          if (window.Sentry) Sentry.captureException(err);
        }
        break;
      }
    }
  });
})();
