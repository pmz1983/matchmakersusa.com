/**
 * Wave 1.5 Assessments controller — 5 NEW assessment surfaces
 *
 * Per CC Assessment 3-Assessment Full Question Copy v1 (2026-05-06):
 * - Search Assessment (Q1-Q17)
 * - Foundation Assessment (Q1-Q11)
 * - Practice Individual Assessment (Q1-Q7)
 * - Practice Couples Assessment (Q1-Q7)
 * - Practice chooser surface (no form; navigation only)
 *
 * Responsibilities:
 * - LMFT acknowledgment gate (pre-Q1; reveals form on click)
 * - Form submission to Backend Edge Function
 * - Wave 1 fallback: localStorage state persistence + graceful close-section reveal
 *
 * Backend integration per Backend Cross-Lane Brief Deliverable #16 §6:
 *   POST /api/connection-code/{search|foundation|practice-individual|practice-couples}-assessment
 * Wave 1.5+ wires Edge Functions; Wave 1 ship: form submits to endpoint;
 * on 404 (Backend not yet wired) show graceful "Reading queued" close section.
 *
 * Voice Register v1.5 + LMFT 3-layer Layer 3 always-on preserved.
 */

(function() {
  'use strict';

  // ──────────────────────────────────────────────────────────────────────
  // LMFT acknowledgment gate
  // ──────────────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-lmft-acknowledge]').forEach(function(button) {
    button.addEventListener('click', function() {
      var assessmentName = button.getAttribute('data-lmft-acknowledge');
      var form = document.querySelector('[data-assessment-form="' + assessmentName + '"]');
      var lmftGate = document.querySelector('[data-lmft-gate="' + assessmentName + '"]');

      if (form) {
        form.setAttribute('data-form-revealed', 'true');
        try {
          localStorage.setItem('mm_assessment_lmft_' + assessmentName, 'acknowledged');
        } catch (err) {
          if (window.Sentry) Sentry.captureException(err);
        }
        if (lmftGate) {
          lmftGate.style.display = 'none';
        }
        var firstQuestion = form.querySelector('.v3-assessment-question');
        if (firstQuestion) {
          firstQuestion.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Form submission — POST to Backend Edge Function
  // ──────────────────────────────────────────────────────────────────────
  document.querySelectorAll('[data-assessment-form]').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var assessmentName = form.getAttribute('data-assessment-form');
      var pillar = form.getAttribute('data-pillar');
      var submitButton = form.querySelector('button[type="submit"]');
      var originalLabel = submitButton ? submitButton.innerHTML : '';

      var formData = new FormData(form);
      var payload = { _assessment_name: assessmentName, _pillar: pillar };

      var practiceVariant = form.getAttribute('data-practice-variant');
      if (practiceVariant) {
        payload._practice_variant = practiceVariant;
      }

      // Map FormData to payload (multi-select checkboxes collected as arrays)
      formData.forEach(function(value, key) {
        if (key.endsWith('.modes')) {
          if (!payload[key]) payload[key] = [];
          if (Array.isArray(payload[key])) {
            payload[key].push(value);
          }
        } else {
          payload[key] = value;
        }
      });

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = 'Submitting the Reading&hellip;';
      }

      // Endpoint per Master Scope §9
      var endpointPath = assessmentName.replace(/_/g, '-');
      var endpoint = '/api/connection-code/' + endpointPath + '-assessment';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(response) {
        if (response.ok) {
          return response.json().catch(function() { return {}; });
        }
        if (response.status === 404) {
          // Wave 1 fallback: Backend Edge Function not yet wired — graceful queue
          return { _wave_1_fallback: true };
        }
        throw new Error('Submission failed: ' + response.status);
      })
      .then(function() {
        try {
          localStorage.setItem('mm_assessment_complete_' + assessmentName, JSON.stringify({
            completed_at: new Date().toISOString(),
            email: payload.email || null
          }));
        } catch (err) {
          if (window.Sentry) Sentry.captureException(err);
        }
        revealClose(assessmentName);
      })
      .catch(function(err) {
        if (window.Sentry) Sentry.captureException(err);
        // Wave 1 fallback: still reveal close section (catches lead via email)
        revealClose(assessmentName);
      });
    });
  });

  function revealClose(assessmentName) {
    var closeSection = document.querySelector('[data-assessment-close="' + assessmentName + '"]');
    var form = document.querySelector('[data-assessment-form="' + assessmentName + '"]');
    if (closeSection) {
      closeSection.removeAttribute('hidden');
      setTimeout(function() {
        closeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    if (form) {
      form.style.display = 'none';
    }
  }
})();
