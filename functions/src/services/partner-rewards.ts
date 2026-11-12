import { createHash, randomUUID } from 'crypto';
import { db } from '../core';
import { partnerStoreId, publicPartner } from './partner-api';
import { readStoreProducts } from './store-products';
import { preparePartnerBuild, saveMemberArtwork, commitOwnerBuild } from './member-build';
import { renderSavedProductGraphic } from './product-graphic-renderer';
import { resolveRuntimeConfig } from '../runtime-config';
import { resolveSaleItem, verifyProviderItems, fulfillOrder, syncFulfillment } from './order-fulfillment';
import { decodeLibraryImage } from './image-validation';
import { registerGrfAsset } from './grf-registrar';
import { originalGrfParams } from '../../../shared/GRF_engine';
import { rewardGraphicInput } from './reward-graphic-input';

function fail(message: string, status = 409): never { throw Object.assign(new Error(message), { status }); }
const validId = (value: any) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const receiptRef = (partner: any, claimId: string) => db.collection('partnerStores').doc(partner.id).collection('rewardClaims').doc(claimId);
const ownerRef = (partner: any, customerRef: string) => digest(`${partner.id}:${customerRef}`);

export async function partnerRewardProducts(partner: any, channelId: any) {
  if (!partner.storeId || !validId(channelId)) fail('Connect a named external store and Rewards channel.', 400);
  const storeId = await partnerStoreId(db, partner);
  const channel = (await db.collection('storeChannels').doc(channelId).get()).data();
  if (!channel || channel.storeId !== storeId || channel.isActive === false) fail('Rewards channel unavailable for this partner.', 404);
  const catalog = await readStoreProducts(db, storeId);
  if (!catalog.configured || !catalog.catalogId) fail('Assign this store its reward catalog first.');
  return { store: publicPartner(partner), catalogId: catalog.catalogId, products: catalog.products.map((p: any) => ({
    ...p, id: p.canonicalBlankKey, name: p.title, description: p.description ?? '', storeId, channelId,
    availableColors: p.availableColors.map((c: any) => c.name), optionsError: p.pricingError || null,
    // Catalog images describe the blank; only saved personalized packets are previews.
    mockupsByColor: {},
  })) };
}

function previewInput(input: any) {
  for (const name of ['claimId', 'customerRef', 'channelId', 'productId', 'sourceHash']) if (!validId(input[name])) fail(`Invalid ${name}.`, 400);
  if (typeof input.color !== 'string' || !input.color || input.color.length > 120 || typeof input.size !== 'string' || !input.size || input.size.length > 40) fail('Choose a color and size.', 400);
  if (!['full', 'qr-only'].includes(input.graphicChoice)) fail('Choose full graphic or QR code only.', 400);
  let url: URL;
  try { url = new URL(input.websiteUrl); } catch { return fail('A verified live website URL is required.', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 500) fail('Use the verified HTTPS website.', 400);
  const logo = decodeLibraryImage(input.logoData, 'image/png');
  if (Buffer.from(logo.imageData, 'base64').length > 3_000_000) fail('The approved logo is too large.', 400);
  return { claimId: input.claimId as string, customerRef: input.customerRef as string, channelId: input.channelId as string,
    graphicChoice: input.graphicChoice as string, sourceHash: input.sourceHash as string, productId: input.productId as string, color: input.color as string, size: input.size as string,
    websiteUrl: url.href, logoData: `data:image/png;base64,${logo.imageData}` };
}
function projectReceipt(value: any) {
  return { claimId: value.claimId, status: value.status, previewId: value.revision, packetId: value.status === 'ready' || value.orderId ? value.packetId : null,
    graphicChoice: value.graphicChoice, sourceHash: value.sourceHash, productId: value.productId, color: value.color, size: value.size, websiteUrl: value.websiteUrl,
    mockupUrl: value.status === 'ready' || value.orderId ? value.mockupUrl || null : null,
    artworkUrl: value.status === 'ready' || value.orderId ? value.artworkUrl || null : null,
    orderId: value.orderId || null, error: value.status === 'failed' ? 'Your personalized preview could not be generated. Please retry.' : null,
    tracking: value.tracking || null };
}
export async function partnerRewardStatus(partner: any, claimId: any, customerRef: any) {
  if (!validId(claimId) || !validId(customerRef)) fail('Invalid reward reference.', 400);
  const ref = receiptRef(partner, claimId), value = (await ref.get()).data();
  if (!value) fail('Reward preview not found.', 404);
  if (value.customerRef !== customerRef) fail('Reward belongs to another customer.', 403);
  if (value.orderId) {
    const order = (await db.collection('orders').doc(value.orderId).get()).data();
    if (!order || order.funding?.partnerId !== partner.id || order.funding?.claimId !== claimId) fail('Reward order binding differs.');
    if (order.providerOrderId) await syncFulfillment(value.orderId);
    const latest = (await db.collection('orders').doc(value.orderId).get()).data()!;
    const status = ['shipped', 'partially_shipped'].includes(latest.status) ? 'shipped' : latest.fulfillmentState === 'submitted' ? 'ordered' : 'approved';
    const tracking = { number: latest.trackingNumber || null, url: latest.trackingUrl || null, carrier: latest.carrier || null };
    await ref.update({ status, tracking }); return projectReceipt({ ...value, status, tracking });
  }
  if (value.status === 'pending' && !(value.leaseUntil > Date.now())) { await ref.update({ status: 'failed', lease: null, leaseUntil: 0 }); return projectReceipt({ ...value, status: 'failed' }); }
  return projectReceipt(value);
}

/** A stable receipt owns revisions; a retry uses the same packet and provider cache. */
export async function partnerRewardPreview(partner: any, raw: any) {
  const input = previewInput(raw);
  const offers = await partnerRewardProducts(partner, input.channelId);
  const offer = offers.products.find((p: any) => p.id === input.productId);
  if (!offer || offer.optionsError || !offer.availableVariants.some((v: any) => v.color === input.color && v.size === input.size)) fail('This catalog variant is unavailable.');
  const product = (await readStoreProducts(db, partner.storeId)).products.find((p: any) => p.id === input.productId)!;
  const placement = product.placements.find((p: any) => p.id === 'front');
  if (!placement || product.fulfillmentProvider !== 'printful') fail('This reward needs a verified Printful front print area.');
  const revision = digest(JSON.stringify({ ...input, catalogId: offers.catalogId, layout: placement, recipeVersion: 1 }));
  const packetId = `reward-${digest(`${partner.id}:${input.claimId}:${revision}`).slice(0, 48)}`;
  const ref = receiptRef(partner, input.claimId), lease = randomUUID();
  const claimed = await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data();
    if (old && old.customerRef !== input.customerRef) fail('Reward belongs to another customer.', 403);
    if (old?.orderId) { if (old.revision !== revision) fail('This reward has already been approved.'); return old; }
    if (old?.revision === revision && old.status === 'ready') return old;
    if (old && old.leaseUntil > Date.now()) { if (old.revision !== revision) fail('Your previous preview is still generating. Retry shortly.'); return { ...old, status: 'pending' }; }
    const { logoData, ...savedInput } = input;
    tx.set(ref, { ...savedInput, partnerId: partner.id, storeId: partner.storeId, revision, packetId, lease, leaseUntil: Date.now() + 540000,
      status: 'pending', createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    return null;
  });
  if (claimed) return projectReceipt(claimed);
  try {
    const owner = ownerRef(partner, input.customerRef);
    const logo = await registerGrfAsset({ sourceUrl: input.logoData, ...originalGrfParams('image/png'), mimeType: 'image/png', createdBy: owner });
    const graphic = rewardGraphicInput(placement, input.websiteUrl, logo.publicUrl, `${resolveRuntimeConfig().origin}/img/qr-gear-mark.png`);
    const build = await preparePartnerBuild(owner, {
      packetType: 'qr-plus', boundProduct: { canonicalBlankKey: input.productId }, title: offer.name, description: offer.description,
      selectedColor: input.color, selectedShirtSize: input.size, selectedPlacements: ['front'], graphicSize: 'large',
      ...graphic, perPlacementConfigs: { front: { graphicChoice: input.graphicChoice } },

    }, { product, packetId, partnerId: partner.id, claimId: input.claimId });
    const packet = (await db.collection('productPackets').doc(packetId).get()).data()!;
    if (packet.status !== 'ready') {
      for (const place of build.builderSnapshot.layoutConfig.selectedPlacements) {
        if (place.startsWith('label_') || packet.placementGraphicUrls?.[place]) continue;
        const image = await renderSavedProductGraphic(build.builderSnapshot, build.qrContent, place);
        await saveMemberArtwork(owner, packetId, place, image, 'owner');
      }
    }
    const built = await commitOwnerBuild(owner, packetId);
    const result = { status: 'ready', mockupUrl: built.mockupUrl, artworkUrl: built.compositeUrl, lease: null, leaseUntil: 0, updatedAt: new Date().toISOString() };
    await db.runTransaction(async tx => { const latest = (await tx.get(ref)).data(); if (latest?.lease !== lease) fail('Reward preview changed. Refresh to resume.'); tx.update(ref, result); });
    return projectReceipt({ ...input, revision, packetId, ...result });
  } catch (error) {
    await db.runTransaction(async tx => { const latest = (await tx.get(ref)).data(); if (latest?.lease === lease) tx.update(ref, { status: 'failed', lease: null, leaseUntil: 0 }); });
    throw error;
  }
}

/** The partner attests paid website eligibility; QR Gear supplies the frozen production. */
export async function approvePartnerReward(partner: any, input: any) {
  for (const key of ['claimId', 'customerRef', 'previewId']) if (!validId(input[key])) fail('Invalid reward approval.', 400);
  if (partner.sponsoredRewards !== true) fail('Fluba-funded production has not been enabled for this partner.', 403);
  const ref = receiptRef(partner, input.claimId), saved = (await ref.get()).data();
  if (!saved || saved.customerRef !== input.customerRef) fail('Reward unavailable for this customer.', 403);
  if (saved.revision !== input.previewId || (!saved.orderId && saved.status !== 'ready')) fail('Approve the current personalized preview first.');
  const authorization = input.authorization;
  if (!validId(authorization?.websiteOrderId) || typeof authorization?.verifiedAt !== 'string' || !Number.isFinite(Date.parse(authorization.verifiedAt))) fail('Verified website payment evidence is required.', 403);
  await partnerRewardProducts(partner, saved.channelId).then(result => {
    const product = result.products.find((p: any) => p.id === saved.productId);
    if (!product || product.optionsError || !product.availableVariants.some((v: any) => v.color === saved.color && v.size === saved.size)) fail('The approved catalog variant is no longer available.');
  });
  const address: Record<string, string> = {};
  for (const key of ['name', 'address1', 'city', 'region', 'postalCode', 'country']) {
    if (typeof input.shipping?.[key] !== 'string' || !input.shipping[key].trim() || input.shipping[key].length > 160) fail('Complete your shipping address.', 400);
    address[key] = input.shipping[key].trim();
  }
  if (!/^[A-Z]{2}$/.test(address.country)) fail('Use a two-letter country code.', 400);
  address.address2 = typeof input.shipping.address2 === 'string' ? input.shipping.address2.slice(0,160) : '';
  // Printful external_id is limited to 32 characters (developers.printful.com/docs/#tag/Orders-API).
  const orderId = `reward-${digest(`${partner.id}:${input.claimId}`).slice(0,25)}`, orderRef = db.collection('orders').doc(orderId);
  if (!saved.orderId) {
    const item = await resolveSaleItem({ id: orderId, quantity: 1, customization: { productColor: saved.color, productSize: saved.size } }, { packetId: saved.packetId, ownerId: ownerRef(partner, saved.customerRef) });
    await verifyProviderItems([item]);
    const { frozenProduction, ...line } = item;
    const now = new Date().toISOString();
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data(), existing = await tx.get(orderRef), sponsor = (await tx.get(db.collection('partnerStores').doc(partner.id))).data();
      if (sponsor?.isActive !== true || sponsor.sponsoredRewards !== true || sponsor.storeId !== saved.storeId) fail('Sponsor authorization changed.', 403);
      if (!current || current.revision !== input.previewId || current.customerRef !== input.customerRef) fail('Reward approval changed.');
      if (existing.exists) { if (existing.data()?.funding?.claimId !== input.claimId) fail('Order identity differs.'); return; }
      tx.create(orderRef, { id: orderId, source: 'partner_reward', sourceChannel: 'partner', userId: ownerRef(partner, saved.customerRef), checkoutVersion: 1,
        paymentStatus: 'sponsored', funding: { type: 'partner_sponsored', partnerId: partner.id, claimId: input.claimId, previewId: input.previewId, authorization, authorizedAt: now },
        status: 'approved', fulfillmentState: 'pending', amountTotalCents: 0, currency: 'usd', customerChargeCents: 0,
        shippingAddress: { ...address, zip: address.postalCode }, productTitle: item.productTitle, createdAt: now, updatedAt: now });
      tx.create(db.collection('orderItems').doc(orderId), { ...line, id: orderId, orderId });
      tx.create(db.collection('orderProductionSources').doc(orderId), { ...frozenProduction, orderId });
      tx.update(ref, { orderId, status: 'approved', approvedAt: now });
    });
  }
  await fulfillOrder(orderId);
  return partnerRewardStatus(partner, input.claimId, input.customerRef);
}
