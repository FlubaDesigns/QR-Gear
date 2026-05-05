'use strict';

const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'qrgear-c1ffd.firebasestorage.app' });
const db = admin.firestore();

const KEEP_TYPES = new Set(['background', 'cropped']);

async function main() {
  const snap = await db.collection('library_assets').get();

  const toDelete = snap.docs.filter(doc => {
    const t = doc.data().assetType;
    return !KEEP_TYPES.has(t);
  });

  const toKeep = snap.docs.filter(doc => {
    const t = doc.data().assetType;
    return KEEP_TYPES.has(t);
  });

  console.log(`\nTotal library_assets: ${snap.size}`);
  console.log(`Keeping (background/cropped): ${toKeep.length}`);
  console.log(`Deleting: ${toDelete.length}`);

  console.log('\nDELETING:');
  toDelete.forEach(doc => {
    const d = doc.data();
    console.log(`  [${doc.id}] type=${d.assetType ?? '—'} name=${d.name ?? '—'}`);
  });

  console.log('\nKEEPING:');
  toKeep.forEach(doc => {
    const d = doc.data();
    console.log(`  [${doc.id}] type=${d.assetType} name=${d.name ?? '—'}`);
  });

  console.log('\nDeleting...');
  let deleted = 0;
  let failed = 0;

  // Batch deletes in groups of 500
  const BATCH_SIZE = 400;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    chunk.forEach(doc => batch.delete(doc.ref));
    try {
      await batch.commit();
      deleted += chunk.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: deleted ${chunk.length} docs`);
    } catch (err) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${err.message}`);
      failed += chunk.length;
    }
  }

  console.log(`\nDone. Deleted: ${deleted}  Failed: ${failed}`);
  console.log(`Remaining library_assets: ${toKeep.length}\n`);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
