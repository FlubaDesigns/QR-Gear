'use strict';

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const PRINTFUL_TOKEN = process.env['PRINTFUL-API-TOKEN'];
const EMBROIDERY_RE = /^embroidery_/;

async function fetchPrintifyVariants(blueprintId, providerId) {
  const url = `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${PRINTIFY_API_KEY}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPrintfulPrintfiles(productId) {
  const url = `https://api.printful.com/mockup-generator/printfiles/${productId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${PRINTFUL_TOKEN}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return body.result || body;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('[Backfill] Loading master_catalog from production...');
  const snap = await db.collection('master_catalog').get();
  console.log(`[Backfill] ${snap.docs.length} docs total`);

  let synced = 0, skipped = 0, errors = 0, i = 0;

  for (const doc of snap.docs) {
    i++;
    const data = doc.data();
    const maps = Array.isArray(data.providerMappings) ? data.providerMappings : [];
    const pyMap = maps.find(m => m.provider === 'printify') || null;
    const pfMap = maps.find(m => m.provider === 'printful') || null;

    const blueprintId = data.printifyBlueprintId ?? pyMap?.blueprintId ?? null;
    const providerId  = data.printifyPrintProviderId ?? pyMap?.printProviderId ?? null;
    const printfulId  = data.printfulProductId ?? (pfMap ? Number(pfMap.productId) : null) ?? null;

    const hasPy = Array.isArray(data.printifyPlacements) && data.printifyPlacements.length > 0;
    const hasPf = Array.isArray(data.printfulPlacements) && data.printfulPlacements.length > 0;

    const needsPy = blueprintId && providerId && !hasPy;
    const needsPf = printfulId && !hasPf;

    if (!needsPy && !needsPf) { skipped++; continue; }

    const update = { lastPlacementSyncAt: new Date().toISOString() };
    if (blueprintId) update.printifyBlueprintId = blueprintId;
    if (providerId)  update.printifyPrintProviderId = providerId;
    if (printfulId)  update.printfulProductId = printfulId;

    if (needsPy) {
      try {
        const variantData = await fetchPrintifyVariants(blueprintId, providerId);
        const seen = new Map();
        for (const v of (variantData?.variants ?? [])) {
          for (const ph of (v.placeholders ?? [])) {
            if (ph.position && !seen.has(ph.position)) {
              seen.set(ph.position, {
                position: ph.position,
                label: ph.label || ph.position.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                width: ph.width ?? null,
                height: ph.height ?? null,
              });
            }
          }
        }
        if (seen.size > 0) {
          update.printifyPlacements = Array.from(seen.values());
          process.stdout.write(`  [${i}/${snap.docs.length}] ${doc.id}: ${seen.size} Printify placements\n`);
        }
        await delay(400);
      } catch (e) {
        process.stdout.write(`  [${i}] ${doc.id} Printify ERR (bp=${blueprintId}/pv=${providerId}): ${e.message}\n`);
        errors++;
      }
    }

    if (needsPf) {
      try {
        const pf = await fetchPrintfulPrintfiles(printfulId);
        const available = pf?.available_placements || {};
        const placements = Object.entries(available)
          .filter(([k]) => !EMBROIDERY_RE.test(k))
          .map(([k, v]) => ({
            position: k,
            label: v.title || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            width: v.width ?? null,
            height: v.height ?? null,
          }));
        if (placements.length > 0) {
          update.printfulPlacements = placements;
          process.stdout.write(`  [${i}/${snap.docs.length}] ${doc.id}: ${placements.length} Printful placements\n`);
        }
        await delay(300);
      } catch (e) {
        process.stdout.write(`  [${i}] ${doc.id} Printful ERR (pf=${printfulId}): ${e.message}\n`);
        errors++;
      }
    }

    if (Object.keys(update).length > 1) {
      await doc.ref.update(update);
      synced++;
    } else {
      skipped++;
    }

    if (i % 10 === 0) {
      process.stdout.write(`[Backfill] ${i}/${snap.docs.length} — synced=${synced} skipped=${skipped} errors=${errors}\n`);
    }
  }

  console.log(`\n[Backfill] DONE. synced=${synced} skipped=${skipped} errors=${errors} total=${snap.docs.length}`);
  process.exit(0);
}

run().catch(e => { console.error('[Backfill] Fatal:', e.message); process.exit(1); });
