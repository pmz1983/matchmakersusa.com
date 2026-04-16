/**
 * Step 2: Import exported Firebase data into Supabase
 *
 * Reads JSON files from ./exports/ and inserts into Supabase tables.
 * Run after: npm run export
 * Run with: npm run import
 *
 * IMPORTANT: Run the SQL migration (002_ios_app_schema.sql) first!
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXPORT_DIR = './exports';
const BATCH_SIZE = 500;

// ─── Helpers ────────────────────────────────────────────────

function loadExport(name) {
  const path = `${EXPORT_DIR}/${name}.json`;
  if (!existsSync(path)) {
    console.log(`  ${path} not found, skipping.`);
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function batchInsert(table, rows, label) {
  if (!rows.length) {
    console.log(`  ${label}: 0 rows, skipping.`);
    return 0;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: 'firebase_uid', ignoreDuplicates: true });
    if (error) {
      console.error(`  ERROR inserting ${label} batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      // Try one-by-one for this batch to find the problematic row
      for (const row of batch) {
        const { error: rowErr } = await supabase.from(table).upsert(row, { ignoreDuplicates: true });
        if (rowErr) {
          console.error(`    Skipped row:`, rowErr.message, JSON.stringify(row).slice(0, 100));
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ${label}: ${inserted}/${rows.length} rows inserted.`);
  return inserted;
}

async function batchInsertGeneric(table, rows, label, conflictKey) {
  if (!rows.length) {
    console.log(`  ${label}: 0 rows, skipping.`);
    return 0;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const opts = conflictKey
      ? { onConflict: conflictKey, ignoreDuplicates: true }
      : { ignoreDuplicates: true };
    const { error } = await supabase.from(table).upsert(batch, opts);
    if (error) {
      // Insert one by one on error
      for (const row of batch) {
        const { error: rowErr } = await supabase.from(table).insert(row);
        if (!rowErr) inserted++;
      }
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  ${label}: ${inserted}/${rows.length} rows.`);
  return inserted;
}

// ─── Firebase email key cleanup ─────────────────────────────
// Firebase replaces . with , in email keys
function cleanFirebaseEmail(emailKey) {
  return emailKey ? emailKey.replace(/,/g, '.') : null;
}

// ─── Import Users ───────────────────────────────────────────

async function importUsers(usersData) {
  console.log('\n── Importing Users ──');
  const firebaseIds = Object.keys(usersData);
  console.log(`  Found ${firebaseIds.length} users in Firebase export.`);

  const userRows = [];
  const profileRows = [];
  const preferenceRows = [];
  const userLevelRows = [];
  const imageRows = [];

  // We need to map firebase_uid → supabase UUID
  const uidMap = {};

  for (const fbId of firebaseIds) {
    const user = usersData[fbId];
    if (!user) continue;

    const signup = user.SignUp || {};
    const profile = user.ProfileData || {};
    const prefs = user.PreferenceData || {};

    // Generate a deterministic UUID or let Supabase auto-generate
    const supabaseId = crypto.randomUUID();
    uidMap[fbId] = supabaseId;

    // ── app_users row
    userRows.push({
      id: supabaseId,
      firebase_uid: fbId,
      email: (signup.email || signup.emailAddress || '').toLowerCase().trim(),
      first_name: signup.firstName || null,
      last_name: signup.lastName || null,
      membership_type: signup.membershipType != null ? parseInt(signup.membershipType) : 1,
      user_type: user.userType != null ? parseInt(user.userType) : 0,
      is_admin: user.isAdmin === true || parseInt(user.userType) === 1,
      app_version: user.appVersion || null,
      fcm_token: user.FCMToken || null,
      account_creation_date: user.accountCreationDate || null,
      last_active_date: user.lastAccountActiveDate || null,
      is_interest_in_coaching: user.isInterestInCoaching === true || user.isInterestInCoaching === 'true',
      match_request_count: parseInt(user.matchRequestCount) || 0,
      match_request_date: user.matchRequestDate || null,
      objectional: user.objectional === true || user.objectional === 'true',
    });

    // ── profiles row
    profileRows.push({
      user_id: supabaseId,
      gender: profile.gender || null,
      interested_in: profile.interestedIn || null,
      birth_date: profile.birthDate || null,
      zip_code: profile.zipCode || null,
      latitude: profile.Latitude ? parseFloat(profile.Latitude) : null,
      longitude: profile.Longitude ? parseFloat(profile.Longitude) : null,
      city: profile.city || null,
      state: profile.state || null,
      about_me: profile.aboutMe || null,
      height: profile.height || null,
      body_type: profile.bodyType || null,
      income: profile.income || null,
      political: profile.political || null,
      religion: profile.religion || null,
      race: profile.race || null,
      have_kids: profile.haveKids || null,
      smoke: profile.smoke || null,
      drink: profile.drink || null,
      education: profile.education || null,
      occupation: profile.occupation || null,
      profile_pic_url: profile.profilePic || null,
    });

    // ── preferences row
    preferenceRows.push({
      user_id: supabaseId,
      self_rating: parseInt(prefs.selfRating) || 6,
      preferred_body_type: prefs.bodyType || null,
      preferred_income: prefs.income || null,
      preferred_political: prefs.political || null,
      preferred_religion: prefs.religion || null,
      preferred_race: prefs.race || null,
      preferred_have_kids: prefs.haveKids || null,
      preferred_smoke: prefs.smoke || null,
      preferred_drink: prefs.drink || null,
      preferred_height_min: prefs.heightMin || null,
      preferred_height_max: prefs.heightMax || null,
      preferred_age_min: prefs.ageMin ? parseInt(prefs.ageMin) : null,
      preferred_age_max: prefs.ageMax ? parseInt(prefs.ageMax) : null,
      search_radius: prefs.searchRadius ? parseInt(prefs.searchRadius) : 100000000,
    });

    // ── user_levels row
    userLevelRows.push({
      user_id: supabaseId,
      current_level: parseInt(user.newUserLevel) || 6,
      level_progress: parseFloat(user.MyLevelProgress) || 0,
      normalized_level: parseInt(user.newUserLevel) || 6,
    });

    // ── profile_images
    const images = user.ProfileImages || {};
    const filterKey = profile.gender && profile.interestedIn
      ? `${profile.gender}_${profile.interestedIn}` : null;

    if (filterKey && images[filterKey]) {
      const imgData = images[filterKey];
      if (typeof imgData === 'object') {
        let sortOrder = 0;
        for (const [imgKey, imgUrl] of Object.entries(imgData)) {
          if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
            imageRows.push({
              user_id: supabaseId,
              image_url: imgUrl,
              sort_order: sortOrder,
              is_primary: sortOrder === 0,
            });
            sortOrder++;
          }
        }
      }
    }
  }

  // Filter out users without email
  const validUserRows = userRows.filter(u => u.email && u.email.length > 3);
  console.log(`  ${userRows.length - validUserRows.length} users skipped (no email).`);

  // Insert in order (users first, then dependent tables)
  await batchInsert('app_users', validUserRows, 'app_users');

  // Now insert profiles, prefs, levels — filter to only users that were inserted
  const validIds = new Set(validUserRows.map(u => u.id));

  await batchInsertGeneric(
    'profiles',
    profileRows.filter(p => validIds.has(p.user_id)),
    'profiles',
    'user_id'
  );

  await batchInsertGeneric(
    'preferences',
    preferenceRows.filter(p => validIds.has(p.user_id)),
    'preferences',
    'user_id'
  );

  await batchInsertGeneric(
    'user_levels',
    userLevelRows.filter(p => validIds.has(p.user_id)),
    'user_levels',
    'user_id'
  );

  await batchInsertGeneric(
    'profile_images',
    imageRows.filter(p => validIds.has(p.user_id)),
    'profile_images'
  );

  return uidMap;
}

// ─── Import Connections (Requests + Friends) ────────────────

async function importConnections(usersData, uidMap) {
  console.log('\n── Importing Connections ──');
  const rows = [];

  for (const [fbId, user] of Object.entries(usersData)) {
    if (!user || !uidMap[fbId]) continue;
    const requesterId = uidMap[fbId];

    // Requests
    const requests = user.Request || {};
    for (const [targetFbId, statusVal] of Object.entries(requests)) {
      if (!uidMap[targetFbId]) continue;
      const status = parseInt(statusVal);
      // Only import Send (0) requests from the requester side
      if (status === 0) {
        rows.push({
          requester_id: requesterId,
          requested_id: uidMap[targetFbId],
          status: 0,
          is_read: false,
        });
      }
    }

    // Friends (status = 1, accepted)
    const friends = user.Friends || {};
    for (const [friendFbId, statusVal] of Object.entries(friends)) {
      if (!uidMap[friendFbId]) continue;
      // Only create from one side to avoid duplicates
      if (fbId < friendFbId) {
        rows.push({
          requester_id: requesterId,
          requested_id: uidMap[friendFbId],
          status: 1,
          is_read: true,
        });
      }
    }
  }

  await batchInsertGeneric('connections', rows, 'connections');
}

// ─── Import Blocks ──────────────────────────────────────────

async function importBlocks(usersData, uidMap) {
  console.log('\n── Importing Blocks ──');
  const rows = [];

  for (const [fbId, user] of Object.entries(usersData)) {
    if (!user || !uidMap[fbId]) continue;
    const blocks = user.Block || {};
    for (const blockedFbId of Object.keys(blocks)) {
      if (!uidMap[blockedFbId]) continue;
      rows.push({
        blocker_id: uidMap[fbId],
        blocked_id: uidMap[blockedFbId],
      });
    }
  }

  await batchInsertGeneric('blocks', rows, 'blocks');
}

// ─── Import Ratings ─────────────────────────────────────────

async function importRatings(usersData, uidMap) {
  console.log('\n── Importing Ratings ──');
  const rows = [];

  for (const [fbId, user] of Object.entries(usersData)) {
    if (!user || !uidMap[fbId]) continue;

    // UserRatingByDate has composite keys: "timestamp~raterUserId"
    const ratingsByDate = user.UserRatingByDate || {};
    for (const [compositeKey, ratingData] of Object.entries(ratingsByDate)) {
      const parts = compositeKey.split('~');
      if (parts.length < 2) continue;

      const raterFbId = parts[1];
      if (!uidMap[raterFbId]) continue;

      const ratingValue = typeof ratingData === 'object'
        ? parseInt(ratingData.rating || ratingData.value || 0)
        : parseInt(ratingData);

      if (ratingValue > 0) {
        rows.push({
          rated_user_id: uidMap[fbId],
          rater_user_id: uidMap[raterFbId],
          rating_value: ratingValue,
          multiplier: typeof ratingData === 'object' ? parseInt(ratingData.multiplier || 1) : 1,
          created_at: parts[0] || new Date().toISOString(),
        });
      }
    }

    // Fallback: simple UserRating if no UserRatingByDate
    if (Object.keys(ratingsByDate).length === 0) {
      const simpleRatings = user.UserRating || {};
      for (const [raterFbId, value] of Object.entries(simpleRatings)) {
        if (!uidMap[raterFbId]) continue;
        rows.push({
          rated_user_id: uidMap[fbId],
          rater_user_id: uidMap[raterFbId],
          rating_value: parseInt(value) || 0,
          multiplier: 1,
        });
      }
    }
  }

  // Deduplicate by rated+rater pair (keep latest)
  const seen = new Map();
  for (const row of rows) {
    const key = `${row.rated_user_id}__${row.rater_user_id}`;
    seen.set(key, row);
  }

  await batchInsertGeneric('ratings', [...seen.values()], 'ratings');
}

// ─── Import Messages ────────────────────────────────────────

async function importMessages(messageData, uidMap) {
  console.log('\n── Importing Messages ──');
  if (!messageData) {
    console.log('  No message data found.');
    return;
  }

  const convRows = [];
  const msgRows = [];
  const convIdMap = {};

  for (const [fbConvId, conv] of Object.entries(messageData)) {
    if (!conv) continue;

    const p1FbId = conv.p1;
    const p2FbId = conv.p2;
    if (!p1FbId || !p2FbId || !uidMap[p1FbId] || !uidMap[p2FbId]) continue;

    const supaConvId = crypto.randomUUID();
    convIdMap[fbConvId] = supaConvId;

    convRows.push({
      id: supaConvId,
      participant_1: uidMap[p1FbId],
      participant_2: uidMap[p2FbId],
      subject: conv.subject || null,
      p1_last_read: conv.p1_LastRead || null,
      p2_last_read: conv.p2_LastRead || null,
      last_message_time: conv.last_conv_time || null,
    });

    // Messages within conversation
    const messages = conv.messages || {};
    for (const [msgId, msg] of Object.entries(messages)) {
      if (!msg) continue;

      const senderFbId = msg.senderId || msg.sender_id || msg.from;
      if (!senderFbId || !uidMap[senderFbId]) continue;

      msgRows.push({
        conversation_id: supaConvId,
        sender_id: uidMap[senderFbId],
        body: msg.message || msg.body || msg.text || '',
        created_at: msg.timestamp || msg.created_at || null,
      });
    }
  }

  await batchInsertGeneric('conversations', convRows, 'conversations');
  await batchInsertGeneric('messages', msgRows, 'messages');
}

// ─── Import Reported Users ──────────────────────────────────

async function importReports(reportedData, uidMap) {
  console.log('\n── Importing Reports ──');
  if (!reportedData) return;

  const rows = [];
  const reported = reportedData.ReportedUsersData || {};
  const resolved = reportedData.ResolvedUsersData || {};

  for (const [key, report] of Object.entries(reported)) {
    if (!report) continue;
    const reporterFbId = report.reportedByUserId || report.reporterId;
    const reportedFbId = report.userId || report.reportedUserId;
    if (!reporterFbId || !reportedFbId) continue;
    if (!uidMap[reporterFbId] || !uidMap[reportedFbId]) continue;

    rows.push({
      reporter_id: uidMap[reporterFbId],
      reported_user_id: uidMap[reportedFbId],
      reason: report.reason || null,
      details: report,
      is_resolved: false,
      created_at: report.date || null,
    });
  }

  for (const [key, report] of Object.entries(resolved)) {
    if (!report) continue;
    const reporterFbId = report.reportedByUserId || report.reporterId;
    const reportedFbId = report.userId || report.reportedUserId;
    if (!reporterFbId || !reportedFbId) continue;
    if (!uidMap[reporterFbId] || !uidMap[reportedFbId]) continue;

    rows.push({
      reporter_id: uidMap[reporterFbId],
      reported_user_id: uidMap[reportedFbId],
      reason: report.reason || null,
      details: report,
      is_resolved: true,
      resolved_at: report.resolvedDate || null,
      created_at: report.date || null,
    });
  }

  await batchInsertGeneric('reports', rows, 'reports');
}

// ─── Import User Groups ─────────────────────────────────────

async function importUserGroups(groupsData, uidMap) {
  console.log('\n── Importing User Groups ──');
  if (!groupsData) return;

  const rows = [];
  const genderMap = { MaleUsers: 'Male', FemaleUsers: 'Female' };

  for (const [genderKey, groups] of Object.entries(groupsData)) {
    if (!groups || typeof groups !== 'object') continue;
    const gender = genderMap[genderKey] || genderKey;

    for (const [groupName, users] of Object.entries(groups)) {
      if (!users || typeof users !== 'object') continue;
      for (const fbId of Object.keys(users)) {
        if (!uidMap[fbId]) continue;
        rows.push({
          user_id: uidMap[fbId],
          gender,
          group_name: groupName,
        });
      }
    }
  }

  await batchInsertGeneric('user_groups', rows, 'user_groups');
}

// ─── Import Profile Views & Photo Rankings ──────────────────

async function importProfileViewsAndRankings(usersData, uidMap) {
  console.log('\n── Importing Profile Views ──');
  const viewRows = [];

  for (const [fbId, user] of Object.entries(usersData)) {
    if (!user || !uidMap[fbId]) continue;

    const reviewedBy = user.ReviewedMyProfileByUser || {};
    for (const [key, data] of Object.entries(reviewedBy)) {
      const viewerFbId = typeof data === 'object' ? (data.userId || data.id) : data;
      if (viewerFbId && uidMap[viewerFbId]) {
        viewRows.push({
          viewer_id: uidMap[viewerFbId],
          viewed_id: uidMap[fbId],
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const uniqueViews = viewRows.filter(r => {
    const key = `${r.viewer_id}__${r.viewed_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await batchInsertGeneric('profile_views', uniqueViews, 'profile_views');

  // ── Ranked Photos
  console.log('\n── Importing Ranked Photos ──');
  const photoRows = [];

  for (const [fbId, user] of Object.entries(usersData)) {
    if (!user || !uidMap[fbId]) continue;
    const ranked = user.RankedPhotos || {};
    for (const [photoKey, photoData] of Object.entries(ranked)) {
      if (!photoData || typeof photoData !== 'object') continue;
      photoRows.push({
        user_id: uidMap[fbId],
        image_url: photoData.imageUrl || photoData.image_url || '',
        rank_count: parseInt(photoData.count || photoData.rank_count || 0),
      });
    }
  }

  await batchInsertGeneric('ranked_photos', photoRows.filter(r => r.image_url), 'ranked_photos');
}

// ─── Save UID mapping for auth migration ────────────────────

function saveUidMap(uidMap) {
  const path = `${EXPORT_DIR}/uid-map.json`;
  writeFileSync(path, JSON.stringify(uidMap, null, 2));
  console.log(`\nUID mapping saved to ${path} (${Object.keys(uidMap).length} entries).`);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('Supabase Data Import — matchmakers-production');
  console.log('═══════════════════════════════════════════════\n');

  // Load exports
  const usersData = loadExport('Users');
  const messageData = loadExport('Message');
  const reportedData = loadExport('ReportedUsers');
  const groupsData = loadExport('UsersGroups');

  if (!usersData) {
    console.error('No Users.json found. Run "npm run export" first.');
    process.exit(1);
  }

  // Import in dependency order
  const uidMap = await importUsers(usersData);
  await importConnections(usersData, uidMap);
  await importBlocks(usersData, uidMap);
  await importRatings(usersData, uidMap);
  await importMessages(messageData, uidMap);
  await importReports(reportedData, uidMap);
  await importUserGroups(groupsData, uidMap);
  await importProfileViewsAndRankings(usersData, uidMap);

  // Save mapping for auth migration
  saveUidMap(uidMap);

  console.log('\n═══════════════════════════════════════════════');
  console.log('Import complete. Run "npm run migrate-auth" next.');
  console.log('═══════════════════════════════════════════════\n');
  process.exit(0);
}

import { webcrypto as crypto_ns } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = crypto_ns;

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
