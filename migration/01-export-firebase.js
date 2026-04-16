/**
 * Step 1: Export all data from Firebase Realtime Database
 *
 * Prerequisites:
 *   1. Download Firebase service account key:
 *      Firebase Console → matchmakers-live → Project Settings →
 *      Service Accounts → Generate New Private Key
 *   2. Save as ./firebase-service-account.json
 *   3. Run: npm install
 *   4. Run: npm run export
 *
 * Output: ./exports/ directory with JSON files for each node
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

config();

// ─── Init Firebase Admin ────────────────────────────────────
const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = getDatabase();

// ─── Export directory ───────────────────────────────────────
const EXPORT_DIR = './exports';
mkdirSync(EXPORT_DIR, { recursive: true });

// ─── Nodes to export ────────────────────────────────────────
const NODES = [
  'Users',
  'Message',
  'Admin',
  'ReportedUsers',
  'UsersEmail',
  'UsersGroups',
  'InApp',
];

async function exportNode(nodeName) {
  console.log(`Exporting /${nodeName}...`);
  const start = Date.now();

  try {
    const snapshot = await db.ref(nodeName).once('value');
    const data = snapshot.val();

    if (!data) {
      console.log(`  /${nodeName} is empty, skipping.`);
      return { node: nodeName, count: 0 };
    }

    const count = typeof data === 'object' ? Object.keys(data).length : 1;
    const filePath = `${EXPORT_DIR}/${nodeName}.json`;
    writeFileSync(filePath, JSON.stringify(data, null, 2));

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  /${nodeName}: ${count} records → ${filePath} (${elapsed}s)`);
    return { node: nodeName, count };
  } catch (err) {
    console.error(`  ERROR exporting /${nodeName}:`, err.message);
    return { node: nodeName, count: 0, error: err.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('Firebase Data Export — matchmakers-live');
  console.log('═══════════════════════════════════════════\n');

  const results = [];
  for (const node of NODES) {
    const result = await exportNode(node);
    results.push(result);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('Export Summary:');
  console.log('═══════════════════════════════════════════');
  for (const r of results) {
    const status = r.error ? `ERROR: ${r.error}` : `${r.count} records`;
    console.log(`  ${r.node}: ${status}`);
  }

  // Write manifest
  writeFileSync(
    `${EXPORT_DIR}/manifest.json`,
    JSON.stringify({
      exportDate: new Date().toISOString(),
      source: process.env.FIREBASE_DATABASE_URL,
      nodes: results,
    }, null, 2)
  );

  console.log(`\nManifest saved to ${EXPORT_DIR}/manifest.json`);
  console.log('Export complete. Run "npm run import" next.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
