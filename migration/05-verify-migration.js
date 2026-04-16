/**
 * Step 5: Verify migration integrity
 *
 * Compares Firebase export counts with Supabase row counts.
 * Run after all migration steps complete.
 * Run with: npm run verify
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

async function getCount(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) return `ERROR: ${error.message}`;
  return count;
}

function getFirebaseCount(data) {
  if (!data) return 0;
  return typeof data === 'object' ? Object.keys(data).length : 0;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Migration Verification');
  console.log('═══════════════════════════════════════════════════\n');

  // Load Firebase exports for comparison
  const users = existsSync(`${EXPORT_DIR}/Users.json`)
    ? JSON.parse(readFileSync(`${EXPORT_DIR}/Users.json`, 'utf8')) : null;
  const messages = existsSync(`${EXPORT_DIR}/Message.json`)
    ? JSON.parse(readFileSync(`${EXPORT_DIR}/Message.json`, 'utf8')) : null;

  const firebaseUserCount = getFirebaseCount(users);
  const firebaseConvCount = getFirebaseCount(messages);

  // Count messages across all conversations
  let firebaseMsgCount = 0;
  if (messages) {
    for (const conv of Object.values(messages)) {
      if (conv?.messages) {
        firebaseMsgCount += Object.keys(conv.messages).length;
      }
    }
  }

  // Count connections + friends
  let firebaseConnectionCount = 0;
  let firebaseBlockCount = 0;
  if (users) {
    for (const user of Object.values(users)) {
      if (user?.Request) firebaseConnectionCount += Object.keys(user.Request).length;
      if (user?.Friends) firebaseConnectionCount += Object.keys(user.Friends).length;
      if (user?.Block) firebaseBlockCount += Object.keys(user.Block).length;
    }
  }

  // Get Supabase counts
  const tables = [
    'app_users', 'profiles', 'preferences', 'profile_images',
    'user_levels', 'ratings', 'connections', 'blocks',
    'conversations', 'messages', 'ranked_photos', 'profile_views',
    'reports', 'user_groups', 'spotlight_subscriptions', 'admin_settings'
  ];

  const counts = {};
  for (const table of tables) {
    counts[table] = await getCount(table);
  }

  // Check auth users
  let authUserCount = 0;
  try {
    // Count app_users that have auth_id linked
    const { count } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true })
      .not('auth_id', 'is', null);
    authUserCount = count || 0;
  } catch (e) {
    authUserCount = 'ERROR';
  }

  // Report
  console.log('Table                  | Supabase | Firebase (approx)');
  console.log('───────────────────────┼──────────┼──────────────────');
  console.log(`app_users              | ${String(counts.app_users).padStart(8)} | ${String(firebaseUserCount).padStart(8)}`);
  console.log(`  with auth linked     | ${String(authUserCount).padStart(8)} |`);
  console.log(`profiles               | ${String(counts.profiles).padStart(8)} |`);
  console.log(`preferences            | ${String(counts.preferences).padStart(8)} |`);
  console.log(`profile_images         | ${String(counts.profile_images).padStart(8)} |`);
  console.log(`user_levels            | ${String(counts.user_levels).padStart(8)} |`);
  console.log(`ratings                | ${String(counts.ratings).padStart(8)} |`);
  console.log(`connections            | ${String(counts.connections).padStart(8)} | ${String(firebaseConnectionCount).padStart(8)} (req+friends, both sides)`);
  console.log(`blocks                 | ${String(counts.blocks).padStart(8)} | ${String(firebaseBlockCount).padStart(8)}`);
  console.log(`conversations          | ${String(counts.conversations).padStart(8)} | ${String(firebaseConvCount).padStart(8)}`);
  console.log(`messages               | ${String(counts.messages).padStart(8)} | ${String(firebaseMsgCount).padStart(8)}`);
  console.log(`ranked_photos          | ${String(counts.ranked_photos).padStart(8)} |`);
  console.log(`profile_views          | ${String(counts.profile_views).padStart(8)} |`);
  console.log(`reports                | ${String(counts.reports).padStart(8)} |`);
  console.log(`user_groups            | ${String(counts.user_groups).padStart(8)} |`);
  console.log(`admin_settings         | ${String(counts.admin_settings).padStart(8)} |`);

  // Warnings
  console.log('\n── Checks ──');

  if (counts.app_users < firebaseUserCount * 0.8) {
    console.log(`WARNING: app_users count (${counts.app_users}) is <80% of Firebase (${firebaseUserCount}). Check for missing emails.`);
  } else {
    console.log(`OK: app_users count looks reasonable.`);
  }

  if (authUserCount < counts.app_users * 0.7) {
    console.log(`WARNING: Only ${authUserCount}/${counts.app_users} users have Supabase Auth linked. Check auth migration.`);
  } else {
    console.log(`OK: Auth linking looks reasonable.`);
  }

  if (counts.conversations < firebaseConvCount * 0.8) {
    console.log(`WARNING: conversation count (${counts.conversations}) seems low vs Firebase (${firebaseConvCount}).`);
  } else {
    console.log(`OK: Conversation count looks reasonable.`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('Verification complete.');
  console.log('═══════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
