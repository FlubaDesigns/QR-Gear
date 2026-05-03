#!/usr/bin/env node
// Sequential enrichment: one category at a time, polls until complete, then next.
(async () => {
  const crypto = require('crypto');
  const https = require('https');

  const CATEGORIES = [
    'T-Shirts',
    'Hoodies & Sweatshirts',
    'Bottoms & Active',
    'Hats & Caps',
    'Footwear & Socks',
    'Sleepwear & Underwear',
    'Baby & Kids',
    'Drinkware',
    'Barware',
    'Drinkware Accessories',
    'Kitchen & Dining',
    'Bedding & Textiles',
    'Home Décor',
    'Wall Art & Prints',
    'Stickers & Magnets',
    'Stationery & Paper',
    'Signs & Display',
    'Books & Photo',
    'Pins & Patches',
    'Tags',
    'Puzzles & Games',
    'Novelty',
    'Bags & Pouches',
    'Jewelry',
    'Phone & Tech Cases',
    'Travel Accessories',
    'Small Accessories',
    'Pet Apparel',
    'Pet Accessories',
    'Ornaments & Décor',
    'Stockings & Gifting',
    'Seasonal Apparel',
  ];

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
  const ADMIN_UID = 'xHUmudG0t5OkCQhqyhB4nXhCUfs1';
  const API_HOST = 'api-b3rye3vhuq-uc.a.run.app';
  const PROJECT_ID = sa.project_id;

  function log(...args) { console.log(new Date().toISOString(), ...args); }

  function base64url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function httpreq(opts, body) {
    return new Promise((resolve, reject) => {
      const r = https.request(opts, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      r.on('error', reject);
      if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
      r.end();
    });
  }

  async function getServiceAccountToken() {
    const now = Math.floor(Date.now() / 1000);
    const h = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const p = base64url(Buffer.from(JSON.stringify({
      iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
    })));
    const sig = crypto.createSign('RSA-SHA256');
    sig.update(h + '.' + p);
    const jwt = h + '.' + p + '.' + base64url(sig.sign(sa.private_key));
    const body = 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt;
    const t = await httpreq({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, body);
    return JSON.parse(t.body).access_token;
  }

  async function getIdToken() {
    const now = Math.floor(Date.now() / 1000);
    const h = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const p = base64url(Buffer.from(JSON.stringify({
      iss: sa.client_email, sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: now, exp: now + 3600, uid: ADMIN_UID, claims: { admin: true }
    })));
    const sig = crypto.createSign('RSA-SHA256');
    sig.update(h + '.' + p);
    const customToken = h + '.' + p + '.' + base64url(sig.sign(sa.private_key));
    const t = await httpreq({ hostname: 'identitytoolkit.googleapis.com', path: '/v1/accounts:signInWithCustomToken?key=' + FIREBASE_API_KEY, method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ token: customToken, returnSecureToken: true }));
    return JSON.parse(t.body).idToken;
  }

  async function getJobStatus(jobId, saToken) {
    const r = await httpreq({ hostname: 'firestore.googleapis.com', path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/master_catalog_syncs/${jobId}`, method: 'GET', headers: { Authorization: 'Bearer ' + saToken } });
    const fields = JSON.parse(r.body).fields || {};
    const out = {};
    for (const [k, v] of Object.entries(fields)) out[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? v.doubleValue ?? null;
    return out;
  }

  async function triggerEnrich(category, idToken) {
    const body = JSON.stringify({ forceRefresh: false, categoryFilter: category });
    const r = await httpreq({ hostname: API_HOST, path: '/admin/master-catalog/enrich', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken } }, body);
    return JSON.parse(r.body);
  }

  async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Mark any stale running jobs as cancelled first
  const saToken0 = await getServiceAccountToken();
  for (const staleId of ['BqO2tvEPQm6piXxBpaT3']) {
    const job = await getJobStatus(staleId, saToken0);
    if (job.status === 'running') {
      const patchBody = JSON.stringify({ fields: { status: { stringValue: 'cancelled' }, completedAt: { stringValue: new Date().toISOString() }, error: { stringValue: 'Superseded by category-by-category run' } } });
      await httpreq({ hostname: 'firestore.googleapis.com', path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/master_catalog_syncs/${staleId}?updateMask.fieldPaths=status&updateMask.fieldPaths=completedAt&updateMask.fieldPaths=error`, method: 'PATCH', headers: { Authorization: 'Bearer ' + saToken0, 'Content-Type': 'application/json' } }, patchBody);
      log(`Marked stale job ${staleId} as cancelled`);
    }
  }

  let totalEnriched = 0;
  let totalErrors = 0;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const category = CATEGORIES[i];
    log(`\n=== [${i + 1}/${CATEGORIES.length}] Starting: ${category} ===`);

    const idToken = await getIdToken();
    const trigger = await triggerEnrich(category, idToken);
    if (!trigger.jobId) {
      log(`ERROR triggering ${category}:`, JSON.stringify(trigger));
      continue;
    }
    const jobId = trigger.jobId;
    log(`Job ${jobId} started`);

    // Poll until complete (check every 30s, timeout after 60 minutes)
    const deadline = Date.now() + 60 * 60 * 1000;
    let done = false;
    while (!done && Date.now() < deadline) {
      await sleep(30000);
      const saToken = await getServiceAccountToken();
      const job = await getJobStatus(jobId, saToken);
      const status = job.status;
      log(`  [${category}] Job ${jobId} — status: ${status} | printful: ${job.printfulEnriched ?? '?'} | printify: ${job.printifyEnriched ?? '?'} | skipped: ${job.skipped ?? '?'} | errors: ${job.errors ?? '?'} | total: ${job.total ?? '?'}`);
      if (status === 'completed' || status === 'failed' || status === 'timed_out') {
        done = true;
        totalEnriched += (Number(job.printfulEnriched) || 0) + (Number(job.printifyEnriched) || 0);
        totalErrors += Number(job.errors) || 0;
        log(`  [${category}] DONE — enriched: ${(Number(job.printfulEnriched)||0)+(Number(job.printifyEnriched)||0)}, errors: ${job.errors ?? 0}`);
      }
    }
    if (!done) {
      log(`  [${category}] TIMEOUT waiting — moving on`);
    }
  }

  log(`\n=== ALL CATEGORIES DONE — total enriched: ${totalEnriched}, total errors: ${totalErrors} ===`);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
