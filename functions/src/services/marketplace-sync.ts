import { db } from '../core';
import {
  SURFACES_COLLECTION,
  MARKETPLACE_ACCOUNTS_COLLECTION,
  MARKETPLACE_LISTINGS_COLLECTION,
  MARKETPLACE_SYNC_JOBS_COLLECTION,
  MARKETPLACE_SYNC_LOGS_COLLECTION,
  type MarketplacePlatform,
  type SyncJobAction,
  type SyncJobStatus,
  type SyncLogLevel,
} from '../constants';
import * as etsyAdapter from '../adapters/etsy';
import * as ebayAdapter from '../adapters/ebay';
import * as amazonAdapter from '../adapters/amazon';
import type { MarketplaceResult, SurfaceInput, SurfaceInputFull, AccountInput, EbayBlock } from '../adapters/etsy';

interface SyncJobDoc {
  listingId: string;
  surfaceId: string;
  accountId: string;
  platform: MarketplacePlatform;
  action: SyncJobAction;
  status: SyncJobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  completedAt?: string;
  errorMessage?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface SurfaceDoc {
  masterProductId: string;
  title: string;
  subtitle?: string;
  description: string;
  bulletPoints?: string[];
  tags: string[];
  keywords?: string[];
  images: string[];
  mockupImages?: string[];
  retailPrice: number;
  compareAtPrice?: number;
  currency?: string;
  sku: string;
  enabledPlatforms: MarketplacePlatform[];
  status: string;
  // Marketplace-common fields
  condition?: string;
  brand?: string;
  material?: string;
  department?: string;
  shippingProfileRef?: string;
  returnsProfileRef?: string;
  // eBay-specific scoped block
  ebay?: EbayBlock;
}

interface AccountDoc {
  platform: MarketplacePlatform;
  accountName: string;
  shopId: string;
  shopName: string;
  feePercent: number;
  isActive: boolean;
}

interface ListingDoc {
  surfaceId: string;
  accountId: string;
  platform: MarketplacePlatform;
  externalListingId?: string;
  externalUrl?: string;
  status: string;
  title: string;
  price: number;
  lastSyncAt?: string;
  lastSyncJobId?: string;
  errorMessage?: string;
}

async function writeLog(
  jobId: string,
  listingId: string,
  accountId: string,
  platform: MarketplacePlatform,
  level: SyncLogLevel,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.collection(MARKETPLACE_SYNC_LOGS_COLLECTION).add({
      jobId,
      listingId,
      accountId,
      platform,
      level,
      message,
      details: details || undefined,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[MarketplaceSync] Failed to write log:', err);
  }
}

async function updateJobStatus(
  jobId: string,
  status: SyncJobStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).update({
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  });
}

async function updateListingStatus(
  listingId: string,
  updates: Record<string, unknown>
): Promise<void> {
  await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).update({
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// Builds the full three-layer resolved surface input.
// core (title/desc/price/sku/images) + common (brand/material/condition/etc.) + ebay block.
// This is the single place where a Firestore SurfaceDoc is normalized for adapter use.
function toSurfaceInputFull(doc: SurfaceDoc): SurfaceInputFull {
  return {
    title: doc.title,
    description: doc.description,
    tags: doc.tags || [],
    images: doc.images || [],
    retailPrice: doc.retailPrice,
    sku: doc.sku,
    masterProductId: doc.masterProductId,
    // Common fields
    subtitle: doc.subtitle,
    bulletPoints: doc.bulletPoints,
    keywords: doc.keywords,
    condition: doc.condition,
    brand: doc.brand,
    material: doc.material,
    department: doc.department,
    shippingProfileRef: doc.shippingProfileRef,
    returnsProfileRef: doc.returnsProfileRef,
    // eBay block — already scoped, adapter reads it directly
    ebay: doc.ebay,
  };
}

// Keep thin alias for adapters that only need the base shape (Etsy, Amazon)
function toSurfaceInput(doc: SurfaceDoc): SurfaceInput {
  return toSurfaceInputFull(doc);
}

function toAccountInput(doc: AccountDoc): AccountInput {
  return { shopId: doc.shopId };
}

function getAdapter(platform: MarketplacePlatform) {
  switch (platform) {
    case 'etsy': return etsyAdapter;
    case 'ebay': return ebayAdapter;
    case 'amazon': return amazonAdapter;
    default: return null;
  }
}

function computeNextRetryDelay(attempt: number): number {
  return Math.min(5000 * Math.pow(2, attempt), 60000);
}

const pendingRetries = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRetryExecution(jobId: string, delayMs: number): void {
  const existing = pendingRetries.get(jobId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    pendingRetries.delete(jobId);
    try {
      console.log(`[MarketplaceSync] Executing scheduled retry for job ${jobId}`);
      await executeSyncJob(jobId);
    } catch (err) {
      console.error(`[MarketplaceSync] Scheduled retry failed for job ${jobId}:`, err);
    }
  }, delayMs);

  pendingRetries.set(jobId, timer);
  console.log(`[MarketplaceSync] Retry scheduled for job ${jobId} in ${delayMs}ms`);
}

let retrySweepInterval: ReturnType<typeof setInterval> | null = null;
const RETRY_SWEEP_INTERVAL_MS = 60_000;

export function startRetrySweep(): void {
  if (retrySweepInterval) return;
  retrySweepInterval = setInterval(async () => {
    try {
      const processed = await processRetryQueue();
      if (processed > 0) {
        console.log(`[MarketplaceSync] Sweep processed ${processed} retry job(s)`);
      }
    } catch (err) {
      console.error('[MarketplaceSync] Retry sweep error:', err);
    }
  }, RETRY_SWEEP_INTERVAL_MS);
  console.log(`[MarketplaceSync] Retry sweep started (every ${RETRY_SWEEP_INTERVAL_MS / 1000}s)`);
}

export function stopRetrySweep(): void {
  if (retrySweepInterval) {
    clearInterval(retrySweepInterval);
    retrySweepInterval = null;
  }
}

export async function executeSyncJob(jobId: string): Promise<void> {
  const jobRef = db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId);

  let job: SyncJobDoc;
  try {
    const claimed = await db.runTransaction(async (tx) => {
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) return null;

      const data = jobSnap.data() as SyncJobDoc;

      if (data.status !== 'queued' && data.status !== 'failed') return null;

      if (data.nextRetryAt) {
        const retryTime = new Date(data.nextRetryAt).getTime();
        if (Date.now() < retryTime) return null;
      }

      if (data.attempts >= data.maxAttempts) {
        tx.update(jobRef, {
          status: 'failed',
          errorMessage: `Max attempts (${data.maxAttempts}) reached`,
          updatedAt: new Date().toISOString(),
        });
        return { ...data, _exhausted: true } as SyncJobDoc & { _exhausted: boolean };
      }

      const now = new Date().toISOString();
      tx.update(jobRef, {
        status: 'running',
        attempts: data.attempts + 1,
        lastAttemptAt: now,
        nextRetryAt: null,
        updatedAt: now,
      });

      return data;
    });

    if (!claimed) {
      console.warn(`[MarketplaceSync] Job ${jobId} not claimable (missing, wrong status, or not yet due)`);
      return;
    }

    if ('_exhausted' in claimed && (claimed as SyncJobDoc & { _exhausted: boolean })._exhausted) {
      await updateListingStatus(claimed.listingId, { status: 'error', errorMessage: `Sync failed after ${claimed.maxAttempts} attempts` });
      await writeLog(jobId, claimed.listingId, claimed.accountId, claimed.platform, 'error', `Job exhausted ${claimed.maxAttempts} attempts`);
      return;
    }

    job = claimed;
  } catch (txErr) {
    console.error(`[MarketplaceSync] Transaction failed for job ${jobId}:`, txErr);
    return;
  }

  await updateListingStatus(job.listingId, { status: 'syncing' });
  await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info', `Starting ${job.action} (attempt ${job.attempts + 1}/${job.maxAttempts})`);

  const listingSnap = await db.collection(MARKETPLACE_LISTINGS_COLLECTION).doc(job.listingId).get();
  if (!listingSnap.exists) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'Listing not found' });
    await updateListingStatus(job.listingId, { status: 'error', errorMessage: 'Listing document missing' }).catch(() => {});
    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error', 'Listing document not found in Firestore');
    return;
  }
  const listing = listingSnap.data() as ListingDoc;

  const surfaceSnap = await db.collection(SURFACES_COLLECTION).doc(job.surfaceId).get();
  if (!surfaceSnap.exists) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'Surface not found' });
    await updateListingStatus(job.listingId, { status: 'error', errorMessage: 'Surface document missing' });
    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error', 'Surface document not found in Firestore');
    return;
  }
  const surface = surfaceSnap.data() as SurfaceDoc;

  const accountSnap = await db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(job.accountId).get();
  if (!accountSnap.exists) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'Account not found' });
    await updateListingStatus(job.listingId, { status: 'error', errorMessage: 'Marketplace account missing' });
    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error', 'Marketplace account not found in Firestore');
    return;
  }
  const account = accountSnap.data() as AccountDoc;

  if (!account.isActive) {
    await updateJobStatus(jobId, 'failed', { errorMessage: 'Marketplace account is inactive' });
    await updateListingStatus(job.listingId, { status: 'paused', errorMessage: 'Account is inactive' });
    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'warn', 'Marketplace account is inactive — skipping sync');
    return;
  }

  const adapter = getAdapter(job.platform);
  if (!adapter) {
    await updateJobStatus(jobId, 'failed', { errorMessage: `Unsupported platform: ${job.platform}` });
    await updateListingStatus(job.listingId, { status: 'error', errorMessage: `Unsupported platform: ${job.platform}` });
    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error', `No adapter for platform: ${job.platform}`);
    return;
  }

  const surfaceInput = toSurfaceInputFull(surface);
  const accountInput = toAccountInput(account);
  let result: MarketplaceResult;

  try {
    switch (job.action) {
      case 'create':
        result = await adapter.createListing(surfaceInput, accountInput);
        break;

      case 'update':
      case 'full_sync':
        if (!listing.externalListingId) {
          await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info', 'No external listing exists — creating instead of updating');
          result = await adapter.createListing(surfaceInput, accountInput);
        } else {
          result = await adapter.updateListing(listing.externalListingId, surfaceInput, accountInput);
        }
        break;

      case 'delete':
        if (!listing.externalListingId) {
          result = { success: true };
          await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info', 'No external listing to delete');
        } else {
          result = await adapter.deleteListing(listing.externalListingId, accountInput);
        }
        break;

      case 'sync_inventory':
        if (!listing.externalListingId) {
          result = { success: false, error: 'Cannot sync inventory without an external listing' };
        } else {
          result = { success: true };
          await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info', 'Inventory sync marked complete (print-on-demand: always in stock)');
        }
        break;

      default:
        result = { success: false, error: `Unknown action: ${job.action}` };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result = { success: false, error: errorMsg };
  }

  const completedAt = new Date().toISOString();

  if (result.success) {
    await updateJobStatus(jobId, 'completed', {
      completedAt,
      result: {
        externalListingId: result.externalListingId,
        externalUrl: result.externalUrl,
      },
    });

    const listingUpdates: Record<string, unknown> = {
      lastSyncAt: completedAt,
      errorMessage: null,
    };

    if (job.action === 'delete') {
      listingUpdates.status = 'delisted';
      listingUpdates.externalListingId = null;
      listingUpdates.externalUrl = null;
    } else {
      listingUpdates.status = 'active';
      if (result.externalListingId) listingUpdates.externalListingId = result.externalListingId;
      if (result.externalUrl) listingUpdates.externalUrl = result.externalUrl;
    }

    await updateListingStatus(job.listingId, listingUpdates);

    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info',
      `${job.action} completed successfully` +
      (result.externalListingId ? ` — external ID: ${result.externalListingId}` : ''),
      { externalListingId: result.externalListingId, externalUrl: result.externalUrl }
    );

    if (surface.status === 'draft' || surface.status === 'ready') {
      await db.collection(SURFACES_COLLECTION).doc(job.surfaceId).update({
        status: 'published',
        updatedAt: completedAt,
      });
    }
  } else {
    const canRetry = (job.attempts + 1) < job.maxAttempts;
    const finalStatus: SyncJobStatus = canRetry ? 'queued' : 'failed';
    const nextRetryAt = canRetry
      ? new Date(Date.now() + computeNextRetryDelay(job.attempts)).toISOString()
      : undefined;

    await updateJobStatus(jobId, finalStatus, {
      errorMessage: result.error,
      nextRetryAt: nextRetryAt || null,
      ...(canRetry ? {} : { completedAt }),
    });

    await updateListingStatus(job.listingId, {
      status: canRetry ? 'syncing' : 'error',
      errorMessage: result.error,
      lastSyncAt: completedAt,
    });

    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error',
      `${job.action} failed: ${result.error}`,
      { attempt: job.attempts + 1, maxAttempts: job.maxAttempts, canRetry, nextRetryAt }
    );

    if (canRetry) {
      await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info',
        `Will retry at ${nextRetryAt} (attempt ${job.attempts + 2}/${job.maxAttempts})`
      );

      const delayMs = computeNextRetryDelay(job.attempts);
      scheduleRetryExecution(jobId, delayMs);
    }
  }
}

export async function processRetryQueue(): Promise<number> {
  const now = new Date().toISOString();
  const snapshot = await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION)
    .where('status', '==', 'queued')
    .get();

  let processed = 0;
  for (const doc of snapshot.docs) {
    const job = doc.data() as SyncJobDoc;
    if (job.nextRetryAt && job.nextRetryAt > now) continue;
    if (job.attempts >= job.maxAttempts) continue;

    try {
      await executeSyncJob(doc.id);
      processed++;
    } catch (err) {
      console.error(`[MarketplaceSync] processRetryQueue error for job ${doc.id}:`, err);
    }
  }
  return processed;
}

export async function retryFailedJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const jobSnap = await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).get();
  if (!jobSnap.exists) return { success: false, error: 'Job not found' };

  const job = jobSnap.data() as SyncJobDoc;
  if (job.status !== 'failed') return { success: false, error: `Job is ${job.status}, not failed` };

  await db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).update({
    status: 'queued',
    attempts: 0,
    errorMessage: null,
    completedAt: null,
    nextRetryAt: null,
    updatedAt: new Date().toISOString(),
  });

  await executeSyncJob(jobId);

  return { success: true };
}
