/**
 * Step 4: Fix and import conversations + messages
 *
 * The main import failed on conversations because participant IDs
 * (Firebase UIDs) weren't mapping to Supabase UUIDs.
 * This script uses the uid-map.json to properly map them.
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
const BATCH_SIZE = 100;

function parseFirebaseTimestamp(ts) {
  if (!ts) return null;
  // Handle numeric timestamps (Unix)
  if (typeof ts === 'number') {
    // If it's in milliseconds
    if (ts > 1e12) return new Date(ts).toISOString();
    // If it's in seconds
    if (ts > 1e9) return new Date(ts * 1000).toISOString();
    return null;
  }
  // Handle string timestamps
  if (typeof ts === 'string') {
    // Try ISO format first
    const isoDate = new Date(ts);
    if (!isNaN(isoDate.getTime())) return isoDate.toISOString();
    // Try Firebase format: "2024-03-23 3:52:07 AM +0000"
    try {
      const cleaned = ts
        .replace(/\s+(a\.m\.|p\.m\.)\s+/i, (m) => m.toUpperCase().replace(/\./g, ''))
        .replace(/\s+(am|pm)\s+/i, (m) => m.toUpperCase());
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {}
    return null;
  }
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('Fix Conversations + Messages Import');
  console.log('═══════════════════════════════════════════\n');

  const messageData = JSON.parse(readFileSync(`${EXPORT_DIR}/Message.json`, 'utf8'));
  const uidMap = JSON.parse(readFileSync(`${EXPORT_DIR}/uid-map.json`, 'utf8'));

  console.log(`Loaded ${Object.keys(messageData).length} conversations`);
  console.log(`UID map has ${Object.keys(uidMap).length} entries\n`);

  let convInserted = 0;
  let msgInserted = 0;
  let convSkipped = 0;

  for (const [fbConvId, conv] of Object.entries(messageData)) {
    if (!conv) continue;

    const p1FbId = conv.p1;
    const p2FbId = conv.p2;

    if (!p1FbId || !p2FbId) { convSkipped++; continue; }
    if (!uidMap[p1FbId] || !uidMap[p2FbId]) { convSkipped++; continue; }

    const p1Id = uidMap[p1FbId];
    const p2Id = uidMap[p2FbId];

    // Parse timestamps
    const lastConvTime = parseFirebaseTimestamp(conv.last_conv_time) || new Date().toISOString();
    const p1LastRead = parseFirebaseTimestamp(conv.p1_LastRead);
    const p2LastRead = parseFirebaseTimestamp(conv.p2_LastRead);

    try {
      // Insert conversation
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .insert({
          participant_1: p1Id,
          participant_2: p2Id,
          subject: conv.subject || null,
          p1_last_read: p1LastRead,
          p2_last_read: p2LastRead,
          last_message_time: lastConvTime,
        })
        .select('id')
        .single();

      if (convErr) {
        if (convErr.message?.includes('duplicate') || convErr.message?.includes('unique')) {
          // Already exists, skip
        } else {
          console.error(`Conv error: ${convErr.message}`);
        }
        convSkipped++;
        continue;
      }

      const convId = convData.id;
      convInserted++;

      // Insert messages
      const messages = conv.messages || {};
      const msgBatch = [];

      for (const [msgId, msg] of Object.entries(messages)) {
        if (!msg) continue;

        const senderFbId = msg.senderId || msg.sender_id || msg.from;
        if (!senderFbId || !uidMap[senderFbId]) continue;

        const timestamp = parseFirebaseTimestamp(msg.timestamp) || parseFirebaseTimestamp(msg.created_at) || new Date().toISOString();

        msgBatch.push({
          conversation_id: convId,
          sender_id: uidMap[senderFbId],
          body: msg.message || msg.body || msg.text || '',
          created_at: timestamp,
        });
      }

      // Insert messages in batches
      for (let i = 0; i < msgBatch.length; i += BATCH_SIZE) {
        const batch = msgBatch.slice(i, i + BATCH_SIZE);
        const { error: msgErr } = await supabase.from('messages').insert(batch);
        if (msgErr) {
          // Insert one by one
          for (const msg of batch) {
            const { error } = await supabase.from('messages').insert(msg);
            if (!error) msgInserted++;
          }
        } else {
          msgInserted += batch.length;
        }
      }

      if (convInserted % 100 === 0) {
        console.log(`  Progress: ${convInserted} conversations, ${msgInserted} messages`);
      }
    } catch (err) {
      console.error(`Error on conv ${fbConvId}: ${err.message}`);
      convSkipped++;
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('Conversations + Messages Summary:');
  console.log(`  Conversations inserted: ${convInserted}`);
  console.log(`  Conversations skipped:  ${convSkipped}`);
  console.log(`  Messages inserted:      ${msgInserted}`);
  console.log('═══════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
