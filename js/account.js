/* /js/account.js — Account dashboard wiring
   Per MY_RELATIONSHIP_OS_DASHBOARD_SPEC v1 2026-05-06 §2.4
   Backend integration per BACKEND_CROSS_LANE_REQUIREMENTS_BRIEF v1 §6
*/

(function () {
  const tierLineEl = document.querySelector('[data-account-tier-line]');
  const focusEl = document.querySelector('[data-account-focus]');
  const focusBodyEl = document.querySelector('[data-account-focus-body]');
  const intentEl = document.querySelector('[data-account-intent]');
  const intentBodyEl = document.querySelector('[data-account-intent-body]');
  const insightsEl = document.querySelector('[data-account-insights]');
  const scriptsCountEl = document.querySelector('[data-account-scripts-count]');
  const scriptsBodyEl = document.querySelector('[data-account-scripts-body]');
  const suitabilityCountEl = document.querySelector('[data-account-suitability-count]');
  const suitabilityBodyEl = document.querySelector('[data-account-suitability-body]');
  const nextStepEl = document.querySelector('[data-account-next-step]');
  const nextStepBodyEl = document.querySelector('[data-account-next-step-body]');
  const accessDisplayEl = document.querySelector('[data-account-access-display]');
  const accessBodyEl = document.querySelector('[data-account-access-body]');
  const upgradeBlockEl = document.querySelector('[data-account-upgrade-block]');
  const vipBlockEl = document.querySelector('[data-account-vip-block]');

  const urlParams = new URLSearchParams(window.location.search);
  const tierFromUrl = urlParams.get('tier');
  const sessionFromUrl = urlParams.get('session_id');

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderFallbackFromUrl() {
    if (tierFromUrl === 'studio' || tierFromUrl === 'core' || tierFromUrl === 'studio_core') {
      if (tierLineEl) tierLineEl.innerHTML = 'Welcome. <em>Studio: the Playbook activated.</em>';
      if (accessDisplayEl) accessDisplayEl.innerHTML = '<em>Studio: the Playbook activated.</em>';
      if (accessBodyEl) accessBodyEl.innerHTML = 'You have Studio access. The Playbook in full + the Connection Compass across Foundation, Search, and Practice. Yours forever.';
      if (upgradeBlockEl) upgradeBlockEl.style.display = 'block';
    } else if (tierFromUrl === 'studio-ai' || tierFromUrl === 'studio_personalized' || tierFromUrl === 'personalized') {
      if (tierLineEl) tierLineEl.innerHTML = 'Welcome. <em>Studio AI: the system, personalized to you.</em>';
      if (accessDisplayEl) accessDisplayEl.innerHTML = '<em>Studio AI: the system, personalized to you.</em>';
      if (accessBodyEl) accessBodyEl.innerHTML = 'You have Studio AI access. The Playbook in full + the Connection Compass + Personalized Reading Path + Chapter-to-Life Mode + persistent context across sessions. Yours forever.';
      if (upgradeBlockEl) upgradeBlockEl.style.display = 'none';
    } else if (tierFromUrl === 'vip') {
      if (tierLineEl) tierLineEl.innerHTML = 'Welcome. <em>VIP.</em>';
      if (accessDisplayEl) accessDisplayEl.innerHTML = '<em>VIP.</em>';
      if (accessBodyEl) accessBodyEl.innerHTML = 'You have VIP access. A dedicated MatchMaker reads your Compass thread and applies the system across a 30-day engagement.';
      if (upgradeBlockEl) upgradeBlockEl.style.display = 'none';
      if (vipBlockEl) vipBlockEl.style.display = 'none';
    } else {
      if (tierLineEl) tierLineEl.innerHTML = 'Welcome. <em>Sign in or open the Compass to begin.</em>';
    }

    // Set sparse defaults for fields the Backend would fill
    if (insightsEl) {
      insightsEl.innerHTML = `
        <li class="v3-account-insight v3-account-insight--placeholder">
          <p class="v3-body"><em>The Compass hasn&rsquo;t held a read with you yet. Open the Compass and bring what you&rsquo;re noticing &mdash; the methodology meets you there.</em></p>
          <a href="/studio/compass/" class="v3-account-insight__cta">Open the Compass &rarr;</a>
        </li>
      `;
    }
    if (scriptsCountEl) scriptsCountEl.innerHTML = '<em>0</em>';
    if (suitabilityCountEl) suitabilityCountEl.innerHTML = '<em>0</em>';
  }

  async function loadDashboardFromBackend() {
    try {
      const response = await fetch('/api/account/dashboard');

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated; fallback render handles unsigned-in case gracefully
          renderFallbackFromUrl();
          return;
        }
        throw new Error('Dashboard fetch failed: ' + response.status);
      }

      const data = await response.json();
      renderDashboard(data);
    } catch (err) {
      if (window.Sentry) Sentry.captureException(err);
      renderFallbackFromUrl();
    }
  }

  function renderDashboard(data) {
    if (tierLineEl && data.tier_label) {
      tierLineEl.innerHTML = `Welcome back. <em>${escapeHtml(data.tier_label)}.</em>`;
    }

    if (focusEl && data.current_focus) {
      focusEl.innerHTML = `<em>${escapeHtml(data.current_focus.headline)}</em>`;
      if (focusBodyEl) focusBodyEl.textContent = data.current_focus.body || '';
    }

    if (intentEl && data.active_intent) {
      intentEl.innerHTML = `<em>${escapeHtml(data.active_intent.label)}.</em>`;
      if (intentBodyEl) intentBodyEl.textContent = data.active_intent.body || '';
    }

    if (insightsEl && Array.isArray(data.recent_insights)) {
      if (data.recent_insights.length === 0) {
        insightsEl.innerHTML = `
          <li class="v3-account-insight v3-account-insight--placeholder">
            <p class="v3-body"><em>The Compass hasn&rsquo;t held a read with you yet. Open the Compass and bring what you&rsquo;re noticing &mdash; the methodology meets you there.</em></p>
            <a href="/studio/compass/" class="v3-account-insight__cta">Open the Compass &rarr;</a>
          </li>
        `;
      } else {
        insightsEl.innerHTML = data.recent_insights.map((insight) => `
          <li class="v3-account-insight">
            <p class="v3-account-insight__date">${escapeHtml(insight.date_relative || '')}</p>
            <p class="v3-account-insight__excerpt">${escapeHtml(insight.excerpt || '')}</p>
            <p class="v3-account-insight__trail"><em>Grounded in: ${escapeHtml(insight.trail_chapter || '')} &middot; ${escapeHtml(insight.trail_framework || '')}</em></p>
            <a href="${escapeHtml(insight.link || '/studio/compass/')}" class="v3-account-insight__cta">Return to this read &rarr;</a>
          </li>
        `).join('');
      }
    }

    if (scriptsCountEl && data.scripts_count != null) {
      scriptsCountEl.innerHTML = `<em>${escapeHtml(String(data.scripts_count))}</em>`;
    }

    if (suitabilityCountEl && data.suitability_count != null) {
      suitabilityCountEl.innerHTML = `<em>${escapeHtml(String(data.suitability_count))}</em>`;
    }

    if (nextStepEl && data.next_step) {
      nextStepEl.innerHTML = `<em>${escapeHtml(data.next_step.headline)}</em>`;
      if (nextStepBodyEl) nextStepBodyEl.textContent = data.next_step.body || '';
    }

    if (accessDisplayEl && data.access) {
      accessDisplayEl.innerHTML = `<em>${escapeHtml(data.access.tier_canonical)}.</em>`;
      if (accessBodyEl) accessBodyEl.innerHTML = data.access.body || '';

      if (upgradeBlockEl) {
        upgradeBlockEl.style.display = (data.access.tier_canonical === 'Studio: the Playbook activated') ? 'block' : 'none';
      }
    }
  }

  loadDashboardFromBackend();
})();
