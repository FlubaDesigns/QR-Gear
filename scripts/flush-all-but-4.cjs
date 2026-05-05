'use strict';

const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'qrgear-c1ffd.firebasestorage.app' });
const db = admin.firestore();
const storage = admin.storage();

// Storage prefixes to delete (everything except library/images/)
const DELETE_STORAGE_PREFIXES = [
  'backgrounds/',        // top-level backgrounds folder (#2)
  'custom-designs/',     // #3
  'library/backgrounds/zip/', // #5
  'library-files/',      // #6
];

async function deleteFirestore() {
  console.log('\n── Firestore: admin_build_sessions ──────────────────');
  const snap = await db.collection('admin_build_sessions').get();
  if (snap.empty) { console.log('  Already empty.'); return; }

  const batch = db.batch();
  snap.docs.forEach(doc => {
    console.log(`  DELETE [${doc.id}] status=${doc.data().status ?? '—'}`);
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`  Deleted: ${snap.size} session(s)`);
}

async function deleteStorage() {
  console.log('\n── Storage: deleting selected prefixes ──────────────');
  const bucket = storage.bucket();
  const [allFiles] = await bucket.getFiles({ maxResults: 1000 });

  const toDelete = allFiles.filter(f =>
    DELETE_STORAGE_PREFIXES.some(prefix => f.name.startsWith(prefix))
  );

  console.log(`  Files to delete: ${toDelete.length}`);
  toDelete.forEach(f => console.log(`  DELETE: ${f.name}`));

  let deleted = 0, failed = 0;
  for (const file of toDelete) {
    try {
      await file.delete();
      deleted++;
    } catch (err) {
      console.error(`  ✗ ${file.name} — ${err.message}`);
      failed++;
    }
  }
  console.log(`  Deleted: ${deleted}  Failed: ${failed}`);
}

async function main() {
  await deleteFirestore();
  await deleteStorage();
  console.log('\nDone.\n');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
