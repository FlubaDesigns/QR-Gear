'use strict';

const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'qrgear-c1ffd.firebasestorage.app' });
const storage = admin.storage();

const DELETE_PREFIXES = [
  'content/',
  'member-graphics/',
  'members/',
  'library/member/',
];

async function main() {
  const bucket = storage.bucket();
  const [allFiles] = await bucket.getFiles({ maxResults: 1000 });

  const toDelete = allFiles.filter(f =>
    DELETE_PREFIXES.some(prefix => f.name.startsWith(prefix))
  );

  console.log(`\nFiles to delete: ${toDelete.length}`);
  toDelete.forEach(f => console.log(`  DELETE: ${f.name}`));

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  console.log('\nDeleting...');
  let deleted = 0;
  let failed = 0;
  for (const file of toDelete) {
    try {
      await file.delete();
      console.log(`  ✓ ${file.name}`);
      deleted++;
    } catch (err) {
      console.error(`  ✗ ${file.name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Deleted: ${deleted}  Failed: ${failed}\n`);
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
