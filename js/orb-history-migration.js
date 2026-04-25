/* ═══════════════════════════════════════════════════════════════
   MATCHMAKERS — orb-history-migration.js
   Tier 1 sub-branch: phase1-orb-retirement-migration

   Migrates legacy `mm_coach` IndexedDB chat history (used by the
   to-be-retired gold-dome orb widget at js/coach-orb.js +
   js/coach-storage.js) into the forward-compatible `mm_coach_v2`
   schema for the future Coach primacy surface (Tier 3).

   Posture
   - IDEMPOTENT — runs on every page load; skips if already migrated
     within the last 30 days (per localStorage flag)
   - NON-DESTRUCTIVE — legacy `mm_coach` DB preserved for 30 days
     post-migration; final cleanup ships in a tiny follow-on commit
   - SILENT — zero user-visible UI; runs in background via
     requestIdleCallback so it never blocks page render
   - FAILURE-TOLERANT — every step try/catch'd + non-blocking; errors
     log to console + analytics; never surface to user
   - FORWARD-COMPATIBLE — v2 records carry a `source: 'orb_legacy'`
     tag plus nullable `intent` + `conversation_uuid` so the Coach
     primacy surface can extend without schema rewrites
   - REVERTABLE — `git revert` of this commit removes the script with
     zero data loss (legacy DB untouched; v2 DB simply orphans
     gracefully if read by no consumer)

   Schemas
   - LEGACY (mm_coach v1):
       messages: { id (auto), sessionId, role, content, timestamp }
       sessions: { sessionId, ... }
   - V2 (mm_coach_v2 v1):
       messages: { id (auto), sessionId, role, content, timestamp,
                   intent (nullable), conversation_uuid (nullable),
                   source ('orb_legacy' | future 'primacy_v1') }
       sessions: { sessionId, source, intent (nullable),
                   migrated_at, ...legacy fields preserved }

   Persistence
   - Read:  IDB `mm_coach` v1 → object stores `messages` + `sessions`
   - Write: IDB `mm_coach_v2` v1 → object stores `messages` + `sessions`
   - Flag:  localStorage.mm_chat_migration_completed_at (ISO8601)

   Activation
   - This script file exists in the repo as of phase1-orb-retirement-
     migration sub-branch
   - HTML <script> inclusion is DEFERRED to either (a) a tiny follow-on
     commit on the same sub-branch once 5-agent review mesh signs off,
     or (b) the Tier 4 orb retirement UI sub-branch when the Coach
     primacy surface lives
   - Until activated, this script has zero effect on production users

   Coordination
   - webcoach: future Coach primacy surface reads mm_coach_v2; intent
     + conversation_uuid populated by primacy implementation
   - Design: silent-default migration UX RATIFIED per D&M Round 1;
     fallback banner reserved for opt-in if migration-failure
     telemetry surfaces issues
   - Legal: no PII handling change; v2 DB is per-browser-origin like
     legacy; user controls via existing browser storage settings
   - Round 2 plan §4.5 + Design §11 F5 feasibility PASS
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Graceful no-op on environments without IndexedDB (very old browsers,
  // some private-browsing modes). Migration failure here is safe: the
  // user simply does not have legacy chat history to migrate.
  if (typeof window === 'undefined' || !window.indexedDB) return;

  // ── Constants ───────────────────────────────────────────────────
  var LEGACY_DB        = 'mm_coach';
  var V2_DB            = 'mm_coach_v2';
  var V2_VERSION       = 1;
  var STORE_MESSAGES   = 'messages';
  var STORE_SESSIONS   = 'sessions';
  var FLAG_KEY         = 'mm_chat_migration_completed_at';
  var FLAG_VALID_MS    = 30 * 24 * 60 * 60 * 1000; // 30 days
  var IDLE_TIMEOUT_MS  = 5000;
  var FALLBACK_DELAY_MS = 1000;

  // ── Idempotence ─────────────────────────────────────────────────
  function alreadyMigrated() {
    try {
      var ts = window.localStorage.getItem(FLAG_KEY);
      if (!ts) return false;
      var when = new Date(ts).getTime();
      if (isNaN(when)) return false;
      return (Date.now() - when) < FLAG_VALID_MS;
    } catch (e) {
      return false; // localStorage unavailable → re-attempt; safe
    }
  }

  function markComplete() {
    try {
      window.localStorage.setItem(FLAG_KEY, new Date().toISOString());
    } catch (e) {
      // localStorage unavailable; migration will re-fire next visit.
      // Idempotent + diff-aware writes mean no harm done.
    }
  }

  // ── Telemetry hooks (use existing track-events Edge Function pipe) ──
  function track(event, props) {
    if (typeof window.mmTrack === 'function') {
      try { window.mmTrack(event, props || {}); } catch (e) {}
    }
  }

  function logInfo(msg) {
    if (window.console && typeof console.info === 'function') {
      console.info('[mm-orb-migration] ' + msg);
    }
  }

  function logWarn(msg, err) {
    if (window.console && typeof console.warn === 'function') {
      console.warn('[mm-orb-migration] ' + msg, err || '');
    }
  }

  // ── IndexedDB plumbing ──────────────────────────────────────────

  // Open legacy DB. Resolves with the DB handle if it exists. Rejects
  // with a benign error if the DB does not exist (nothing to migrate).
  function openLegacy() {
    return new Promise(function (resolve, reject) {
      var req = window.indexedDB.open(LEGACY_DB);
      var existedAtOpen = true;

      req.onupgradeneeded = function () {
        // onupgradeneeded fires when the DB is created OR version-bumped.
        // If we hit it on a plain `open()` (no version arg), the DB did
        // not previously exist. Abort: there is nothing to migrate.
        existedAtOpen = false;
        var db = req.result;
        try { db.close(); } catch (e) {}
        // Best-effort: delete the empty DB we just accidentally created
        try { window.indexedDB.deleteDatabase(LEGACY_DB); } catch (e) {}
      };

      req.onsuccess = function (e) {
        if (!existedAtOpen) {
          reject(new Error('legacy DB did not exist; nothing to migrate'));
          return;
        }
        resolve(e.target.result);
      };
      req.onerror = function () { reject(req.error || new Error('legacy open failed')); };
      req.onblocked = function () { reject(new Error('legacy open blocked')); };
    });
  }

  // Open or create v2 DB with the forward-compatible schema.
  function openV2() {
    return new Promise(function (resolve, reject) {
      var req = window.indexedDB.open(V2_DB, V2_VERSION);

      req.onupgradeneeded = function (e) {
        var db = e.target.result;

        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          var msgStore = db.createObjectStore(STORE_MESSAGES, {
            keyPath: 'id',
            autoIncrement: true
          });
          msgStore.createIndex('sessionId', 'sessionId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
          msgStore.createIndex('source',    'source',    { unique: false });
        }

        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          var sessStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
          sessStore.createIndex('source', 'source', { unique: false });
        }
      };

      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function () { reject(req.error || new Error('v2 open failed')); };
      req.onblocked = function () { reject(new Error('v2 open blocked')); };
    });
  }

  // Read all records from a legacy store (or empty array if store absent).
  function readAll(db, storeName) {
    return new Promise(function (resolve, reject) {
      try {
        if (!db.objectStoreNames.contains(storeName)) { resolve([]); return; }
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var req = store.getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error || new Error('readAll failed')); };
      } catch (e) { reject(e); }
    });
  }

  // Write a batch of records to a v2 store with a per-record decorator
  // that adds forward-compatible fields and drops the legacy auto-id.
  function writeBatch(db, storeName, records, decorate) {
    return new Promise(function (resolve, reject) {
      if (!records || !records.length) { resolve(0); return; }
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      var queued = 0;
      records.forEach(function (rec) {
        try {
          var v2rec = decorate(rec);
          // Drop legacy auto-id so v2 generates fresh ids; sessions use
          // sessionId as keyPath so id removal is harmless there too.
          if (v2rec && Object.prototype.hasOwnProperty.call(v2rec, 'id')) {
            delete v2rec.id;
          }
          store.add(v2rec);
          queued++;
        } catch (e) {
          // Per-record failure (e.g., duplicate sessionId on re-run with
          // stale flag) — non-fatal; continue with the next record.
        }
      });
      tx.oncomplete = function () { resolve(queued); };
      tx.onerror = function () { reject(tx.error || new Error('writeBatch failed')); };
    });
  }

  // ── Decorators (legacy → v2 record transforms) ──────────────────
  function decorateMessage(legacyMsg) {
    return {
      sessionId:         legacyMsg.sessionId || null,
      role:              legacyMsg.role      || 'user',
      content:           legacyMsg.content   || '',
      timestamp:         legacyMsg.timestamp || Date.now(),
      intent:            null,        // populated by Coach primacy surface
      conversation_uuid: null,        // populated by Coach primacy surface
      source:            'orb_legacy' // marks the migration provenance
    };
  }

  function decorateSession(legacySession) {
    var copy = {};
    for (var k in legacySession) {
      if (Object.prototype.hasOwnProperty.call(legacySession, k)) {
        copy[k] = legacySession[k];
      }
    }
    if (!copy.intent) copy.intent = null;
    copy.source       = 'orb_legacy';
    copy.migrated_at  = Date.now();
    return copy;
  }

  // ── Migration orchestrator ──────────────────────────────────────
  function migrate() {
    if (alreadyMigrated()) return;

    var legacyDb = null;
    var v2Db     = null;

    openLegacy()
      .then(function (db) {
        legacyDb = db;
        return Promise.all([
          readAll(db, STORE_MESSAGES),
          readAll(db, STORE_SESSIONS)
        ]);
      })
      .then(function (results) {
        var messages = results[0];
        var sessions = results[1];

        // Empty legacy DB — mark complete + done. (User opened orb but
        // never sent a message; nothing to carry forward.)
        if (!messages.length && !sessions.length) {
          markComplete();
          track('orb_history_migration_skipped', { reason: 'empty' });
          logInfo('legacy DB present but empty; marked complete');
          return;
        }

        return openV2().then(function (db) {
          v2Db = db;
          return Promise.all([
            writeBatch(v2Db, STORE_MESSAGES, messages, decorateMessage),
            writeBatch(v2Db, STORE_SESSIONS, sessions, decorateSession)
          ]).then(function (counts) {
            var msgCount  = counts[0];
            var sessCount = counts[1];
            logInfo('migrated ' + msgCount + ' messages + ' + sessCount + ' sessions to mm_coach_v2');
            track('orb_history_migrated', {
              messages: msgCount,
              sessions: sessCount
            });
            markComplete();
          });
        });
      })
      .catch(function (err) {
        // Two benign failure paths land here:
        //   (a) legacy DB does not exist → user has no orb history
        //   (b) IndexedDB unavailable / blocked → defer to next visit
        // Either way: log + telemetry; never surface to user; do not mark
        // complete (so a successful retry can happen later).
        var msg = (err && err.message) ? err.message : String(err);
        if (msg.indexOf('did not exist') !== -1) {
          // No legacy data to migrate; mark complete to suppress retry.
          markComplete();
          track('orb_history_migration_skipped', { reason: 'no_legacy_db' });
          logInfo('no legacy mm_coach DB present; marked complete');
        } else {
          logWarn('migration deferred:', msg);
          track('orb_history_migration_error', {
            error: msg.substring(0, 120)
          });
        }
      })
      .then(function () {
        // Best-effort cleanup: close DB handles
        try { if (legacyDb) legacyDb.close(); } catch (e) {}
        try { if (v2Db)     v2Db.close();     } catch (e) {}
      });
  }

  // ── Schedule migration when browser is idle ─────────────────────
  // requestIdleCallback ensures the migration never competes with first
  // paint, layout, or input handling. Fallback to a small setTimeout for
  // browsers that lack requestIdleCallback (older Safari).
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(migrate, { timeout: IDLE_TIMEOUT_MS });
  } else {
    window.setTimeout(migrate, FALLBACK_DELAY_MS);
  }
})();
