/* ═══════════════════════════════════════════════════════════════════════════
   MATCHMAKERS — studio-suitability.js
   Studio Suitability (/studio/suitability/) — client-side reading template engine
   Per Paul §5 LOCK: TEMPLATED, not AI. Zero backend dependency.
   Mission-critical hot-fix sprint per Paul §5 directive 2026-05-03
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Signal × Reading catalog (templated) ─────────────────────────────── */
  /* Five canonical signals × five intent classes; reads return structured
     judgment with the methodology's discernment register. */

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* Cadence × intent reading library — institutional discernment register */
  var CADENCE_READINGS = {
    'fast-shallow': {
      label: 'Fast cadence · short content',
      reading: 'Surface engagement. They are present in the conversation but the depth has not yet been earned. Read this as available but uncalibrated — the framework calls for a deliberate depth-shift on your side, not theirs.',
      ask: 'A specific question that requires more than three sentences to answer.'
    },
    'fast-deep': {
      label: 'Fast cadence · considered content',
      reading: 'High-signal engagement. They are reading and answering carefully without making you wait. The methodology recognizes this as the most calibrating register — match it; do not flatten it. Do not slow your replies artificially.',
      ask: 'A question that pulls on their orientation, not their biography.'
    },
    'slow-shallow': {
      label: 'Slow cadence · short content',
      reading: 'Diminished interest or external constraint. The framework cannot resolve which from cadence alone — pattern over time will. Hold register; offer one structured question; let the next turn reveal which it is.',
      ask: 'A direct question that names the cadence shift without making it a complaint.'
    },
    'slow-deep': {
      label: 'Slow cadence · considered content',
      reading: 'Deliberation. They are taking the time to compose. The methodology reads this as a higher-orientation register than fast-shallow — slow-deep usually correlates with marriage-tier and long-term Intent.',
      ask: 'A question that gives them room to develop the thread on their cadence.'
    },
    'silent': {
      label: 'No response within reasonable window',
      reading: 'Silence is data. The framework treats one missed response as circumstantial; two as a signal; three as orientation. Diagnose which based on the prior turn — did your last message push depth, or was it filler?',
      ask: 'One careful re-open, no more. If silence follows, the framework lets it rest.'
    }
  };

  var CONSISTENCY_READINGS = {
    'consistent': {
      label: 'Consistent across days / contexts',
      reading: 'High institutional reliability. They show up the same in different conditions. The methodology recognizes this as the strongest predictor the framework reads — more than any specific content.'
    },
    'mood-variable': {
      label: 'Variable by mood / time of day',
      reading: 'Read this as composition, not deception — most people are mood-variable on text. The framework asks you to read which version is the orientation register: the considered one or the casual one.'
    },
    'context-dependent': {
      label: 'Different in private vs. public / app vs. SMS',
      reading: 'Code-switching. Common; not disqualifying. The methodology asks: which register do they hold under stress? That is the orientation register; the rest is composition.'
    },
    'sharp-shift': {
      label: 'A sharp shift after a specific event',
      reading: 'A discontinuity. The framework asks you to name the event in your own reading — was it something you said, something they revealed, or something external? The diagnosis informs the move.'
    }
  };

  var INTENT_READINGS = {
    'casual': 'Read for compatibility, not conversion. The methodology does not pressure casual Intent toward marriage register; that is not the framework. Honor the stated Intent.',
    'long-term': 'Read for orientation alignment over the next 12 months. Long-term Intent calls for the framework to test stability: do they show up the same on day 30 as day 3?',
    'marriage': 'Read for institutional posture. Marriage Intent calls for the deepest discernment register the methodology offers — values, family structure, geographic bounds, financial register, religious/cultural alignment.',
    'fall-in-love': 'Read for the fall-in-love conditions: presence, vulnerability, reciprocity. The framework does not predict love; it surfaces the conditions under which love becomes possible.',
    'unsure': 'Read for what their behavior reveals their Intent to be — which is often different from what they have stated. The methodology trusts pattern over self-report when the two disagree.'
  };

  function buildReading(input) {
    var blocks = [];

    blocks.push({
      eyebrow: 'Subject',
      title: input.subject || '[unnamed subject]',
      body: input.summary
        ? input.summary
        : 'No subject summary provided. The reading proceeds on the cadence and consistency signals you flagged.'
    });

    if (input.cadence && CADENCE_READINGS[input.cadence]) {
      var c = CADENCE_READINGS[input.cadence];
      blocks.push({
        eyebrow: 'Cadence signal',
        title: c.label,
        body: c.reading,
        suffix: 'The framework asks: ' + c.ask
      });
    }

    if (input.consistency && CONSISTENCY_READINGS[input.consistency]) {
      var k = CONSISTENCY_READINGS[input.consistency];
      blocks.push({
        eyebrow: 'Consistency signal',
        title: k.label,
        body: k.reading
      });
    }

    if (input.intent && INTENT_READINGS[input.intent]) {
      blocks.push({
        eyebrow: 'Intent register',
        title: capitalize(input.intent.replace('-', ' ')),
        body: INTENT_READINGS[input.intent]
      });
    }

    if (input.notes) {
      blocks.push({
        eyebrow: 'Operator notes',
        title: 'What you have noticed',
        body: input.notes,
        suffix: 'These observations weight the reading. The methodology does not override what the operator has seen with their own eyes.'
      });
    }

    blocks.push({
      eyebrow: 'Discernment summary',
      title: 'The reading',
      body: composeSummary(input)
    });

    return blocks;
  }

  function capitalize(s) {
    return String(s || '').replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
  }

  function composeSummary(input) {
    var parts = [];
    var cadenceTag = (input.cadence || '').replace('-', ' ');
    var consistencyTag = (input.consistency || '').replace('-', ' ');
    var intentTag = (input.intent || '').replace('-', ' ');

    if (input.cadence && input.consistency) {
      parts.push('A ' + cadenceTag + ' cadence sitting on ' + consistencyTag + ' consistency.');
    } else if (input.cadence) {
      parts.push('A ' + cadenceTag + ' cadence; consistency not yet read.');
    } else if (input.consistency) {
      parts.push(capitalize(consistencyTag) + ' consistency; cadence not yet read.');
    }

    if (input.intent) {
      parts.push('Stated Intent: ' + intentTag + '. The methodology reads pattern against the Intent — alignment is the question, not the answer.');
    }

    parts.push('The framework does not decide. It surfaces what is there. The next move is yours: hold register, deepen, or step back.');
    parts.push('Suitors are reviewed, not curated.');
    return parts.join(' ');
  }

  function render(blocks) {
    var output = document.getElementById('studio-suitability-output');
    if (!output) return;
    output.innerHTML = '';

    var card = el('article', 'studio-tool-output');
    card.setAttribute('aria-live', 'polite');

    var topEyebrow = el('p', 'studio-tool-output__eyebrow', 'Suitability · structured reading');
    var rule = document.createElement('hr');
    rule.className = 'studio-tool-output__rule';
    rule.setAttribute('aria-hidden', 'true');
    var topTitle = el('h3', 'studio-tool-output__title', 'The methodology has read what you described.');
    card.appendChild(topEyebrow);
    card.appendChild(rule);
    card.appendChild(topTitle);

    blocks.forEach(function (b) {
      var section = el('section', 'studio-tool-output__section');
      section.appendChild(el('p', 'studio-tool-output__section-eyebrow', b.eyebrow));
      section.appendChild(el('h4', 'studio-tool-output__section-title', b.title));
      section.appendChild(el('p', 'studio-tool-output__section-body', b.body));
      if (b.suffix) {
        var s = el('p', 'studio-tool-output__section-suffix');
        s.innerHTML = '<em>' + escapeHtml(b.suffix) + '</em>';
        section.appendChild(s);
      }
      card.appendChild(section);
    });

    var meta = el('p', 'studio-tool-output__meta',
      'Templated against the methodology corpus. The reading surfaces; the choice is yours. Suitors are reviewed, not curated.');
    card.appendChild(meta);

    output.appendChild(card);
    output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    var form = document.getElementById('studio-suitability-form');
    var output = document.getElementById('studio-suitability-output');
    if (!form || !output) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var input = {
        subject: String(fd.get('subject') || '').trim(),
        summary: String(fd.get('summary') || '').trim(),
        cadence: String(fd.get('cadence') || '').trim(),
        consistency: String(fd.get('consistency') || '').trim(),
        intent: String(fd.get('intent') || '').trim(),
        notes: String(fd.get('notes') || '').trim()
      };
      var blocks = buildReading(input);
      render(blocks);
    });

    form.addEventListener('reset', function () {
      output.innerHTML = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
