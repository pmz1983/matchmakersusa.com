/* ═══════════════════════════════════════════════════════════════════════════
   MATCHMAKERS — studio-script-builder.js
   Studio Script Builder (/studio/script-builder/) — client-side template engine
   Per Paul §5 LOCK: TEMPLATED, not AI. Zero backend dependency.
   Mission-critical hot-fix sprint per Paul §5 directive 2026-05-03
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Phase × Output catalog (templated; no AI) ─────────────────────────── */
  /* Each (phase, output) returns a structured calibration the user can adapt. */

  var TEMPLATES = {
    'opener': {
      'calibration': {
        title: 'The Opener — Calibration register',
        body: function (ctx) {
          return [
            'Anchor on something specific you read in their profile — a phrase, a place, a stated value. Generic openers fail every framework the methodology recognizes.',
            '',
            'Lead with discernment, not interest. The institutional register reads as: "I noticed you " + [specific signal observed] + ". " + [a question that asks them to elaborate, not a compliment].',
            '',
            'Avoid: How was your weekend / Hey there / You\'re beautiful. These do not calibrate against the framework.',
            ''
          ].concat(addContextNotes(ctx)).join('\n');
        }
      },
      'opening': {
        title: 'The Opener — Opening line draft',
        body: function (ctx) {
          var who = ctx.who || 'them';
          var detail = ctx.detail || 'the specific thing you noticed';
          return [
            'Hi ' + who + ' — your profile mentions ' + detail + '. I read that as ' + (ctx.read || '[your reading of what it suggests about their orientation]') + '. Curious how you came to it — was that always the orientation, or did it surface more recently?',
            '',
            '— Note: The methodology asks you to lead with structured curiosity, not flattery. Adjust phrasing to your voice; preserve the structure.'
          ].join('\n');
        }
      }
    },
    'momentum': {
      'calibration': {
        title: 'Conversation momentum — Calibration register',
        body: function (ctx) {
          return [
            'Momentum is not about volume. It is about the cadence between question, answer, and the next question that takes the conversation deeper.',
            '',
            'Read the response speed and depth: short and fast = surface engagement; longer and slower = considered orientation. Match the register; do not flatten it.',
            '',
            'If they answer your question without asking one back, that is a signal. If three turns pass without reciprocity, the framework calls for a soft pivot to a closer or a deliberate pause.',
            ''
          ].concat(addContextNotes(ctx)).join('\n');
        }
      },
      'opening': {
        title: 'Conversation momentum — Pivot line',
        body: function (ctx) {
          return [
            'Reading our last few exchanges, I notice we are circling [topic]. I would rather pull on a thread that matters: ' + (ctx.detail || '[the thread that matters from what they have shared]') + '. What does that look like for you in practice?',
            '',
            '— Note: Use this when momentum has flattened. The methodology calls for deliberate depth-shifts when the conversation surface plateaus.'
          ].join('\n');
        }
      }
    },
    'date-ask': {
      'calibration': {
        title: 'The date ask — Calibration register',
        body: function (ctx) {
          return [
            'A date ask is not a request for permission. It is a calibrated proposal grounded in what the conversation has already established.',
            '',
            'The framework requires: (1) a specific reference to something the conversation has established, (2) a concrete proposal — time, place, structure, (3) a soft frame that reads as confident, not desperate.',
            '',
            'Avoid open-ended "we should grab a drink sometime" patterns. Those do not calibrate.',
            ''
          ].concat(addContextNotes(ctx)).join('\n');
        }
      },
      'opening': {
        title: 'The date ask — Proposal line',
        body: function (ctx) {
          var thread = ctx.detail || '[the thread you have been pulling on together]';
          return [
            'Given everything we have circled around ' + thread + ' — I would rather sit with a coffee and continue the conversation in person. Are you free ' + (ctx.when || '[Thursday or Saturday afternoon]') + '? I have a place in mind that suits the register.',
            '',
            '— Note: Specific. Concrete. Confidently framed. Adjust the day/place to your context; preserve the structure.'
          ].join('\n');
        }
      }
    },
    'recovery': {
      'calibration': {
        title: 'Recovery — Calibration register',
        body: function (ctx) {
          return [
            'When a thread goes silent, the framework calls for one careful re-open — not three. The institutional register treats silence as data, not failure.',
            '',
            'Read: did they go silent mid-thread (likely circumstantial) or after a question that touched something deeper (likely orientation)? The diagnosis informs the move.',
            '',
            'If circumstantial: a low-stakes touch that re-opens the thread without explanation. If orientation-related: leave it. The framework does not chase.',
            ''
          ].concat(addContextNotes(ctx)).join('\n');
        }
      },
      'opening': {
        title: 'Recovery — Re-open line (single attempt)',
        body: function (ctx) {
          var thread = ctx.detail || '[the thread you were on]';
          return [
            'Hey — circling back on ' + thread + '. I had a thought I have been holding: ' + (ctx.read || '[the specific thought, one sentence]') + '. Curious whether it lands.',
            '',
            '— Note: One attempt. If no response within a reasonable window, the framework lets it rest. Do not chase.'
          ].join('\n');
        }
      }
    },
    'pivot-to-call': {
      'calibration': {
        title: 'Pivot to call — Calibration register',
        body: function (ctx) {
          return [
            'A pivot to voice or video is the methodology\'s way of compressing weeks of texting into a single signal-rich exchange.',
            '',
            'The framework reads: text reveals composition; voice reveals cadence; video reveals presence. Each layer adds discernment data the prior could not.',
            '',
            'Frame the pivot as preference, not test. "I would rather hear how you talk about this" reads stronger than "we should hop on a call sometime".',
            ''
          ].concat(addContextNotes(ctx)).join('\n');
        }
      },
      'opening': {
        title: 'Pivot to call — Proposal line',
        body: function (ctx) {
          return [
            'I have enjoyed the cadence of this — and I would rather hear you talk about ' + (ctx.detail || '[the thread you have been on]') + ' than read you. Free for fifteen minutes ' + (ctx.when || '[a weekday evening or weekend afternoon]') + '?',
            '',
            '— Note: Bounded duration ("fifteen minutes") calibrates against the institutional register. Preserve the structure; adjust the wording.'
          ].join('\n');
        }
      }
    }
  };

  function addContextNotes(ctx) {
    var notes = [];
    if (ctx.who) notes.push('Subject: ' + ctx.who);
    if (ctx.detail) notes.push('Anchor signal: ' + ctx.detail);
    if (ctx.read) notes.push('Your reading: ' + ctx.read);
    if (ctx.when) notes.push('Timing window: ' + ctx.when);
    if (notes.length) {
      notes.unshift('');
      notes.unshift('— Context the framework noted —');
    }
    return notes;
  }

  /* ── DOM render ─────────────────────────────────────────────────────── */

  var formEl, outputEl;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function render(phaseKey, registerKey, ctx) {
    var t = TEMPLATES[phaseKey] && TEMPLATES[phaseKey][registerKey];
    if (!t) return;

    outputEl.innerHTML = '';
    var card = el('article', 'studio-tool-output');
    card.setAttribute('aria-live', 'polite');

    var eyebrow = el('p', 'studio-tool-output__eyebrow', 'Script Builder · output');
    var rule = document.createElement('hr');
    rule.className = 'studio-tool-output__rule';
    rule.setAttribute('aria-hidden', 'true');
    var title = el('h3', 'studio-tool-output__title', t.title);
    var body = el('div', 'studio-tool-output__body');
    body.innerHTML = String(t.body(ctx)).split('\n').map(function (line) {
      if (!line) return '<p class="studio-tool-output__spacer">&nbsp;</p>';
      return '<p>' + escapeHtml(line) + '</p>';
    }).join('');

    var meta = el('p', 'studio-tool-output__meta',
      'Templated against the methodology corpus. The framework is the framework; the words are yours to refine.');

    card.appendChild(eyebrow);
    card.appendChild(rule);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(meta);

    outputEl.appendChild(card);
    outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init() {
    formEl = document.getElementById('studio-script-form');
    outputEl = document.getElementById('studio-script-output');
    if (!formEl || !outputEl) return;

    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(formEl);
      var phase = String(fd.get('phase') || '').trim();
      var register = String(fd.get('register') || 'calibration').trim();
      var ctx = {
        who: String(fd.get('who') || '').trim(),
        detail: String(fd.get('detail') || '').trim(),
        read: String(fd.get('read') || '').trim(),
        when: String(fd.get('when') || '').trim()
      };
      if (!phase) return;
      render(phase, register, ctx);
    });

    formEl.addEventListener('reset', function () {
      outputEl.innerHTML = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
