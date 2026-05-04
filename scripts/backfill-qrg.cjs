'use strict';

const admin = require('firebase-admin');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const PRINTIFY_KEY = process.env.PRINTIFY_API_KEY;
const PRINTFUL_TOKEN = process.env['PRINTFUL-API-TOKEN'];
const EMBROIDERY_RE = /^embroidery_/;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(fn, label) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fn();
      if (res.status === 429) {
        const wait = 3000 * Math.pow(2, attempt);
        process.stdout.write(`    [429] ${label} — waiting ${wait}ms\n`);
        await delay(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await delay(1000 * (attempt + 1));
    }
  }
}

async function getPrintifyPlacements(blueprintId, providerId) {
  const url = `https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`;
  const data = await fetchWithRetry(
    () => fetch(url, { headers: { Authorization: `Bearer ${PRINTIFY_KEY}` } }),
    `Printify bp=${blueprintId}/pv=${providerId}`
  );
  const seen = new Map();
  for (const v of (data?.variants ?? [])) {
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
  return Array.from(seen.values());
}

async function getPrintfulPlacements(productId) {
  const url = `https://api.printful.com/mockup-generator/printfiles/${productId}`;
  const data = await fetchWithRetry(
    () => fetch(url, { headers: { Authorization: `Bearer ${PRINTFUL_TOKEN}` } }),
    `Printful pf=${productId}`
  );
  const available = data?.available_placements || data?.result?.available_placements || {};
  return Object.entries(available)
    .filter(([k]) => !EMBROIDERY_RE.test(k))
    .map(([k, v]) => ({
      position: k,
      label: v.title || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      width: v.width ?? null,
      height: v.height ?? null,
    }));
}

async function processDoc(doc, idx, total) {
  const data = doc.data();
  const maps = Array.isArray(data.providerMappings) ? data.providerMappings : [];
  const pyMap = maps.find(m => m.provider === 'printify') || null;
  const pfMap = maps.find(m => m.provider === 'printful') || null;

  const blueprintId = data.printifyBlueprintId ?? pyMap?.blueprintId ?? null;
  const providerId  = data.printifyPrintProviderId ?? pyMap?.printProviderId ?? null;
  const printfulId  = data.printfulProductId ?? (pfMap ? Number(pfMap.productId) : null) ?? null;

  const hasPy = Array.isArray(data.printifyPlacements) && data.printifyPlacements.length > 0;
  const hasPf = Array.isArray(data.printfulPlacements) && data.printfulPlacements.length > 0;

  if (hasPy && hasPf) return 'skipped';
  if (!blueprintId && !printfulId) return 'skipped';

  const update = { lastPlacementSyncAt: new Date().toISOString() };
  if (blueprintId) update.printifyBlueprintId = blueprintId;
  if (providerId)  update.printifyPrintProviderId = providerId;
  if (printfulId)  update.printfulProductId = printfulId;

  let pyPlacements = [], pfPlacements = [];

  if (!hasPy && blueprintId && providerId) {
    try {
      pyPlacements = await getPrintifyPlacements(blueprintId, providerId);
      if (pyPlacements.length) update.printifyPlacements = pyPlacements;
    } catch (e) {
      process.stdout.write(`  [${idx}/${total}] ${doc.id} Printify ERR: ${e.message}\n`);
    }
    await delay(350);
  }

  if (!hasPf && printfulId) {
    try {
      pfPlacements = await getPrintfulPlacements(printfulId);
      if (pfPlacements.length) update.printfulPlacements = pfPlacements;
    } catch (e) {
      if (!e.message.includes('400')) {
        process.stdout.write(`  [${idx}/${total}] ${doc.id} Printful ERR: ${e.message}\n`);
      }
    }
    await delay(400);
  }

  if (pyPlacements.length || pfPlacements.length) {
    process.stdout.write(`  [${idx}/${total}] ${doc.id}: py=${pyPlacements.length} pf=${pfPlacements.length}\n`);
  }

  await doc.ref.update(update);
  return 'synced';
}

async function run() {
  process.stdout.write('[Backfill-QRG] Loading qrg_ docs...\n');
  const snap = await db.collection('master_catalog')
    .where(admin.firestore.FieldPath.documentId(), '>=', 'qrg_')
    .where(admin.firestore.FieldPath.documentId(), '<', 'qrg_z')
    .get();

  process.stdout.write(`[Backfill-QRG] ${snap.docs.length} qrg_ docs\n`);

  let synced = 0, skipped = 0, idx = 0;
  const BATCH = 3;

  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = snap.docs.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((doc, j) => processDoc(doc, i + j + 1, snap.docs.length)));
    for (const r of results) { if (r === 'synced') synced++; else skipped++; }
    idx = i + BATCH;

    if (idx % 60 === 0 || idx >= snap.docs.length) {
      process.stdout.write(`[Backfill-QRG] ${Math.min(idx, snap.docs.length)}/${snap.docs.length} — synced=${synced} skipped=${skipped}\n`);
    }
  }

  process.stdout.write(`\n[Backfill-QRG] DONE. synced=${synced} skipped=${skipped} total=${snap.docs.length}\n`);
  process.exit(0);
}

run().catch(e => { process.stderr.write(`[Backfill-QRG] Fatal: ${e.message}\n`); process.exit(1); });
