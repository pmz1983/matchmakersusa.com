/* ═══════════════════════════════════════════════════
   CONNECTION CODE ENGINE — Stage 1-7 SPA
   v3.0 MVP Day 2 — 2026-05-02
   localStorage state · hash-routed stages · accessible
   ═══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'cc-state-v1';
  const TOTAL_STAGES = 7;

  // ── Question banks (Cartier voice; methodology-grounded) ──

  const INTENTS = ['Long-Term', 'Marriage', 'Fall in Love', 'Casual', 'Friendship', 'Companionship', 'Not Sure', 'Short-Term', 'Open to All'];

  // 9-Intent assessment — 7 condensed questions per AI Umbrella MVP §1.1
  const INTENT_QUESTIONS = [
    {
      id: 'i1',
      prompt: 'A year from now, the result you would call a real outcome looks most like',
      hint: 'Choose the answer closest to the read you arrive with.',
      options: [
        { label: 'A relationship that earns long-term standing.', weights: { 'Long-Term': 3, 'Marriage': 1 } },
        { label: 'A relationship that becomes a marriage.', weights: { 'Marriage': 3, 'Long-Term': 1 } },
        { label: 'Falling in love, deeply, with the right person.', weights: { 'Fall in Love': 3, 'Long-Term': 1 } },
        { label: 'Connection that is honest, present, and unhurried.', weights: { 'Companionship': 3, 'Long-Term': 1 } },
        { label: 'I am still calibrating what the right outcome is.', weights: { 'Not Sure': 3, 'Open to All': 1 } }
      ]
    },
    {
      id: 'i2',
      prompt: 'The pace that feels honest to you right now is',
      options: [
        { label: 'Deliberate. Worth the time it takes.', weights: { 'Long-Term': 2, 'Marriage': 2 } },
        { label: 'Steady. Not rushed, not held back.', weights: { 'Long-Term': 2, 'Companionship': 1 } },
        { label: 'Open. I want to feel the real thing when it arrives.', weights: { 'Fall in Love': 3 } },
        { label: 'Light. Connection without the long horizon.', weights: { 'Casual': 3, 'Short-Term': 1 } },
        { label: 'Patient. The right cadence is the one that earns it.', weights: { 'Companionship': 2, 'Long-Term': 1 } }
      ]
    },
    {
      id: 'i3',
      prompt: 'When a connection ends, the part that registers most is',
      options: [
        { label: 'Whether it could have been the long one.', weights: { 'Long-Term': 3 } },
        { label: 'Whether it could have led to commitment.', weights: { 'Marriage': 3 } },
        { label: 'Whether it ever became real.', weights: { 'Fall in Love': 3 } },
        { label: 'Whether it was honest while it lasted.', weights: { 'Casual': 2, 'Short-Term': 2 } },
        { label: 'Whether the company itself was good.', weights: { 'Friendship': 3, 'Companionship': 2 } }
      ]
    },
    {
      id: 'i4',
      prompt: 'The kind of presence you are most drawn to is',
      options: [
        { label: 'Steady and serious about a future.', weights: { 'Long-Term': 2, 'Marriage': 2 } },
        { label: 'Emotionally open and ready to be known.', weights: { 'Fall in Love': 3 } },
        { label: 'Easy company without inflated expectation.', weights: { 'Casual': 2, 'Friendship': 2 } },
        { label: 'A real partner, not a romantic projection.', weights: { 'Companionship': 3, 'Long-Term': 1 } },
        { label: 'I will read it when I meet it.', weights: { 'Open to All': 3, 'Not Sure': 1 } }
      ]
    },
    {
      id: 'i5',
      prompt: 'On the question of marriage, your current position is',
      options: [
        { label: 'Marriage is the explicit outcome I am calibrating for.', weights: { 'Marriage': 4 } },
        { label: 'Marriage is welcome, but standing matters more than form.', weights: { 'Long-Term': 3, 'Marriage': 1 } },
        { label: 'Marriage is not the frame I am thinking in right now.', weights: { 'Casual': 1, 'Companionship': 2, 'Friendship': 1 } },
        { label: 'Marriage is something I am still working out.', weights: { 'Not Sure': 3 } },
        { label: 'I am open to where the right connection takes it.', weights: { 'Open to All': 3 } }
      ]
    },
    {
      id: 'i6',
      prompt: 'The honest read on what you want from new connections in the next ninety days is',
      options: [
        { label: 'Identify the one connection worth the long horizon.', weights: { 'Long-Term': 3, 'Marriage': 1 } },
        { label: 'Find someone who can become a partner.', weights: { 'Marriage': 2, 'Long-Term': 2 } },
        { label: 'Meet someone the read says is real.', weights: { 'Fall in Love': 3 } },
        { label: 'Keep dating light and unburdened.', weights: { 'Casual': 3, 'Short-Term': 1 } },
        { label: 'Build a friendship that may or may not become more.', weights: { 'Friendship': 3, 'Companionship': 1 } }
      ]
    },
    {
      id: 'i7',
      prompt: 'If someone asked you to name the kind of dating life you are calibrating for, you would say',
      options: [
        { label: 'A long, serious connection.', weights: { 'Long-Term': 3 } },
        { label: 'The relationship that becomes a marriage.', weights: { 'Marriage': 3 } },
        { label: 'The connection that becomes love.', weights: { 'Fall in Love': 3 } },
        { label: 'A short, honest connection.', weights: { 'Short-Term': 3, 'Casual': 1 } },
        { label: 'Friendship, with the door left open.', weights: { 'Friendship': 3, 'Companionship': 1 } },
        { label: 'I am open to where the right read takes it.', weights: { 'Open to All': 3 } }
      ]
    }
  ];

  // 5-Phase calibration — 4 questions per AI Umbrella MVP §1.1
  const PHASES = ['Profile', 'Connection', 'Courtship', 'Commitment', 'Ongoing'];

  const PHASE_QUESTIONS = [
    {
      id: 'p1',
      prompt: 'The work in front of you most accurately is',
      options: [
        { label: 'Defining the standing I am bringing to dating.', phase: 'Profile' },
        { label: 'Establishing connection with someone who has surfaced.', phase: 'Connection' },
        { label: 'Reading whether a courting connection is real.', phase: 'Courtship' },
        { label: 'Calibrating a commitment that is forming.', phase: 'Commitment' },
        { label: 'Holding the shape of a relationship already built.', phase: 'Ongoing' }
      ]
    },
    {
      id: 'p2',
      prompt: 'The next decision worth getting right is',
      options: [
        { label: 'How I present what I am actually looking for.', phase: 'Profile' },
        { label: 'Whether to deepen with someone newly in view.', phase: 'Connection' },
        { label: 'Whether the courting cadence is honest.', phase: 'Courtship' },
        { label: 'Whether the commitment is the right one to name.', phase: 'Commitment' },
        { label: 'How to keep the existing relationship calibrated.', phase: 'Ongoing' }
      ]
    },
    {
      id: 'p3',
      prompt: 'The number of people in active view is',
      options: [
        { label: 'None right now. I am working on the read of myself first.', phase: 'Profile' },
        { label: 'A small number, recently surfaced.', phase: 'Connection' },
        { label: 'One or two, with whom courting is in motion.', phase: 'Courtship' },
        { label: 'One person, where commitment is the question.', phase: 'Commitment' },
        { label: 'One person, with whom the relationship is established.', phase: 'Ongoing' }
      ]
    },
    {
      id: 'p4',
      prompt: 'The question you are most often asking yourself is',
      options: [
        { label: 'What am I bringing to this, honestly?', phase: 'Profile' },
        { label: 'Is this person someone I should engage further?', phase: 'Connection' },
        { label: 'Is what I am reading in them the real thing?', phase: 'Courtship' },
        { label: 'Is this the commitment I want on the record?', phase: 'Commitment' },
        { label: 'How do I keep what we have calibrated?', phase: 'Ongoing' }
      ]
    }
  ];

  // 5-Signal initial state — 3 questions per AI Umbrella MVP §1.1
  const SIGNALS = ['Intent', 'Position', 'Open', 'Build', 'Progress'];

  const SIGNAL_QUESTIONS = [
    {
      id: 's1',
      signal: 'Open',
      prompt: 'On the read of openness, where are you',
      options: [
        { label: 'I am open. The door is one I am willing to walk through.', value: 'open' },
        { label: 'I am partially open. There are conditions before the door moves.', value: 'partial' },
        { label: 'I am not currently open. The frame is something else.', value: 'closed' }
      ]
    },
    {
      id: 's2',
      signal: 'Build',
      prompt: 'On the read of building, where are you',
      options: [
        { label: 'I am building. There is something forming worth the work.', value: 'build' },
        { label: 'I am holding. Not building yet, not stepping back.', value: 'hold' },
        { label: 'I am observing. The build moment has not arrived.', value: 'observe' }
      ]
    },
    {
      id: 's3',
      signal: 'Progress',
      prompt: 'On the read of progress, where are you',
      options: [
        { label: 'There is progress. The cadence is moving the right direction.', value: 'progress' },
        { label: 'There is steady standing. The cadence is held, not advancing.', value: 'steady' },
        { label: 'There is a question on whether progress is real.', value: 'question' }
      ]
    }
  ];

  // ── State management ──

  function defaultState() {
    return {
      stage: 1,
      maxStageReached: 1,
      intent: { responses: {}, scores: {}, dominant: null },
      phase: { responses: {}, dominant: null },
      signal: { responses: {} },
      startedAt: new Date().toISOString(),
      completedAt: null
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (err) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      // Storage may be unavailable; the SPA still works in-memory for this session.
    }
  }

  let state = loadState();

  // ── Scoring ──

  function scoreIntent(responses) {
    const scores = {};
    INTENTS.forEach((i) => { scores[i] = 0; });
    Object.keys(responses).forEach((qid) => {
      const opt = responses[qid];
      if (!opt || !opt.weights) return;
      Object.keys(opt.weights).forEach((intent) => {
        scores[intent] = (scores[intent] || 0) + opt.weights[intent];
      });
    });
    let dominant = null;
    let dominantScore = -1;
    INTENTS.forEach((i) => {
      if (scores[i] > dominantScore) {
        dominantScore = scores[i];
        dominant = i;
      }
    });
    return { scores: scores, dominant: dominant };
  }

  function scorePhase(responses) {
    const tally = {};
    PHASES.forEach((p) => { tally[p] = 0; });
    Object.keys(responses).forEach((qid) => {
      const opt = responses[qid];
      if (!opt || !opt.phase) return;
      tally[opt.phase] = (tally[opt.phase] || 0) + 1;
    });
    let dominant = null;
    let dominantCount = -1;
    PHASES.forEach((p) => {
      if (tally[p] > dominantCount) {
        dominantCount = tally[p];
        dominant = p;
      }
    });
    return dominant;
  }

  // ── Stage transitions ──

  function setStage(n) {
    const target = Math.max(1, Math.min(TOTAL_STAGES, n));
    state.stage = target;
    if (target > state.maxStageReached) state.maxStageReached = target;
    saveState(state);

    document.querySelectorAll('.cc-stage').forEach((el) => {
      const s = parseInt(el.getAttribute('data-stage'), 10);
      const active = s === target;
      if (active) {
        el.removeAttribute('hidden');
      } else {
        el.setAttribute('hidden', '');
      }
    });

    renderProgress();
    renderStage(target);

    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '#stage=' + target);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const heading = document.querySelector('[data-stage="' + target + '"] [data-stage-heading]');
    if (heading) heading.focus();
  }

  function renderProgress() {
    const dots = document.querySelectorAll('.cc-progress__dot');
    dots.forEach((dot) => {
      const s = parseInt(dot.getAttribute('data-stage-marker'), 10);
      let label;
      if (s === state.stage) label = 'active';
      else if (s < state.stage) label = 'complete';
      else label = 'pending';
      dot.setAttribute('data-state', label);
    });
    const labelEl = document.querySelector('.cc-progress__label');
    if (labelEl) labelEl.textContent = 'Stage ' + state.stage + ' of ' + TOTAL_STAGES;
  }

  // ── Question card rendering ──

  function renderQuestionCard(opts) {
    // opts: { container, questions, currentIndex, getResponse, onSelect, onContinue, onBack, onComplete, label }
    const total = opts.questions.length;
    const idx = opts.currentIndex;
    const q = opts.questions[idx];
    const existing = opts.getResponse(q.id);

    const card = document.createElement('div');
    card.className = 'cc-card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-labelledby', 'cc-q-' + q.id);

    const head = document.createElement('div');
    head.className = 'cc-card__head';
    head.innerHTML =
      '<span class="cc-card__numeral">' + ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][idx] + '</span>' +
      '<span class="cc-card__counter">' + opts.label + ' &middot; ' + (idx + 1) + ' of ' + total + '</span>';
    card.appendChild(head);

    const question = document.createElement('h3');
    question.className = 'cc-card__question';
    question.id = 'cc-q-' + q.id;
    question.setAttribute('tabindex', '-1');
    question.setAttribute('data-stage-heading', '');
    question.textContent = q.prompt;
    card.appendChild(question);

    if (q.hint) {
      const hint = document.createElement('p');
      hint.className = 'cc-card__hint';
      hint.textContent = q.hint;
      card.appendChild(hint);
    }

    const choices = document.createElement('div');
    choices.className = 'cc-choices';
    choices.setAttribute('role', 'radiogroup');
    choices.setAttribute('aria-labelledby', 'cc-q-' + q.id);

    q.options.forEach((option, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc-choice';
      btn.setAttribute('role', 'radio');
      const pressed = existing && existing.label === option.label;
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      btn.setAttribute('aria-checked', pressed ? 'true' : 'false');
      btn.innerHTML = '<span class="cc-choice__bullet" aria-hidden="true"></span>' + escapeHtml(option.label);
      btn.addEventListener('click', () => {
        opts.onSelect(q.id, option);
        renderQuestionCard(opts); // re-render to reflect selection
      });
      choices.appendChild(btn);
    });
    card.appendChild(choices);

    const actions = document.createElement('div');
    actions.className = 'cc-actions';

    if (idx > 0) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'cc-btn cc-btn--ghost';
      back.textContent = 'Back';
      back.addEventListener('click', () => {
        opts.currentIndex = idx - 1;
        renderQuestionCard(opts);
      });
      actions.appendChild(back);
    }

    const cont = document.createElement('button');
    cont.type = 'button';
    cont.className = 'cc-btn';
    const isLast = idx === total - 1;
    cont.innerHTML = (isLast ? 'Complete' : 'Continue') + ' <span aria-hidden="true">&rarr;</span>';
    if (!existing) cont.setAttribute('disabled', '');
    cont.addEventListener('click', () => {
      if (isLast) {
        opts.onComplete();
      } else {
        opts.currentIndex = idx + 1;
        renderQuestionCard(opts);
      }
    });
    actions.appendChild(cont);

    card.appendChild(actions);

    opts.container.replaceChildren(card);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // ── Stage 2 (9-Intent) ──

  function renderStage2() {
    const container = document.querySelector('[data-stage="2"] [data-question-host]');
    if (!container) return;
    const opts = {
      container: container,
      questions: INTENT_QUESTIONS,
      currentIndex: 0,
      label: 'Intent',
      getResponse: (qid) => state.intent.responses[qid],
      onSelect: (qid, option) => {
        state.intent.responses[qid] = { label: option.label, weights: option.weights };
        const scored = scoreIntent(state.intent.responses);
        state.intent.scores = scored.scores;
        state.intent.dominant = scored.dominant;
        saveState(state);
      },
      onComplete: () => setStage(3)
    };
    renderQuestionCard(opts);
  }

  // ── Stage 3 (5-Phase) ──

  function renderStage3() {
    const container = document.querySelector('[data-stage="3"] [data-question-host]');
    if (!container) return;
    const opts = {
      container: container,
      questions: PHASE_QUESTIONS,
      currentIndex: 0,
      label: 'Phase',
      getResponse: (qid) => state.phase.responses[qid],
      onSelect: (qid, option) => {
        state.phase.responses[qid] = { label: option.label, phase: option.phase };
        state.phase.dominant = scorePhase(state.phase.responses);
        saveState(state);
      },
      onComplete: () => setStage(4)
    };
    renderQuestionCard(opts);
  }

  // ── Stage 4 (5-Signal) ──

  function renderStage4() {
    const container = document.querySelector('[data-stage="4"] [data-question-host]');
    if (!container) return;
    const opts = {
      container: container,
      questions: SIGNAL_QUESTIONS,
      currentIndex: 0,
      label: 'Signal',
      getResponse: (qid) => state.signal.responses[qid],
      onSelect: (qid, option) => {
        state.signal.responses[qid] = { label: option.label, value: option.value, signal: SIGNAL_QUESTIONS.find((q) => q.id === qid).signal };
        saveState(state);
      },
      onComplete: () => {
        state.completedAt = new Date().toISOString();
        saveState(state);
        setStage(5);
      }
    };
    renderQuestionCard(opts);
  }

  // ── Stage 5 (Brief generation + render) ──

  function renderStage5() {
    const intent = state.intent.dominant || '—';
    const phase = state.phase.dominant || '—';
    const signals = state.signal.responses;

    const setText = (sel, text) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = text;
    };

    setText('[data-brief-intent]', intent);
    setText('[data-brief-phase]', phase ? phase + ' Phase' : '—');

    const signalLabel = SIGNALS.map((sig) => {
      const resp = Object.values(signals).find((r) => r.signal === sig);
      if (!resp) return null;
      return sig + ': ' + resp.value;
    }).filter(Boolean).join(' · ') || '—';
    setText('[data-brief-signals]', signalLabel);

    // If a Brief was already generated this session, re-render it.
    if (state.brief && state.brief.pages) {
      renderBriefPages(state.brief);
    }
  }

  function generateBriefAction() {
    const host = document.querySelector('[data-brief-host]');
    if (!host) return;

    host.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'cc-brief-loading';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.textContent = 'A moment, please. The Coach is preparing the Brief.';
    host.appendChild(loading);

    if (!global.MMConnectionCodeAPI) {
      renderBriefFallback(host, 'OFFLINE');
      return;
    }

    global.MMConnectionCodeAPI.generateBrief(state)
      .then((data) => {
        const brief = data && data.brief ? data.brief : data;
        state.brief = normalizeBrief(brief, state);
        saveState(state);
        renderBriefPages(state.brief);
      })
      .catch((err) => {
        // Backend RPC not yet live: render the local-only Brief preview as a
        // graceful fallback so Day 3 review surfaces the layout for Paul +
        // Atlas G1. Backend swap happens at handoff per Extended Autonomy v1.
        const localBrief = buildLocalFallbackBrief(state);
        state.brief = localBrief;
        saveState(state);
        renderBriefPages(localBrief, { degraded: true, code: err && err.code });
      });
  }

  function normalizeBrief(brief, currentState) {
    if (!brief || typeof brief !== 'object') return buildLocalFallbackBrief(currentState);
    return {
      intent_dominant: brief.intent_dominant || currentState.intent.dominant || '—',
      phase_dominant: brief.phase_dominant || currentState.phase.dominant || '—',
      signal_state: brief.signal_state || signalStateFromResponses(currentState.signal.responses),
      pages: brief.pages || buildLocalFallbackBrief(currentState).pages,
      chapter_citations: brief.chapter_citations || [],
      generated_at: brief.generated_at || new Date().toISOString(),
      source: 'backend'
    };
  }

  function signalStateFromResponses(responses) {
    const out = {};
    Object.values(responses || {}).forEach((r) => {
      if (r && r.signal) out[r.signal] = r.value;
    });
    return out;
  }

  function buildLocalFallbackBrief(currentState) {
    const intent = currentState.intent.dominant || '—';
    const phase = currentState.phase.dominant || '—';
    const sig = signalStateFromResponses(currentState.signal.responses);
    const sigLine = SIGNALS.map((s) => sig[s] ? s + ': ' + sig[s] : null).filter(Boolean).join(' · ') || '—';

    return {
      intent_dominant: intent,
      phase_dominant: phase,
      signal_state: sig,
      generated_at: new Date().toISOString(),
      source: 'local-fallback',
      pages: [
        {
          title: 'Letter of Calibration',
          body: [
            'The Connection Code is the methodology behind every successful relationship decision. The Engine has read your responses and surfaces three things on this page: your dominant Intent, your current Phase, and your initial Signal state.',
            'These are not verdicts. They are the read the methodology arrives with. The Coach holds them as the starting record.'
          ],
          highlights: [
            { label: 'Dominant Intent', value: intent },
            { label: 'Current Phase', value: phase + ' Phase' },
            { label: 'Initial Signal Read', value: sigLine }
          ]
        },
        {
          title: 'Page Two · Intent in Practice',
          body: [
            briefIntentNarrative(intent),
            'The Intent reading shapes which chapters of the Connection Code apply most directly. The Coach references the Intent at every turn, not as a fixed identity, but as the calibration the methodology is currently working with.'
          ]
        },
        {
          title: 'Page Three · Phase and Signal',
          body: [
            briefPhaseNarrative(phase),
            briefSignalNarrative(sig)
          ]
        },
        {
          title: 'Page Four · The Next Move',
          body: [
            'The next move that earns it begins where you arrive. The Coach is held to the Brief; the Brief is held to the read; the read is yours to recalibrate as practice deepens.',
            'Coach Lite is the methodology in conversation. Coach AI begins at L2 Studio, where the Connection Code corpus is cited verbatim with each turn.'
          ]
        }
      ]
    };
  }

  function briefIntentNarrative(intent) {
    const map = {
      'Long-Term': 'Long-Term names the work as enduring, the cadence as deliberate, and the read as patient. The methodology calibrates against the long horizon first; the moment second.',
      'Marriage': 'Marriage names the explicit outcome. The methodology calibrates against commitment as the form, not the feeling. The Phase the methodology surfaces is the work that earns it.',
      'Fall in Love': 'Fall in Love names the read as one that must register as real. The methodology does not perform feeling; it surfaces whether the cadence allows the real thing to arrive.',
      'Casual': 'Casual names the read as light, present, and unburdened by the long horizon. The methodology calibrates honesty across the cadence, regardless of duration.',
      'Friendship': 'Friendship names the work as the shape of company. The methodology reads connection without the requirement of romantic outcome.',
      'Companionship': 'Companionship names the read as steady, present, and shared. The methodology calibrates the cadence of company, with or without the romantic frame.',
      'Not Sure': 'Not Sure names the calibration as in-progress. The methodology reads the uncertainty as data, not deficit. The Brief is the starting record; the read deepens in practice.',
      'Short-Term': 'Short-Term names the read as honest within a shorter arc. The methodology calibrates symmetry of expectation across the cadence.',
      'Open to All': 'Open to All names the read as one that surfaces shape from cadence rather than declaring shape ahead of it. The methodology calibrates against what cadence reveals.'
    };
    return map[intent] || 'Intent precedes everything. The methodology calibrates against the Intent first; the Phase second; the Signal in motion.';
  }

  function briefPhaseNarrative(phase) {
    const map = {
      'Profile': 'The Profile phase is interior. The work is the read of yourself before someone is in view. The methodology calibrates standing first, presence second, and Intent over both.',
      'Connection': 'The Connection phase is where someone has surfaced and the read deepens. The Open Signal is what governs whether the cadence advances.',
      'Courtship': 'The Courtship phase is where the cadence becomes the read. The Build Signal across two cycles is what tells the truth before language arrives.',
      'Commitment': 'The Commitment phase is where naming converts the read into a record. The Progress Signal across one full cycle is the methodology\'s readiness check.',
      'Ongoing': 'The Ongoing phase is the holding of shape. Quarterly recalibration is the cadence the methodology reads against; the Brief is the starting record.'
    };
    return map[phase] || 'The Phase reading shapes the next move. The Coach holds the Phase as the frame for every subsequent calibration.';
  }

  function briefSignalNarrative(sig) {
    const parts = [];
    if (sig['Open']) parts.push('On Open: ' + sig['Open'] + '. The methodology reads Open as the door the cadence is allowed to walk through.');
    if (sig['Build']) parts.push('On Build: ' + sig['Build'] + '. The methodology reads Build as whether the cadence cycle holds without you supplying its momentum.');
    if (sig['Progress']) parts.push('On Progress: ' + sig['Progress'] + '. The methodology reads Progress as the cadence cycle confirming, not the verbal commitment alone.');
    return parts.join(' ') || 'The Signal state surfaces what the methodology reads in motion.';
  }

  function renderBriefPages(brief, opts) {
    opts = opts || {};
    const host = document.querySelector('[data-brief-host]');
    if (!host || !brief || !brief.pages) return;

    host.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = 'cc-brief--full';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Connection Code Brief');

    if (opts.degraded) {
      const cue = document.createElement('div');
      cue.className = 'cc-brief-fallback';
      cue.textContent = 'The Coach is preparing the gateway. The Brief surfaces here as the local read. The full letterhead generation arrives when the Backend lane completes its handoff.';
      wrap.appendChild(cue);
    }

    brief.pages.forEach((page, i) => {
      const article = document.createElement('article');
      article.className = 'cc-brief-page';

      const head = document.createElement('header');
      head.className = 'cc-brief-page__head';
      head.innerHTML =
        '<p class="cc-brief-page__pagenum">Page ' + ['One', 'Two', 'Three', 'Four'][i] + '</p>' +
        '<p class="cc-brief-page__letterhead">Connection Code<span style="color:var(--cc-gold);font-size:.5em;vertical-align:super;">&trade;</span> Brief</p>';
      article.appendChild(head);

      const title = document.createElement('h3');
      title.className = 'cc-brief-page__value';
      title.textContent = page.title;
      article.appendChild(title);

      if (page.highlights) {
        page.highlights.forEach((h) => {
          const sec = document.createElement('div');
          sec.className = 'cc-brief-page__section';
          const lab = document.createElement('p');
          lab.className = 'cc-brief-page__label';
          lab.textContent = h.label;
          const val = document.createElement('p');
          val.className = 'cc-brief-page__value';
          val.textContent = h.value;
          sec.appendChild(lab);
          sec.appendChild(val);
          article.appendChild(sec);
        });
      }

      (page.body || []).forEach((para) => {
        const p = document.createElement('p');
        p.className = 'cc-brief-page__paragraph';
        p.textContent = para;
        article.appendChild(p);
      });

      (page.citations || []).forEach((cite) => {
        const c = document.createElement('p');
        c.className = 'cc-brief-page__cite';
        c.textContent = cite;
        article.appendChild(c);
      });

      wrap.appendChild(article);
    });

    host.appendChild(wrap);
  }

  function renderBriefFallback(host, code) {
    host.replaceChildren();
    const cue = document.createElement('div');
    cue.className = 'cc-brief-fallback';
    cue.textContent = 'The Coach is briefly unavailable. The Brief generates when service returns. (' + (code || 'OFFLINE') + ')';
    host.appendChild(cue);
  }

  // ── Stage 6 (Sign-up) ──

  function renderStage6() {
    // Pre-fill if state already has email captured.
    const emailEl = document.querySelector('[name="email"]');
    if (emailEl && state.signup && state.signup.email) emailEl.value = state.signup.email;
    const nameEl = document.querySelector('[name="given_name"]');
    if (nameEl && state.signup && state.signup.given_name) nameEl.value = state.signup.given_name;
  }

  function bindSignupForm() {
    const form = document.querySelector('[data-signup-form]');
    if (!form) return;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const email = (form.querySelector('[name="email"]') || {}).value || '';
      const given_name = (form.querySelector('[name="given_name"]') || {}).value || '';
      const terms = (form.querySelector('[name="terms"]') || {}).checked;
      const status = form.querySelector('[data-signup-status]');

      if (!email || !/^.+@.+\..+$/.test(email)) {
        if (status) { status.textContent = 'A valid email is required.'; status.setAttribute('data-state', 'error'); }
        return;
      }
      if (!terms) {
        if (status) { status.textContent = 'Acknowledgment of the Privacy Policy is required.'; status.setAttribute('data-state', 'error'); }
        return;
      }

      state.signup = { email: email.trim(), given_name: given_name.trim() };
      saveState(state);

      if (status) { status.textContent = 'A moment, please. The Coach is creating the standing record.'; status.setAttribute('data-state', ''); }

      const submitBtn = form.querySelector('[data-signup-submit]');
      if (submitBtn) submitBtn.setAttribute('disabled', '');

      const onResolve = () => {
        if (status) { status.textContent = 'Welcome. The Coach holds the Brief on your behalf. The Welcome Letter arrives within twenty-four hours.'; status.setAttribute('data-state', 'success'); }
        if (submitBtn) submitBtn.removeAttribute('disabled');
        setTimeout(() => setStage(7), 800);
      };

      const onReject = (err) => {
        // Day 3 graceful degradation: persist locally; advance to Coach Lite;
        // Backend handoff replays sign-up server-side at next session.
        state.signup_pending_backend_sync = true;
        saveState(state);
        if (status) {
          status.textContent = 'The Coach has held your record locally. The standing record completes when service returns.';
          status.setAttribute('data-state', 'success');
        }
        if (submitBtn) submitBtn.removeAttribute('disabled');
        setTimeout(() => setStage(7), 1000);
      };

      if (!global.MMConnectionCodeAPI) {
        onReject({ code: 'OFFLINE' });
        return;
      }

      global.MMConnectionCodeAPI.signupL1({
        email: state.signup.email,
        given_name: state.signup.given_name,
        state: stripStateForPayload(state)
      })
        .then((res) => {
          state.signup.user_id = res && res.user_id;
          state.signup.memory_store_id = res && res.memory_store_id;
          state.signup.created_at = res && res.created_at;
          saveState(state);
          // Fire-and-forget: schedule Welcome Letter (24hr post-signup).
          if (state.signup.user_id) {
            global.MMConnectionCodeAPI.scheduleWelcomeLetter(state.signup.user_id).catch(() => {});
          }
          onResolve();
        })
        .catch(onReject);
    });
  }

  function stripStateForPayload(s) {
    return {
      stage: s.stage,
      intent: { dominant: s.intent.dominant, scores: s.intent.scores },
      phase: { dominant: s.phase.dominant },
      signal: { state: signalStateFromResponses(s.signal.responses) },
      brief_summary: s.brief ? { intent_dominant: s.brief.intent_dominant, phase_dominant: s.brief.phase_dominant, signal_state: s.brief.signal_state, source: s.brief.source } : null,
      startedAt: s.startedAt,
      completedAt: s.completedAt
    };
  }

  // ── Stage 7 (Coach Lite) ──

  function renderStage7() {
    const host = document.querySelector('[data-coach-lite-host]');
    if (!host) return;
    if (!global.MMCoachLite) {
      host.replaceChildren();
      const fallback = document.createElement('p');
      fallback.className = 'cc-coach-prompt';
      fallback.textContent = 'A moment, please.';
      host.appendChild(fallback);
      return;
    }
    if (!state.coachLite) state.coachLite = { currentNode: global.MMCoachLite.getRootId(), trail: [] };
    renderCoachLiteNode();
  }

  function renderCoachLiteNode() {
    const host = document.querySelector('[data-coach-lite-host]');
    if (!host || !state.coachLite) return;
    const node = global.MMCoachLite.getNode(state.coachLite.currentNode);

    host.replaceChildren();

    const prompt = document.createElement('p');
    prompt.className = 'cc-coach-prompt';
    prompt.textContent = node.prompt;
    prompt.setAttribute('tabindex', '-1');
    host.appendChild(prompt);
    prompt.focus();

    if (node.terminal) {
      if (node.closing) {
        const closing = document.createElement('p');
        closing.className = 'cc-coach-closing';
        closing.textContent = node.closing;
        host.appendChild(closing);
      }

      const restart = document.createElement('div');
      restart.className = 'cc-actions';
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'cc-btn cc-btn--ghost';
      back.textContent = 'Return to the Coach';
      back.addEventListener('click', () => {
        state.coachLite.currentNode = global.MMCoachLite.getRootId();
        state.coachLite.trail = [];
        saveState(state);
        renderCoachLiteNode();
      });
      restart.appendChild(back);
      host.appendChild(restart);
    } else {
      const choices = document.createElement('div');
      choices.className = 'cc-choices';
      choices.setAttribute('role', 'group');
      (node.options || []).forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cc-choice';
        btn.innerHTML = '<span class="cc-choice__bullet" aria-hidden="true"></span>' + escapeHtml(opt.label);
        btn.addEventListener('click', () => {
          state.coachLite.trail.push({ from: state.coachLite.currentNode, choice: opt.label });
          state.coachLite.currentNode = opt.next;
          saveState(state);
          renderCoachLiteNode();
        });
        choices.appendChild(btn);
      });
      host.appendChild(choices);
    }

    if (state.coachLite.trail && state.coachLite.trail.length > 0) {
      const trail = document.createElement('div');
      trail.className = 'cc-coach-trail';
      const head = document.createElement('p');
      head.className = 'cc-coach-trail__head';
      head.textContent = 'The path the Coach has taken with you';
      trail.appendChild(head);
      const list = document.createElement('ul');
      list.className = 'cc-coach-trail__list';
      state.coachLite.trail.forEach((step, i) => {
        const li = document.createElement('li');
        li.textContent = (i + 1) + '. ' + step.choice;
        list.appendChild(li);
      });
      trail.appendChild(list);
      host.appendChild(trail);
    }
  }

  // ── Init ──

  function bindStageActions() {
    const beginBtn = document.querySelector('[data-action="begin"]');
    if (beginBtn) beginBtn.addEventListener('click', () => setStage(2));

    const generateBriefBtn = document.querySelector('[data-action="generate-brief"]');
    if (generateBriefBtn) generateBriefBtn.addEventListener('click', () => {
      generateBriefAction();
      // Move to sign-up after a short delay so user sees the Brief render.
      // Otherwise scroll keeps the user on Stage 5 to read the Brief.
      generateBriefBtn.textContent = 'Continue to sign-up →';
      generateBriefBtn.setAttribute('data-action', 'brief-review');
      generateBriefBtn.addEventListener('click', () => setStage(6), { once: true });
    });

    const restartBtns = document.querySelectorAll('[data-action="restart"], [data-action="coach-lite-restart"]');
    restartBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const isCoachRestart = btn.getAttribute('data-action') === 'coach-lite-restart';
        if (isCoachRestart) {
          if (state.coachLite) {
            state.coachLite.currentNode = (global.MMCoachLite && global.MMCoachLite.getRootId()) || 'root';
            state.coachLite.trail = [];
            saveState(state);
            renderCoachLiteNode();
          }
          return;
        }
        if (!confirm('Begin again? Your current calibration will be cleared.')) return;
        state = defaultState();
        saveState(state);
        setStage(1);
      });
    });

    const backHomeBtns = document.querySelectorAll('[data-action="back-stage"]');
    backHomeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.getAttribute('data-target') || '1', 10);
        setStage(target);
      });
    });

    bindSignupForm();
  }

  function renderStage(stage) {
    if (stage === 2) renderStage2();
    else if (stage === 3) renderStage3();
    else if (stage === 4) renderStage4();
    else if (stage === 5) renderStage5();
    else if (stage === 6) renderStage6();
    else if (stage === 7) renderStage7();
  }

  function readHashStage() {
    const m = /stage=(\d)/.exec(window.location.hash || '');
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (isNaN(n) || n < 1 || n > TOTAL_STAGES) return null;
    return n;
  }

  function init() {
    bindStageActions();

    const hashStage = readHashStage();
    const initialStage = hashStage || state.stage || 1;
    setStage(initialStage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
