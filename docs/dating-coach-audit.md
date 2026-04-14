# MatchMakers Dating Coach: Comprehensive Audit and Redesign Specification

**Document version:** 1.0
**Date:** 2026-04-14
**Scope:** AI Dating Coach product — frontend (coach-orb.js, playbook-content.js), backend (coach-proxy/index.ts), UX, architecture, mobile web
**Product price:** $500 / 30-day access
**Model:** Claude Sonnet via Supabase Edge Function

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current-State Audit Findings](#2-current-state-audit-findings)
3. [Recommended Onboarding and Intent Architecture](#3-recommended-onboarding-and-intent-architecture)
4. [User State, Memory, and Preference Framework](#4-user-state-memory-and-preference-framework)
5. [Methodology and Resource Architecture](#5-methodology-and-resource-architecture)
6. [Premium Conversation Design](#6-premium-conversation-design)
7. [UX/UI Product Experience Design](#7-uxui-product-experience-design)
8. [Tiered Access Architecture](#8-tiered-access-architecture)
9. [Functional and Technical Architecture](#9-functional-and-technical-architecture)
10. [Mobile Web Navigation and Coach System](#10-mobile-web-navigation-and-coach-system)
11. [QA and Zero-Regression Plan](#11-qa-and-zero-regression-plan)
12. [Final Prioritized Action Plan](#12-final-prioritized-action-plan)

---

## 1. Executive Summary

### What Was Audited

A full-stack audit of the MatchMakers Dating Coach product across three codebases:

- **coach-orb.js** (605 lines) -- floating gold orb and side-panel chat, present on every page
- **playbook-content.js** (227 lines) -- embedded coach within the Playbook content page
- **coach-proxy/index.ts** (430 lines) -- Supabase Edge Function proxy to Anthropic API with an 8,000-word system prompt containing the complete MatchMakers 5-phase methodology
- **style.css** (coach sections, ~350 lines) -- all visual styling for both surfaces
- **HTML templates** across index.html and playbook/content/index.html

### Key Findings

1. **Onboarding creates friction, not value.** Three mandatory steps (Intent, Phase, Focus) force users through jargon they do not understand before they can ask a single question. The Phase question uses internal methodology language ("Phase 3 -- Active Conversations") that means nothing to a new user who paid $500 and wants to start talking to their coach immediately.

2. **No conversation persistence.** Message history is stored only in JavaScript variables (`cp_history`, `pb_history`). Every page reload, browser close, or navigation event destroys the entire conversation. For a $500 product with 30-day access, this is a critical deficiency.

3. **Rate limiting is ephemeral.** The Edge Function stores rate limits in an in-memory `Map`. Every cold start (Supabase scales to zero after inactivity) resets all counters, meaning the 50-message daily limit is not enforced reliably.

4. **Two independent codebases do the same thing.** coach-orb.js and playbook-content.js duplicate the entire chat interface, onboarding flow, and API integration with no shared code. State is not synced between surfaces -- a user who onboards via the orb must re-onboard on the playbook page.

5. **Mobile web experience is broken.** The coach panel uses `85vh` height on mobile, which does not account for the iOS Safari dynamic toolbar. The virtual keyboard pushes the input area offscreen. Touch targets in onboarding are below Apple's 44px minimum.

6. **No settings or editing capability.** Once a user selects their Intent during onboarding, there is no way to change it without clearing localStorage manually. No settings panel exists.

7. **Access validation is inconsistent.** The orb accepts any code starting with `MMCOACH` (prefix check). The playbook checks against a specific code (`MMCOACH2026`) or exact prefix. Different validation logic between two surfaces of the same product.

### Transformation Vision

Transform the Dating Coach from a functional prototype into an investor-grade, premium AI coaching experience that:

- Onboards users in a single, personal step (not three clinical steps)
- Persists all conversations for 30 days across sessions, devices, and surfaces
- Controls API costs through intelligent conversation summarization
- Delivers a mobile-first web experience indistinguishable from a native app
- Supports tiered access (Standard at $500, Premium at $750-1000)
- Makes the MatchMakers methodology the visible, felt differentiator in every interaction

### Expected Impact

| Metric | Current | Target |
|--------|---------|--------|
| Onboarding completion rate | Unknown (no analytics) | 95%+ |
| Message persistence | 0 minutes (lost on reload) | 30 days |
| Rate limit reliability | Resets on cold start | 100% enforced |
| Mobile web usability | Broken (keyboard, height, targets) | Native-app feel |
| API cost per request | ~4,000 tokens (full history) | ~2,500 tokens (summary + recent) |
| Time to first message | 45-90 seconds (3 steps) | 10-15 seconds (1 step) |
| Surfaces synced | No | Yes |

---

## 2. Current-State Audit Findings

### 2.1 What Is Working

- **System prompt quality is high.** The 8,000-word system prompt in `coach-proxy/index.ts` is well-structured across 7 sections covering methodology, platform mechanics, product ecosystem, brand voice, coaching protocol, and response format standards. It is the single strongest asset in the current implementation.
- **Visual design of the orb is premium.** The gold radial gradient, animated glow ring, and breathing pulse during thinking state create the right premium feel at first glance.
- **Edge Function architecture is correct.** Using a server-side proxy to keep the API key and system prompt out of client code is the right pattern.
- **Basic chat flow works.** Users can send messages and receive AI responses. The markdown-to-HTML rendering handles bold text and line breaks.
- **Suggested prompts exist.** Four default prompts give new users a starting point.

### 2.2 What Is Not Working

#### Onboarding Friction

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| 3 mandatory steps before chat | Critical | Abandonment before first message |
| Phase question uses internal jargon | High | User confusion, wrong selections |
| No "I don't know" as a first-class path | High | Forces premature commitment |
| No way to skip any step | High | Blocks eager users |
| No free-text input option | Medium | Limits expression |
| Progress pips show 3 dots -- implies long process | Medium | Psychological friction |
| Onboarding UX different between orb and playbook | Medium | Inconsistent product feel |

#### Question Order and Clarity

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| Phase question assumes methodology knowledge | Critical | Users guess wrong, coach gets wrong context |
| Focus question is redundant (coach should ask this) | High | Unnecessary friction |
| Intent options lack descriptions | Medium | "Fall in Love" vs "Long-Term" distinction unclear |
| "Not Sure" is buried as last option | Medium | Stigmatizes uncertainty |

#### Personalization

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| Welcome message is generic when context is set | High | Doesn't feel personal or premium |
| Suggested prompts are static, not Intent-aware | High | Same prompts for Marriage and Casual users |
| No user name collection | Medium | Cannot personalize greetings |
| No returning-user experience | High | Every session feels like the first |

#### Redundancy Between Surfaces

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| coach-orb.js and playbook-content.js are independent copies | High | Double maintenance, double bugs |
| State not shared (Intent, Phase, Focus, history) | High | User must repeat setup on each surface |
| Different onboarding HTML structure | Medium | Inconsistent experience |
| Different access code validation logic | High | Security inconsistency |

#### User Burden

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| No way to edit Intent after onboarding | Critical | Locked into wrong selection |
| No settings panel | High | No user control |
| "New Session" does not offer to reset Intent | Medium | Stale context after goal change |
| No message usage indicator | Medium | User does not know how many messages remain |
| Days remaining never refreshes live | Low | Stale badge until page reload |

#### Premium Feel

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| No smooth panel animations on mobile | High | Feels cheap on the primary device |
| No status transitions (Ready / Thinking / Rate Limited) with visual states | Medium | Unclear system state |
| Chat input area has no polish (plain textarea) | Medium | Does not feel like $500 |
| No message timestamps | Low | Cannot track conversation flow |
| "New" button in header feels disposable | Low | Premium products say "New Session" |

#### Flexibility and Adaptability

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| System prompt has no tier awareness | High | Cannot differentiate Standard vs Premium behavior |
| No adaptive tone logic | Medium | Same tone for panicked "she texted" and strategic planning |
| No follow-up suggestion generation | Medium | Conversation dead-ends after each response |
| No "I don't know" coaching protocol in system prompt | High | Coach does not know how to handle uncertain users |

#### Methodology Integration

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| Methodology references in system prompt are strong | N/A (working) | Good |
| Phase detection logic exists but is passive | Medium | Coach waits for user to indicate phase |
| No proactive phase identification in first response | Medium | Missed opportunity to demonstrate methodology value |
| Playbook cross-references not surfaced | Low | Missed upsell and education opportunity |

#### Memory Design

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| History stored only in JS variables | Critical | Total loss on any navigation |
| No conversation persistence mechanism | Critical | Unusable as a 30-day product |
| No session summary generation | High | Full history sent every request (cost) |
| History cap at 40 messages (in-memory) is arbitrary | Medium | No graceful degradation |

#### First-Time UX

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| Tooltip only shows once, for 5 seconds | Low | May miss it |
| No explanation of what coach can do | High | User must guess capabilities |
| No example conversations or use cases | Medium | Cold start problem |

#### Repeat UX

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| No "welcome back" experience | High | Every return feels like first visit |
| No conversation continuity | Critical | Cannot reference previous sessions |
| No progress tracking | Medium | No sense of coaching journey |

#### Web-Only Experience

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| Works without app | N/A (working) | Good |
| No offline capability | Low | Expected for web product |
| No PWA features | Low | Nice-to-have, not critical |

#### Mobile Web Experience

| Issue | Severity | Business Impact |
|-------|----------|-----------------|
| Panel height uses `85vh` not `100dvh` | Critical | Content hidden behind Safari toolbar |
| Virtual keyboard pushes input offscreen | Critical | Cannot type on mobile |
| Touch targets below 44px minimum | High | Difficult to tap on mobile |
| No swipe-to-dismiss | Medium | Missing expected mobile gesture |
| Orb position may conflict with thumb zone | Medium | Ergonomic issue |
| Panel border-radius on mobile is decorative waste | Low | 18px radius on full-width panel |

### 2.3 Bug Report

#### Bug 1: Access Code Validation Inconsistency

**Severity:** High
**Surfaces:** coach-orb.js (line 392) vs playbook-content.js (line 97)

**Reproduction:**
1. Open the orb on the home page
2. Enter code "MMCOACH-ANYTHING" -- accepts (prefix check: `code.startsWith('MMCOACH')`)
3. Open the playbook content page
4. Enter code "MMCOACH-ANYTHING" -- also accepts (same prefix check)
5. Enter code "RANDOM123" -- rejected on both

**Root cause:** Both surfaces use prefix matching for MMCOACH codes, but the playbook also checks against a hardcoded `DC_CODE = 'MMCOACH2026'` constant. If this constant is changed, the orb would not be updated. The orb also separately calls `lookupPromo()` for free promo codes while the playbook has its own promo check.

**Fix:** Centralize access validation in a shared module or validate server-side.

#### Bug 2: Intent/Phase/Focus State Not Synced Across Surfaces

**Severity:** High
**Surfaces:** coach-orb.js vs playbook-content.js

**Reproduction:**
1. Open the orb, complete onboarding with Intent="Marriage", Phase="Phase 3"
2. Navigate to the Playbook content page
3. The playbook coach reads from the same localStorage keys (`pb_dc_intent`, etc.) so it should have the data
4. However, the in-memory variables `pb_intent`, `pb_phase`, `pb_focus` in playbook-content.js are initialized empty and only loaded if `pb_dc_onboarded` is set
5. If user changes Intent on one surface, the other surface's in-memory state is stale until page reload

**Root cause:** Both scripts read localStorage on init but hold state in separate in-memory variables. No `storage` event listener syncs changes between tabs or between orb and playbook on the same page.

**Fix:** Add `window.addEventListener('storage', ...)` listener in both scripts, or unify into a single script.

#### Bug 3: Onboarding Bypass When Context Keys Are Empty

**Severity:** Medium
**Surfaces:** Both

**Reproduction:**
1. Open browser console
2. Run: `localStorage.setItem('pb_dc_onboarded', '1')`
3. Do NOT set `pb_dc_intent`, `pb_dc_phase`, or `pb_dc_focus`
4. Reload the page
5. Coach initializes with empty Intent, empty Phase, empty Focus
6. Welcome message displays: "Your context is set -- Intent, . What are you working on right now?" (broken formatting)
7. MEMBER CONTEXT sent to API has "Intent: Not specified / Phase: Not specified / Focus: Not specified"

**Root cause:** `initCoachPanel()` checks only `localStorage.getItem('pb_dc_onboarded')` without verifying that required context values exist.

**Fix:** Validate that at least Intent is present; if not, re-trigger onboarding.

#### Bug 4: "New Session" Does Not Reset Intent

**Severity:** Medium
**Surfaces:** Both

**Reproduction:**
1. Complete onboarding with Intent="Casual"
2. Use coach for several messages
3. Click "New Session" / "New" button
4. Confirm the clear
5. History is cleared, welcome message reshown
6. Intent remains "Casual" -- no option to change it
7. User whose goals have changed is now stuck with wrong context

**Root cause:** `newSession()` / `pbDcNewSession()` only clears `cp_history` / `pb_history` and re-renders messages. It does not touch localStorage Intent/Phase/Focus and offers no re-onboarding option.

**Fix:** Add "Reset goals" option in New Session flow, or add settings panel for Intent editing.

#### Bug 5: Days Remaining Badge Never Refreshes Without Page Reload

**Severity:** Low
**Surfaces:** Both

**Reproduction:**
1. Open coach at 11:59 PM with "1d remaining" showing
2. Wait until after midnight
3. Badge still shows "1d remaining"
4. Reload page -- now shows "Access expired"

**Root cause:** `updateDaysRemaining()` is called once during `initCoachPanel()` and never again. No interval or visibility-change listener triggers a refresh.

**Fix:** Add `document.addEventListener('visibilitychange', ...)` to refresh the badge when the tab regains focus.

#### Bug 6: Message History Lost on Page Reload

**Severity:** Critical
**Surfaces:** Both

**Reproduction:**
1. Open coach, send 5 messages, receive 5 responses
2. Press F5 or navigate away and back
3. All conversation history is gone
4. Welcome message displays again as if first visit

**Root cause:** `cp_history` and `pb_history` are plain JavaScript arrays with no persistence layer. No IndexedDB, no localStorage serialization, no server-side storage.

**Fix:** Implement IndexedDB persistence with 30-day TTL (detailed in Section 4).

#### Bug 7: Rate Limit Resets on Edge Function Cold Start

**Severity:** High
**Surface:** coach-proxy/index.ts

**Reproduction:**
1. Send 50 messages to hit rate limit
2. Wait 15-30 minutes (Supabase cold start threshold)
3. Send another message
4. Message succeeds -- rate limit has been reset

**Root cause:** Line 293 in index.ts: `const rateLimits = new Map<string, { count: number; resetAt: number }>();` -- this is module-level state that lives only in the Edge Function instance's memory. When the instance is recycled, the Map is garbage collected.

**Fix:** Move rate limit tracking to a Supabase table (detailed in Section 9).

---

## 3. Recommended Onboarding and Intent Architecture

### 3.1 Changes Summary

| Current | Recommended |
|---------|-------------|
| 3 mandatory steps (Intent, Phase, Focus) | 1 step (Intent only) |
| Phase question (5 options using internal jargon) | REMOVED -- coach infers from conversation |
| Focus question (3 options) | REMOVED -- coach asks this conversationally |
| "Not Sure" buried as 6th option | "I'm not sure yet" promoted to first-class path |
| No free-text alternative | Optional "Or tell me what's going on" textarea |
| No way to edit after selection | Settings panel with gear icon |
| Same flow for orb and playbook | Unified component, same behavior everywhere |

### 3.2 New Intent Options

The redesigned Intent selection presents these options:

```
[Long-Term Relationship]  -- Find a committed partner
[Marriage]                 -- Find the person to marry
[Fall in Love]             -- Open to deep connection
[Casual Dating]            -- Enjoy dating without pressure
[Short-Term]               -- Something real, not forever
[I'm not sure yet]         -- Help me figure it out     <-- PROMOTED, visually distinct
```

Plus an optional free-text field below:

```
Or tell me what's going on in your own words (optional):
[                                                      ]
```

### 3.3 "I'm Not Sure Yet" Flow

When a user selects "I'm not sure yet," the coach enters a discovery protocol:

**Welcome message for "I'm not sure yet" users:**

> Welcome to your MatchMakers Dating Coach. I'm here to help you figure out exactly what you want -- that's actually Phase 1 of the methodology, and it's where every great outcome starts.
>
> Let me ask you a few questions to get us started. There's no wrong answer here.
>
> First: What made you sign up for coaching right now? Was there a specific situation, or more of a general feeling that something needs to change?

**System prompt addition for "I'm not sure yet" protocol:**

```
INTENT DISCOVERY PROTOCOL (when member selects "I'm not sure yet"):

This is Phase 1 in action. The member has declared "I'm not sure" and that IS a valid
starting point. Your job is to help them find clarity through questions, not to assign
them an Intent.

Discovery sequence:
1. Ask what prompted them to sign up right now (situation vs. general feeling)
2. Ask about their last meaningful dating experience and what they wanted from it
3. Ask what outcome would make them feel like this coaching was worth it
4. Based on their answers, reflect back what you're hearing and suggest an Intent
5. Let them confirm or adjust

Rules:
- Never pressure them to choose. Uncertainty is honest and productive.
- Frame discovery as Phase 1 of the methodology: "This IS the process working."
- After 3-5 exchanges, you should have enough to suggest an Intent.
- If they confirm an Intent, acknowledge the shift: "Great. Your Intent is [X].
  Everything I recommend from here will be calibrated to that."
- Store the discovered Intent the same way a selected Intent is stored.

Do NOT:
- Rush them. Discovery conversations are some of the most valuable.
- Treat "not sure" as lesser than a declared Intent.
- Skip methodology references. This is literally Phase 1.
```

### 3.4 Progressive Profiling Strategy

Instead of asking Phase and Focus upfront, the coach learns these through conversation:

| Information | How It Is Learned | When It Is Used |
|-------------|-------------------|-----------------|
| Intent | Selected at onboarding (or discovered via "not sure" flow) | Every response is calibrated to Intent |
| Phase | Inferred from first 1-3 messages (talking about profiles = Phase 2, messaging = Phase 3, etc.) | Coach announces detected phase and adapts guidance |
| Focus | Coach's first conversational question after welcome | Sets initial conversation direction |
| Name | Coach asks naturally in first exchange if user doesn't offer it | Personalization |
| Platform usage | Inferred from questions (mentions M button = active user, asks what M button is = new user) | Adjusts mechanical explanations |
| Emotional state | Detected from message tone and content | Adjusts between strategic/empathetic/direct tone |

### 3.5 How Users Edit Intent Later

**Settings panel access:** Gear icon in the coach header, positioned between "days remaining" and "New Session" button.

**Settings panel contents:**
- Current Intent (with change option)
- Message usage today (e.g., "23 of 50 messages used")
- Days remaining
- Tier indicator (Standard / Premium)
- "Clear conversation history" option
- "Upgrade to Premium" button (if on Standard)

**Intent change flow:**

1. User taps gear icon
2. Settings panel slides down from header (overlays chat area)
3. Current Intent shown with "Change" link
4. Tapping "Change" shows the 6 Intent options + "I'm not sure"
5. User selects new Intent
6. Coach inserts a system message: "Your Intent has been updated to [New Intent]."
7. Coach's next response acknowledges the change: "Got it -- you're now focused on [New Intent]. That changes our approach. Here's what I'd recommend adjusting..."

**How the system handles Intent changes:**

```javascript
// When Intent changes from current to new:
async function handleIntentChange(oldIntent, newIntent) {
  // 1. Update localStorage
  localStorage.setItem('pb_dc_intent', newIntent);

  // 2. Insert a system-visible message into the conversation
  const changeNote = `[Intent changed from "${oldIntent}" to "${newIntent}"]`;
  addMessage('system', `Your coaching focus has been updated to: ${newIntent}`);

  // 3. Add context note to next API call
  // This is appended to the MEMBER CONTEXT block:
  // "Intent: [newIntent] (changed from [oldIntent] during this session)"

  // 4. Do NOT clear conversation history
  // The coach should reference the change naturally
}
```

### 3.6 Complete Onboarding Flow Diagram

```
User opens coach (orb click or playbook scroll)
        |
        v
[Has access?] --NO--> [Show purchase/code entry]
        |
       YES
        |
        v
[Has completed onboarding (pb_dc_onboarded)?]
        |                     |
       YES                   NO
        |                     |
        v                     v
[Load stored Intent]   [Show single onboarding screen]
[Load stored history]         |
[Show chat with              [6 Intent buttons]
 returning welcome]          [+ "I'm not sure yet"]
                             [+ optional free-text field]
                                    |
                                    v
                            [User selects Intent OR types free text]
                                    |
                          +---------+---------+
                          |                   |
                   [Selected Intent]   ["I'm not sure"]
                          |                   |
                          v                   v
                   [Store Intent]      [Store "exploring"]
                   [Mark onboarded]    [Mark onboarded]
                          |                   |
                          v                   v
                   [Show chat]         [Show chat]
                   [Intent-adapted     [Discovery welcome
                    welcome message]    message begins
                   [Intent-specific     Phase 1 protocol]
                    suggested prompts]
```

### 3.7 Onboarding HTML (Redesigned -- Single Step)

```html
<!-- New onboarding: single step, replaces 3-step flow -->
<div id="co-onboard" class="cp-onboard">
  <div class="cp-ob-header">
    <div class="cp-ob-greeting">Welcome to your Dating Coach</div>
    <div class="cp-ob-sub">Before we start, one question:</div>
  </div>

  <div class="cp-ob-q">What are you looking for?</div>
  <div class="cp-ob-opts">
    <button class="cp-ob-opt co-intent-opt"
            onclick="coSelectIntent(this,'Long-Term')">
      <span class="cp-ob-opt-name">Long-Term Relationship</span>
      <span class="cp-ob-opt-desc">Find a committed partner</span>
    </button>
    <button class="cp-ob-opt co-intent-opt"
            onclick="coSelectIntent(this,'Marriage')">
      <span class="cp-ob-opt-name">Marriage</span>
      <span class="cp-ob-opt-desc">Find the person to marry</span>
    </button>
    <button class="cp-ob-opt co-intent-opt"
            onclick="coSelectIntent(this,'Fall in Love')">
      <span class="cp-ob-opt-name">Fall in Love</span>
      <span class="cp-ob-opt-desc">Open to deep connection</span>
    </button>
    <button class="cp-ob-opt co-intent-opt"
            onclick="coSelectIntent(this,'Casual')">
      <span class="cp-ob-opt-name">Casual Dating</span>
      <span class="cp-ob-opt-desc">Enjoy dating without pressure</span>
    </button>
    <button class="cp-ob-opt co-intent-opt"
            onclick="coSelectIntent(this,'Short-Term')">
      <span class="cp-ob-opt-name">Short-Term</span>
      <span class="cp-ob-opt-desc">Something real, not forever</span>
    </button>
    <button class="cp-ob-opt co-intent-opt cp-ob-opt--unsure"
            onclick="coSelectIntent(this,'Not Sure')">
      <span class="cp-ob-opt-name">I'm not sure yet</span>
      <span class="cp-ob-opt-desc">Help me figure it out</span>
    </button>
  </div>

  <div class="cp-ob-freetext">
    <label class="cp-ob-freetext-label">
      Or tell me what's going on in your own words:
    </label>
    <textarea class="cp-ob-freetext-input" id="co-freetext"
              placeholder="e.g., I just got out of a long relationship and I'm not sure what I want..."
              rows="2" maxlength="500"></textarea>
  </div>

  <button class="cp-ob-start" id="co-ob-start" disabled
          onclick="coStartCoach()">
    Start Coaching Session
  </button>
</div>
```

### 3.8 Onboarding JavaScript (Redesigned)

```javascript
// Simplified onboarding -- single step
var intent = '';
var freeText = '';

window.coSelectIntent = function (el, v) {
  // Deselect all
  document.querySelectorAll('.co-intent-opt').forEach(function (o) {
    o.classList.remove('sel');
  });
  el.classList.add('sel');
  intent = v;
  // Enable start button when Intent is selected OR free text is entered
  updateStartButton();
};

function onFreeTextInput() {
  freeText = document.getElementById('co-freetext').value.trim();
  // If user types free text, auto-select "Not Sure" if no Intent selected
  if (freeText && !intent) {
    var unsureBtn = document.querySelector('.cp-ob-opt--unsure');
    if (unsureBtn) {
      unsureBtn.classList.add('sel');
      intent = 'Not Sure';
    }
  }
  updateStartButton();
}

function updateStartButton() {
  var btn = document.getElementById('co-ob-start');
  if (btn) {
    btn.disabled = !(intent || freeText);
  }
}

window.coStartCoach = function () {
  // Store selections
  localStorage.setItem('pb_dc_onboarded', '1');
  localStorage.setItem('pb_dc_intent', intent || 'Not Sure');

  // Store free text if provided (sent as context in first message)
  if (freeText) {
    localStorage.setItem('pb_dc_freetext', freeText);
  }

  // Phase and Focus are no longer stored -- inferred by coach
  localStorage.removeItem('pb_dc_phase');
  localStorage.removeItem('pb_dc_focus');

  // Transition to chat
  if (onboardEl) onboardEl.style.display = 'none';
  if (chatEl) chatEl.style.display = 'flex';

  setTimeout(function () {
    showWelcome(intent, freeText);
  }, 300);
};
```

---

## 4. User State, Memory, and Preference Framework

### 4.1 Storage Architecture Overview

| Data | Storage | Lifetime | Sync |
|------|---------|----------|------|
| Access flag (`pb_dc_access`) | localStorage | Until cleared | Cross-tab via storage event |
| First access timestamp (`pb_dc_first`) | localStorage | Permanent | Cross-tab via storage event |
| Onboarded flag (`pb_dc_onboarded`) | localStorage | Until cleared | Cross-tab via storage event |
| Intent (`pb_dc_intent`) | localStorage + IndexedDB | 30 days | Cross-tab via storage event |
| Free text from onboarding | IndexedDB | 30 days | N/A |
| Session ID (`dc_session`) | localStorage | Until cleared | Cross-tab via storage event |
| Conversation messages | IndexedDB | 30 days | N/A (client-only) |
| Conversation summaries | IndexedDB | 30 days | N/A (client-only) |
| Tier (`pb_dc_tier`) | localStorage (synced from server) | Session | Updated on each API call |
| Message count today | Supabase table (server) | 24 hours | Server-authoritative |
| Panel open/closed state | In-memory only | Current session | N/A |
| Typing state | In-memory only | Current session | N/A |
| Input draft text | In-memory only | Current session | N/A |

### 4.2 Long-Term Storage: IndexedDB Schema

```javascript
// IndexedDB database: "matchmakers_coach"
// Version: 1

const DB_NAME = 'matchmakers_coach';
const DB_VERSION = 1;

function openDB() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function (event) {
      var db = event.target.result;

      // Store: messages
      // Key: auto-increment
      // Indexes: sessionId, timestamp
      if (!db.objectStoreNames.contains('messages')) {
        var msgStore = db.createObjectStore('messages', {
          keyPath: 'id',
          autoIncrement: true
        });
        msgStore.createIndex('sessionId', 'sessionId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store: summaries
      // Key: summaryId (sessionId + sequence number)
      if (!db.objectStoreNames.contains('summaries')) {
        var sumStore = db.createObjectStore('summaries', {
          keyPath: 'summaryId'
        });
        sumStore.createIndex('sessionId', 'sessionId', { unique: false });
        sumStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Store: userProfile
      // Key: 'profile' (singleton)
      if (!db.objectStoreNames.contains('userProfile')) {
        db.createObjectStore('userProfile', { keyPath: 'key' });
      }

      // Store: metadata
      // Key: string key
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = function (event) {
      resolve(event.target.result);
    };

    request.onerror = function (event) {
      reject(event.target.error);
    };
  });
}
```

**Message record schema:**

```javascript
{
  id: /* auto-increment */,
  sessionId: 'dc_1713100000000_abc123',
  role: 'user' | 'assistant',
  content: 'The message text',
  timestamp: 1713100000000,
  summarized: false  // true once included in a summary
}
```

**Summary record schema:**

```javascript
{
  summaryId: 'dc_1713100000000_abc123_summary_1',
  sessionId: 'dc_1713100000000_abc123',
  content: 'Summary of messages 1-10: User is in Phase 3, working on...',
  messageRange: { from: 1, to: 10 },
  timestamp: 1713100500000
}
```

**User profile record schema:**

```javascript
{
  key: 'profile',
  intent: 'Long-Term',
  freeText: 'Just got out of a 3-year relationship...',
  inferredPhase: 'Phase 2',
  name: 'Mike',  // learned from conversation
  createdAt: 1713100000000,
  updatedAt: 1713100500000
}
```

### 4.3 Per-Session Only Storage

These values exist only in JavaScript variables and are intentionally ephemeral:

```javascript
var sessionState = {
  panelOpen: false,          // Panel visibility
  typing: false,             // Whether AI is generating
  inputDraft: '',            // Current unsent text in textarea
  lastScrollPosition: 0,    // Scroll position in messages
  pendingSummary: false      // Whether a summary generation is in progress
};
```

### 4.4 Usage Inference

The system infers information from user behavior without asking:

| Inference | Signal | How Used |
|-----------|--------|----------|
| Likely phase | Message content keywords (see Section 2 of system prompt, "Diagnosing Where A Member Is") | Coach announces detected phase |
| Engagement pattern | Messages per day, time between sessions, conversation length | Adjust proactive suggestions |
| Emotional state | Language analysis (urgency markers, emotional words, punctuation) | Tone adaptation |
| Platform familiarity | Whether user references M button, Levels, Requests by name | Adjust mechanical explanations |
| Session maturity | Number of sessions, total messages sent | Depth of coaching responses |

### 4.5 Conflict Resolution

**Scenario:** Stored Intent says "Marriage" but user asks about a casual hookup.

**Resolution logic:**

```
System prompt addition:

INTENT CONFLICT HANDLING:

When a member's current message contradicts their declared Intent, do NOT:
- Ignore the contradiction
- Silently switch to the new context
- Lecture them about consistency

DO:
- Acknowledge both: "Your Intent is set to Marriage, and you're asking about
  something more casual. That's totally fine -- people have layers."
- Ask for clarity: "Should I adjust your Intent, or is this a one-off situation
  you want tactical help with?"
- If they want to change Intent: guide them to the settings gear icon
- If it's situational: help with the current question while noting the broader
  context
```

### 4.6 Conversation Persistence Architecture

#### Message Storage Flow

```
User sends message
        |
        v
[Add to in-memory history array]
        |
        v
[Write to IndexedDB 'messages' store]
        |
        v
[Check message count since last summary]
        |
   >= 10 messages?
   /           \
  YES           NO
   |             |
   v             v
[Generate      [Continue]
 summary via
 API call]
   |
   v
[Store summary in IndexedDB 'summaries' store]
[Mark messages 1-10 as summarized: true]
```

#### Summary Generation

Every 10 messages, the system generates a summary to compress older context:

```javascript
async function generateSummary(messages) {
  // messages: array of the 10 messages to summarize
  var summaryPrompt = [
    {
      role: 'user',
      content: 'Summarize this coaching conversation in 150 words or fewer. ' +
        'Include: (1) the user\'s current situation and goals, ' +
        '(2) key advice given, (3) any action items or next steps discussed, ' +
        '(4) the user\'s emotional state and engagement level. ' +
        'Format as a concise narrative paragraph.\n\n' +
        'CONVERSATION:\n' +
        messages.map(function (m) {
          return m.role.toUpperCase() + ': ' + m.content;
        }).join('\n\n')
    }
  ];

  var response = await fetch(COACH_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getSessionId(),
      'x-summary-request': '1'  // Edge Function routes this differently
    },
    body: JSON.stringify({
      messages: summaryPrompt,
      context: ''  // No member context needed for summary
    })
  });

  var data = await response.json();
  return data.content[0].text;
}
```

#### Session Restoration (Page Reload / Return Visit)

```javascript
async function restoreSession() {
  var db = await openDB();

  // 1. Load the most recent summary
  var summaries = await getAllFromStore(db, 'summaries');
  var latestSummary = summaries.length > 0
    ? summaries[summaries.length - 1]
    : null;

  // 2. Load the last 5 unsummarized messages
  var messages = await getAllFromStore(db, 'messages');
  var recentMessages = messages
    .filter(function (m) { return !m.summarized; })
    .slice(-5);

  // 3. Build the context for the API
  var restoredContext = '';
  if (latestSummary) {
    restoredContext += '\n\nPREVIOUS SESSION SUMMARY:\n' + latestSummary.content;
  }

  // 4. Rebuild in-memory history for display
  //    Show last 20 messages in the UI (scrollable)
  var displayMessages = messages.slice(-20);
  displayMessages.forEach(function (m) {
    addMessage(m.role === 'assistant' ? 'coach' : 'user', m.content);
  });

  // 5. Set the API history to summary + recent (not full history)
  cp_history = [];
  if (latestSummary) {
    cp_history.push({
      role: 'user',
      content: '[Previous session summary: ' + latestSummary.content + ']'
    });
    cp_history.push({
      role: 'assistant',
      content: 'I have context from our previous conversations. How can I help you today?'
    });
  }
  recentMessages.forEach(function (m) {
    cp_history.push({ role: m.role, content: m.content });
  });

  return displayMessages.length > 0;
}
```

#### Cost Impact Analysis

**Current approach (no persistence, no summaries):**
- System prompt: ~8,000 words = ~10,000 tokens
- Full message history (up to 40 messages): ~8,000 tokens average
- Total per request: ~18,000 tokens input
- At Sonnet pricing ($3/M input tokens): $0.054 per request
- 50 messages/day x 30 days = 1,500 requests per user
- Cost per user per 30-day period: **$81.00**

**Optimized approach (summaries + 5 recent messages):**
- System prompt: ~10,000 tokens (unchanged)
- Summary (150 words): ~200 tokens
- Last 5 messages: ~1,000 tokens
- Total per request: ~11,200 tokens input
- At Sonnet pricing ($3/M input tokens): $0.034 per request
- 50 messages/day x 30 days = 1,500 requests per user
- Cost per user per 30-day period: **$51.00**

**Savings: ~37% per user ($30 per user per 30-day cycle)**

Note: Summary generation adds ~1 extra API call per 10 messages (150 additional calls per user per 30 days), but these are small requests (~2,000 tokens each), adding approximately $0.90 per user. Net savings remain significant.

| Users | Current Cost (30 days) | Optimized Cost (30 days) | Savings |
|-------|----------------------|------------------------|---------|
| 10 | $810 | $519 | $291 |
| 50 | $4,050 | $2,595 | $1,455 |
| 100 | $8,100 | $5,190 | $2,910 |

### 4.7 User-Type Logic Framework

#### New User, No Data

```
Trigger: pb_dc_onboarded not set, no IndexedDB data
Flow:
  1. Show onboarding (single Intent step)
  2. After selection, show Intent-adapted welcome message
  3. Show Intent-specific suggested prompts
  4. First response includes methodology orientation
State after: pb_dc_onboarded=1, pb_dc_intent=[selected], IndexedDB initialized
```

#### Web-Only Paying User, No App

```
Trigger: pb_dc_access=1, no app-specific data
Flow:
  1. Full coach experience, no degradation
  2. When user mentions app-specific features (M button, Levels),
     coach explains them and offers app download link
  3. If user asks about features requiring the app, coach provides
     the web-applicable equivalent or directs to app
State: Same as any other user
```

#### Returning User With History

```
Trigger: pb_dc_onboarded=1, IndexedDB has messages
Flow:
  1. Load messages from IndexedDB, display last 20 in chat
  2. Load most recent summary + last 5 messages as API context
  3. Show returning welcome: "Welcome back. Last time we were
     working on [topic from summary]. How did that go?"
  4. Show context-aware suggested prompts based on last conversation
State: Restored from IndexedDB, no re-onboarding
```

#### User Who Says "I Don't Know"

```
Trigger: User selects "I'm not sure yet" during onboarding
Flow:
  1. Store Intent as "exploring"
  2. Welcome message begins discovery protocol (Section 3.3)
  3. Suggested prompts are discovery-oriented:
     - "I just got out of a relationship"
     - "I want to date but I'm not sure what I'm looking for"
     - "Help me figure out what I actually want"
     - "I've been on some dates but nothing clicks"
  4. After 3-5 exchanges, coach suggests an Intent
  5. If user confirms, update stored Intent
State: pb_dc_intent='exploring' initially, updated when discovered
```

#### User Who Skips Onboarding

```
Trigger: User has pb_dc_onboarded=1 but pb_dc_intent is empty/missing
         (e.g., localStorage was partially cleared, or bug from old code)
Flow:
  1. Detect missing Intent during initCoachPanel()
  2. Show a soft re-onboarding: "Quick question before we start --
     what are you looking for?" (same Intent options)
  3. Do NOT re-show full onboarding screen -- integrate into chat
  4. If user types a message instead of selecting, treat as free-text
     onboarding and set Intent to "exploring"
State: Repaired -- pb_dc_intent set from selection or inferred
```

#### User Whose Goals Changed

```
Trigger: User opens settings panel and changes Intent
Flow:
  1. Store new Intent in localStorage and IndexedDB userProfile
  2. Insert visual divider in chat: "Intent updated: [Old] -> [New]"
  3. Next coach response acknowledges change and adjusts:
     "Got it. You're shifting from [Old] to [New]. That changes our
     approach -- here's what I'd focus on now..."
  4. Summary generation captures the Intent change
  5. Suggested prompts update to reflect new Intent
State: pb_dc_intent updated, conversation continues with new context
```

---

## 5. Methodology and Resource Architecture

### 5.1 Current System Prompt Assessment

The existing system prompt in `coach-proxy/index.ts` is 283 lines and approximately 8,000 words across 7 sections:

1. WHO YOU ARE -- identity and boundaries
2. THE 5-PHASE SYSTEM -- complete methodology (Phases 1-5)
3. PLATFORM MECHANICAL KNOWLEDGE -- M button, Requests, Discovery, Levels
4. PRODUCT ECOSYSTEM -- Connection Code, Playbook, Dating Coach, VIP
5. BRAND VOICE AND COACHING STANDARDS -- tone, what never to say
6. COACHING PROTOCOL -- diagnosis, message review, emotional support
7. RESPONSE FORMAT STANDARDS -- conciseness, formatting, closing questions

**Verdict:** The system prompt is the strongest part of the current implementation. It contains the complete methodology, platform knowledge, and coaching protocol. It should be preserved and enhanced, not replaced.

### 5.2 Recommendation: Keep System Prompt as Primary

At the current scale (single product, one methodology, one platform), the system prompt approach is correct:

- **No RAG needed.** The methodology fits within the context window with room to spare.
- **No vector database needed.** There is no corpus of documents to search.
- **No embedding pipeline needed.** The knowledge is structured, not scattered.

The system prompt should remain the single source of truth for coaching behavior.

### 5.3 System Prompt Enhancements

The following additions should be appended to the existing system prompt:

#### 5.3.1 Tier Awareness

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 8 — TIER AWARENESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Dating Coach has two tiers:
- Standard ($500, 50 messages per day, 30 days)
- Premium ($750-1000, unlimited messages, 30 days)

The MEMBER CONTEXT block includes the member's tier. Adjust behavior accordingly:

For Standard tier members:
- Be concise. Every message counts against their daily limit.
- When a response could be either brief or detailed, choose brief and offer
  to elaborate: "Want me to go deeper on any of these points?"
- If a member is approaching their daily limit (remaining < 10), mention it
  naturally: "You have a few messages left today, so let me make this count."
- Never make the member feel limited. Frame it as intentional: "The daily
  limit keeps our sessions focused."

For Premium tier members:
- You can be more expansive. Offer detailed breakdowns, multiple options,
  and extended coaching sequences.
- Proactively offer to do deep-dives: "Want me to walk you through the full
  Courtship preparation framework?"
- Suggest multi-message coaching exercises: "Let's do a message drafting
  session. Send me the first version and we'll iterate."
```

#### 5.3.2 "I Don't Know" Coaching Protocol

(Full text provided in Section 3.3 above -- append to system prompt as Section 9.)

#### 5.3.3 Follow-Up Suggestion Generation

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 10 — FOLLOW-UP SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After every response, include 1-2 natural follow-up suggestions at the end.
These should feel like a coach's instinct, not a menu.

Format: End your response with a line break, then:
"Want to [specific next step]?" or "Should we [specific next step]?"

Examples:
- After profile feedback: "Want me to draft a new bio version based on this?"
- After message review: "Should we work on a follow-up message too?"
- After Phase identification: "Want me to walk you through what Phase 3
  looks like step by step?"
- After emotional support: "Want to talk about what happened, or should we
  focus on what to do next?"

Rules:
- Maximum 2 suggestions per response
- Suggestions must be specific to the conversation, not generic
- Never suggest things outside your scope (therapy, legal advice, etc.)
- Frame as optional, not mandatory: "Want to..." not "You should..."
- If the conversation has a clear next action, suggest that specific action
- If the conversation is exploratory, suggest a direction to go deeper
```

#### 5.3.4 Context-Adaptive Tone Instructions

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 11 — CONTEXT-ADAPTIVE TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your tone is not one thing. It adapts to the member's emotional state and
the nature of their question. Read the room.

STRATEGIC ADVISOR mode (default):
Trigger: Planning questions, profile work, methodology questions
Tone: Confident, structured, specific. "Here's the framework. Here's what
to do. Here's why it works."
Example: "Your opener has two problems. First, it's a yes/no question..."

EMPATHETIC MENTOR mode:
Trigger: Emotional language, rejection stories, frustration, loneliness,
         "I give up", "what's wrong with me", "I got ghosted"
Tone: Warm, validating, then redirecting to action. Acknowledge the feeling
FIRST, then coach.
Example: "That stings. Being ghosted after what felt like a real connection
is genuinely painful. Here's what I want you to know..."

PERFORMANCE COACH mode:
Trigger: Urgent requests, "she just texted", "what do I say", "date is
         tonight", time-sensitive situations
Tone: Direct, immediate, no preamble. Give the answer first, explain later.
Example: "Here's what to send: [exact text]. Send it now. Here's why this
works..."

DISCOVERY GUIDE mode:
Trigger: "I don't know", vague questions, exploring, new user uncertainty
Tone: Curious, Socratic, gently guiding. Ask more than you answer.
Example: "Interesting. When you say you want something 'real,' what does
that look like for you? What's the first image that comes to mind?"

The transition between modes should be seamless. A single conversation might
move through all four. Never announce the mode shift. Just shift.
```

### 5.4 Structured Scenario Responses

Add a section to the system prompt that provides structured handling for the most common scenarios:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 12 — COMMON SCENARIO FRAMEWORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO: "Help me write an opening message"
Framework:
1. Ask to see the other person's profile (or description of it)
2. Identify 1-2 specific hooks from their profile
3. Draft a message using the template:
   [Specific observation] + [Question that shows you read their profile]
4. Explain WHY each element works, referencing Phase 3 principles
5. Offer a backup version with different energy (playful vs. sincere)

SCENARIO: "They stopped responding"
Framework:
1. Ask for the last 3-5 messages in the conversation
2. Identify the last message's structure (question vs. statement)
3. If statement: "Your last message ended with a statement. Statements
   permit silence. Here's a re-engagement message..."
4. If question and no response after 48+ hours: "The question didn't land.
   Here's what to send as a genuine follow-up..."
5. If multiple non-responses: "This is a pattern. Here's how to read it..."
6. Reference: Phase 3, "When Someone Doesn't Respond" framework

SCENARIO: "Review my profile / bio"
Framework:
1. Ask them to share their bio text
2. Evaluate against three criteria:
   a. Does it sound like everyone else's? (Specificity test)
   b. Does it reveal personality or just list facts? (Voice test)
   c. Does it attract compatible people or everyone? (Intent alignment)
3. Provide specific revisions, not generic tips
4. Reference: Phase 2 Profile principles

SCENARIO: "I just got rejected / ghosted / dumped"
Framework:
1. Acknowledge the pain first. Do not rush to solutions.
2. Validate the feeling without enabling spiraling
3. After 1-2 empathetic exchanges, redirect: "When you're ready,
   here's what I think happened and what you can do differently..."
4. Reference: Phase and methodology context where appropriate
5. If distress seems beyond dating scope, suggest professional support

SCENARIO: "What should I text right now?" (urgent)
Framework:
1. Ask for the exact text they received (if not already shared)
2. Ask for 10 seconds of context (how long dating, how serious)
3. Provide the EXACT text to send -- no hedging, no options
4. Explain in 1 sentence why it works
5. Offer a follow-up strategy if they don't respond
6. This is PERFORMANCE COACH mode -- speed matters

SCENARIO: "How do I ask for a date / video call?"
Framework:
1. Assess where they are in the conversation (message count, rapport level)
2. If < 5 meaningful exchanges: "Build a bit more first. Here's how..."
3. If 5-7 exchanges: "Now is the time. Here's the invite..."
4. Provide the specific language: "I'd love to continue this on a call.
   Are you available [day] around [time]?"
5. Reference: Phase 3 to Phase 4 transition principles
```

### 5.5 System Prompt Versioning Strategy

```javascript
// In coach-proxy/index.ts, add version tracking:
const SYSTEM_PROMPT_VERSION = '2.0.0';

// Include version in API response headers for debugging:
return new Response(
  JSON.stringify({
    content: data.content,
    remaining_messages: rateCheck.remaining,
  }),
  {
    status: 200,
    headers: {
      ...headers,
      'x-prompt-version': SYSTEM_PROMPT_VERSION,
    },
  }
);
```

Version history should be maintained in a `PROMPT_CHANGELOG.md` file:

```
## v2.0.0 (2026-04-XX)
- Added Section 8: Tier Awareness
- Added Section 9: Intent Discovery Protocol
- Added Section 10: Follow-Up Suggestions
- Added Section 11: Context-Adaptive Tone
- Added Section 12: Common Scenario Frameworks
- Modified BEGIN SESSION INSTRUCTION for returning users

## v1.0.0 (2026-XX-XX)
- Initial system prompt (Sections 1-7)
```

### 5.6 When to Consider RAG

The system prompt approach should be maintained until one or more of these thresholds is crossed:

| Trigger | Current | Threshold | Action |
|---------|---------|-----------|--------|
| Methodology word count | ~8,000 | >15,000 | Move methodology to retrievable chunks |
| Script library size | ~50 scripts (embedded) | >200 scripts | Create script database with semantic search |
| Platform knowledge updates | Static | Weekly changes | Move to updatable knowledge base |
| Multi-product coaching | Single product | 3+ products | Modular prompt composition |
| Personalization depth | Intent + Phase | 20+ user attributes | User profile-aware retrieval |

Until these thresholds are reached, RAG adds complexity without proportional value. The current system prompt fits well within Sonnet's context window and should be maintained as a single, versioned document.

---

## 6. Premium Conversation Design

### 6.1 Response Principles

Every response from the Dating Coach must satisfy these criteria:

1. **Specific.** Name the exact problem, give the exact fix. "Your message ends with a closed question" not "try being more open."
2. **Actionable.** Every response includes something the user can DO. Even empathetic responses end with a next step.
3. **Methodology-grounded.** Reference the phase, the principle, the framework. "This is a Phase 3 situation" or "The Connection Code says..."
4. **Emotionally aware.** Read the room before responding. Urgent questions get immediate answers. Emotional questions get validation first. Strategic questions get structured frameworks.
5. **Concise for Standard tier.** Every message costs the user against their daily limit. Be efficient. Offer depth as an option, not a default.

### 6.2 First-Time Conversation Design

**For users who selected a specific Intent (e.g., "Long-Term Relationship"):**

> Welcome to your MatchMakers Dating Coach. You're here for a long-term relationship -- that means everything we do together is calibrated toward building something real and lasting.
>
> I know the full MatchMakers methodology -- all 5 phases, 50+ proven scripts, and the Connection Code. Think of me as your strategic partner for the next 30 days.
>
> To start: what are you working on right now? A specific person, a situation that needs help, or your overall strategy?

**For users who selected "I'm not sure yet":**

> Welcome to your MatchMakers Dating Coach. You said you're not sure what you're looking for yet, and that's actually the perfect place to start. In the MatchMakers methodology, this is Phase 1 -- Intent. Every good outcome begins here.
>
> Let me ask you something: what made you decide to get coaching right now? Was there a specific moment, or more of a general feeling?

**For users who provided free text (e.g., "Just got out of a 3-year relationship"):**

> Welcome to your MatchMakers Dating Coach. I see you're coming out of a 3-year relationship. That's a significant transition, and the fact that you're here says something about your intention to be deliberate about what comes next.
>
> Before we dive into strategy, I want to understand where you are: how are you feeling about getting back out there? Excited, cautious, somewhere in between?

### 6.3 Returning Conversation Design

When a user returns with existing conversation history:

> Welcome back. Last time we were working on [extracted from summary -- e.g., "your opening message strategy for that match you were excited about"]. How did that go?

If the previous session ended with an action item:

> Welcome back. You were going to [action item from summary -- e.g., "send that revised opener to Sarah"]. Did you send it? What happened?

If significant time has passed (>3 days since last message):

> Welcome back -- it's been a few days. Catch me up on where things stand. Anything change since we last talked?

### 6.4 Urgent Text-Help Design

When the user's message contains urgency markers ("she just texted", "what do I say", "date is tonight", "help asap"):

**Response pattern: Answer first, explain second.**

> Here's what to send:
>
> "[Exact message text tailored to the situation]"
>
> Send it. Here's why this works: [1-2 sentence explanation].
>
> What did she say that prompted this?

The coach should NOT:
- Ask clarifying questions before providing an answer (in urgent mode)
- Provide multiple options (one clear recommendation)
- Add preamble or methodology context (save it for after the crisis)

### 6.5 Broad Strategic Questions Design

When the user asks something like "How do I get better at dating?" or "What should my strategy be?":

**Response pattern: Structured framework with clear phases.**

> Let's build your strategy. Based on what you've told me, here's where I'd focus:
>
> **1. Immediate priority (this week):** [Specific action]
> **2. Short-term focus (next 2 weeks):** [Specific goal]
> **3. Ongoing practice:** [Behavioral change or habit]
>
> This maps to [Phase X] of the methodology. The principle here is [principle].
>
> Want me to go deeper on any of these three?

### 6.6 "I Don't Know" Conversations

**Socratic questioning sequence:**

1. "What made you sign up for coaching right now?"
2. "Tell me about the last person you were genuinely interested in. What drew you to them?"
3. "When you imagine things going well, what does that look like?"
4. "If you could fast-forward 6 months and this coaching worked perfectly, what changed?"

**After 3-5 exchanges:**

> Based on what you've told me, here's what I'm hearing: you want [reflected intent]. In the MatchMakers system, that maps closest to [Intent option]. Does that feel right, or am I missing something?

### 6.7 Profile Optimization Design

**Not generic tips. Specific, evidence-based feedback.**

Bad (generic): "Try to show your personality in your photos."
Good (specific): "Your third photo is a group shot where you're not the tallest person and you're not centered. The community will have trouble identifying you. Replace it with a solo shot that shows you doing something you actually enjoy."

**Profile review protocol:**

1. Ask user to paste their bio text
2. Evaluate specificity: "Could this bio belong to anyone, or is it distinctly you?"
3. Evaluate Intent alignment: "Does this bio attract the kind of person your Intent describes?"
4. Provide a rewritten version with tracked changes
5. Reference Phase 2 profile principles

### 6.8 When to Ask vs. Answer

| Situation | Action |
|-----------|--------|
| Urgent request | Answer immediately, ask later |
| Emotional distress | Acknowledge first, then ask 1 clarifying question |
| Vague question | Ask 1 specific clarifying question |
| Strategic question with enough context | Answer with framework |
| Message for review | Ask for the full conversation if only partial shared |
| Profile review | Ask them to paste the bio |
| Phase unclear | Ask one question to determine phase |
| Multiple issues in one message | Address the most urgent, then ask which to tackle next |

### 6.9 When to Give 1 Recommendation vs. Multiple Options

| Situation | Approach |
|-----------|----------|
| Urgent ("what do I text right now") | 1 recommendation, no options |
| Message drafting | 1 primary draft + 1 alternative with different tone |
| Strategy ("what should I focus on") | 3 prioritized steps (but 1 clear first step) |
| Intent discovery | Reflect back 1 suggested Intent (not "you could be X or Y") |
| Profile bio rewrite | 1 rewritten version with changes explained |
| Date planning | 2-3 venue/activity suggestions ranked by fit |

### 6.10 When to Offer Scripts

Offer scripts (exact text to send) when:
- User is drafting a first message
- User needs to respond to something specific
- User needs to ask for a date/call
- User needs to address a difficult conversation
- User needs to re-engage after silence

Frame scripts as starting points, not mandates:
> "Here's what I'd send -- feel free to adjust the tone to feel more like you:"

### 6.11 How to Frame Uncertainty

When the coach does not have enough information:
> "I need a bit more context to give you a good answer here. Can you tell me [specific question]?"

When the situation is genuinely ambiguous:
> "There are two ways to read this. If [interpretation A], then [recommendation A]. If [interpretation B], then [recommendation B]. Which feels closer to what's happening?"

Never:
- "I'm not sure" (projects incompetence)
- "It depends" without specifying on WHAT it depends
- "Every situation is different" (true but unhelpful)

### 6.12 Premium Fallback: User Never Feels Stuck

If the user sends a message and the coach cannot determine intent:
> "I want to make sure I help you with the right thing. Are you looking for: (A) help with a specific message or conversation, (B) strategy advice for your overall approach, or (C) something else entirely?"

If the user sends a single word like "help":
> "I'm here. What's going on right now? The more specific you can be, the more targeted I can make my advice."

If the user seems frustrated with the coach:
> "I want to make sure I'm being useful. What would be most helpful right now -- a specific answer to something, or a different approach to what we've been discussing?"

### 6.13 Follow-Up Suggestion Design

After each response, the coach appends 1-2 natural next steps:

**After message drafting:**
> Want me to draft a follow-up strategy in case they don't respond within 48 hours?

**After profile feedback:**
> Should we work on your photo strategy next?

**After emotional support:**
> When you're ready, want to talk about what to do next?

**After methodology explanation:**
> Want to see how this applies to your specific situation?

**After Phase identification:**
> Should we map out your next 3 moves in Phase [X]?

**Rules for suggestions:**
- Always specific to the current conversation
- Maximum 2 per response
- Phrased as questions, not imperatives
- Never repeat a suggestion from the previous response
- Rotate between tactical ("want me to draft...") and strategic ("should we map out...")

---

## 7. UX/UI Product Experience Design

### 7.1 Onboarding Redesign

#### Before (Current -- 3 Steps)

```
Step 1: What is your Intent?
  [6 buttons, no descriptions]
  [Continue button, disabled until selection]
        |
        v
Step 2: Where are you right now?
  [5 phase options using internal jargon]
  [Continue button, disabled until selection]
        |
        v
Step 3: What are you working on?
  [3 focus options]
  [Begin Coaching Session button]
```

#### After (Redesigned -- 1 Step)

```
Welcome to your Dating Coach

What are you looking for?
  [Long-Term Relationship -- Find a committed partner]
  [Marriage -- Find the person to marry]
  [Fall in Love -- Open to deep connection]
  [Casual Dating -- Enjoy dating without pressure]
  [Short-Term -- Something real, not forever]
  [I'm not sure yet -- Help me figure it out]  <-- visually distinct

Or tell me what's going on in your own words:
[optional free-text textarea]

[Start Coaching Session]  <-- enabled when Intent selected OR text entered
```

**CSS for redesigned onboarding:**

```css
/* Onboarding: single step redesign */
.cp-onboard {
  flex: 1;
  padding: 24px 20px;
  overflow-y: auto;
  display: none;
}

.cp-onboard.show {
  display: flex;
  flex-direction: column;
}

.cp-ob-header {
  margin-bottom: 20px;
}

.cp-ob-greeting {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 1.3rem;
  font-weight: 400;
  font-style: italic;
  color: var(--white, #EDF2F7);
  margin-bottom: 4px;
}

.cp-ob-sub {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.8rem;
  color: var(--sl, #7A95AF);
}

.cp-ob-q {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--white, #EDF2F7);
  margin-bottom: 12px;
}

.cp-ob-opts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.cp-ob-opt {
  padding: 12px 16px;
  border: 1px solid rgba(65, 91, 124, 0.22);
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 44px; /* Touch target minimum */
}

.cp-ob-opt:hover {
  border-color: rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.04);
}

.cp-ob-opt.sel {
  border-color: rgba(201, 168, 76, 0.5);
  background: rgba(201, 168, 76, 0.08);
}

.cp-ob-opt-name {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--white, #EDF2F7);
}

.cp-ob-opt-desc {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.7rem;
  color: var(--sl, #7A95AF);
}

/* "I'm not sure yet" gets a distinct visual treatment */
.cp-ob-opt--unsure {
  border-style: dashed;
  border-color: rgba(201, 168, 76, 0.2);
}

.cp-ob-opt--unsure.sel {
  border-style: solid;
  border-color: rgba(201, 168, 76, 0.5);
  background: rgba(201, 168, 76, 0.06);
}

/* Free text area */
.cp-ob-freetext {
  margin-bottom: 16px;
}

.cp-ob-freetext-label {
  display: block;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.72rem;
  color: var(--sl, #7A95AF);
  margin-bottom: 6px;
}

.cp-ob-freetext-input {
  width: 100%;
  resize: none;
  border: 1px solid rgba(65, 91, 124, 0.22);
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(5, 9, 15, 0.5);
  color: var(--white, #EDF2F7);
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.8rem;
  line-height: 1.5;
  box-sizing: border-box;
}

.cp-ob-freetext-input:focus {
  outline: none;
  border-color: rgba(201, 168, 76, 0.35);
}

.cp-ob-freetext-input::placeholder {
  color: rgba(122, 149, 175, 0.4);
}

/* Start button */
.cp-ob-start {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  background: #C9A84C;
  color: #0B1727;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  min-height: 44px; /* Touch target minimum */
}

.cp-ob-start:hover {
  background: #D4B65E;
}

.cp-ob-start:disabled {
  background: rgba(201, 168, 76, 0.2);
  cursor: default;
  opacity: 0.6;
}
```

### 7.2 Settings Panel Design

#### HTML

```html
<!-- Settings panel: inserted after cp-header, before co-onboard -->
<div id="co-settings" class="cp-settings">
  <div class="cp-settings-section">
    <div class="cp-settings-label">Your Intent</div>
    <div class="cp-settings-value" id="co-settings-intent">Long-Term Relationship</div>
    <button class="cp-settings-change" id="co-settings-change-intent">Change</button>
    <div id="co-settings-intent-picker" class="cp-settings-picker" style="display:none;">
      <button class="cp-settings-opt" data-intent="Long-Term">Long-Term</button>
      <button class="cp-settings-opt" data-intent="Marriage">Marriage</button>
      <button class="cp-settings-opt" data-intent="Fall in Love">Fall in Love</button>
      <button class="cp-settings-opt" data-intent="Casual">Casual</button>
      <button class="cp-settings-opt" data-intent="Short-Term">Short-Term</button>
      <button class="cp-settings-opt" data-intent="Not Sure">I'm not sure</button>
    </div>
  </div>

  <div class="cp-settings-divider"></div>

  <div class="cp-settings-section">
    <div class="cp-settings-label">Messages Today</div>
    <div class="cp-settings-value" id="co-settings-usage">23 of 50</div>
    <div class="cp-settings-bar">
      <div class="cp-settings-bar-fill" id="co-settings-bar-fill" style="width:46%"></div>
    </div>
  </div>

  <div class="cp-settings-divider"></div>

  <div class="cp-settings-section">
    <div class="cp-settings-label">Days Remaining</div>
    <div class="cp-settings-value" id="co-settings-days">24 days</div>
  </div>

  <div class="cp-settings-divider"></div>

  <div class="cp-settings-section">
    <div class="cp-settings-label">Tier</div>
    <div class="cp-settings-value">
      <span id="co-settings-tier">Standard</span>
      <button class="cp-settings-upgrade" id="co-settings-upgrade">Upgrade to Premium</button>
    </div>
  </div>

  <div class="cp-settings-divider"></div>

  <button class="cp-settings-clear" id="co-settings-clear">Clear Conversation History</button>
</div>
```

#### CSS

```css
/* Settings panel */
.cp-settings {
  display: none;
  padding: 16px 18px;
  background: rgba(5, 9, 15, 0.6);
  border-bottom: 1px solid rgba(65, 91, 124, 0.15);
  animation: slideDown 0.2s ease;
}

.cp-settings.open {
  display: block;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.cp-settings-section {
  padding: 8px 0;
}

.cp-settings-label {
  font-family: 'Outfit', sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(201, 168, 76, 0.5);
  margin-bottom: 4px;
}

.cp-settings-value {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.82rem;
  color: var(--white, #EDF2F7);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-settings-change {
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.7rem;
  color: rgba(201, 168, 76, 0.6);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  padding: 4px;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
}

.cp-settings-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.cp-settings-opt {
  padding: 6px 12px;
  border: 1px solid rgba(65, 91, 124, 0.22);
  border-radius: 6px;
  background: transparent;
  color: var(--tx, #C2D1E0);
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.72rem;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  min-height: 44px;
}

.cp-settings-opt:hover {
  border-color: rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.05);
}

.cp-settings-bar {
  width: 100%;
  height: 3px;
  background: rgba(65, 91, 124, 0.15);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.cp-settings-bar-fill {
  height: 100%;
  background: #C9A84C;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.cp-settings-divider {
  height: 1px;
  background: rgba(65, 91, 124, 0.1);
  margin: 4px 0;
}

.cp-settings-upgrade {
  padding: 4px 10px;
  border: 1px solid rgba(201, 168, 76, 0.3);
  border-radius: 5px;
  background: transparent;
  color: #C9A84C;
  font-family: 'Outfit', sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s;
  min-height: 44px;
}

.cp-settings-upgrade:hover {
  background: rgba(201, 168, 76, 0.08);
}

.cp-settings-clear {
  width: 100%;
  padding: 8px;
  border: 1px solid rgba(229, 115, 115, 0.2);
  border-radius: 6px;
  background: transparent;
  color: rgba(229, 115, 115, 0.6);
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.72rem;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  margin-top: 8px;
  min-height: 44px;
}

.cp-settings-clear:hover {
  background: rgba(229, 115, 115, 0.05);
  border-color: rgba(229, 115, 115, 0.3);
}
```

#### Settings Panel JavaScript

```javascript
// Add gear icon to header (next to days remaining)
// HTML: <button class="cp-gear" id="co-gear" aria-label="Settings">
//         <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
//              stroke="currentColor" stroke-width="2">
//           <circle cx="12" cy="12" r="3"/>
//           <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42
//                    M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
//         </svg>
//       </button>

var settingsOpen = false;

function toggleSettings() {
  var panel = document.getElementById('co-settings');
  if (!panel) return;

  settingsOpen = !settingsOpen;
  if (settingsOpen) {
    panel.classList.add('open');
    updateSettingsDisplay();
  } else {
    panel.classList.remove('open');
  }
}

function updateSettingsDisplay() {
  // Intent
  var intentEl = document.getElementById('co-settings-intent');
  if (intentEl) intentEl.textContent = intent || 'Not set';

  // Usage (from last API response)
  var usageEl = document.getElementById('co-settings-usage');
  var barEl = document.getElementById('co-settings-bar-fill');
  if (usageEl && typeof lastRemainingMessages !== 'undefined') {
    var used = 50 - lastRemainingMessages;
    usageEl.textContent = used + ' of 50';
    if (barEl) barEl.style.width = ((used / 50) * 100) + '%';
  }

  // Days
  var daysSettingsEl = document.getElementById('co-settings-days');
  if (daysSettingsEl) {
    var first = parseInt(localStorage.getItem('pb_dc_first') || Date.now(), 10);
    var days = Math.max(0, 30 - Math.floor((Date.now() - first) / 86400000));
    daysSettingsEl.textContent = days > 0 ? days + ' days' : 'Expired';
  }
}

// Bind gear icon click
var gearBtn = document.getElementById('co-gear');
if (gearBtn) {
  gearBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSettings();
  });
}

// Bind Intent change
var changeIntentBtn = document.getElementById('co-settings-change-intent');
if (changeIntentBtn) {
  changeIntentBtn.addEventListener('click', function () {
    var picker = document.getElementById('co-settings-intent-picker');
    if (picker) {
      picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    }
  });
}

// Bind Intent picker options
document.querySelectorAll('.cp-settings-opt[data-intent]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var oldIntent = intent;
    var newIntent = btn.getAttribute('data-intent');
    intent = newIntent;
    localStorage.setItem('pb_dc_intent', newIntent);

    // Update display
    var intentEl = document.getElementById('co-settings-intent');
    if (intentEl) intentEl.textContent = newIntent;

    // Hide picker
    var picker = document.getElementById('co-settings-intent-picker');
    if (picker) picker.style.display = 'none';

    // Insert system message in chat
    addMessage('system', 'Your Intent has been updated to: ' + newIntent);

    // Close settings
    toggleSettings();
  });
});
```

### 7.3 Suggested Prompts Redesign

Replace the static 4-prompt list with context-aware prompts:

```javascript
function getSuggestedPrompts(userIntent) {
  var prompts = {
    'Long-Term': [
      'Help me write an opening message to someone I matched with',
      'Review my dating profile -- is it attracting the right people?',
      'She stopped responding. What should I do?',
      'How do I know when to suggest meeting in person?'
    ],
    'Marriage': [
      'How do I communicate that I want marriage without scaring people off?',
      'Help me evaluate if this person shares my long-term values',
      'I keep attracting people who aren\'t serious. What\'s going wrong?',
      'When is the right time to have the exclusivity conversation?'
    ],
    'Fall in Love': [
      'Help me write a message that shows genuine interest',
      'How do I build emotional connection through text?',
      'I feel a spark but I\'m not sure if they feel it too',
      'How do I move from casual chatting to something deeper?'
    ],
    'Casual': [
      'Help me set clear expectations without being awkward',
      'How do I keep things fun without leading someone on?',
      'Best first date ideas for keeping it low-pressure',
      'How do I handle the "what are we?" conversation?'
    ],
    'Short-Term': [
      'Help me write an opener that\'s direct but not aggressive',
      'She\'s great but I\'m not looking for forever. How do I handle this?',
      'Best approach for a fun, honest short-term connection',
      'How do I end things kindly when it\'s run its course?'
    ],
    'Not Sure': [
      'I just got out of a relationship -- help me figure out what I want',
      'I want to date but I don\'t know what I\'m looking for',
      'Help me figure out what I actually want from dating',
      'I\'ve been on some dates but nothing feels right'
    ],
    'exploring': [
      'Help me figure out what I actually want',
      'I don\'t know where to start with dating',
      'What should I be looking for in a match?',
      'How does the MatchMakers methodology work?'
    ]
  };

  return prompts[userIntent] || prompts['Not Sure'];
}

function showSuggestedPrompts() {
  if (!messagesEl) return;

  var promptList = getSuggestedPrompts(intent || 'Not Sure');

  var wrap = document.createElement('div');
  wrap.className = 'cp-suggestions';
  wrap.id = 'co-suggestions';

  promptList.forEach(function (p) {
    var btn = document.createElement('button');
    btn.className = 'cp-suggest-btn';
    btn.textContent = p;
    btn.addEventListener('click', function () {
      if (inputEl) inputEl.value = p;
      var el = document.getElementById('co-suggestions');
      if (el) el.remove();
      sendMessage();
    });
    wrap.appendChild(btn);
  });

  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
```

**Prompt rotation on return visits:**

```javascript
function getRotatedPrompts(userIntent) {
  var allPrompts = getSuggestedPrompts(userIntent);
  // Use session count or timestamp to rotate which prompts are shown
  var sessionCount = parseInt(localStorage.getItem('dc_session_count') || '0', 10);
  var offset = sessionCount % allPrompts.length;

  // Show 4 prompts starting from the offset, wrapping around
  var rotated = [];
  for (var i = 0; i < Math.min(4, allPrompts.length); i++) {
    rotated.push(allPrompts[(offset + i) % allPrompts.length]);
  }
  return rotated;
}
```

### 7.4 Mobile Web Fixes (Critical)

#### Panel Height Fix

```css
/* BEFORE (broken): */
/* .coach-panel { height: 85vh; } */

/* AFTER (fixed): */
@media (max-width: 760px) {
  .coach-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    height: 100dvh;           /* Dynamic viewport height */
    height: 100vh;            /* Fallback for older browsers */
    max-height: -webkit-fill-available; /* iOS Safari fallback */
    border-radius: 18px 18px 0 0;
    transform: translateY(110%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .coach-panel.open {
    transform: translateY(0);
  }
}
```

#### iOS Keyboard / Virtual Viewport Fix

```javascript
// Handle iOS virtual keyboard
function setupMobileKeyboardHandler() {
  if (!window.visualViewport) return;

  window.visualViewport.addEventListener('resize', function () {
    var panel = document.querySelector('.coach-panel');
    if (!panel || !panel.classList.contains('open')) return;

    var viewportHeight = window.visualViewport.height;
    var offsetTop = window.visualViewport.offsetTop;

    // Adjust panel height to fit above keyboard
    panel.style.height = viewportHeight + 'px';
    panel.style.transform = 'translateY(' + offsetTop + 'px)';
  });

  window.visualViewport.addEventListener('scroll', function () {
    var panel = document.querySelector('.coach-panel');
    if (!panel || !panel.classList.contains('open')) return;

    var offsetTop = window.visualViewport.offsetTop;
    panel.style.transform = 'translateY(' + offsetTop + 'px)';
  });
}

// Call during init:
setupMobileKeyboardHandler();
```

#### Input Sticky at Bottom

```css
@media (max-width: 760px) {
  .cp-input-area {
    padding: 10px 12px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    border-top: 1px solid rgba(65, 91, 124, 0.15);
    background: #0B1727;
    position: sticky;
    bottom: 0;
    z-index: 1;
  }
}
```

#### Touch Target Sizes

```css
/* All interactive elements must be at least 44x44px on mobile */
@media (max-width: 760px) {
  .cp-ob-opt,
  .cp-send,
  .cp-close,
  .cp-new,
  .cp-suggest-btn,
  .cp-settings-change,
  .cp-settings-opt,
  .cp-settings-upgrade,
  .cp-settings-clear,
  .cp-ob-start {
    min-height: 44px;
    min-width: 44px;
  }

  .cp-send {
    width: 44px;
    height: 44px;
  }

  .cp-close {
    width: 36px;
    height: 36px;
  }

  .cp-suggest-btn {
    padding: 10px 16px;
    font-size: 0.78rem;
  }

  .cp-ob-opt {
    padding: 14px 16px;
  }
}
```

#### Scroll Containment in Messages Area

```css
@media (max-width: 760px) {
  .cp-messages {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;  /* Prevent scroll chaining to body */
    padding: 12px;
  }
}
```

#### Orb Positioning

```css
@media (max-width: 760px) {
  .coach-orb {
    width: 50px;
    height: 50px;
    bottom: 20px;
    right: 16px;
    /* Position avoids bottom-right thumb zone on right-handed devices */
    /* 20px from bottom clears most navigation bars */
    /* 16px from right is reachable but not in the dead corner */
  }
}
```

#### Panel as Full-Width Bottom Sheet on Mobile

```css
@media (max-width: 760px) {
  .coach-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    border-radius: 18px 18px 0 0;
  }

  /* Drag handle at top of panel for swipe-to-dismiss affordance */
  .coach-panel::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    background: rgba(65, 91, 124, 0.3);
    border-radius: 2px;
    margin: 8px auto 4px;
  }
}
```

#### Swipe Down to Dismiss

```javascript
// Swipe-to-dismiss for mobile coach panel
function setupSwipeToDismiss() {
  if (!isMobile()) return;

  var panel = document.querySelector('.coach-panel');
  if (!panel) return;

  var startY = 0;
  var currentY = 0;
  var isDragging = false;

  panel.addEventListener('touchstart', function (e) {
    // Only capture swipe on the header area (top 60px)
    var rect = panel.getBoundingClientRect();
    var touchY = e.touches[0].clientY - rect.top;
    if (touchY > 60) return;

    startY = e.touches[0].clientY;
    isDragging = true;
    panel.style.transition = 'none';
  }, { passive: true });

  panel.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    var delta = currentY - startY;
    if (delta > 0) {
      panel.style.transform = 'translateY(' + delta + 'px)';
    }
  }, { passive: true });

  panel.addEventListener('touchend', function () {
    if (!isDragging) return;
    isDragging = false;
    panel.style.transition = '';

    var delta = currentY - startY;
    if (delta > 100) {
      closePanel();
    } else {
      panel.style.transform = '';
    }
    startY = 0;
    currentY = 0;
  });
}
```

### 7.5 Premium Visual Cues

#### Gold Accents Throughout

Already present in the current design. Ensure consistency:
- Orb: gold radial gradient (working)
- Avatar: gold "M" on gold background (working)
- Send button: gold fill (working)
- Selected options: gold border/background (working)
- Settings accent: gold labels (new)

#### "M" Avatar With Subtle Animation

```css
.cp-av {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #D4B65E, #C9A84C);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.75rem;
  color: #0B1727;
  flex-shrink: 0;
  position: relative;
}

/* Subtle ring pulse on the header avatar */
.cp-av::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1px solid rgba(201, 168, 76, 0.2);
  animation: avatarPulse 3s ease-in-out infinite;
}

@keyframes avatarPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}
```

#### Smooth Panel Transitions

```css
/* Panel open animation */
.coach-panel {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Message enter animation */
@keyframes msgSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cp-msg {
  animation: msgSlideIn 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Settings panel slide */
@keyframes settingsSlide {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 400px;
  }
}
```

#### Typography Hierarchy

```css
/* Already established but documenting the hierarchy: */
/* Title (Coach name): Outfit 700, 0.78rem */
/* Body (messages): DM Sans 400, 0.82rem, line-height 1.55 */
/* Labels: Outfit 700, 0.6rem, letter-spacing 0.1em, uppercase */
/* Metadata (status, days): DM Sans 400, 0.65rem */
/* Suggestions: DM Sans 400, 0.72rem */
```

#### Status Indicators

```css
/* Ready state */
.cp-status {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.65rem;
  color: rgba(45, 184, 122, 0.65);
  margin-top: 1px;
}

.cp-status::before {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(45, 184, 122, 0.65);
  margin-right: 4px;
  vertical-align: middle;
}

/* Thinking state */
.cp-status.thinking {
  color: rgba(201, 168, 76, 0.65);
}

.cp-status.thinking::before {
  background: rgba(201, 168, 76, 0.65);
  animation: statusPulse 1s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Rate limited state */
.cp-status.limited {
  color: rgba(229, 115, 115, 0.65);
}

.cp-status.limited::before {
  background: rgba(229, 115, 115, 0.65);
}
```

---

## 8. Tiered Access Architecture

### 8.1 Tier Definitions

| Feature | Standard | Premium |
|---------|----------|---------|
| Price | $500 | $750-1000 (TBD) |
| Duration | 30 days | 30 days |
| Messages per day | 50 | Unlimited |
| Conversation persistence | Yes | Yes |
| Session summaries | Yes | Yes |
| Context-adaptive tone | Yes | Yes |
| Response depth | Concise by default | Expansive by default |
| Multi-message coaching exercises | No | Yes |
| Priority during high load | Standard | Priority |

### 8.2 Database Schema

**Add `tier` field to purchases table:**

```sql
-- Supabase migration
ALTER TABLE purchases
ADD COLUMN tier TEXT NOT NULL DEFAULT 'standard'
CHECK (tier IN ('standard', 'premium'));

-- Add index for tier lookups
CREATE INDEX idx_purchases_tier ON purchases(tier);

-- Create rate_limits table (replaces in-memory Map)
CREATE TABLE coach_rate_limits (
  session_id TEXT PRIMARY KEY,
  message_count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  tier TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cleanup function: remove expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM coach_rate_limits WHERE reset_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;
```

### 8.3 Edge Function Changes

```typescript
// Updated coach-proxy/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Tier-based limits
const TIER_LIMITS: Record<string, number> = {
  standard: 50,
  premium: 999999, // effectively unlimited
};

async function checkRateLimit(
  sessionId: string,
  tier: string
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const limit = TIER_LIMITS[tier] || TIER_LIMITS.standard;

  // Try to get existing rate limit record
  const { data: existing } = await supabase
    .from("coach_rate_limits")
    .select("message_count, reset_at")
    .eq("session_id", sessionId)
    .single();

  if (!existing || new Date(existing.reset_at) < now) {
    // No record or expired -- create/reset
    await supabase.from("coach_rate_limits").upsert({
      session_id: sessionId,
      message_count: 1,
      reset_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      tier: tier,
      updated_at: now.toISOString(),
    });
    return { allowed: true, remaining: limit - 1 };
  }

  if (existing.message_count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment count
  await supabase
    .from("coach_rate_limits")
    .update({
      message_count: existing.message_count + 1,
      updated_at: now.toISOString(),
    })
    .eq("session_id", sessionId);

  return {
    allowed: true,
    remaining: limit - (existing.message_count + 1),
  };
}
```

### 8.4 Frontend Tier Display

```javascript
// Track tier from API response
var userTier = localStorage.getItem('pb_dc_tier') || 'standard';

// After each API call, update tier from response headers or body:
// response.headers.get('x-user-tier')
// This is set by the Edge Function after looking up the purchase record

function updateTierDisplay() {
  var tierEl = document.getElementById('co-settings-tier');
  if (tierEl) {
    tierEl.textContent = userTier === 'premium' ? 'Premium' : 'Standard';
  }

  var upgradeBtn = document.getElementById('co-settings-upgrade');
  if (upgradeBtn) {
    upgradeBtn.style.display = userTier === 'premium' ? 'none' : 'inline-flex';
  }
}
```

### 8.5 Upgrade Prompt Logic

```javascript
// Show upgrade prompt when user approaches daily limit (Standard tier only)
function maybeShowUpgradePrompt(remaining) {
  if (userTier === 'premium') return;

  if (remaining <= 5 && remaining > 0) {
    addMessage('system',
      'You have ' + remaining + ' messages remaining today. ' +
      'Upgrade to Premium for unlimited daily messages.'
    );
  }

  if (remaining === 0) {
    addMessage('system',
      'You\'ve reached your daily message limit (50 messages). ' +
      'Your limit resets in 24 hours, or you can upgrade to Premium ' +
      'for unlimited messages. Tap the gear icon to upgrade.'
    );
  }
}
```

### 8.6 Future Flexibility

The tier system is designed for easy extension:

```typescript
// To add a new tier, update TIER_LIMITS:
const TIER_LIMITS: Record<string, number> = {
  standard: 50,
  premium: 999999,
  // Future tiers:
  // starter: 20,
  // professional: 100,
  // enterprise: 999999,
};

// To change pricing, update the purchases table and checkout flow
// No Edge Function changes needed -- tier name drives behavior

// To add tier-specific features (e.g., conversation export):
// Check tier in the Edge Function response:
// if (tier === 'premium') { include additional data }
```

---

## 9. Functional and Technical Architecture

### 9.1 Conversation Persistence: IndexedDB Implementation

Complete implementation for the `matchmakers_coach` IndexedDB database:

```javascript
// coach-storage.js -- shared storage module

var CoachStorage = (function () {
  'use strict';

  var DB_NAME = 'matchmakers_coach';
  var DB_VERSION = 1;
  var MESSAGE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  function openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains('messages')) {
          var msgStore = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          msgStore.createIndex('sessionId', 'sessionId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
          msgStore.createIndex('summarized', 'summarized', { unique: false });
        }

        if (!db.objectStoreNames.contains('summaries')) {
          var sumStore = db.createObjectStore('summaries', {
            keyPath: 'summaryId',
          });
          sumStore.createIndex('sessionId', 'sessionId', { unique: false });
          sumStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('userProfile')) {
          db.createObjectStore('userProfile', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = function (event) {
        resolve(event.target.result);
      };

      request.onerror = function (event) {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // ── Message Operations ──

  function saveMessage(role, content) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('messages', 'readwrite');
        var store = tx.objectStore('messages');

        var record = {
          sessionId: getSessionId(),
          role: role,
          content: content,
          timestamp: Date.now(),
          summarized: false,
        };

        var request = store.add(record);
        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  function getRecentMessages(limit) {
    limit = limit || 20;
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('messages', 'readonly');
        var store = tx.objectStore('messages');
        var index = store.index('timestamp');
        var messages = [];

        var request = index.openCursor(null, 'prev');
        request.onsuccess = function (event) {
          var cursor = event.target.result;
          if (cursor && messages.length < limit) {
            messages.unshift(cursor.value);
            cursor.continue();
          } else {
            resolve(messages);
          }
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  function getUnsummarizedMessages() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('messages', 'readonly');
        var store = tx.objectStore('messages');
        var index = store.index('summarized');
        var request = index.getAll(false);

        request.onsuccess = function () {
          resolve(request.result);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  function markMessagesSummarized(ids) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('messages', 'readwrite');
        var store = tx.objectStore('messages');
        var remaining = ids.length;

        ids.forEach(function (id) {
          var getReq = store.get(id);
          getReq.onsuccess = function () {
            var record = getReq.result;
            if (record) {
              record.summarized = true;
              store.put(record);
            }
            remaining--;
            if (remaining === 0) resolve();
          };
        });

        if (ids.length === 0) resolve();
      });
    });
  }

  // ── Summary Operations ──

  function saveSummary(content, messageRange) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('summaries', 'readwrite');
        var store = tx.objectStore('summaries');

        var record = {
          summaryId: getSessionId() + '_summary_' + Date.now(),
          sessionId: getSessionId(),
          content: content,
          messageRange: messageRange,
          timestamp: Date.now(),
        };

        var request = store.add(record);
        request.onsuccess = function () {
          resolve(record.summaryId);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  function getLatestSummary() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('summaries', 'readonly');
        var store = tx.objectStore('summaries');
        var index = store.index('timestamp');

        var request = index.openCursor(null, 'prev');
        request.onsuccess = function (event) {
          var cursor = event.target.result;
          resolve(cursor ? cursor.value : null);
        };
        request.onerror = function () {
          reject(request.error);
        };
      });
    });
  }

  // ── Cleanup ──

  function cleanupExpiredData() {
    var cutoff = Date.now() - MESSAGE_TTL;

    return openDB().then(function (db) {
      // Clean messages
      var msgTx = db.transaction('messages', 'readwrite');
      var msgStore = msgTx.objectStore('messages');
      var msgIndex = msgStore.index('timestamp');

      var msgRequest = msgIndex.openCursor(IDBKeyRange.upperBound(cutoff));
      msgRequest.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Clean summaries
      var sumTx = db.transaction('summaries', 'readwrite');
      var sumStore = sumTx.objectStore('summaries');
      var sumIndex = sumStore.index('timestamp');

      var sumRequest = sumIndex.openCursor(IDBKeyRange.upperBound(cutoff));
      sumRequest.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    });
  }

  // ── Clear All ──

  function clearAllData() {
    return openDB().then(function (db) {
      var stores = ['messages', 'summaries', 'userProfile', 'metadata'];
      stores.forEach(function (storeName) {
        var tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
      });
    });
  }

  // ── Public API ──

  return {
    saveMessage: saveMessage,
    getRecentMessages: getRecentMessages,
    getUnsummarizedMessages: getUnsummarizedMessages,
    markMessagesSummarized: markMessagesSummarized,
    saveSummary: saveSummary,
    getLatestSummary: getLatestSummary,
    cleanupExpiredData: cleanupExpiredData,
    clearAllData: clearAllData,
  };
})();
```

### 9.2 Session Summary System

```javascript
// Summary generation: called after every 10 unsummarized messages
var SUMMARY_THRESHOLD = 10;
var summaryInProgress = false;

async function maybeGenerateSummary() {
  if (summaryInProgress) return;

  var unsummarized = await CoachStorage.getUnsummarizedMessages();
  if (unsummarized.length < SUMMARY_THRESHOLD) return;

  summaryInProgress = true;

  try {
    // Take the oldest 10 unsummarized messages
    var batch = unsummarized.slice(0, SUMMARY_THRESHOLD);

    var summaryRequest = [{
      role: 'user',
      content:
        'Summarize this coaching conversation in 150 words or fewer. ' +
        'Include: (1) the user\'s current situation and goals, ' +
        '(2) key advice given, (3) any action items or next steps, ' +
        '(4) the user\'s emotional state. ' +
        'Write as a concise paragraph, not bullet points.\n\n' +
        'CONVERSATION:\n' +
        batch.map(function (m) {
          return m.role.toUpperCase() + ': ' + m.content;
        }).join('\n\n')
    }];

    var response = await fetch(COACH_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': getSessionId(),
        'x-summary-request': '1'
      },
      body: JSON.stringify({
        messages: summaryRequest,
        context: ''
      })
    });

    var data = await response.json();
    var summaryText = (data.content && data.content[0] && data.content[0].text) || '';

    if (summaryText) {
      var ids = batch.map(function (m) { return m.id; });
      await CoachStorage.saveSummary(summaryText, {
        from: ids[0],
        to: ids[ids.length - 1]
      });
      await CoachStorage.markMessagesSummarized(ids);
    }
  } catch (err) {
    console.error('Summary generation failed:', err);
  }

  summaryInProgress = false;
}
```

### 9.3 API Cost Optimization

#### Token Count Comparison

**Current (no optimization):**

```
Request composition:
  System prompt:      ~10,000 tokens (8K words)
  Message history:    ~8,000 tokens (40 messages average)
  Member context:     ~100 tokens
  ─────────────────────────────────
  Total input:        ~18,100 tokens per request
  Max output:         1,000 tokens
  ─────────────────────────────────
  Total per request:  ~19,100 tokens

  Sonnet pricing: $3/M input + $15/M output
  Cost per request: $0.054 input + $0.015 output = $0.069
  50 msgs/day x 30 days = 1,500 requests/user
  Cost per user (30 days): $103.50
```

**Optimized (summary + 5 recent):**

```
Request composition:
  System prompt:      ~10,000 tokens (8K words, unchanged)
  Latest summary:     ~200 tokens (150 words)
  Last 5 messages:    ~1,000 tokens
  Member context:     ~100 tokens
  ─────────────────────────────────
  Total input:        ~11,300 tokens per request
  Max output:         1,000 tokens
  ─────────────────────────────────
  Total per request:  ~12,300 tokens

  Cost per request: $0.034 input + $0.015 output = $0.049
  1,500 requests + 150 summary requests = 1,650 total
  Summary requests cost: 150 x $0.010 = $1.50
  Cost per user (30 days): $73.50 + $1.50 = $75.00
```

**Savings: ~27% per user ($28.50 per user per 30-day cycle)**

| Users | Current (30d) | Optimized (30d) | Monthly Savings |
|-------|---------------|-----------------|-----------------|
| 10 | $1,035 | $750 | $285 |
| 50 | $5,175 | $3,750 | $1,425 |
| 100 | $10,350 | $7,500 | $2,850 |

### 9.4 Rate Limiting Fix

Replace the in-memory `Map` with Supabase table queries (schema in Section 8.2):

```typescript
// In coach-proxy/index.ts, replace the existing checkRateLimit function:

// REMOVE:
// const rateLimits = new Map<string, { count: number; resetAt: number }>();
// function checkRateLimit(sessionId: string) { ... }

// REPLACE WITH:
async function checkRateLimit(
  sessionId: string,
  tier: string = "standard"
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = tier === "premium" ? 999999 : DAILY_LIMIT;
  const now = new Date();

  // Attempt to get existing record
  const { data: existing, error: fetchError } = await supabase
    .from("coach_rate_limits")
    .select("message_count, reset_at")
    .eq("session_id", sessionId)
    .single();

  // No record or expired: create fresh
  if (fetchError || !existing || new Date(existing.reset_at) < now) {
    const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await supabase.from("coach_rate_limits").upsert(
      {
        session_id: sessionId,
        message_count: 1,
        reset_at: resetAt.toISOString(),
        tier: tier,
        updated_at: now.toISOString(),
      },
      { onConflict: "session_id" }
    );

    return { allowed: true, remaining: limit - 1 };
  }

  // Check if limit reached
  if (existing.message_count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment
  await supabase
    .from("coach_rate_limits")
    .update({
      message_count: existing.message_count + 1,
      updated_at: now.toISOString(),
    })
    .eq("session_id", sessionId);

  return {
    allowed: true,
    remaining: limit - (existing.message_count + 1),
  };
}
```

### 9.5 State Sync Across Surfaces

Use the `storage` event to sync state between the orb and playbook surfaces:

```javascript
// Add to both coach-orb.js and playbook-content.js (or to the unified module):

window.addEventListener('storage', function (event) {
  // Sync Intent changes
  if (event.key === 'pb_dc_intent') {
    intent = event.newValue || '';
    // Update any visible Intent display
    var intentEl = document.getElementById('co-settings-intent');
    if (intentEl) intentEl.textContent = intent || 'Not set';
  }

  // Sync access changes
  if (event.key === 'pb_dc_access') {
    refreshOrbState();
    if (event.newValue === '1') {
      initCoachPanel();
    }
  }

  // Sync onboarding completion
  if (event.key === 'pb_dc_onboarded') {
    if (event.newValue === '1' && !hasCompletedOnboarding) {
      hasCompletedOnboarding = true;
      initCoachPanel();
    }
  }

  // Sync session ID
  if (event.key === 'dc_session') {
    // If session changed in another tab, update our reference
    // This ensures rate limiting uses the same session
  }
});

// For same-page sync (orb and playbook on the same page):
// Use a custom event since storage events don't fire for the same page
function broadcastStateChange(key, value) {
  localStorage.setItem(key, value);
  // Dispatch custom event for same-page listeners
  window.dispatchEvent(new CustomEvent('coachStateChange', {
    detail: { key: key, value: value }
  }));
}

window.addEventListener('coachStateChange', function (event) {
  var key = event.detail.key;
  var value = event.detail.value;
  // Handle same as storage event above
});
```

### 9.6 Bug Fixes: All 7 Bugs

#### Fix for Bug 1: Access Code Validation Inconsistency

```javascript
// Create a shared validation function used by both surfaces:
// coach-auth.js (new shared module, or inline in both files)

function validateCoachAccessCode(code) {
  if (!code) return false;
  code = code.trim().toUpperCase();

  // Method 1: MMCOACH prefix (purchased codes)
  if (code.startsWith('MMCOACH')) return true;

  // Method 2: Valid promo codes (from checkout system)
  if (typeof lookupPromo === 'function') {
    var promo = lookupPromo(code);
    if (promo && promo.type === 'free') return true;
  }

  return false;
}

// Use in BOTH coach-orb.js and playbook-content.js:
// Replace: var isValidCoach = code.startsWith('MMCOACH');
// With:    var isValid = validateCoachAccessCode(code);
```

#### Fix for Bug 2: State Sync

(Covered in Section 9.5 above.)

#### Fix for Bug 3: Onboarding Bypass

```javascript
// In initCoachPanel(), add validation:
function initCoachPanel() {
  updateDaysRemaining();

  var isOnboarded = localStorage.getItem('pb_dc_onboarded');
  var hasIntent = localStorage.getItem('pb_dc_intent');

  if (isOnboarded && hasIntent) {
    // Valid state -- proceed
    intent = hasIntent;
    if (chatEl) chatEl.style.display = 'flex';
    if (onboardEl) onboardEl.style.display = 'none';
    if (cp_history.length === 0) {
      showWelcome();
    }
  } else {
    // Invalid state -- re-trigger onboarding
    // Clear potentially corrupt state
    localStorage.removeItem('pb_dc_onboarded');
    localStorage.removeItem('pb_dc_intent');
    localStorage.removeItem('pb_dc_phase');
    localStorage.removeItem('pb_dc_focus');
    startOnboarding();
  }
}
```

#### Fix for Bug 4: New Session Intent Reset

```javascript
function newSession() {
  var msg = 'Clear conversation history?';
  if (intent) {
    msg += '\n\nYour current Intent is "' + intent +
           '". Would you also like to reset your goals?';
  }

  // Use a two-button approach instead of confirm()
  // For now, simplified:
  if (!confirm('Clear conversation history?')) return;

  cp_history = [];
  if (messagesEl) messagesEl.innerHTML = '';

  // Offer Intent reset
  var resetGoals = confirm(
    'Your Intent is currently "' + intent +
    '". Would you like to change it? (Cancel to keep current Intent)'
  );

  if (resetGoals) {
    localStorage.removeItem('pb_dc_onboarded');
    localStorage.removeItem('pb_dc_intent');
    intent = '';
    startOnboarding();
  } else {
    setTimeout(showWelcome, 200);
  }
}
```

#### Fix for Bug 5: Days Remaining Refresh

```javascript
// Add visibility change listener in init():
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
    updateDaysRemaining();
  }
});

// Also check on panel open:
function openPanel() {
  if (!orbEl || !panelEl) return;
  orbEl.classList.add('open');
  panelEl.classList.add('open');
  lockBodyScroll();
  updateDaysRemaining(); // Refresh on every open
  if (inputEl) inputEl.focus();
}
```

#### Fix for Bug 6: Message History Persistence

(Full IndexedDB implementation in Section 9.1. Integration into sendMessage:)

```javascript
async function sendMessage() {
  if (typing) return;
  if (!inputEl) return;
  var txt = inputEl.value.trim();
  if (!txt) return;

  inputEl.value = '';
  inputEl.style.height = 'auto';
  if (sendBtn) sendBtn.disabled = true;
  typing = true;
  if (statusEl) statusEl.textContent = 'Thinking...';

  var sugg = document.getElementById('co-suggestions');
  if (sugg) sugg.remove();

  addMessage('user', txt);
  cp_history.push({ role: 'user', content: txt });

  // PERSIST: Save user message to IndexedDB
  await CoachStorage.saveMessage('user', txt);

  showTyping();
  if (orbEl) orbEl.classList.add('thinking');

  // ... existing API call logic ...

  // After receiving response:
  if (reply) {
    hideTyping();
    addMessage('coach', reply);
    cp_history.push({ role: 'assistant', content: reply });

    // PERSIST: Save assistant message to IndexedDB
    await CoachStorage.saveMessage('assistant', reply);

    // SUMMARIZE: Check if summary is needed
    maybeGenerateSummary();
  }

  // ... rest of existing logic ...
}
```

#### Fix for Bug 7: Rate Limit Persistence

(Full Supabase table implementation in Section 9.4.)

### 9.7 Analytics Instrumentation

```javascript
// coach-analytics.js -- lightweight event tracking

var CoachAnalytics = (function () {
  'use strict';

  var events = [];
  var FLUSH_INTERVAL = 30000; // 30 seconds
  var ENDPOINT = 'https://peamviowxkyaglyjpagc.supabase.co/functions/v1/coach-analytics';

  function track(eventName, properties) {
    events.push({
      event: eventName,
      properties: properties || {},
      timestamp: Date.now(),
      sessionId: localStorage.getItem('dc_session') || 'unknown',
      page: window.location.pathname
    });
  }

  function flush() {
    if (events.length === 0) return;

    var batch = events.splice(0);

    // Fire and forget -- analytics should never block the UI
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true // ensures delivery even on page unload
    }).catch(function () {
      // Silently fail -- analytics should never cause errors
    });
  }

  // Flush on interval
  setInterval(flush, FLUSH_INTERVAL);

  // Flush on page unload
  window.addEventListener('beforeunload', flush);

  return { track: track };
})();

// Events to track:
// CoachAnalytics.track('onboarding_started');
// CoachAnalytics.track('onboarding_completed', { intent: 'Long-Term' });
// CoachAnalytics.track('onboarding_abandoned', { step: 1 });
// CoachAnalytics.track('message_sent', { messageLength: txt.length });
// CoachAnalytics.track('message_received', { responseLength: reply.length });
// CoachAnalytics.track('session_started');
// CoachAnalytics.track('session_ended', { messageCount: cp_history.length });
// CoachAnalytics.track('suggested_prompt_used', { prompt: p });
// CoachAnalytics.track('settings_opened');
// CoachAnalytics.track('intent_changed', { from: old, to: new });
// CoachAnalytics.track('rate_limit_hit');
// CoachAnalytics.track('error', { type: 'api_error', message: errMsg });
```

---

## 10. Mobile Web Navigation and Coach System

### 10.1 Current Issues (Detailed)

| Issue | Root Cause | Impact |
|-------|-----------|--------|
| Panel height wrong on iOS Safari | Uses `85vh` which includes browser chrome | Content cut off at bottom |
| Keyboard pushes input offscreen | No `visualViewport` API handling | Cannot type messages |
| Touch targets too small | Buttons sized for desktop (padding-based, some <44px) | Missed taps, frustration |
| Scroll chaining | No `overscroll-behavior: contain` | Scrolling in messages scrolls the whole page |
| Orb position conflicts | Fixed at bottom-right, may overlap content | Blocks page content on small screens |
| No swipe-to-dismiss | Desktop-only close mechanism (X button) | Unnatural mobile interaction |
| Panel border-radius at bottom | 18px radius on full-width bottom sheet | Wastes screen space |
| No safe-area handling | No `env(safe-area-inset-bottom)` | Input hidden behind home indicator |

### 10.2 Complete Mobile CSS Fix

```css
/* ── Mobile Web Fixes for Coach ── */
@media (max-width: 760px) {

  /* ── Orb ── */
  .coach-orb {
    width: 50px;
    height: 50px;
    bottom: 20px;
    right: 16px;
    /* Ensure orb is above safe area on notched devices */
    bottom: max(20px, calc(env(safe-area-inset-bottom) + 8px));
  }

  /* ── Tooltip ── */
  .coach-tooltip {
    bottom: max(76px, calc(env(safe-area-inset-bottom) + 64px));
    right: 16px;
    max-width: 200px;
  }

  /* ── Locked Popover ── */
  .coach-locked-pop {
    bottom: max(76px, calc(env(safe-area-inset-bottom) + 64px));
    right: 16px;
    width: calc(100vw - 32px);
    max-width: 320px;
  }

  /* ── Panel: Full-width bottom sheet ── */
  .coach-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-width: 100%;
    height: 100dvh;
    height: 100vh; /* Fallback */
    border-radius: 0;
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .coach-panel.open {
    transform: translateY(0);
  }

  /* Drag handle at top */
  .coach-panel::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    background: rgba(65, 91, 124, 0.3);
    border-radius: 2px;
    margin: 8px auto 0;
    flex-shrink: 0;
  }

  /* ── Header ── */
  .cp-header {
    padding: 12px 16px;
    gap: 8px;
  }

  .cp-close,
  .cp-new {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── Messages area ── */
  .cp-messages {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 12px 14px;
    /* Prevent rubber-band scrolling from affecting the panel */
  }

  /* ── Input area ── */
  .cp-input-area {
    padding: 10px 12px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    border-top: 1px solid rgba(65, 91, 124, 0.15);
    background: #0B1727;
    flex-shrink: 0;
  }

  .cp-input {
    font-size: 16px; /* Prevent iOS zoom on focus */
    padding: 10px 14px;
    min-height: 44px;
  }

  .cp-send {
    width: 44px;
    height: 44px;
    font-size: 1rem;
  }

  /* ── Onboarding ── */
  .cp-ob-opt {
    min-height: 44px;
    padding: 14px 16px;
  }

  .cp-ob-start {
    min-height: 48px;
    font-size: 0.82rem;
    width: 100%;
  }

  .cp-ob-freetext-input {
    font-size: 16px; /* Prevent iOS zoom */
  }

  /* ── Suggested prompts ── */
  .cp-suggestions {
    flex-wrap: wrap;
  }

  .cp-suggest-btn {
    padding: 10px 14px;
    font-size: 0.76rem;
    min-height: 44px;
    white-space: normal; /* Allow wrapping on mobile */
    text-align: left;
  }

  /* ── Settings panel ── */
  .cp-settings {
    padding: 16px;
  }

  .cp-settings-opt {
    min-height: 44px;
    padding: 10px 14px;
  }

  .cp-settings-change {
    min-height: 44px;
    min-width: 44px;
  }

  .cp-settings-clear {
    min-height: 48px;
    font-size: 0.78rem;
  }

  /* ── Message bubbles ── */
  .cp-msg-bubble {
    max-width: 88%; /* Slightly wider on mobile */
    font-size: 0.84rem;
  }
}
```

### 10.3 iOS Virtual Keyboard Handler

```javascript
function setupMobileKeyboardHandler() {
  // Only run on mobile
  if (!isMobile() || !window.visualViewport) return;

  var panel = document.querySelector('.coach-panel');
  var inputArea = document.querySelector('.cp-input-area');
  var messagesArea = document.querySelector('.cp-messages');

  if (!panel) return;

  var initialHeight = window.visualViewport.height;

  window.visualViewport.addEventListener('resize', function () {
    if (!panel.classList.contains('open')) return;

    var currentHeight = window.visualViewport.height;
    var keyboardHeight = initialHeight - currentHeight;

    if (keyboardHeight > 100) {
      // Keyboard is open
      panel.style.height = currentHeight + 'px';

      // Scroll messages to bottom
      if (messagesArea) {
        requestAnimationFrame(function () {
          messagesArea.scrollTop = messagesArea.scrollHeight;
        });
      }
    } else {
      // Keyboard is closed
      panel.style.height = '';
    }
  });

  // When input gets focus, ensure it's visible
  var input = document.getElementById('co-input');
  if (input) {
    input.addEventListener('focus', function () {
      // Small delay to let keyboard animation start
      setTimeout(function () {
        if (inputArea) {
          inputArea.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
      }, 300);
    });
  }
}
```

### 10.4 Testing Matrix

| Device | Screen Size | Browser | Key Test Areas |
|--------|------------|---------|----------------|
| iPhone SE (3rd gen) | 375x667 | Safari 17+ | Small screen, keyboard overlap, touch targets |
| iPhone 14 | 390x844 | Safari 17+ | Dynamic Island, notch handling |
| iPhone 15 Pro Max | 430x932 | Safari 18+ | Large screen, safe areas, max content |
| Samsung Galaxy S23 | 360x780 | Chrome 120+ | Android keyboard behavior, font rendering |
| Samsung Galaxy S24 Ultra | 412x915 | Chrome 120+ | Large Android, different aspect ratio |
| iPad Mini | 744x1133 | Safari 17+ | Tablet sizing (should use desktop layout) |

**Test checklist for each device:**

- [ ] Orb visible and tappable
- [ ] Panel opens smoothly (no jank)
- [ ] Panel fills screen properly (no gap at bottom)
- [ ] Onboarding buttons all tappable (44px minimum)
- [ ] Free-text input focuses without page zoom
- [ ] Chat messages scroll independently of body
- [ ] Input area visible when keyboard is open
- [ ] Send button tappable with keyboard open
- [ ] Messages render correctly (no overflow)
- [ ] Swipe down on header dismisses panel
- [ ] Settings panel accessible and usable
- [ ] Suggested prompts wrap and remain tappable
- [ ] Status indicator visible
- [ ] Days remaining badge visible

### 10.5 Premium Feel on Mobile

#### Smooth Spring Animations

```css
/* Panel open: spring-like ease */
.coach-panel {
  transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Panel close: slightly faster */
.coach-panel.closing {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
```

#### Haptic-Style Visual Feedback

```css
/* Button press effect */
.cp-send:active,
.cp-ob-opt:active,
.cp-ob-start:active,
.cp-suggest-btn:active {
  transform: scale(0.97);
  transition: transform 0.1s ease;
}

/* Gold glow on selection */
.cp-ob-opt.sel {
  box-shadow: 0 0 0 1px rgba(201, 168, 76, 0.3),
              0 0 12px rgba(201, 168, 76, 0.08);
}
```

#### No Layout Shifts

```css
/* Pre-allocate space for dynamic elements */
.cp-status {
  min-height: 16px; /* Prevents shift when text changes */
}

.cp-days {
  min-width: 80px; /* Prevents header reflow */
  text-align: right;
}

/* Prevent content jump when suggestions appear/disappear */
.cp-suggestions {
  min-height: 0;
  transition: min-height 0.2s ease;
}
```

---

## 11. QA and Zero-Regression Plan

### 11.1 Test Cases (47 Scenarios)

#### Category 1: Onboarding (8 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 1 | New user selects specific Intent | 1. Clear localStorage 2. Open coach 3. Select "Long-Term" 4. Click "Start Coaching Session" | Chat opens, welcome message mentions "long-term relationship", suggested prompts are Long-Term specific | |
| 2 | New user selects "I'm not sure" | 1. Clear localStorage 2. Open coach 3. Select "I'm not sure yet" 4. Click "Start Coaching Session" | Chat opens, welcome message starts discovery conversation, prompts are discovery-oriented | |
| 3 | New user enters free text only | 1. Clear localStorage 2. Open coach 3. Type "Just got out of a relationship" in free text 4. Click "Start" | Intent auto-set to "Not Sure", chat opens, welcome references their situation | |
| 4 | New user enters free text + selects Intent | 1. Clear localStorage 2. Open coach 3. Select "Casual" 4. Type "want to have fun" 5. Click "Start" | Intent is "Casual", free text is stored, welcome references both | |
| 5 | Start button disabled until selection/text | 1. Clear localStorage 2. Open coach | Start button is disabled. Selecting Intent enables it. Typing text enables it. | |
| 6 | No Phase or Focus steps shown | 1. Clear localStorage 2. Open coach | Only Intent step visible. No Phase step. No Focus step. No progress pips. | |
| 7 | Onboarding on playbook surface | 1. Clear localStorage 2. Navigate to playbook content 3. Scroll to coach section | Same single-step onboarding as orb. No divergence. | |
| 8 | Onboarding persists across surfaces | 1. Complete onboarding on orb 2. Open playbook content | Playbook coach shows chat (not onboarding). Intent matches orb selection. | |

#### Category 2: Conversation Persistence (7 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 9 | History survives page reload | 1. Send 5 messages 2. Receive 5 responses 3. Reload page | All 10 messages visible in chat. No re-onboarding. | |
| 10 | History survives browser close | 1. Send messages 2. Close browser 3. Reopen and navigate to page | Messages restored from IndexedDB. | |
| 11 | Returning user gets welcome back | 1. Have existing history 2. Close and reopen coach | "Welcome back" message references last conversation topic. | |
| 12 | Summary generated at 10 messages | 1. Send 10 messages 2. Check IndexedDB summaries store | Summary record exists with content referencing conversation. | |
| 13 | API uses summary + 5 recent | 1. Send 15 messages 2. Monitor API request body on message 16 | Request body contains summary + last 5 messages, not all 15. | |
| 14 | Clear history works | 1. Have history 2. Open settings 3. Click "Clear history" | IndexedDB messages cleared. Chat area empty. Fresh welcome shown. | |
| 15 | 30-day TTL enforced | 1. Insert test message with timestamp 31 days ago 2. Call cleanupExpiredData() | Old message deleted. Recent messages preserved. | |

#### Category 3: Intent Management (6 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 16 | Change Intent via settings | 1. Set Intent to "Marriage" 2. Open settings 3. Tap "Change" 4. Select "Casual" | Intent updates to "Casual". System message shows in chat. Next response acknowledges change. | |
| 17 | Intent syncs across surfaces | 1. Change Intent on orb settings 2. Open playbook coach | Playbook shows updated Intent. | |
| 18 | Coach adapts to new Intent | 1. Change Intent from "Long-Term" to "Casual" 2. Send a message | Response tone and advice adjusts to casual dating context. | |
| 19 | "Not Sure" discovery leads to Intent | 1. Select "Not Sure" 2. Answer 3-5 discovery questions | Coach suggests an Intent. Confirming it updates stored Intent. | |
| 20 | Intent conflict detection | 1. Set Intent to "Marriage" 2. Ask about casual hookup | Coach acknowledges the conflict and asks for clarification. | |
| 21 | Bypass protection: no Intent | 1. Set pb_dc_onboarded=1 2. Clear pb_dc_intent 3. Reload | Onboarding re-triggers (soft re-onboarding). | |

#### Category 4: Rate Limiting (5 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 22 | 50 message limit enforced | 1. Send 50 messages | 50th message succeeds. 51st returns rate limit error. | |
| 23 | Rate limit survives cold start | 1. Send 50 messages 2. Wait for Edge Function cold start 3. Send message | Still rate limited. Cannot send. | |
| 24 | Rate limit resets after 24 hours | 1. Hit rate limit 2. Advance clock 24 hours | Can send messages again. | |
| 25 | Upgrade prompt at low remaining | 1. Send 45 messages (Standard tier) | System message shows remaining count and upgrade option. | |
| 26 | Premium tier unlimited | 1. Set tier to Premium 2. Send 100 messages | All messages succeed. No rate limit. | |

#### Category 5: Mobile Web (8 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 27 | Panel height on iPhone Safari | 1. Open coach on iPhone Safari | Panel fills screen. No gap at bottom. Content not hidden. | |
| 28 | Keyboard does not hide input | 1. Open coach on iPhone 2. Tap input field | Keyboard opens. Input area stays visible above keyboard. | |
| 29 | Touch targets 44px | 1. Open coach on mobile | All buttons, options, and interactive elements are at least 44x44px. | |
| 30 | Scroll containment | 1. Open coach 2. Scroll messages area up and down rapidly | Only messages scroll. Page body does not scroll behind panel. | |
| 31 | Swipe to dismiss | 1. Open coach 2. Swipe down on header area | Panel dismisses with smooth animation. | |
| 32 | Input font 16px (no iOS zoom) | 1. Open coach on iPhone 2. Tap input field | No page zoom occurs when input gets focus. | |
| 33 | Safe area handling | 1. Open coach on iPhone with home indicator | Input area not hidden behind home indicator bar. | |
| 34 | Onboarding buttons on small screen | 1. Open coach on iPhone SE 2. View onboarding | All 6 Intent buttons + free text visible and scrollable. | |

#### Category 6: Cross-Surface Sync (4 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 35 | Onboard on orb, verify playbook | 1. Complete onboarding on orb 2. Navigate to playbook content | Playbook coach skips onboarding. Shows chat. Intent correct. | |
| 36 | Access code on playbook, verify orb | 1. Enter access code on playbook 2. Navigate to home page | Orb shows active (gold glow). Panel accessible. | |
| 37 | Two tabs open, change Intent | 1. Open coach in two tabs 2. Change Intent in tab A | Tab B updates Intent on next interaction (storage event). | |
| 38 | Session ID consistent | 1. Open coach on orb 2. Open coach on playbook | Same dc_session used. Rate limit applies across both. | |

#### Category 7: Edge Cases (6 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 39 | Clear all localStorage | 1. Clear all localStorage 2. Reload page | Orb shows locked state. No errors. Clean state. | |
| 40 | Expired access (31+ days) | 1. Set pb_dc_first to 31 days ago 2. Open coach | Shows "Access expired" badge. Chat still accessible (grace period). | |
| 41 | Corrupted IndexedDB | 1. Delete IndexedDB database 2. Open coach with pb_dc_onboarded=1 | Graceful fallback. Chat works without history. No errors. | |
| 42 | Very long message (2000 chars) | 1. Paste 2000 character message 2. Send | Message truncated to MAX_MESSAGE_LENGTH. No error. | |
| 43 | Rapid fire messages | 1. Send 5 messages in quick succession | Each message queued and sent. No duplicate sends. No UI corruption. | |
| 44 | Network disconnect mid-message | 1. Send message 2. Disconnect network before response | Typing indicator removed. Error message shown. User can retry. | |

#### Category 8: Conversation Quality (3 tests)

| # | Test Case | Steps | Expected Result | Pass/Fail |
|---|-----------|-------|-----------------|-----------|
| 45 | Emotional input | Send: "I just got dumped and I feel terrible" | Response leads with empathy. Acknowledges pain. Then offers actionable next step. Does not say "just be yourself." | |
| 46 | Urgent input | Send: "She just texted me 'we need to talk' what do I say" | Response gives immediate text to send FIRST. Explanation second. No clarifying questions before the answer. | |
| 47 | Vague input | Send: "help" | Response asks a specific clarifying question. Does not give generic advice. Does not lecture. | |

### 11.2 Pass/Fail Rubric

Each test case is evaluated on these dimensions:

| Dimension | Score 1 (Fail) | Score 3 (Acceptable) | Score 5 (Premium) |
|-----------|---------------|---------------------|-------------------|
| Premium feel | Looks broken or cheap | Functional, clean | Polished, animated, delightful |
| Methodology alignment | Generic advice, no references | Mentions methodology occasionally | Every response grounded in methodology |
| Response usefulness | Platitudes, vague | Somewhat helpful | Specific, actionable, immediately applicable |
| Friction level | Multiple steps, confusion | Minor friction, manageable | Effortless, intuitive |
| Mobile web quality | Broken layout, hidden elements | Usable with workarounds | Native-app feel |
| Investor-readiness | Would not show to investors | Could show with caveats | Confident demo piece |

**Minimum passing scores:**
- Premium feel: 4
- Methodology alignment: 4
- Response usefulness: 4
- Friction level: 4
- Mobile web quality: 4
- Investor-readiness: 4

---

## 12. Final Prioritized Action Plan

### Phase 1: Critical Fixes (Week 1-2)

**Goal:** Fix everything that is broken. Remove friction. Establish the foundation.

| Task | Priority | Effort | Files Modified |
|------|----------|--------|----------------|
| Fix Bug 1: Centralize access code validation | P0 | 2 hours | coach-orb.js, playbook-content.js |
| Fix Bug 3: Onboarding bypass protection | P0 | 1 hour | coach-orb.js, playbook-content.js |
| Fix Bug 5: Days remaining refresh on visibility | P0 | 30 min | coach-orb.js, playbook-content.js |
| Remove Phase question from onboarding | P0 | 3 hours | index.html, playbook/content/index.html, coach-orb.js, playbook-content.js, style.css |
| Remove Focus question from onboarding | P0 | 2 hours | Same as above |
| Add "I'm not sure yet" as first-class option | P0 | 2 hours | Same as above |
| Add optional free-text input | P0 | 2 hours | Same as above |
| Add intent descriptions to buttons | P1 | 1 hour | index.html, playbook/content/index.html, style.css |
| Fix mobile panel height (100dvh) | P0 | 1 hour | style.css |
| Fix iOS keyboard overlap | P0 | 3 hours | coach-orb.js, style.css |
| Fix touch targets (44px minimum) | P0 | 2 hours | style.css |
| Fix scroll containment | P1 | 1 hour | style.css |
| Add settings gear icon | P1 | 4 hours | index.html, coach-orb.js, style.css |
| Build Intent change via settings | P1 | 3 hours | coach-orb.js |
| Fix Bug 4: New Session intent reset option | P1 | 2 hours | coach-orb.js, playbook-content.js |
| Add safe-area handling for notched devices | P1 | 1 hour | style.css |

**Phase 1 total estimated effort: 30 hours**

### Phase 2: Persistence and Intelligence (Week 3-4)

**Goal:** Add memory. Add summaries. Make the coach remember.

| Task | Priority | Effort | Files Modified |
|------|----------|--------|----------------|
| Implement IndexedDB storage module | P0 | 6 hours | New: coach-storage.js |
| Integrate IndexedDB with sendMessage | P0 | 3 hours | coach-orb.js, playbook-content.js |
| Build session restoration on page load | P0 | 4 hours | coach-orb.js, playbook-content.js |
| Implement summary generation every 10 msgs | P0 | 4 hours | coach-orb.js, coach-proxy/index.ts |
| Build returning-user welcome message | P1 | 2 hours | coach-orb.js |
| Fix Bug 7: Move rate limiting to Supabase | P0 | 4 hours | coach-proxy/index.ts, SQL migration |
| Add context-aware suggested prompts | P1 | 3 hours | coach-orb.js, playbook-content.js |
| Implement state sync (storage events) | P1 | 3 hours | coach-orb.js, playbook-content.js |
| Fix Bug 2: Cross-surface state sync | P1 | 2 hours | coach-orb.js, playbook-content.js |
| Add 30-day TTL cleanup for IndexedDB | P2 | 2 hours | coach-storage.js |
| Add swipe-to-dismiss on mobile | P2 | 3 hours | coach-orb.js, style.css |
| Update system prompt: discovery protocol | P0 | 2 hours | coach-proxy/index.ts |
| Update system prompt: adaptive tone | P1 | 2 hours | coach-proxy/index.ts |
| Update system prompt: follow-up suggestions | P1 | 1 hour | coach-proxy/index.ts |

**Phase 2 total estimated effort: 41 hours**

### Phase 3: Premium Polish and Tiers (Week 5-6)

**Goal:** Build the tier system. Add upgrade paths. Polish the premium feel.

| Task | Priority | Effort | Files Modified |
|------|----------|--------|----------------|
| Create coach_rate_limits Supabase table | P0 | 2 hours | SQL migration |
| Add tier field to purchases table | P0 | 1 hour | SQL migration |
| Implement tier-aware rate limiting in Edge Function | P0 | 4 hours | coach-proxy/index.ts |
| Build upgrade prompt logic (at 45/50 messages) | P1 | 2 hours | coach-orb.js |
| Add tier badge to settings panel | P1 | 1 hour | coach-orb.js, style.css |
| Update system prompt: tier awareness section | P0 | 2 hours | coach-proxy/index.ts |
| Update system prompt: common scenarios section | P1 | 3 hours | coach-proxy/index.ts |
| Add message count display in settings | P1 | 2 hours | coach-orb.js |
| Spring animations for panel open/close | P2 | 2 hours | style.css |
| Button press feedback (scale transform) | P2 | 1 hour | style.css |
| Status indicator states (Ready/Thinking/Limited) | P1 | 2 hours | coach-orb.js, style.css |
| Avatar pulse animation | P2 | 1 hour | style.css |
| Analytics instrumentation | P1 | 4 hours | New: coach-analytics.js, coach-orb.js |
| Full mobile QA pass (all devices in matrix) | P0 | 8 hours | Various fixes |

**Phase 3 total estimated effort: 35 hours**

### Phase 4: Optimization (Week 7+)

**Goal:** Optimize based on real usage data. Iterate. Scale.

| Task | Priority | Effort | Files Modified |
|------|----------|--------|----------------|
| A/B test onboarding: with/without free text | P2 | 8 hours | coach-orb.js, analytics |
| Analyze conversation patterns from analytics | P2 | 4 hours | Data analysis |
| Optimize system prompt based on common failures | P1 | 4 hours | coach-proxy/index.ts |
| Add conversation export (PDF) | P2 | 8 hours | New module |
| Performance optimization: lazy-load coach module | P2 | 4 hours | coach-orb.js, build config |
| Implement prompt rotation algorithm | P3 | 2 hours | coach-orb.js |
| Add message timestamps to chat UI | P3 | 2 hours | coach-orb.js, style.css |
| System prompt versioning with changelog | P2 | 2 hours | coach-proxy/index.ts, PROMPT_CHANGELOG.md |
| Supabase rate_limits cleanup cron job | P2 | 2 hours | SQL, Supabase scheduled function |
| Unify coach-orb.js and playbook-content.js | P1 | 12 hours | Major refactor into shared module |
| Consider PWA manifest for mobile install | P3 | 4 hours | manifest.json, service-worker.js |

**Phase 4 total estimated effort: 52 hours**

---

### Total Estimated Effort

| Phase | Hours | Timeline |
|-------|-------|----------|
| Phase 1: Critical Fixes | 30 | Week 1-2 |
| Phase 2: Persistence + Intelligence | 41 | Week 3-4 |
| Phase 3: Premium Polish + Tiers | 35 | Week 5-6 |
| Phase 4: Optimization | 52 | Week 7+ |
| **Total** | **158** | **7-8 weeks** |

---

### Key Dependencies

1. **Supabase access:** Phases 2-3 require database migrations (rate_limits table, tier column). Need admin access to Supabase project.
2. **Anthropic API pricing:** Cost projections assume current Sonnet pricing ($3/M input, $15/M output). Monitor for changes.
3. **Premium tier pricing decision:** $750-1000 range for Premium needs to be finalized before Phase 3 checkout integration.
4. **Mobile devices for testing:** Need physical access to iPhone SE, iPhone 14+, and Samsung Galaxy for Phase 1 mobile fixes and Phase 3 QA.

### Success Criteria

The Dating Coach redesign is complete when:

1. A new user can go from opening the coach to their first AI response in under 15 seconds
2. All conversations persist for 30 days across page reloads and browser restarts
3. The 50-message daily limit is enforced reliably (survives Edge Function cold starts)
4. Intent can be changed at any time via the settings panel
5. Mobile web experience has no layout breaks, keyboard overlaps, or undersized touch targets on the test device matrix
6. Every AI response references the MatchMakers methodology
7. The system costs 25-35% less per user per month through conversation summaries
8. An investor watching a demo sees a product that feels native-app quality on mobile
9. All 47 test cases pass with scores of 4+ on the rubric

---

*End of document. This specification is designed to be executed immediately. Every recommendation includes the specific code, CSS, or system prompt text needed for implementation.*
