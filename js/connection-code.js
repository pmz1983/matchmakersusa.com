/* ═══════════════════════════════════════════════════
   CONNECTION CODE ENGINE — Stage 1-7 SPA
   v3.0 MVP Day 2 — 2026-05-02
   localStorage state · hash-routed stages · accessible
   ═══════════════════════════════════════════════════ */

(function () {
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

  // ── Stage 5 (Brief preview) ──

  function renderStage5() {
    const intent = state.intent.dominant || '—';
    const phase = state.phase.dominant || '—';
    const signals = state.signal.responses;

    const setText = (sel, text) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = text;
    };

    setText('[data-brief-intent]', intent);
    setText('[data-brief-phase]', phase + ' Phase');

    const signalLabel = SIGNALS.map((sig) => {
      const resp = Object.values(signals).find((r) => r.signal === sig);
      if (!resp) return null;
      return sig + ': ' + resp.value;
    }).filter(Boolean).join(' · ') || '—';
    setText('[data-brief-signals]', signalLabel);
  }

  // ── Init ──

  function bindStageActions() {
    const beginBtn = document.querySelector('[data-action="begin"]');
    if (beginBtn) beginBtn.addEventListener('click', () => setStage(2));

    const reviewBtn = document.querySelector('[data-action="brief-review"]');
    if (reviewBtn) reviewBtn.addEventListener('click', () => setStage(6));

    const signupContinue = document.querySelector('[data-action="signup-continue"]');
    if (signupContinue) signupContinue.addEventListener('click', () => setStage(7));

    const restartBtns = document.querySelectorAll('[data-action="restart"]');
    restartBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
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
  }

  function renderStage(stage) {
    if (stage === 2) renderStage2();
    else if (stage === 3) renderStage3();
    else if (stage === 4) renderStage4();
    else if (stage === 5) renderStage5();
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
})();
