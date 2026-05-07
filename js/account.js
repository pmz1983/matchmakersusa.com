/* /js/account.js — Account dashboard wiring (Wave 2 sprint refit)
   Per MY_RELATIONSHIP_OS_DASHBOARD_SPEC v1 2026-05-06 §2.4
   Backend integration per BACKEND_CROSS_LANE_REQUIREMENTS_BRIEF v1 §6 +
   account-dashboard EF v1 (Backend Atlas correspondence W15 + Wave 2 wiring)

   Auth model:
   - Authenticated users: POST /api/account/dashboard with { email, session_id } from
     Stripe success URL params; Backend proxy handles SECRET_KEY auth → Supabase EF
   - Unauthenticated users (or 401 / network error): URL-param fallback rendering
     preserved (Welcome / tier label / sparse defaults)

   Response shape support:
   - NEW EF response (entitlements_summary + methodology_state + recent_purchases) —
     translated via translateBackendResponse() into legacy UI render shape
   - Legacy response (tier_label / current_focus / active_intent / recent_insights /
     scripts_count / suitability_count / next_step / access) — passed through directly
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
  const emailFromUrl = urlParams.get('email');

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

  /**
   * Translate Backend account-dashboard EF v1 response into legacy UI render shape.
   * EF response: { found, email, user_id, entitlements_summary, recent_purchases, methodology_state, version, req_id }
   * UI shape:    { tier_label, active_intent, recent_insights, access, scripts_count, suitability_count, ... }
   */
  function translateBackendResponse(efData) {
    if (!efData || efData.found === false) return null;

    const ent = efData.entitlements_summary || {};
    const ms = efData.methodology_state || null;

    // Tier-canonical mapping per Voice Register v1.5 §5.L verb-form discipline +
    // Q2 R-D Synthesis Studio + Studio AI label canonical
    let tierCanonical = null;
    let tierLabelShort = null;
    let upgradeBlockVisible = false;
    if (ent.studio_personalized) {
      tierCanonical = 'Studio AI: the system, personalized to you';
      tierLabelShort = 'Studio AI: the system, personalized to you';
      upgradeBlockVisible = false;
    } else if (ent.studio_core) {
      tierCanonical = 'Studio: the Playbook activated';
      tierLabelShort = 'Studio: the Playbook activated';
      upgradeBlockVisible = true;
    } else if (ent.playbook_only) {
      tierCanonical = 'The Playbook';
      tierLabelShort = 'The Playbook';
      upgradeBlockVisible = false;
    } else if (ent.vip_tier) {
      const vipLabel = ent.vip_tier === 'diamond' ? 'Diamond' : ent.vip_tier === 'premier' ? 'VIP Premier' : 'VIP';
      tierCanonical = vipLabel;
      tierLabelShort = vipLabel;
      upgradeBlockVisible = false;
    }

    // Active intent — mapped from methodology_state
    const intentMap = {
      long_term: 'Long-term',
      marriage: 'Marriage',
      fall_in_love: 'Fall in Love',
      casual: 'Casual',
      friendship: 'Friendship',
      companionship: 'Companionship',
      not_sure: 'Not Sure',
      short_term: 'Short-term',
      open_to_all: 'Open to All'
    };
    const activeIntent = ms && ms.active_intent ? {
      label: intentMap[ms.active_intent] || ms.active_intent,
      body: ''
    } : null;

    // Active phase — mapped from methodology_state
    const phaseMap = {
      profile: 'Profile',
      connection: 'Connection',
      courtship: 'Courtship',
      commitment: 'Commitment',
      ongoing: 'Ongoing'
    };
    const currentFocus = ms && ms.active_phase ? {
      headline: phaseMap[ms.active_phase] || ms.active_phase,
      body: 'The methodology meets you in this Phase. Open the Compass to bring what you&rsquo;re noticing.'
    } : null;

    // Recent insights — derived from saved_chapters (if present)
    const recentInsights = ms && Array.isArray(ms.saved_chapters) ? ms.saved_chapters.slice(0, 3).map((ch) => ({
      date_relative: '',
      excerpt: ch && ch.excerpt ? ch.excerpt : '',
      trail_chapter: ch && ch.chapter_name ? ch.chapter_name : '',
      trail_framework: ch && ch.framework_name ? ch.framework_name : '',
      link: ch && ch.link ? ch.link : '/studio/compass/'
    })) : [];

    // Counts default to 0 (Backend will surface scripts/suitability in a later cycle)
    const scriptsCount = 0;
    const suitabilityCount = 0;

    return {
      tier_label: tierLabelShort,
      access: tierCanonical ? { tier_canonical: tierCanonical, body: descBodyForTier(tierCanonical), upgrade_visible: upgradeBlockVisible } : null,
      active_intent: activeIntent,
      current_focus: currentFocus,
      recent_insights: recentInsights,
      scripts_count: scriptsCount,
      suitability_count: suitabilityCount,
      next_step: nextStepForState(ent, ms)
    };
  }

  function descBodyForTier(tierCanonical) {
    if (tierCanonical === 'Studio: the Playbook activated') return 'You have Studio access. The Playbook in full + the Connection Compass across Foundation, Search, and Practice. Yours forever.';
    if (tierCanonical === 'Studio AI: the system, personalized to you') return 'You have Studio AI access. The Playbook in full + the Connection Compass + Personalized Reading Path + Chapter-to-Life Mode + persistent context across sessions. Yours forever.';
    if (tierCanonical === 'The Playbook') return 'You have the Playbook in full. Twenty-seven chapters across three contexts. Yours forever.';
    if (tierCanonical === 'Diamond') return 'You have Diamond access. A dedicated MatchMaker applies the methodology with you. Letters letterpress. Sessions video. Audits annual.';
    if (tierCanonical && tierCanonical.indexOf('VIP') === 0) return 'You have VIP access. A dedicated MatchMaker reads your Compass thread and applies the system across a thirty-day engagement.';
    return '';
  }

  function nextStepForState(ent, ms) {
    if (ms && ms.active_phase) {
      return {
        headline: 'Open the Compass and bring what you&rsquo;re noticing.',
        body: 'The methodology meets you where you are. Whatever&rsquo;s surfacing today &mdash; the script you need, the pattern that won&rsquo;t settle, the chapter that speaks to your moment &mdash; the Compass holds it.'
      };
    }
    return {
      headline: 'Begin a Reading.',
      body: 'The methodology proceeds from a Reading. Begin the Foundation, Search, or Practice Assessment to locate yourself in the system.'
    };
  }

  async function loadDashboardFromBackend() {
    try {
      // Build request body — pass session_id / email when present (Stripe success URL).
      // Backend proxy resolves auth + queries account-dashboard EF with secret bearer token.
      const body = {};
      if (emailFromUrl) body.email = emailFromUrl;
      if (sessionFromUrl) body.session_id = sessionFromUrl;

      const response = await fetch('/api/account/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 404) {
          // Not authenticated or proxy not yet wired — fallback render handles
          renderFallbackFromUrl();
          return;
        }
        throw new Error('Dashboard fetch failed: ' + response.status);
      }

      const data = await response.json();

      // Detect response shape: NEW EF (entitlements_summary key) vs LEGACY (tier_label key)
      let renderData = data;
      if (data && data.entitlements_summary) {
        renderData = translateBackendResponse(data);
        if (!renderData) {
          // EF returned found:false — render fallback from URL params
          renderFallbackFromUrl();
          return;
        }
      }

      renderDashboard(renderData);
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
        const showUpgrade = data.access.upgrade_visible !== undefined
          ? data.access.upgrade_visible
          : (data.access.tier_canonical === 'Studio: the Playbook activated');
        upgradeBlockEl.style.display = showUpgrade ? 'block' : 'none';
      }
    }
  }

  loadDashboardFromBackend();
})();
