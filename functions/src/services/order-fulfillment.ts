import { randomUUID } from 'crypto';
import { db } from '../core';
import { printfulClient, PrintfulApiError, type PrintfulOrder, type PrintfulOrderFile } from './printful';
import { requireLiveCommerce } from '../runtime-config';
import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import { requireFulfillmentProvider } from '../../../shared/fulfillmentSettings';
import { inspectGrfAsset } from '../../../shared/GRF_engine';
import { detectPrintMethod } from '../../../shared/placements';
import { selectCatalogSaleVariant } from './catalog-sale-variants';
import { validatePacketComposition } from './assembly-store';
import { getCatalogInstancePrice, getSizeUpcharges } from './pricing';
import { dynamicsPrintSource, prepareDynamicsOrderItems } from './dynamics-order';
import { QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';

/** Freeze server-owned catalog data, never cart-supplied prices or provider IDs. */
export async function resolveSaleItem(cart: any) {
  const c = cart.customization || {};
  const memberPacketId = c.memberPacketId;
  const instanceId = memberPacketId || c.instanceId || c.linkId || c.productId;
  if (typeof instanceId !== 'string' || !instanceId || instanceId.includes('/')) throw new Error('The cart item needs a saved catalog product.');
  if (!Number.isSafeInteger(cart.quantity) || cart.quantity <= 0) throw new Error('Choose a positive whole-number quantity.');
  const instance = (await db.collection(memberPacketId ? 'member_packets' : 'admin_catalog_instances').doc(instanceId).get()).data();
  if (!instance || instance.isVisible === false || instance.isActive === false || ['archived', 'deleted'].includes(instance.status)) throw new Error('This catalog product is unavailable.');
  if (memberPacketId && instance.status !== 'published') throw new Error('This member product is not published.');
  const packetId = memberPacketId ? instance.productionPacketId : instance.currentPacketId;
  if (!packetId) throw new Error('Product has no saved production packet.');
  const packet = (await db.collection('productPackets').doc(packetId).get()).data();
  if (!packet) throw new Error('Production packet is missing.');
  if (memberPacketId && (packet.status !== 'published' || packet.memberId !== instance.memberId || packet.memberPacketId !== memberPacketId)) throw new Error('Member production ownership does not match.');
  await validatePacketComposition(db, packetId, packet);
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  if (!snapshot.layoutConfig.selectedPlacements.includes('label_inside')) throw new Error('Restore the required inside brand label in Admin Pricing before selling this product.');
  const provider = requireFulfillmentProvider(snapshot.metadata.fulfillmentProvider);
  if (packet.fulfillmentProvider !== provider) throw new Error('Saved product provider differs from its production packet.');
  // Adapter availability is a capability check, never a default or a reroute.
  if (provider !== 'printful') throw new Error(`The ${provider} checkout handoff needs validation before this product can be sold. Select a Printful build or finish that integration.`);
  const masterId = snapshot.metadata.selectedProductDocId;
  const master = (await db.collection('master_catalog').doc(masterId).get()).data();
  if (!master || master.isActive === false) throw new Error('Product blank is unavailable.');
  const size = c.productSize, color = c.productColor;
  if (typeof size !== 'string' || !size || typeof color !== 'string' || !color) throw new Error('Choose a size and color.');
  const { key: variantKey, mapping } = selectCatalogSaleVariant(memberPacketId ? { enabledColors: [packet.selectedColor], enabledSizes: [size] } : instance, master, provider, size, color);
  const files: PrintfulOrderFile[] = [];
  for (const placement of snapshot.layoutConfig.selectedPlacements) {
    const layout = snapshot.layoutConfig.providerLayouts?.[placement];
    const spec = master.qrgPrintSpecs?.printful?.locations?.find((p: any) => p.id === placement && p.provider === provider && typeof p.providerPlacementId === 'string' && typeof layout?.providerPlacementId === 'string' && detectPrintMethod(p.providerPlacementId) === detectPrintMethod(layout?.providerPlacementId || ''));
    const width = layout?.dimensions?.widthPx, height = layout?.dimensions?.heightPx;
    const dpi = layout?.dimensions?.dpi, target = spec?.dimensions;
    if (layout?.provider !== provider || !spec?.verifiedVariantIds?.includes(Number(mapping.variantId)) || !(width > 0 && height > 0 && dpi > 0 && target?.dpi > 0) || width / dpi !== target.widthPx / target.dpi || height / dpi !== target.heightPx / target.dpi || dpi < target.dpi) throw new Error(`Refresh and regenerate the verified Printful print area for ${placement}.`);
    const grfId = packet.placementGrfIds?.[placement];
    const asset = grfId ? (await db.collection('grf_assets').doc(grfId).get()).data() : null;
    const url = packet.placementGraphicUrls?.[placement];
    if (!asset || asset.isActive === false || inspectGrfAsset(asset).length || asset.grfId !== grfId || asset.publicUrl !== url || !/^https:\/\//.test(url)) throw new Error(`Registered print artwork is missing for ${placement}.`);
    if (files.some(file => file.type === spec.providerPlacementId)) throw new Error('Multiple files target the same print area.');
    files.push({ type: spec.providerPlacementId, url, position: { area_width: target.widthPx, area_height: target.heightPx, width: target.widthPx, height: target.heightPx, top: 0, left: 0 } });
  }
  if (!files.length) throw new Error('Product has no production artwork.');
  const price = memberPacketId ? Number(packet.pricing?.customerPrice) + ((await getSizeUpcharges())[size] ?? 0) : await getCatalogInstancePrice(instanceId, size);
  if (price === null || !Number.isFinite(price) || price <= 0) throw new Error('Product has no saved sale price.');
  const unitAmount = Math.round(price * 100);
  const productTitle = instance.resolved?.title || packet.adminCatalogTitle || packet.title;
  if (!productTitle) throw new Error('Product needs a saved title.');
  const dynamics = packet.composeInstanceId ? (await db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(packet.composeInstanceId).get()).data() : null;
  if (snapshot.qrConfig.qrProductState === 'qr_compose' && (!dynamics || dynamics.status !== 'active')) throw new Error('The QR Compose sequence is unavailable.');
  return { cartItemId: cart.id, productId: instanceId, packetId, masterId, assemblyId: packet.assemblyId,
    qrExperience: { version: 1, sourceHash: dynamicsPrintSource(packet), composeMode: dynamics?.composeMode || 'auto-rotate', slots: dynamics?.slots || [] },
    productCost: Number(packet.pricing?.subtotal || 0), creatorMemberId: memberPacketId ? instance.memberId : '',
    productTitle, quantity: cart.quantity, unitAmount, price: (unitAmount / 100).toFixed(2),
    customization: { productSize: size, productColor: color, instanceId, packetId },
    fulfillment: { provider, variantKey, productId: Number(mapping.productId), variantId: Number(mapping.variantId), files } };
}

export async function verifyProviderItems(items: Awaited<ReturnType<typeof resolveSaleItem>>[]) {
  const products = new Map<number, Awaited<ReturnType<typeof printfulClient.getProduct>>>();
  for (const item of items) {
    const id = item.fulfillment.productId;
    if (!products.has(id)) products.set(id, await printfulClient.getProduct(id));
    const product = products.get(id)!;
    const variant = product.variants?.find(v => v.id === item.fulfillment.variantId);
    if (!variant || variant.in_stock === false) throw new Error(`${item.productTitle}: the selected Printful variant is unavailable.`);
    const placements = product.product?.files;
    if (!Array.isArray(placements) || item.fulfillment.files.some(file => !placements.some(p => p.type === file.type))) throw new Error(`${item.productTitle}: Printful no longer supports a saved print placement. Refresh the build before selling it.`);
  }
}

function providerUpdates(remote: PrintfulOrder) {
  if (!remote?.id || !remote.status) throw new Error('Printful returned an incomplete order.');
  const states: Record<string, string> = { draft: 'paid', pending: 'routed', inprocess: 'in_production', partial: 'partially_shipped', fulfilled: 'shipped', failed: 'fulfillment_failed', canceled: 'cancelled', onhold: 'on_hold' };
  const shipments = remote.shipments || [];
  return { providerOrderId: String(remote.id), routedProvider: 'printful', providerStatus: remote.status,
    status: states[remote.status] || 'on_hold', shipments,
    trackingNumber: shipments[0]?.tracking_number || null, trackingUrl: shipments[0]?.tracking_url || null,
    carrier: shipments[0]?.carrier || null, lastSyncedAt: new Date().toISOString() };
}

/** One durable order ID also identifies the remote order; retries recover, never recreate. */
export async function fulfillOrder(orderId: string) {
  requireLiveCommerce('Order production');
  const ref = db.collection('orders').doc(orderId), token = randomUUID();
  const order = await db.runTransaction(async tx => {
    const value = (await tx.get(ref)).data();
    if (!value || value.checkoutVersion !== 1 || value.paymentStatus !== 'paid' || !value.paymentVerifiedAt) throw new Error('Order must have a verified payment and frozen checkout items.');
    if (value.fulfillmentState === 'submitted') return null;
    if (value.status === 'cancelled' || value.status === 'refunded') throw new Error('Cancelled/refunded orders cannot enter production.');
    if (value.fulfillmentLeaseUntil > Date.now()) throw new Error('Fulfillment is already in progress. Retry shortly.');
    tx.update(ref, { fulfillmentLease: token, fulfillmentLeaseUntil: Date.now() + 120000, fulfillmentState: 'submitting', fulfillmentError: null });
    return value;
  });
  if (!order) return { success: true, alreadySubmitted: true };
  const release = async (updates: Record<string, any>) => db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data();
    if (latest?.fulfillmentLease !== token) throw new Error('Fulfillment lease changed; refresh this order before retrying.');
    tx.update(ref, { ...updates, fulfillmentLease: null, fulfillmentLeaseUntil: 0, updatedAt: new Date().toISOString() });
  });
  try {
    const items = (await db.collection('orderItems').where('orderId', '==', orderId).get()).docs.map(d => d.data());
    if (!items.length || items.some(item => item.fulfillment?.provider !== 'printful')) throw new Error('Order has missing or unsupported provider items.');
    const address = order.shippingAddress;
    if (!address?.name || !address.address1 || !address.city || !address.zip || !address.country) throw new Error('A complete shipping address is required.');
    let remote: PrintfulOrder | null = null;
    try { remote = await printfulClient.getOrder(`@${orderId}`); }
    catch (error) { if (!(error instanceof PrintfulApiError) || error.status !== 404) throw error; }
    if (!remote) {
      const individualItems = await prepareDynamicsOrderItems(orderId, order.userId, async () => {
        await db.runTransaction(async tx => {
          const current = (await tx.get(ref)).data();
          if (current?.fulfillmentLease !== token) throw new Error('Fulfillment lease changed; retry this order.');
          tx.update(ref, { fulfillmentLeaseUntil: Date.now() + 120000 });
        });
      });
      remote = await printfulClient.createOrder({ external_id: orderId,
      recipient: { name: address.name, address1: address.address1, address2: address.address2 || '', city: address.city,
        state_code: address.region || '', country_code: address.country, zip: address.zip, email: order.customerEmail || '', phone: address.phone || '' },
      items: individualItems });
    }
    if (remote.external_id !== orderId) throw new Error('Printful returned an order with a different external ID.');
    await ref.update({ providerOrderId: String(remote.id), routedProvider: 'printful', providerStatus: remote.status });
    if (remote.status === 'draft') remote = await printfulClient.confirmOrder(String(remote.id));
    if (!['pending', 'inprocess', 'partial', 'fulfilled'].includes(remote.status)) throw new Error(`Printful order needs attention: ${remote.status}.`);
    await release({ ...providerUpdates(remote), fulfillmentState: 'submitted', fulfillmentError: null });
    return { success: true, providerOrderId: String(remote.id) };
  } catch (error: any) {
    await release({ fulfillmentState: 'failed', fulfillmentError: error.message });
    throw error;
  }
}

export async function syncFulfillment(orderId: string) {
  const ref = db.collection('orders').doc(orderId), order = (await ref.get()).data();
  if (!order || order.routedProvider !== 'printful' || !order.providerOrderId) throw new Error('No Printful order has been submitted.');
  const remote = await printfulClient.getOrder(String(order.providerOrderId));
  if (remote.external_id !== orderId) throw new Error('Provider order identity does not match.');
  const updates = providerUpdates(remote);
  await ref.update(updates);
  return updates;
}
