import { resolveMarketplaceVariants } from './marketplace-variants';
import { refreshListingFees } from './marketplace-fees';
import { marketplaceSalePrice } from '../../../shared/surfaces';
import { createHash } from 'crypto';
import { db } from '../core';
import { SURFACES_COLLECTION, MARKETPLACE_ACCOUNTS_COLLECTION, MARKETPLACE_LISTINGS_COLLECTION, MARKETPLACE_SYNC_JOBS_COLLECTION, MARKETPLACE_SYNC_LOGS_COLLECTION, SURFACE_VARIANTS_COLLECTION, type MarketplacePlatform, type SyncJobAction } from '../constants';
import { normalizeProductForPublishing, marketplaceSelectionErrors } from './surface-generator';
import { publishMarketplaceListing, type PublishResult } from './marketplace-publisher';

export class MarketplaceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const now = () => new Date().toISOString();
const listings = () => db.collection(MARKETPLACE_LISTINGS_COLLECTION);
const jobs = () => db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION);

async function readContext(surfaceId: string, accountId: string, remoteOnly = false) {
  const [surfaceDoc, accountDoc] = await Promise.all([
    db.collection(SURFACES_COLLECTION).doc(surfaceId).get(),
    db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get(),
  ]);
  if (!surfaceDoc.exists || !accountDoc.exists) throw new MarketplaceError('Surface or marketplace account not found.', 404);
  const surface = surfaceDoc.data()!, account = accountDoc.data()!;
  if (remoteOnly) {
    if (!account.isActive) throw new MarketplaceError('Marketplace account is inactive.');
    return { surface, account, product: null };
  }
  if (!surface.masterProductId) throw new MarketplaceError('Generate this surface from a committed product first.');
  const product = await normalizeProductForPublishing(surface.masterProductId, db);
  if (surface.sku !== product.sku) throw new MarketplaceError('Surface QRG identity does not match its product. Regenerate the surface.');
  if (!account.isActive) throw new MarketplaceError('Marketplace account is inactive.');
  if (!surface.enabledPlatforms?.includes(account.platform)) throw new MarketplaceError('Enable this marketplace on the surface first.');
  return { surface, account, product };
}

/** Reuses old canonical rows; deterministic IDs plus a transaction prevent new duplicates. */
export async function getOrCreateMarketplaceListing(surfaceId: string, accountId: string, expectedPlatform?: string) {
  const { surface, account } = await readContext(surfaceId, accountId);
  if (expectedPlatform && account.platform !== expectedPlatform) throw new MarketplaceError('Selected account does not match the requested marketplace.');
  const deterministicId = createHash('sha256').update(JSON.stringify([surfaceId, accountId])).digest('hex');
  const ref = listings().doc(deterministicId);
  return db.runTransaction(async tx => {
    const existing = await tx.get(listings().where('surfaceId', '==', surfaceId).where('accountId', '==', accountId).limit(2));
    if (existing.size > 1) throw new MarketplaceError('Duplicate listing records exist for this surface and account. Reconcile them before publishing.', 409);
    if (!existing.empty) return { ...existing.docs[0].data(), id: existing.docs[0].id };
    // Direct pushes used to write only surface histories. Do not silently create a duplicate external listing.
    const history = Object.values(surface[`${account.platform}PushHistory`] || {}) as any[];
    const prior = history.filter(item => item.accountId === accountId && (item.listingId || item.success)).sort((a, b) => (b.pushedAt || '').localeCompare(a.pushedAt || ''))[0];
    if (prior && account.platform === 'etsy' && !prior.listingId) throw new MarketplaceError('An earlier Etsy push exists without a listing ID. Reconcile it in Etsy before publishing again.', 409);
    const data = {
      surfaceId, accountId, platform: account.platform, qrgCode: surface.sku, marketplaceSku: surface.sku,
      productInstanceId: surface.masterProductId, status: prior ? 'pending' : 'draft', title: surface.title, price: marketplaceSalePrice(surface as any, account.platform),
      ...(prior?.listingId ? { externalListingId: String(prior.listingId) } : {}),
      createdAt: now(), updatedAt: now(),
    };
    tx.create(ref, data);
    return { ...data, id: ref.id };
  });
}

function publishOptions(input: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const key of ['taxonomyId', 'shippingProfileId', 'returnPolicyId']) {
    if (input[key] != null) {
      const value = Number(input[key]);
      if (!Number.isSafeInteger(value) || value <= 0) throw new MarketplaceError(`Invalid ${key}.`);
      result[key] = value;
    }
  }
  for (const key of ['whoMade', 'whenMade']) if (typeof input[key] === 'string') result[key] = input[key];
  return result;
}

/** Hold one listing lock and await the attempt while the HTTP request is alive. */
export async function runMarketplaceJob(listingId: string, action: SyncJobAction, options: Record<string, any> = {}) {
  const jobRef = jobs().doc(), listingRef = listings().doc(listingId);
  const savedOptions = publishOptions(options);
  await db.runTransaction(async tx => {
    const snap = await tx.get(listingRef);
    if (!snap.exists) throw new MarketplaceError('Listing not found.', 404);
    const listing = snap.data()!;
    if (listing.status === 'syncing') throw new MarketplaceError('A job is already running for this listing.', 409);
    if (listing.platform === 'etsy' && listing.externalCreateAttempted && !listing.externalListingId) throw new MarketplaceError('Previous Etsy creation has an unknown outcome. Check Etsy and reconcile its listing ID before retrying.', 409);
    const timestamp = now();
    tx.create(jobRef, { listingId, surfaceId: listing.surfaceId, accountId: listing.accountId, platform: listing.platform,
      qrgCode: listing.qrgCode, marketplaceSku: listing.marketplaceSku, productInstanceId: listing.productInstanceId,
      action, status: 'queued', attempts: 0, maxAttempts: 1, createdAt: timestamp, updatedAt: timestamp });
    tx.update(listingRef, { status: 'syncing', lastSyncJobId: jobRef.id, updatedAt: timestamp,
      ...(Object.keys(savedOptions).length ? { publishOptions: { ...listing.publishOptions, ...savedOptions } } : {}) });
  });
  await executeSyncJob(jobRef.id);
  const saved = (await jobRef.get()).data()!;
  return { ...saved, id: jobRef.id, success: saved.status === 'completed', error: saved.errorMessage || undefined, ...saved.result };
}

export async function executeSyncJob(jobId: string): Promise<void> {
  const jobRef = jobs().doc(jobId);
  const job = await db.runTransaction(async tx => {
    const snap = await tx.get(jobRef);
    if (!snap.exists || snap.data()!.status !== 'queued') return null;
    const data = snap.data()!;
    const listing = await tx.get(listings().doc(data.listingId));
    if (!listing.exists || listing.data()!.lastSyncJobId !== jobId) {
      tx.update(jobRef, { status: 'failed', errorMessage: 'Listing is missing or owned by another job.', updatedAt: now() });
      return null;
    }
    tx.update(jobRef, { status: 'running', attempts: (data.attempts || 0) + 1, lastAttemptAt: now(), nextRetryAt: null, updatedAt: now() });
    return data;
  });
  if (!job) return;
  const listingRef = listings().doc(job.listingId);
  let result: PublishResult;
  try {
    const listing = (await listingRef.get()).data()!;
    const { surface, account, product } = await readContext(job.surfaceId, job.accountId, ['check_status', 'delete'].includes(job.action));
    if (listing.surfaceId !== job.surfaceId || listing.accountId !== job.accountId || account.platform !== job.platform ||
        listing.platform !== job.platform || job.qrgCode !== surface.sku || job.marketplaceSku !== surface.sku ||
        listing.qrgCode !== surface.sku || listing.marketplaceSku !== surface.sku || job.productInstanceId !== surface.masterProductId) {
      throw new MarketplaceError('Listing, job and product identity do not match.');
    }
    if (['delete', 'check_status'].includes(job.action) && !['ebay', 'amazon'].includes(job.platform)) throw new MarketplaceError('Remote status and removal are available for eBay and Amazon.');
    if (!['create', 'update', 'full_sync', 'sync_inventory', 'delete', 'check_status'].includes(job.action)) throw new MarketplaceError('Unsupported marketplace job action.');
    let resolvedVariants: Awaited<ReturnType<typeof resolveMarketplaceVariants>> = [];
    if (product) {
      const variants = await db.collection(SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', job.surfaceId).get();
      if (['ebay', 'amazon'].includes(job.platform)) {
        if (!variants.empty) throw new MarketplaceError('Legacy surface variant overrides must be reconciled with the built product before publishing.');
        resolvedVariants = await resolveMarketplaceVariants(product, db);
      } else {
        const selectionErrors = marketplaceSelectionErrors(product, !variants.empty);
        if (selectionErrors.length) throw new MarketplaceError(selectionErrors.join(' '));
      }
    }
    result = await publishMarketplaceListing(job.platform as MarketplacePlatform, surface, account, listing, {
      amazonItems: async items => { await listingRef.update({ amazonItems: items, amazonRemovalRequested: false, remoteStatus: 'Submission processing', externalListingId: surface.sku, updatedAt: now() }); },
      amazonRemoval: async () => { await listingRef.update({ amazonRemovalRequested: true, updatedAt: now() }); },
      ebayOffer: async (offerId, identity) => {
        await listingRef.update({ externalOfferId: offerId, ...(identity?.offers ? { ebayOffers: identity.offers } : {}),
          ...(identity?.inventoryItemGroupKey ? { ebayInventoryItemGroupKey: identity.inventoryItemGroupKey } : {}), updatedAt: now() });
      },
      ebayPrepared: async () => {
        try { await refreshListingFees(job.listingId); } catch { console.error('[Marketplace fees] Could not save eBay fee result:', job.listingId); }
      },
      etsyToken: async token => { await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(job.accountId).update({ etsyRefreshToken: token, updatedAt: now() }); },
      externalListing: async id => { await listingRef.update({ externalListingId: id, updatedAt: now() }); },
      etsyCreateAttempt: async () => { await listingRef.update({ externalCreateAttempted: true, updatedAt: now() }); },
    }, resolvedVariants, job.action);
  } catch (error) {
    result = { success: false, sku: job.qrgCode || '', listingStatus: 'error', error: error instanceof Error ? error.message : String(error) };
  }
  const timestamp = now();
  // Do not persist undefined fields, account credentials, or request headers in public job results.
  const storedResult = JSON.parse(JSON.stringify(result));
  await db.runTransaction(async tx => {
    const listingSnap = await tx.get(listingRef);
    const related = await tx.get(listings().where('surfaceId', '==', job.surfaceId));
    const surfaceSnap = await tx.get(db.collection(SURFACES_COLLECTION).doc(job.surfaceId));
    if (!listingSnap.exists || listingSnap.data()!.lastSyncJobId !== jobId) throw new MarketplaceError('Listing changed during publishing; result requires reconciliation.', 409);
    tx.update(jobRef, { status: result.success ? 'completed' : 'failed', result: storedResult,
      errorMessage: result.error || null, completedAt: timestamp, updatedAt: timestamp });
    tx.update(listingRef, { status: result.listingStatus, lastSyncAt: timestamp, updatedAt: timestamp,
      errorMessage: result.error || null, ...((job.platform === 'ebay' && result.success) || (job.platform === 'amazon' && result.amazonItems && ['check_status', 'delete'].includes(job.action)) ? { remoteCheckedAt: timestamp, remoteStatus: result.remoteStatus || result.listingStatus } : {}),
      ...(result.amazonItems ? { amazonItems: result.amazonItems } : {}),
      ...(result.externalListingId ? { externalListingId: result.externalListingId } : {}),
      ...(result.externalUrl ? { externalUrl: result.externalUrl } : {}) });
    if (result.success && surfaceSnap.exists) {
      const hasActiveListing = related.docs.some(doc => doc.id === job.listingId ? result.listingStatus === 'active' : doc.data().status === 'active');
      tx.update(surfaceSnap.ref, { status: hasActiveListing ? 'published' : surfaceSnap.data()!.status === 'published' ? 'draft' : surfaceSnap.data()!.status, updatedAt: timestamp });
    }
    tx.create(db.collection(MARKETPLACE_SYNC_LOGS_COLLECTION).doc(), { jobId, listingId: job.listingId, accountId: job.accountId,
      platform: job.platform, level: result.success ? 'info' : 'error', message: result.error || `Marketplace returned ${result.listingStatus}.`, createdAt: timestamp });
  });
  if (result.success && job.platform !== 'ebay' && !['check_status', 'delete'].includes(job.action)) {
    // Fee failures have their own visible status; an accepted listing stays accepted.
    try { await refreshListingFees(job.listingId); }
    catch { console.error('[Marketplace fees] Could not save fee retrieval result:', job.listingId); }
  }
}

export async function retryFailedJob(jobId: string) {
  const snap = await jobs().doc(jobId).get();
  if (!snap.exists) throw new MarketplaceError('Job not found.', 404);
  const job = snap.data()!;
  if (job.status !== 'failed') throw new MarketplaceError('Only failed jobs can be retried.');
  // Retain the old attempt for audit; the same locked job path owns explicit retries.
  return runMarketplaceJob(job.listingId, job.action);
}

export async function processRetryQueue(): Promise<number> {
  const snapshot = await jobs().where('status', '==', 'queued').get();
  for (const job of snapshot.docs) await executeSyncJob(job.id);
  return snapshot.size;
}
