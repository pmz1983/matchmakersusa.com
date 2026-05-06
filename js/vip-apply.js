/* /js/vip-apply.js — VIP application form submission
   Per BROKEN_CTAS_WAVE_1_CYCLE_2_SPEC v1 2026-05-06 §4.4
   Backend integration per BACKEND_CROSS_LANE_REQUIREMENTS_BRIEF v1 §2
*/

(function () {
  const form = document.getElementById('vip-apply-form');
  const status = document.getElementById('vip-apply-status');
  if (!form) return;

  // URL query param tier pre-selection
  const urlParams = new URLSearchParams(window.location.search);
  const tierParam = urlParams.get('tier');
  if (tierParam) {
    let value = tierParam;
    if (tierParam === 'studio-ai' || tierParam === 'studio-personalized') value = 'studio_personalized';
    const radio = form.querySelector(`input[name="tier"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('.v3-vip-apply-form__submit');
    const originalLabel = submitBtn ? submitBtn.innerHTML : null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Submitting…';
    }
    if (status) {
      status.textContent = '';
      status.removeAttribute('data-status');
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    if (payload.consent_contact === 'on') payload.consent_contact = true;

    try {
      const response = await fetch('/api/vip/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error('Submission failed: ' + response.status + ' ' + errorBody);
      }

      await response.json().catch(() => ({}));

      if (status) {
        status.setAttribute('data-status', 'success');
        status.innerHTML = `Your application is in. The matchmaker reads it within seven days &mdash; you will hear back regardless of the disposition. Confirmation has been sent to ${escapeHtml(payload.email || '')}.`;
      }

      form.style.display = 'none';
      if (form.parentElement) {
        form.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalLabel || 'Submit application';
      }
      if (status) {
        status.setAttribute('data-status', 'error');
        status.innerHTML = 'Submission couldn&rsquo;t complete. Please try again, or reach <a href="mailto:customerservice@matchmakersusa.com">customerservice@matchmakersusa.com</a> directly.';
      }
      if (window.Sentry) Sentry.captureException(err);
    }
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
