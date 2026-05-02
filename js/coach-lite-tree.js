/* ═══════════════════════════════════════════════════
   COACH LITE CHOICE TREE — MVP Day 3 skeleton
   ~30 nodes; static client-side; no LLM at L1
   Cartier voice; webcoach co-authors v1.6 polish
   ═══════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // Node schema:
  //   id: string
  //   prompt: Cartier-voice prompt rendered to user
  //   options: [{ label, next }]  OR  terminal: true with closing
  //   closing: optional Cartier-voice closing line for terminal nodes

  const TREE = {
    'root': {
      prompt: 'The Coach is ready. Where would you like to begin the read.',
      options: [
        { label: 'A connection that has surfaced and I am unsure how to read it.', next: 'phase_connection' },
        { label: 'I am working on the read of myself before someone is in view.', next: 'phase_profile' },
        { label: 'Someone is in courting cadence and I am reading whether it is real.', next: 'phase_courtship' },
        { label: 'A commitment is forming and I am calibrating it.', next: 'phase_commitment' },
        { label: 'A relationship is established and I am holding its shape.', next: 'phase_ongoing' }
      ]
    },

    // ── Profile Phase branches ──
    'phase_profile': {
      prompt: 'The Profile phase is where the read of yourself precedes the read of anyone else. The next move that earns it is which one.',
      options: [
        { label: 'Defining what I am actually looking for.', next: 'profile_intent' },
        { label: 'Reading my own standing honestly.', next: 'profile_standing' },
        { label: 'Surfacing the kind of presence I want to bring.', next: 'profile_presence' }
      ]
    },
    'profile_intent': {
      terminal: true,
      prompt: 'Intent precedes everything. The Connection Code Brief surfaces the dominant Intent the methodology is currently calibrating for. The next move is to read the Brief carefully and let the dominant Intent shape every subsequent decision.',
      closing: 'Consult the Brief. Then return when the read has settled.'
    },
    'profile_standing': {
      terminal: true,
      prompt: 'Standing is the honesty the read begins with. The Connection Code Brief surfaces your current Phase. Profile-phase work is interior, and the read of yourself is what shapes everything downstream.',
      closing: 'Consult the Brief. Profile work calibrates the read of yourself first.'
    },
    'profile_presence': {
      terminal: true,
      prompt: 'Presence is observable; persona is performed. The methodology calibrates against the read of presence, not the persona. The Brief surfaces your initial Signal state, including Open and Build.',
      closing: 'Read the Signal state in the Brief. Presence is what arrives in real time.'
    },

    // ── Connection Phase branches ──
    'phase_connection': {
      prompt: 'A connection has surfaced. The Connection phase is where the read deepens. What is the question that surfaces most often.',
      options: [
        { label: 'Whether to engage further with someone newly in view.', next: 'connection_engage' },
        { label: 'How to read the cadence I am receiving.', next: 'connection_cadence' },
        { label: 'Whether what I am noticing is the real thing.', next: 'connection_real' },
        { label: 'Something feels off and I cannot name it.', next: 'connection_off' }
      ]
    },
    'connection_engage': {
      terminal: true,
      prompt: 'The decision to engage further is a Position-Signal call. The Brief surfaces your current Signal state. The methodology reads engagement against Intent first; cadence second; presence third.',
      closing: 'Read against Intent. Then cadence. Then presence.'
    },
    'connection_cadence': {
      terminal: true,
      prompt: 'Cadence tells the truth when language does not. The methodology reads the gap between sent and received as a Signal, not a verdict. Hold the read open until two more cadence moments have arrived.',
      closing: 'Two more cadence moments. Then return with the read.'
    },
    'connection_real': {
      terminal: true,
      prompt: 'The read of whether it is real surfaces in the Build Signal. The Brief surfaces your initial state on Build. Real is what survives a second cadence cycle without you supplying its momentum.',
      closing: 'Hold the read. Watch the Build Signal across one more cycle.'
    },
    'connection_off': {
      prompt: 'Something off, unnamed. The methodology reads "off" as a Signal worth taking seriously, even before the language for it has arrived. Where is the off-ness most located.',
      options: [
        { label: 'In the cadence; the rhythm is wrong.', next: 'connection_cadence' },
        { label: 'In the presence; the read of who is present feels off.', next: 'connection_presence_off' },
        { label: 'In myself; I am not steady on what I want.', next: 'phase_profile' }
      ]
    },
    'connection_presence_off': {
      terminal: true,
      prompt: 'A presence read that registers as off is a Signal. The methodology does not require you to name it before you trust it. Hold the read; let the cadence cycle confirm or correct it.',
      closing: 'Trust the off-read. One more cadence cycle confirms or corrects.'
    },

    // ── Courtship Phase branches ──
    'phase_courtship': {
      prompt: 'Courtship is where the cadence becomes the read. What is the calibration most in front of you now.',
      options: [
        { label: 'Whether the cadence is honest on both sides.', next: 'courtship_cadence_honest' },
        { label: 'Whether I am reading more than is actually there.', next: 'courtship_overreading' },
        { label: 'Whether the courting is moving toward Commitment or pausing.', next: 'courtship_progress' }
      ]
    },
    'courtship_cadence_honest': {
      terminal: true,
      prompt: 'Honest cadence is symmetric without being identical. The Build Signal in your Brief reads the symmetry. If the cadence is one-sided across two cycles, the methodology treats the asymmetry as the answer.',
      closing: 'Two cycles is the read. Asymmetry across two cycles names itself.'
    },
    'courtship_overreading': {
      terminal: true,
      prompt: 'Overreading is when the read leans on hope instead of cadence. The Brief surfaces your dominant Intent; let the Intent calibrate what the read is allowed to claim.',
      closing: 'Read against the Brief. Hope is not a Signal.'
    },
    'courtship_progress': {
      terminal: true,
      prompt: 'The Progress Signal is the methodology\'s reading of whether courtship is moving. The Brief surfaces your initial Progress state. Progress is the cadence cycle confirming, not a verbal commitment ahead of cadence.',
      closing: 'Watch the Progress Signal across one more cycle. Verbal commitments without cadence are not Progress.'
    },

    // ── Commitment Phase branches ──
    'phase_commitment': {
      prompt: 'Commitment is the moment the methodology asks whether the read holds. What is the question on the table now.',
      options: [
        { label: 'Whether to name the commitment explicitly.', next: 'commitment_name' },
        { label: 'Whether the commitment forming is the right one for me.', next: 'commitment_right' },
        { label: 'Whether I am ready, regardless of the other side.', next: 'commitment_ready' }
      ]
    },
    'commitment_name': {
      terminal: true,
      prompt: 'Naming a commitment converts the read into a record. The methodology reads naming as a Phase transition, not a decision in isolation. Name when the Build and Progress Signals have both held across the prior cycle.',
      closing: 'Both Signals held across one full cycle. Then naming earns it.'
    },
    'commitment_right': {
      terminal: true,
      prompt: 'The read on whether a commitment is the right one is calibrated against your dominant Intent in the Brief. If the commitment forming does not serve the Intent the methodology surfaced, the methodology reads the misalignment as the answer.',
      closing: 'Read the commitment against the Intent. Misalignment is the answer when it is present.'
    },
    'commitment_ready': {
      terminal: true,
      prompt: 'Readiness is interior. The Brief surfaces your dominant Intent and current Phase. The methodology does not commit on your behalf; it surfaces whether the Phase is the one in which a commitment earns its standing.',
      closing: 'Re-read Phase and Intent in the Brief. Readiness is yours to name.'
    },

    // ── Ongoing Phase branches ──
    'phase_ongoing': {
      prompt: 'Ongoing is where the methodology holds the shape of what has been built. What is the question that surfaces most.',
      options: [
        { label: 'How to keep the cadence calibrated over time.', next: 'ongoing_cadence' },
        { label: 'How to read a moment that feels different from before.', next: 'ongoing_different' },
        { label: 'How to invite recalibration when the read has drifted.', next: 'ongoing_drift' }
      ]
    },
    'ongoing_cadence': {
      terminal: true,
      prompt: 'Ongoing cadence is calibrated against the Phase the relationship is in. Re-running Suitability against the same suitor on a quarterly cycle surfaces drift before drift becomes the question.',
      closing: 'Quarterly is the cadence the methodology reads against. Hold it.'
    },
    'ongoing_different': {
      terminal: true,
      prompt: 'A moment that reads differently is a Signal. The methodology does not require you to name the difference; the difference is the data. Hold the read across one more cadence cycle, and the Signal will resolve.',
      closing: 'One more cadence cycle. The Signal resolves itself.'
    },
    'ongoing_drift': {
      terminal: true,
      prompt: 'Drift is calibrated by re-running the read. The Brief is a starting record; recalibration is the practice of returning to it and surfacing what has changed.',
      closing: 'Return to the Brief. Recalibrate the Signal state. The methodology earns the membership.'
    }
  };

  function getNode(id) {
    return TREE[id] || TREE['root'];
  }

  function getRootId() {
    return 'root';
  }

  global.MMCoachLite = {
    TREE: TREE,
    getNode: getNode,
    getRootId: getRootId
  };
})(typeof window !== 'undefined' ? window : this);
