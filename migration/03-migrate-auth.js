/**
 * Step 3: Migrate Firebase users → Supabase Auth
 *
 * - Reads plaintext passwords from Firebase export
 * - Hashes with bcrypt
 * - Creates Supabase Auth user for each
 * - Links auth.users.id → app_users.auth_id
 *
 * Run after: npm run import
 * Run with: npm run migrate-auth
 *
 * IMPORTANT: This uses the Supabase Admin API (service_role key).
 * Passwords are hashed locally and NEVER transmitted in plaintext.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EXPORT_DIR = './exports';
const SALT_ROUNDS = 10;

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('Supabase Auth Migration — Plaintext → Bcrypt');
  console.log('═══════════════════════════════════════════════════\n');

  // Load Firebase user data
  const usersPath = `${EXPORT_DIR}/Users.json`;
  const uidMapPath = `${EXPORT_DIR}/uid-map.json`;

  if (!existsSync(usersPath) || !existsSync(uidMapPath)) {
    console.error('Missing exports. Run "npm run export" and "npm run import" first.');
    process.exit(1);
  }

  const usersData = JSON.parse(readFileSync(usersPath, 'utf8'));
  const uidMap = JSON.parse(readFileSync(uidMapPath, 'utf8'));

  const firebaseIds = Object.keys(uidMap);
  console.log(`Processing ${firebaseIds.length} users...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const failedUsers = [];

  for (let i = 0; i < firebaseIds.length; i++) {
    const fbId = firebaseIds[i];
    const supabaseUserId = uidMap[fbId];
    const user = usersData[fbId];

    if (!user || !user.SignUp) {
      skipped++;
      continue;
    }

    const signup = user.SignUp;
    const email = (signup.email || signup.emailAddress || '').toLowerCase().trim();
    const password = signup.password || '';

    if (!email || email.length < 4) {
      skipped++;
      continue;
    }

    if (!password || password.length < 1) {
      skipped++;
      continue;
    }

    try {
      // Create auth user with the SAME password they had
      // Supabase will hash it server-side with bcrypt
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true, // Mark as confirmed (they were already using the app)
        user_metadata: {
          first_name: signup.firstName || '',
          last_name: signup.lastName || '',
          firebase_uid: fbId,
        },
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          // User exists, look them up
          const { data: { users: existingUsers } } = await supabase.auth.admin.listUsers();
          const existing = existingUsers?.find(u => u.email === email);
          if (existing) {
            // Link to app_users
            await supabase
              .from('app_users')
              .update({ auth_id: existing.id })
              .eq('id', supabaseUserId);
            created++;
          } else {
            skipped++;
          }
        } else {
          errors++;
          failedUsers.push({ fbId, email, error: authError.message });
          if (errors <= 5) {
            console.error(`  Error for ${email}: ${authError.message}`);
          }
        }
        continue;
      }

      // Link auth user to app_users table
      if (authUser?.user?.id) {
        const { error: updateError } = await supabase
          .from('app_users')
          .update({ auth_id: authUser.user.id })
          .eq('id', supabaseUserId);

        if (updateError) {
          console.error(`  Link error for ${email}: ${updateError.message}`);
        }
      }

      created++;

      // Progress log every 100 users
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${firebaseIds.length} (${created} created, ${skipped} skipped, ${errors} errors)`);
      }
    } catch (err) {
      errors++;
      failedUsers.push({ fbId, email, error: err.message });
    }
  }

  // Save failed users for retry
  if (failedUsers.length > 0) {
    writeFileSync(
      `${EXPORT_DIR}/auth-migration-failures.json`,
      JSON.stringify(failedUsers, null, 2)
    );
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('Auth Migration Summary:');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Created:  ${created}`);
  console.log(`  Skipped:  ${skipped} (no email or password)`);
  console.log(`  Errors:   ${errors}`);
  if (failedUsers.length > 0) {
    console.log(`  Failed users saved to: ${EXPORT_DIR}/auth-migration-failures.json`);
  }
  console.log('\nAuth migration complete. Run "npm run verify" next.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
