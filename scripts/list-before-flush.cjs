'use strict';

const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'qrgear-c1ffd.firebasestorage.app' });
const db = admin.firestore();
const storage = admin.storage();

async function main() {
  // ── 1. productPackets ─────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  FIRESTORE: productPackets');
  console.log('══════════════════════════════════════════');
  const snap = await db.collection('productPackets').get();
  if (snap.empty) {
    console.log('  (empty)');
  } else {
    snap.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  [${doc.id}]`);
      console.log(`    productName : ${d.productName ?? d.name ?? '—'}`);
      console.log(`    status      : ${d.status ?? '—'}`);
      console.log(`    createdAt   : ${d.createdAt?.toDate?.() ?? d.createdAt ?? '—'}`);
      console.log(`    store       : ${d.storeId ?? d.store ?? '—'}`);
      console.log(`    channel     : ${d.channelId ?? d.channel ?? '—'}`);
    });
    console.log(`\n  TOTAL: ${snap.size} packet(s)`);
  }

  // ── 2. admin_build_sessions ───────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  FIRESTORE: admin_build_sessions');
  console.log('══════════════════════════════════════════');
  const sessions = await db.collection('admin_build_sessions').get();
  if (sessions.empty) {
    console.log('  (empty)');
  } else {
    sessions.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  [${doc.id}] status=${d.status ?? '—'} product=${d.productName ?? '—'}`);
    });
    console.log(`\n  TOTAL: ${sessions.size} session(s)`);
  }

  // ── 3. library_assets / productGraphics ───────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  FIRESTORE: library_assets');
  console.log('══════════════════════════════════════════');
  const assets = await db.collection('library_assets').get();
  if (assets.empty) {
    console.log('  (empty)');
  } else {
    assets.docs.forEach(doc => {
      const d = doc.data();
      console.log(`  [${doc.id}] grfId=${d.grfId ?? '—'} type=${d.assetType ?? '—'} name=${d.name ?? '—'}`);
    });
    console.log(`\n  TOTAL: ${assets.size} asset(s)`);
  }

  // ── 4. Firebase Storage top-level folders ────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  STORAGE: top-level folder listing');
  console.log('══════════════════════════════════════════');
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({ maxResults: 500 });

  // Group by top-level prefix
  const folderCounts = {};
  const allPaths = [];
  for (const f of files) {
    allPaths.push(f.name);
    const topFolder = f.name.split('/')[0];
    folderCounts[topFolder] = (folderCounts[topFolder] ?? 0) + 1;
  }

  console.log('\n  Top-level folders (file count):');
  for (const [folder, count] of Object.entries(folderCounts).sort()) {
    console.log(`    ${folder}/  (${count} file${count !== 1 ? 's' : ''})`);
  }

  // Show all paths so user can see exactly what's there
  console.log('\n  All storage paths:');
  for (const p of allPaths.sort()) {
    console.log(`    ${p}`);
  }

  console.log(`\n  TOTAL: ${files.length} file(s) in storage`);
  console.log('\nDone. Nothing was deleted.\n');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
