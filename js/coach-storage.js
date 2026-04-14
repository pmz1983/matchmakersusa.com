/* ═══════════════════════════════════════════════════
   MATCHMAKERS — coach-storage.js
   IndexedDB persistence for Dating Coach conversations
   Stores messages, session summaries, and rate-limit counters
   ═══════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DB_NAME = 'mm_coach';
  var DB_VERSION = 1;
  var STORE_MESSAGES = 'messages';
  var STORE_SESSIONS = 'sessions';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  var _db = null;

  // ── Open Database ──
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }
      if (!window.indexedDB) { reject(new Error('IndexedDB not supported')); return; }

      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;

        // Messages store: keyed by auto-increment, indexed by sessionId
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          var msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id', autoIncrement: true });
          msgStore.createIndex('sessionId', 'sessionId', { unique: false });
          msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Sessions store: keyed by sessionId
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          db.createObjectStore(STORE_SESSIONS, { keyPath: 'sessionId' });
        }
      };

      req.onsuccess = function (e) {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  // ── Save a single message ──
  function saveMessage(sessionId, role, content) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_MESSAGES, 'readwrite');
        var store = tx.objectStore(STORE_MESSAGES);
        store.add({
          sessionId: sessionId,
          role: role,
          content: content,
          timestamp: Date.now()
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] saveMessage error:', err);
    });
  }

  // ── Load all messages for a session ──
  function loadMessages(sessionId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_MESSAGES, 'readonly');
        var store = tx.objectStore(STORE_MESSAGES);
        var idx = store.index('sessionId');
        var req = idx.getAll(sessionId);
        req.onsuccess = function () {
          var msgs = (req.result || []).sort(function (a, b) {
            return a.timestamp - b.timestamp;
          });
          resolve(msgs);
        };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] loadMessages error:', err);
      return [];
    });
  }

  // ── Clear all messages for a session ──
  function clearSession(sessionId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE_MESSAGES, STORE_SESSIONS], 'readwrite');
        var msgStore = tx.objectStore(STORE_MESSAGES);
        var sessStore = tx.objectStore(STORE_SESSIONS);

        // Delete session metadata
        sessStore.delete(sessionId);

        // Delete all messages for this session via cursor
        var idx = msgStore.index('sessionId');
        var cursorReq = idx.openCursor(IDBKeyRange.only(sessionId));
        cursorReq.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] clearSession error:', err);
    });
  }

  // ── Save session metadata (summary, last context, etc.) ──
  function saveSessionMeta(sessionId, meta) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_SESSIONS, 'readwrite');
        var store = tx.objectStore(STORE_SESSIONS);
        var record = Object.assign({}, meta, {
          sessionId: sessionId,
          updatedAt: Date.now()
        });
        store.put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] saveSessionMeta error:', err);
    });
  }

  // ── Load session metadata ──
  function loadSessionMeta(sessionId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_SESSIONS, 'readonly');
        var store = tx.objectStore(STORE_SESSIONS);
        var req = store.get(sessionId);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] loadSessionMeta error:', err);
      return null;
    });
  }

  // ── Purge expired data (older than 30 days) ──
  function purgeExpired() {
    var cutoff = Date.now() - TTL_MS;
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE_MESSAGES, STORE_SESSIONS], 'readwrite');

        // Purge old messages
        var msgStore = tx.objectStore(STORE_MESSAGES);
        var idx = msgStore.index('timestamp');
        var range = IDBKeyRange.upperBound(cutoff);
        var cursorReq = idx.openCursor(range);
        cursorReq.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        // Purge old sessions
        var sessStore = tx.objectStore(STORE_SESSIONS);
        var sessCursor = sessStore.openCursor();
        sessCursor.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            if (cursor.value.updatedAt && cursor.value.updatedAt < cutoff) {
              cursor.delete();
            }
            cursor.continue();
          }
        };

        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] purgeExpired error:', err);
    });
  }

  // ── Clear ALL coach data (full reset) ──
  function clearAllData() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction([STORE_MESSAGES, STORE_SESSIONS], 'readwrite');
        tx.objectStore(STORE_MESSAGES).clear();
        tx.objectStore(STORE_SESSIONS).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (err) {
      console.warn('[coach-storage] clearAllData error:', err);
    });
  }

  // ── Get message count for a session (for rate limiting) ──
  function getMessageCount(sessionId) {
    return loadMessages(sessionId).then(function (msgs) {
      // Count user messages from today
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayStart = today.getTime();
      return msgs.filter(function (m) {
        return m.role === 'user' && m.timestamp >= todayStart;
      }).length;
    });
  }

  // ── Expose API ──
  window.CoachStorage = {
    saveMessage: saveMessage,
    loadMessages: loadMessages,
    clearSession: clearSession,
    saveSessionMeta: saveSessionMeta,
    loadSessionMeta: loadSessionMeta,
    purgeExpired: purgeExpired,
    clearAllData: clearAllData,
    getMessageCount: getMessageCount
  };

  // Run purge on load (non-blocking)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(purgeExpired, 2000);
    });
  } else {
    setTimeout(purgeExpired, 2000);
  }
})();
