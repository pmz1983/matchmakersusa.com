/* ═══════════════════════════════════════════════════
   MATCHMAKERS — assessment.js
   Intent Assessment quiz engine
   ═══════════════════════════════════════════════════ */

const IA_QUESTIONS = [{"cat": "intent", "q": "When you picture your dating life six months from now, what outcome would feel like success?", "why": "Anchors to near-term reality rather than aspirational fantasy.", "options": [["I'm in a committed relationship with someone I'm genuinely excited about.", {"longterm": 3, "fallinlove": 2, "marriage": 1}, 0], ["I've fallen in love \u2014 or I'm well on my way.", {"fallinlove": 3, "longterm": 2, "marriage": 1}, 0], ["I've found the person I want to build my life with.", {"marriage": 3, "longterm": 2, "fallinlove": 1}, 0], ["I've had meaningful connections without pressure or commitment.", {"casual": 3, "shortterm": 2, "notsure": 1}, 0], ["I've met interesting people and know myself better.", {"notsure": 3, "casual": 1, "friends": 1}, 0], ["I'm not sure \u2014 I'm trying to figure that out.", {"notsure": 3, "casual": 1}, 0]]}, {"cat": "intent", "q": "Someone you've been talking to asks: 'What are you actually looking for here?' You say:", "why": "Tests declaration under mild social pressure.", "options": [["Exactly what I want \u2014 something serious and lasting.", {"longterm": 3, "marriage": 2, "fallinlove": 1}, 0], ["That I'm looking for the real feeling \u2014 falling in love if it happens.", {"fallinlove": 3, "longterm": 1}, 0], ["That I want to find my person \u2014 I'm evaluating accordingly.", {"marriage": 3, "longterm": 2}, 0], ["That I'm not looking for commitment, but I want real connection.", {"casual": 3, "shortterm": 2}, 0], ["Something vague \u2014 I don't want to close doors or define things yet.", {"notsure": 3, "casual": 1}, 0], ["I pause. I'm not sure how to answer honestly.", {"notsure": 3, "friends": 1}, 0]]}, {"cat": "intent", "q": "Which of these feels most true about what you want \u2014 right now, not eventually?", "why": "Strips away what the user thinks they should say.", "options": [["I want a lasting, committed partnership and I'm ready for that investment.", {"longterm": 3, "marriage": 2, "fallinlove": 1}, 0], ["I want to fall in love. The relationship structure matters less than the feeling.", {"fallinlove": 3, "longterm": 1, "casual": 1}, 0], ["I want to find a spouse. I'm past dating for the sake of it.", {"marriage": 3, "longterm": 2}, 0], ["I want real connection without the weight of commitment.", {"casual": 3, "shortterm": 2, "notsure": 1}, 0], ["I want to understand myself better before I can answer this honestly.", {"notsure": 3, "casual": 1}, 0], ["I'm in a transitional phase \u2014 I know what I don't want more than what I do.", {"notsure": 2, "casual": 2, "shortterm": 1}, 0]]}, {"cat": "readiness", "q": "How much time and emotional energy are you genuinely prepared to invest in the right connection right now?", "why": "Measures real-world readiness vs stated intent.", "options": [["Full investment. If the right person appears, I'm ready.", {"clarity": 7}, 7], ["Significant, but with a realistic timeline.", {"clarity": 5}, 5], ["Meaningful, but I have real constraints at the moment.", {"clarity": 3}, 3], ["Limited \u2014 my life isn't structured for this right now.", {"clarity": 1}, 1], ["I'm not sure \u2014 I keep saying I'm ready but my behavior suggests otherwise.", {"clarity": 0}, 0]]}, {"cat": "readiness", "q": "A promising connection is developing well. It's moving toward something more serious. How do you respond?", "why": "Tests whether readiness matches stated intent when it gets real.", "options": [["This is exactly what I was hoping for. I lean in.", {"clarity": 7}, 7], ["Excited but I want to make sure the foundation is real first.", {"clarity": 5}, 5], ["Hopeful but cautious \u2014 I need a little more time to feel safe.", {"clarity": 3}, 3], ["Slightly uneasy \u2014 this is faster or deeper than I was expecting.", {"clarity": 2}, 2], ["I start creating distance. Something in me resists when it gets serious.", {"clarity": 0}, 0]]}, {"cat": "readiness", "q": "When you think about the last time you ended or let fade a connection that had real potential \u2014 what happened?", "why": "Behavioral history is the most reliable predictor of actual readiness.", "options": [["I haven't let a genuine connection fade \u2014 I take them seriously.", {"clarity": 6}, 6], ["Life got complicated. I regret it and I'm more committed now.", {"clarity": 5}, 5], ["It scared me a little. I'm working on that.", {"clarity": 3}, 3], ["It's a pattern I recognize and I'm trying to understand it.", {"clarity": 2}, 2], ["It happens more than I'd like to admit.", {"clarity": 0}, 0]]}, {"cat": "signal", "q": "How would the last person you were talking to describe what you were looking for?", "why": "Tests whether stated intent is communicated clearly to others.", "options": [["Exactly what I'd say \u2014 we were aligned from the start.", {"clarity": 4}, 4], ["Probably accurate \u2014 I'm generally clear but not always explicit.", {"clarity": 3}, 3], ["Possibly different from what I'd say \u2014 I'm not sure I communicated it well.", {"clarity": 2}, 2], ["Probably confused \u2014 I wasn't clear with them or myself.", {"clarity": 1}, 1], ["I don't know. I didn't make it clear.", {"clarity": 0}, 0]]}, {"cat": "signal", "q": "Honestly: do your actions in dating \u2014 how you message, how you engage, how you follow through \u2014 match what you say you want?", "why": "Signal alignment is the most diagnostic question in the assessment.", "options": [["Yes. My behavior reflects my intent consistently.", {"clarity": 3}, 3], ["Mostly \u2014 occasional inconsistency but I'm aware of it.", {"clarity": 2}, 2], ["Not as well as I'd like. There's a gap I'm working on.", {"clarity": 1}, 1], ["Honestly, no. What I do and what I say I want don't match.", {"clarity": 0}, 0]]}];
const IA_INTENTS   = {"longterm": {"name": "Long-Term Relationship", "headline": "You know what you want. The work is in the signals.", "desc": "Your Intent is clear at the goal level. Most people with Long-Term intent don't fail because they want the wrong thing \u2014 they fail because they operate without a system. The first message, the first call, the first date all carry more weight when you're serious. The Connection Code gives you the architecture for all of it.", "strength": "You've done the most important work \u2014 you know what you want.", "gap": "Clarity of intent doesn't guarantee clarity of signal. What you communicate in the first three interactions either confirms or undermines your stated goal.", "signal": "Signal 1: Intent"}, "marriage": {"name": "Marriage", "headline": "You're evaluating, not exploring. The system needs to match that.", "desc": "Marriage Intent is the highest-commitment declaration on the platform \u2014 and it changes the evaluation criteria for every connection. You're not dating for experience. You're assessing fit. The MatchMakers methodology treats this seriously: every phase, every script, and every signal is built around the premise that you know what you're here for.", "strength": "You have the most filtered, precise selection criteria of any Intent type.", "gap": "Most people with Marriage Intent underestimate how much the opening signals matter. You can disqualify the right person in the first three messages if your signals don't match your evaluation standard.", "signal": "Signal 1: Intent"}, "fallinlove": {"name": "Fall in Love", "headline": "You want the experience, not just the outcome. That requires precision.", "desc": "Fall in Love Intent is about the feeling \u2014 real, undeniable, reciprocal emotional investment. The risk for this Intent type is romantic ambiguity: attracting people who want to settle rather than feel. The Connection Code's Build signal is where this Intent type lives or dies. Signal 4 is specifically about creating the depth that makes real connection possible.", "strength": "You're emotionally available and genuinely open. This is rarer than people think.", "gap": "Openness without structure attracts the wrong people. Signal 2 (Position) and Signal 3 (Open) determine who shows up.", "signal": "Signal 4: Build"}, "casual": {"name": "Casual", "headline": "Casual Intent is valid. The problem is almost never honesty \u2014 it's clarity.", "desc": "Casual Intent fails not because it's wrong, but because people rarely declare it explicitly \u2014 which creates mismatched connections from the first interaction. The MatchMakers approach to Casual Intent is simple: be the most honest person in the room. Explicit declaration at the start produces better matches, faster, with far less wasted time on both sides.", "strength": "You know what you want right now. That honesty is the foundation of every successful Casual connection.", "gap": "The gap between unstated Casual intent and stated ambiguity creates the most mismatches on the platform.", "signal": "Signal 1: Intent"}, "shortterm": {"name": "Short-Term", "headline": "Defined duration, real connection. This requires the most precise signaling.", "desc": "Short-Term Intent is the most misunderstood category on the platform. It is not casual indifference \u2014 it is honest acknowledgment that your current situation has a timeline. The Connection Code applies fully: declaration, positioning, opening, and depth all matter, because even short-term connections succeed or fail based on signal alignment from the start.", "strength": "Temporal clarity is a form of respect. Most people don't offer it.", "gap": "Short-Term Intent requires the most explicit Signal 1 declaration \u2014 vagueness here creates the most damage.", "signal": "Signal 1: Intent"}, "notsure": {"name": "Exploring", "headline": "Uncertainty is honest. Clarity is the work.", "desc": "Exploring Intent is not a problem \u2014 it is an honest diagnosis of where you are. The risk is spending months in connections that stall because neither person had a clear foundation. The Connection Code's starting point is Signal 1 precisely because over a decade of human matchmaking has shown that ambiguity at the declaration stage predicts failure at every subsequent stage.", "strength": "You're honest about where you are. This is the starting point, not a liability.", "gap": "Exploring without a framework keeps you exploring indefinitely. The Connection Code's Intent framework was specifically designed for this.", "signal": "Signal 1: Intent"}, "friends": {"name": "Connection-First", "headline": "You value the relationship quality more than its definition.", "desc": "Connection-First Intent is about depth before definition \u2014 real friendship and mutual investment before any pressure to categorize. On the MatchMakers platform, this maps closely to companionship and open exploration. The Signal 4 (Build) and Signal 5 (Progress) framework applies differently for this Intent: the goal is not to escalate, but to deepen at a pace the connection itself sets.", "strength": "You attract people who also value genuine connection over performance.", "gap": "Without Signal 1 clarity, Connection-First Intent is often mistaken for romantic availability.", "signal": "Signal 4: Build"}};
const IA_CLARITY   = {"high": {"label": "High Clarity", "score_range": "14\u201320", "desc": "Your intent and your behavior are aligned. You know what you want, you can articulate it, and your actions reflect it. The work at this level is not on the foundation \u2014 it is on the execution signals. The Playbook's script library and the Dating Coach are built for exactly where you are.", "next": "playbook_coach", "cta_primary": "Coach & Playbook \u2014 $250 \u2192", "cta_secondary": "Read the Connection Code \u2014 Free \u2192", "cta_product": "playbook", "cta_note": "High-Clarity members get the most from the full methodology. The Playbook is the foundation; the Dating Coach applies it in real time."}, "medium": {"label": "Developing Clarity", "score_range": "8\u201313", "desc": "Your intent is established but your behavioral signals have room to align more tightly. You know generally what you want \u2014 the gap is in how consistently you communicate and act on it. The Playbook's Intent and Open chapters directly address this.", "next": "playbook", "cta_primary": "Coach & Playbook \u2014 $250 \u2192", "cta_secondary": "Read the Connection Code \u2014 Free \u2192", "cta_product": "playbook", "cta_note": "The Playbook's Signal 1 and Signal 3 chapters were built for this clarity level. Start there."}, "low": {"label": "Foundational Stage", "score_range": "0\u20137", "desc": "You're in the process of clarifying what you want \u2014 and that honesty is the most important thing you can bring to this. The Connection Code's free framework is the right starting point: it explains the 5-signal architecture and gives you the vocabulary for the work ahead.", "next": "connection_code", "cta_primary": "Read the Connection Code \u2014 Free \u2192", "cta_secondary": "Coach & Playbook \u2014 $250 \u2192", "cta_product": "connection_code", "cta_note": "Start with the Connection Code. It will help you understand what you're building toward before you invest in the deeper methodology."}};

let iaAnswers = {};
let iaScores  = {};
let iaClarity = 0;
const TOTAL = IA_QUESTIONS.length;

// ── Start ──────────────────────────────────────────────────────────
window.iaStart = function() {
  if (window.mmTrack) mmTrack('assessment_start');
  document.getElementById('ia-land').style.display = 'none';
  showQ(0);
};

function showQ(qi) {
  document.querySelectorAll('.ia-q-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ia-loading, .ia-result').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('ia-q' + qi);
  if (el) {
    el.classList.add('active');
    el.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  updateProgress((qi / TOTAL) * 100);
  // Restore previous selection
  if (iaAnswers[qi] !== undefined) {
    document.querySelectorAll('#ia-q' + qi + ' .ia-opt').forEach(o => o.classList.remove('selected'));
    const prev = document.getElementById('ia-q' + qi + '-o' + iaAnswers[qi]);
    if (prev) prev.classList.add('selected');
    document.getElementById('ia-cont' + qi).disabled = false;
  }
}

window.iaSelect = function(qi, oi) {
  document.querySelectorAll('#ia-q' + qi + ' .ia-opt').forEach(o => o.classList.remove('selected'));
  document.getElementById('ia-q' + qi + '-o' + oi).classList.add('selected');
  iaAnswers[qi] = oi;
  document.getElementById('ia-cont' + qi).disabled = false;
};

window.iaContinue = function(qi) {
  const oi = iaAnswers[qi];
  if (oi === undefined) return;

  // Recalculate all scores from scratch to avoid double-counting
  // when a user navigates back and then forward again
  iaScores = {};
  iaClarity = 0;
  Object.entries(iaAnswers).forEach(([qIdx, oIdx]) => {
    const q = IA_QUESTIONS[qIdx];
    const opt = q.options[oIdx];
    if (q.cat === 'intent') {
      Object.entries(opt[1]).forEach(([intent, pts]) => {
        iaScores[intent] = (iaScores[intent] || 0) + pts;
      });
    }
    if (q.cat === 'readiness' || q.cat === 'signal') {
      iaClarity += (opt[2] || 0);
    }
  });

  if (qi < TOTAL - 1) {
    showQ(qi + 1);
  } else {
    showLoading();
  }
};

window.iaBack = function(qi) {
  if (qi > 0) showQ(qi - 1);
  else { document.querySelectorAll('.ia-q-screen').forEach(s => s.classList.remove('active')); document.getElementById('ia-land').style.display = 'flex'; updateProgress(0); }
};

function showLoading() {
  document.querySelectorAll('.ia-q-screen').forEach(s => s.classList.remove('active'));
  document.getElementById('ia-loading').classList.add('active');
  updateProgress(100);
  setTimeout(renderResult, 1800);
}

function renderResult() {
  document.getElementById('ia-loading').classList.remove('active');
  document.getElementById('ia-result').classList.add('active');
  document.getElementById('ia-result').scrollIntoView({behavior:'smooth', block:'start'});

  // Find top intent
  let topIntent = 'notsure';
  let topScore  = 0;
  Object.entries(iaScores).forEach(([k,v]) => { if(v > topScore) { topScore = v; topIntent = k; } });

  // Clarity level
  const maxClarity = 27;
  const clarityPct = Math.round((iaClarity / maxClarity) * 100);
  let clarityKey = 'low';
  if (iaClarity >= 14) clarityKey = 'high';
  else if (iaClarity >= 8) clarityKey = 'medium';

  // Track assessment completion
  if (window.mmTrack) mmTrack('assessment_complete', {
    intent: topIntent,
    clarity_score: iaClarity,
    clarity_level: clarityKey,
    intent_score: topScore
  });

  const intent   = IA_INTENTS[topIntent] || IA_INTENTS.notsure;
  const clarity  = IA_CLARITY[clarityKey];

  const clarityColors = { high: 'rgba(45,184,122,.7)', medium: 'rgba(201,168,76,.7)', low: 'rgba(120,149,175,.5)' };
  const clarityBgColors = { high: 'rgba(45,184,122,.08)', medium: 'rgba(201,168,76,.06)', low: 'rgba(65,91,124,.12)' };
  const clarityBorderColors = { high: 'rgba(45,184,122,.25)', medium: 'rgba(201,168,76,.22)', low: 'rgba(65,91,124,.3)' };

  // v2.2 — canonical button system (Atlas C-5 ring style); class="btn-gold" inherits the unified ring CSS.
  const primaryCTA = clarity.next === 'connection_code'
    ? `<a href="/guide/" class="btn-gold">${clarity.cta_primary}</a>`
    : `<button data-product="${clarity.cta_product}" onclick="openPreCheckout(this)" class="btn-gold">${clarity.cta_primary}</button>`;

  const secondaryCTA = clarity.next === 'connection_code'
    ? `<a href="/playbook/" class="btn-gold">Coach &amp; Playbook &mdash; $250 &rarr;</a>`
    : `<a href="/guide/" class="btn-gold">${clarity.cta_secondary}</a>`;

  // v2.2 — VIP CTA added to results (Atlas directive: "Add VIP CTA on Assessment results page")
  const vipCTA = `<a href="/vip/" class="btn-gold">Apply for VIP MatchMaking &rarr;</a>`;

  document.getElementById('ia-result-inner').innerHTML = `
    <div style="margin-bottom:2rem;">
      <span class="ia-result-badge" style="background:${clarityBgColors[clarityKey]};border:1px solid ${clarityBorderColors[clarityKey]};color:${clarityColors[clarityKey]};">${clarity.label}</span>
      <div class="ia-result-intent">Your Intent:<br><em>${intent.name}</em></div>
      <div class="ia-result-rule"></div>
      <div class="ia-result-headline">${intent.headline}</div>
      <div class="ia-result-desc">${intent.desc}</div>
    </div>

    <div class="ia-clarity-block">
      <div class="ia-clarity-label">Intent Clarity Score</div>
      <div class="ia-clarity-level" style="color:${clarityColors[clarityKey]}">${clarity.label}</div>
      <div class="ia-clarity-bar-wrap">
        <div class="ia-clarity-bar-fill" id="ia-clarity-fill" style="width:0%;background:linear-gradient(90deg,rgba(65,91,124,.4),${clarityColors[clarityKey]})"></div>
      </div>
      <div class="ia-clarity-desc">${clarity.desc}</div>
    </div>

    <div class="ia-sg-grid">
      <div class="ia-sg-card">
        <div class="ia-sg-label s">What's Working</div>
        <div class="ia-sg-text">${intent.strength}</div>
      </div>
      <div class="ia-sg-card">
        <div class="ia-sg-label g">Where to Focus</div>
        <div class="ia-sg-text">${intent.gap}</div>
      </div>
    </div>

    <div class="ia-signal-callout">
      <div class="ey">Connection Code · ${intent.signal}</div>
      <p>Your result maps to <strong style="color:#EDF2F7;">${intent.signal}</strong> of the Connection Code — the behavioral framework that governs this stage of connection. The Playbook teaches this signal in full depth, with every script and principle organized around it.</p>
    </div>

    <div class="ia-cta-block">
      <div class="ia-cta-label">Your Recommended Next Step</div>
      <div class="ia-cta-main">${clarityKey === 'high' ? 'You have the clarity. Now build the system.' : clarityKey === 'medium' ? 'Strengthen the signals. The methodology is the lever.' : 'Start with the framework. Clarity is the first work.'}</div>
      <div class="ia-cta-note">${clarity.cta_note}</div>
      <div style="display:flex;flex-direction:column;gap:.6rem;align-items:stretch;">
        ${primaryCTA}
        ${secondaryCTA}
        ${vipCTA}
      </div>
      <button class="ia-retake" onclick="iaRetake()">Retake the assessment</button>
    </div>
  `;

  // Animate clarity bar
  setTimeout(() => {
    const fill = document.getElementById('ia-clarity-fill');
    if (fill) fill.style.width = clarityPct + '%';
  }, 400);
}

window.iaRetake = function() {
  iaAnswers = {};
  iaScores  = {};
  iaClarity = 0;
  document.querySelectorAll('.ia-opt').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll('.ia-q-screen button[id^="ia-cont"]').forEach(b => b.disabled = true);
  document.getElementById('ia-result').classList.remove('active');
  document.getElementById('ia-land').style.display = 'flex';
  updateProgress(0);
  window.scrollTo({top:0, behavior:'smooth'});
};

function updateProgress(pct) {
  const f = document.getElementById('ia-prog');
  if (f) f.style.width = pct + '%';
}

// Scroll progress
window.addEventListener('scroll', () => {
  const h = document.documentElement;
  const land = document.getElementById('ia-land');
  if (land && land.style.display !== 'none') return;
  const pct = window.scrollY / (h.scrollHeight - h.clientHeight) * 100;
  // updateProgress(pct); // comment out to keep step-based progress
}, {passive:true});

const nav = document.querySelector('nav');
if (nav) window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 60), {passive:true});