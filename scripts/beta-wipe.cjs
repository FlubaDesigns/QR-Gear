/**
 * scripts/beta-wipe.js
 *
 * Beta reset — wipes all build artifacts, stores, and generated images.
 *
 * SAFE (never touched):
 *   master_catalog, catalogs, catalog_sync_history, layout_profiles
 *   printify_*, printful_*, print_placements, printify_printful_mapping
 *   pricing, repricing_rules, repricing_history, hosting_tiers
 *   users, customers, orders, order_items, qr_scans, claim_codes
 *   email_templates, email_logs, fonts, settings, system_config
 *   templates, template_categories, graphic_sets
 *   admin_images, admin_image_folders, hosted_images
 *   dynamic_pages, dynamic_page_assets, member_profiles
 *   product_categories, product_category_links
 *   referrals, referral_earnings, api_keys
 *   gifts, gift_codes, gift_packages, gift_redemptions
 *
 * WIPED:
 *   build_sessions, bld_definitions, bld_counters
 *   assemblies, asm_counters
 *   grf_assets, grf_counters
 *   admin_catalog_instances
 *   packets, product_packets, temp_packets
 *   stores, channels, store_channels, store_product_links
 *   collections, collection_items
 *   bulk_publish_jobs, publish_states
 *   mockup_cache, mockup_jobs
 *   Firebase Storage (all files)
 */

const admin = require('firebase-admin');

// ── Init ─────────────────────────────────────────────────────────────────────

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY env var not set');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountKey);
} catch {
  console.error('❌  FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'qrgear-c1ffd.firebasestorage.app',
});

const db      = admin.firestore();
const storage = admin.storage();

// ── Collections to wipe ───────────────────────────────────────────────────────

const WIPE_COLLECTIONS = [
  'build_sessions',
  'bld_definitions',
  'bld_counters',
  'assemblies',
  'asm_counters',
  'grf_assets',
  'grf_counters',
  'admin_catalog_instances',
  'packets',
  'product_packets',
  'temp_packets',
  'stores',
  'channels',
  'store_channels',
  'store_product_links',
  'collections',
  'collection_items',
  'bulk_publish_jobs',
  'publish_states',
  'mockup_cache',
  'mockup_jobs',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function deleteCollection(name) {
  const ref = db.collection(name);
  let total = 0;

  while (true) {
    const snap = await ref.limit(400).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    total += snap.size;
    process.stdout.write(`\r  ${name}: deleted ${total} docs...`);
  }

  console.log(`\r  ✓ ${name}: ${total} docs deleted${' '.repeat(10)}`);
  return total;
}

async function deleteStorageFiles() {
  const bucket = storage.bucket();
  console.log('\n🗂  Deleting Firebase Storage files...');

  try {
    const [files] = await bucket.getFiles();
    if (files.length === 0) {
      console.log('  ✓ Storage already empty');
      return 0;
    }

    let deleted = 0;
    // Delete in batches of 50
    const BATCH = 50;
    for (let i = 0; i < files.length; i += BATCH) {
      const chunk = files.slice(i, i + BATCH);
      await Promise.all(chunk.map(f => f.delete().catch(() => {})));
      deleted += chunk.length;
      process.stdout.write(`\r  Storage: deleted ${deleted}/${files.length} files...`);
    }
    console.log(`\r  ✓ Storage: ${deleted} files deleted${' '.repeat(20)}`);
    return deleted;
  } catch (err) {
    console.warn(`  ⚠  Storage wipe error: ${err.message}`);
    return 0;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('  QR Gear — Beta Reset Wipe');
  console.log('══════════════════════════════════════════');
  console.log('');
  console.log('Collections to wipe:');
  WIPE_COLLECTIONS.forEach(c => console.log(`  • ${c}`));
  console.log('  • Firebase Storage (all files)');
  console.log('');
  console.log('Starting in 3 seconds... (Ctrl+C to abort)');
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n🗑  Wiping Firestore collections...\n');

  let totalDocs = 0;
  for (const name of WIPE_COLLECTIONS) {
    const count = await deleteCollection(name);
    totalDocs += count;
  }

  const storageCount = await deleteStorageFiles();

  console.log('');
  console.log('══════════════════════════════════════════');
  console.log(`  ✅  Done — ${totalDocs} Firestore docs deleted`);
  console.log(`          ${storageCount} Storage files deleted`);
  console.log('══════════════════════════════════════════');
  console.log('');
  console.log('  Preserved: master_catalog, catalogs, printify_*,');
  console.log('  printful_*, pricing, repricing_rules, users,');
  console.log('  customers, orders, templates, fonts, and all');
  console.log('  other non-build data.');
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Wipe failed:', err.message);
  process.exit(1);
});
