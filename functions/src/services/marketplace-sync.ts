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

interface MarketplaceResult {
  success: boolean;
  externalListingId?: string;
  externalUrl?: string;
  error?: string;
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

async function callEtsyCreate(surface: SurfaceDoc, account: AccountDoc): Promise<MarketplaceResult> {
  const apiKey = process.env.ETSY_API_KEYSTRING;
  const accessToken = process.env.ETSY_ACCESS_TOKEN;
  const shopId = account.shopId || process.env.ETSY_SHOP_ID;

  if (!apiKey || !accessToken || !shopId) {
    return { success: false, error: 'Etsy API credentials not configured (ETSY_API_KEYSTRING, ETSY_ACCESS_TOKEN, ETSY_SHOP_ID)' };
  }

  const base = 'https://api.etsy.com/v3/application';

  const listingBody = {
    title: surface.title.substring(0, 140),
    description: surface.description.substring(0, 65535),
    price: surface.retailPrice,
    quantity: 999,
    who_made: 'i_did',
    when_made: 'made_to_order',
    taxonomy_id: 482,
    tags: (surface.tags || []).slice(0, 13),
    shipping_profile_id: null as number | null,
    type: 'physical',
    is_customizable: true,
  };

  try {
    const profilesRes = await fetch(`${base}/shops/${shopId}/shipping-profiles`, {
      headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${accessToken}` },
    });
    if (profilesRes.ok) {
      const profilesData = await profilesRes.json() as { results?: Array<{ shipping_profile_id: number }> };
      if (profilesData.results && profilesData.results.length > 0) {
        listingBody.shipping_profile_id = profilesData.results[0].shipping_profile_id;
      }
    }
  } catch {}

  const createRes = await fetch(`${base}/shops/${shopId}/listings`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(listingBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    return { success: false, error: `Etsy create listing failed (${createRes.status}): ${errText}` };
  }

  const result = await createRes.json() as { listing_id: number; url: string };
  const listingId = String(result.listing_id);

  if (surface.images && surface.images.length > 0) {
    for (const imageUrl of surface.images.slice(0, 10)) {
      try {
        if (!imageUrl.startsWith('https://')) continue;
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const formData = new FormData();
          formData.append('image', new Blob([imgBuffer]), 'product.jpg');

          await fetch(`${base}/shops/${shopId}/listings/${listingId}/images`, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Authorization': `Bearer ${accessToken}`,
            },
            body: formData as any,
          });
        }
      } catch (imgErr) {
        console.warn('[MarketplaceSync] Etsy image upload skipped:', imgErr);
      }
    }
  }

  return {
    success: true,
    externalListingId: listingId,
    externalUrl: result.url || `https://www.etsy.com/listing/${listingId}`,
  };
}

async function callEtsyUpdate(externalListingId: string, surface: SurfaceDoc, account: AccountDoc): Promise<MarketplaceResult> {
  const apiKey = process.env.ETSY_API_KEYSTRING;
  const accessToken = process.env.ETSY_ACCESS_TOKEN;
  const shopId = account.shopId || process.env.ETSY_SHOP_ID;

  if (!apiKey || !accessToken || !shopId) {
    return { success: false, error: 'Etsy API credentials not configured' };
  }

  const base = 'https://api.etsy.com/v3/application';

  const updateRes = await fetch(`${base}/shops/${shopId}/listings/${externalListingId}`, {
    method: 'PATCH',
    headers: {
      'x-api-key': apiKey,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: surface.title.substring(0, 140),
      description: surface.description.substring(0, 65535),
      price: surface.retailPrice,
      tags: (surface.tags || []).slice(0, 13),
    }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return { success: false, error: `Etsy update listing failed (${updateRes.status}): ${errText}` };
  }

  return {
    success: true,
    externalListingId,
    externalUrl: `https://www.etsy.com/listing/${externalListingId}`,
  };
}

async function callEtsyDelete(externalListingId: string, account: AccountDoc): Promise<MarketplaceResult> {
  const apiKey = process.env.ETSY_API_KEYSTRING;
  const accessToken = process.env.ETSY_ACCESS_TOKEN;
  const shopId = account.shopId || process.env.ETSY_SHOP_ID;

  if (!apiKey || !accessToken || !shopId) {
    return { success: false, error: 'Etsy API credentials not configured' };
  }

  const base = 'https://api.etsy.com/v3/application';

  const deleteRes = await fetch(`${base}/shops/${shopId}/listings/${externalListingId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': apiKey, 'Authorization': `Bearer ${accessToken}` },
  });

  if (!deleteRes.ok && deleteRes.status !== 404) {
    const errText = await deleteRes.text();
    return { success: false, error: `Etsy delete failed (${deleteRes.status}): ${errText}` };
  }

  return { success: true };
}

async function callEbayCreate(surface: SurfaceDoc, account: AccountDoc): Promise<MarketplaceResult> {
  const accessToken = process.env.EBAY_ACCESS_TOKEN;
  if (!accessToken) {
    return { success: false, error: 'EBAY_ACCESS_TOKEN not configured' };
  }

  const sku = `QRGEAR-${surface.sku || surface.masterProductId.substring(0, 8)}`.toUpperCase();
  const inventoryApi = 'https://api.ebay.com/sell/inventory/v1';
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Language': 'en-US',
    'Accept': 'application/json',
  };

  const inventoryItem = {
    sku,
    product: {
      title: surface.title.substring(0, 80),
      description: surface.description.substring(0, 4000),
      aspects: { Brand: ['QR Gear'], Type: ['Apparel'] },
      imageUrls: (surface.images || []).slice(0, 12),
    },
    condition: 'NEW',
    availability: { shipToLocationAvailability: { quantity: 999 } },
  };

  const invRes = await fetch(`${inventoryApi}/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(inventoryItem),
  });

  if (!invRes.ok) {
    const errText = await invRes.text();
    return { success: false, error: `eBay inventory creation failed (${invRes.status}): ${errText}` };
  }

  const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
  const offerData = {
    sku,
    marketplaceId,
    format: 'FIXED_PRICE',
    listingDescription: surface.description.substring(0, 4000),
    categoryId: process.env.EBAY_DEFAULT_CATEGORY_ID || '1059',
    listingPolicies: {
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID || '',
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID || '',
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID || '',
    },
    pricingSummary: { price: { value: surface.retailPrice.toFixed(2), currency: 'USD' } },
    quantityLimitPerBuyer: 10,
  };

  const offerRes = await fetch(`${inventoryApi}/offer`, {
    method: 'POST',
    headers,
    body: JSON.stringify(offerData),
  });

  if (!offerRes.ok) {
    const errText = await offerRes.text();
    return { success: false, error: `eBay offer creation failed (${offerRes.status}): ${errText}` };
  }

  const offerResult = await offerRes.json() as { offerId: string };

  const publishRes = await fetch(`${inventoryApi}/offer/${offerResult.offerId}/publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!publishRes.ok) {
    const errText = await publishRes.text();
    return { success: false, error: `eBay publish failed (${publishRes.status}): ${errText}` };
  }

  const publishResult = await publishRes.json() as { listingId: string };

  return {
    success: true,
    externalListingId: publishResult.listingId,
    externalUrl: `https://www.ebay.com/itm/${publishResult.listingId}`,
  };
}

async function callEbayDelete(externalListingId: string): Promise<MarketplaceResult> {
  const accessToken = process.env.EBAY_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: 'EBAY_ACCESS_TOKEN not configured' };

  const inventoryApi = 'https://api.ebay.com/sell/inventory/v1';
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    const offersRes = await fetch(`${inventoryApi}/offer?marketplace_id=${process.env.EBAY_MARKETPLACE_ID || 'EBAY_US'}&limit=100`, { headers });
    if (offersRes.ok) {
      const offersData = await offersRes.json() as { offers?: Array<{ offerId: string; sku: string; listing?: { listingId: string } }> };
      const match = offersData.offers?.find(o => o.listing?.listingId === externalListingId);
      if (match) {
        await fetch(`${inventoryApi}/offer/${match.offerId}/withdraw`, { method: 'POST', headers, body: '{}' }).catch(() => {});
        await fetch(`${inventoryApi}/offer/${match.offerId}`, { method: 'DELETE', headers }).catch(() => {});
        await fetch(`${inventoryApi}/inventory_item/${encodeURIComponent(match.sku)}`, { method: 'DELETE', headers }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[MarketplaceSync] eBay delete cleanup error (non-fatal):', err);
  }

  return { success: true };
}

async function callAmazonCreate(surface: SurfaceDoc, account: AccountDoc): Promise<MarketplaceResult> {
  const clientId = process.env.AMAZON_SP_CLIENT_ID;
  const refreshToken = process.env.AMAZON_SP_REFRESH_TOKEN;
  const sellerId = process.env.AMAZON_SELLER_ID;

  if (!clientId || !refreshToken || !sellerId) {
    return { success: false, error: 'Amazon SP-API credentials not configured (AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, AMAZON_SP_REFRESH_TOKEN, AMAZON_SELLER_ID)' };
  }

  const sku = `QG-${(surface.sku || surface.masterProductId).substring(0, 12)}`.toUpperCase();
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'ATVPDKIKX0DER';

  const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET || '',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return { success: false, error: `Amazon token refresh failed: ${errText}` };
  }

  const tokenData = await tokenRes.json() as { access_token: string };

  const endpoint = 'https://sellingpartnerapi-na.amazon.com';
  const listingData = {
    productType: 'SHIRT',
    requirements: 'LISTING',
    attributes: {
      condition_type: [{ value: 'new_new' }],
      item_name: [{ value: surface.title.substring(0, 500), language_tag: 'en_US' }],
      product_description: [{ value: surface.description.substring(0, 2000), language_tag: 'en_US' }],
      brand: [{ value: 'QR Gear', language_tag: 'en_US' }],
      purchasable_offer: [{
        currency: 'USD',
        our_price: [{ schedule: [{ value_with_tax: surface.retailPrice }] }],
      }],
      fulfillment_availability: [{ fulfillment_channel_code: 'DEFAULT', quantity: 999 }],
    },
  };

  const listRes = await fetch(
    `${endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(sku)}?marketplaceIds=${marketplaceId}`,
    {
      method: 'PUT',
      headers: {
        'x-amz-access-token': tokenData.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(listingData),
    }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    return { success: false, error: `Amazon listing creation failed (${listRes.status}): ${errText}` };
  }

  return {
    success: true,
    externalListingId: sku,
    externalUrl: `https://sellercentral.amazon.com/skucentral?mSku=${encodeURIComponent(sku)}`,
  };
}

async function callAmazonDelete(externalListingId: string): Promise<MarketplaceResult> {
  const clientId = process.env.AMAZON_SP_CLIENT_ID;
  const clientSecret = process.env.AMAZON_SP_CLIENT_SECRET;
  const refreshToken = process.env.AMAZON_SP_REFRESH_TOKEN;
  const sellerId = process.env.AMAZON_SELLER_ID;
  const marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'ATVPDKIKX0DER';

  if (!clientId || !refreshToken || !sellerId) {
    return { success: false, error: 'Amazon SP-API credentials not configured' };
  }

  try {
    const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret || '',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return { success: false, error: `Amazon token refresh failed: ${errText}` };
    }

    const tokenData = await tokenRes.json() as { access_token: string };
    const endpoint = 'https://sellingpartnerapi-na.amazon.com';

    const deleteRes = await fetch(
      `${endpoint}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(externalListingId)}?marketplaceIds=${marketplaceId}`,
      {
        method: 'DELETE',
        headers: {
          'x-amz-access-token': tokenData.access_token,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!deleteRes.ok && deleteRes.status !== 404) {
      const errText = await deleteRes.text();
      return { success: false, error: `Amazon delete failed (${deleteRes.status}): ${errText}` };
    }
  } catch (err) {
    console.warn('[MarketplaceSync] Amazon delete error (non-fatal):', err);
  }

  return { success: true };
}

async function dispatchCreate(platform: MarketplacePlatform, surface: SurfaceDoc, account: AccountDoc): Promise<MarketplaceResult> {
  switch (platform) {
    case 'etsy': return callEtsyCreate(surface, account);
    case 'ebay': return callEbayCreate(surface, account);
    case 'amazon': return callAmazonCreate(surface, account);
    default: return { success: false, error: `Unsupported platform: ${platform}` };
  }
}

async function dispatchUpdate(platform: MarketplacePlatform, externalListingId: string, surface: SurfaceDoc, account: AccountDoc): Promise<MarketplaceResult> {
  switch (platform) {
    case 'etsy': return callEtsyUpdate(externalListingId, surface, account);
    case 'ebay': return { success: false, error: 'eBay update requires offer scan — use full_sync instead' };
    case 'amazon': return callAmazonCreate(surface, account);
    default: return { success: false, error: `Unsupported platform: ${platform}` };
  }
}

async function dispatchDelete(platform: MarketplacePlatform, externalListingId: string, account: AccountDoc): Promise<MarketplaceResult> {
  switch (platform) {
    case 'etsy': return callEtsyDelete(externalListingId, account);
    case 'ebay': return callEbayDelete(externalListingId);
    case 'amazon': return callAmazonDelete(externalListingId);
    default: return { success: false, error: `Unsupported platform: ${platform}` };
  }
}

export async function executeSyncJob(jobId: string): Promise<void> {
  const jobRef = db.collection(MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    console.error(`[MarketplaceSync] Job ${jobId} not found`);
    return;
  }

  const job = jobSnap.data() as SyncJobDoc;

  if (job.status !== 'queued' && job.status !== 'failed') {
    console.warn(`[MarketplaceSync] Job ${jobId} is ${job.status}, skipping`);
    return;
  }

  if (job.attempts >= job.maxAttempts) {
    await updateJobStatus(jobId, 'failed', { errorMessage: `Max attempts (${job.maxAttempts}) reached` });
    await updateListingStatus(job.listingId, { status: 'error', errorMessage: `Sync failed after ${job.maxAttempts} attempts` });
    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error', `Job exhausted ${job.maxAttempts} attempts`);
    return;
  }

  const now = new Date().toISOString();
  await updateJobStatus(jobId, 'running', {
    attempts: job.attempts + 1,
    lastAttemptAt: now,
  });
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

  let result: MarketplaceResult;

  try {
    switch (job.action) {
      case 'create':
        result = await dispatchCreate(job.platform, surface, account);
        break;

      case 'update':
      case 'full_sync':
        if (!listing.externalListingId) {
          await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info', 'No external listing exists — creating instead of updating');
          result = await dispatchCreate(job.platform, surface, account);
        } else {
          result = await dispatchUpdate(job.platform, listing.externalListingId, surface, account);
        }
        break;

      case 'delete':
        if (!listing.externalListingId) {
          result = { success: true };
          await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info', 'No external listing to delete');
        } else {
          result = await dispatchDelete(job.platform, listing.externalListingId, account);
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

    await updateJobStatus(jobId, finalStatus, {
      errorMessage: result.error,
      ...(canRetry ? {} : { completedAt }),
    });

    await updateListingStatus(job.listingId, {
      status: canRetry ? 'syncing' : 'error',
      errorMessage: result.error,
      lastSyncAt: completedAt,
    });

    await writeLog(jobId, job.listingId, job.accountId, job.platform, 'error',
      `${job.action} failed: ${result.error}`,
      { attempt: job.attempts + 1, maxAttempts: job.maxAttempts, canRetry }
    );

    if (canRetry) {
      await writeLog(jobId, job.listingId, job.accountId, job.platform, 'info',
        `Will retry (attempt ${job.attempts + 2}/${job.maxAttempts})`
      );
      setTimeout(() => {
        executeSyncJob(jobId).catch((e) =>
          console.error(`[MarketplaceSync] Retry failed for job ${jobId}:`, e)
        );
      }, Math.min(5000 * Math.pow(2, job.attempts), 60000));
    }
  }
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
    updatedAt: new Date().toISOString(),
  });

  executeSyncJob(jobId).catch((e) =>
    console.error(`[MarketplaceSync] Retry execution failed for job ${jobId}:`, e)
  );

  return { success: true };
}
