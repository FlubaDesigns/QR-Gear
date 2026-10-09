import { calculatePacketPricing, withInsideLabel } from './pricing';
import { QR_GEAR_BRANDED_TAG_URL } from '../core';
import { createGrfRegistrar } from './grf-store';
import { GRF_PACKET_SLOTS, inspectGrfAsset } from '../../../shared/GRF_engine';
import { refreshQrgProviderPricing } from './master-catalog';
import { resolveInstance } from './instance-resolver';
import { createHash } from 'node:crypto';
import { pricingSettingsSchema } from '../../../shared/schema-orders';
import { transactionReader } from './composition-validation';
import { resolveBuildDestination, destinationMetadata } from './build-destination';

/** One catalog editor for both adapters; destination changes travel with the saved build. */
export async function updateCatalogInstance(db: any, id: string, body: Record<string, any>, now: any, actor: string) {
  return db.runTransaction(async (tx: any) => {
    const ref = db.collection('admin_catalog_instances').doc(id), doc = await tx.get(ref);
    if (!doc.exists) throw new Error('Catalog item not found.');
    const existing = doc.data();
    const overrides = { ...existing.overrides, ...body.overrides, ...(body.metadata !== undefined ? { metadata: body.metadata } : {}) };
    const resolved = resolveInstance(existing.baseSnapshot, overrides);
    const update: Record<string, any> = { overrides, resolved, version: (existing.version || 0) + 1, updatedAt: now, updatedBy: actor };
    for (const [field, allowed] of [['enabledColors', resolved.colors], ['enabledSizes', resolved.sizes]] as const) {
      if (body[field] === undefined) continue;
      if (!Array.isArray(body[field]) || body[field].some((v: unknown) => typeof v !== 'string' || !allowed.includes(v))) {
        throw Object.assign(new Error(`Invalid ${field}`), { status: 400 });
      }
      update[field] = Array.from(new Set(body[field]));
    }
    for (const field of ['status','customerPrice']) if (body[field] !== undefined) update[field] = body[field];
    let packet: any = null, session: any = null, links: any = null;
    if (body.folderUpdate) {
      const destination = await resolveBuildDestination(transactionReader(db, tx), body.folderUpdate);
      Object.assign(update, destination);
      if (existing.currentPacketId) packet = await tx.get(db.collection('productPackets').doc(existing.currentPacketId));
      if (existing.sourceSessionId) session = await tx.get(db.collection('admin_build_sessions').doc(existing.sourceSessionId));
      links = existing.currentPacketId ? await tx.get(db.collection('storeProductLinks').where('packetId', '==', existing.currentPacketId)) : null;
      if (packet && (!packet.exists || (packet.data().ownerInstanceId && packet.data().ownerInstanceId !== id))) throw new Error('Catalog item and packet ownership disagree.');
      if (session && (!session.exists || (session.data().committedInstanceId && session.data().committedInstanceId !== id))) throw new Error('Catalog item and saved build ownership disagree.');
      const metadata = destinationMetadata(destination);
      if (packet) tx.update(packet.ref, { ...destination,
        ...(packet.data().builderSnapshot ? { builderSnapshot: { ...packet.data().builderSnapshot, metadata: { ...packet.data().builderSnapshot.metadata, ...metadata } } } : {}), updatedAt: now });
      if (session) tx.update(session.ref, { 'working.metadata': { ...session.data().working?.metadata, ...metadata }, updatedAt: now });
      for (const link of links?.docs || []) tx.update(link.ref, { ...destination, channel: destination.channelId, collection: destination.collectionName, updatedAt: now });
    }
    tx.update(ref, update);
    return { success: true, instanceId: id, resolved, version: update.version };
  });
}

/** Reprice saved builds from QRG costs and Admin Pricing through the canonical resolver.
 * The lookup import refreshes only QRG cost mappings. Preview never changes product prices.
 * Restores the existing inside brand artwork through the canonical GRF registrar.
 */
export async function syncCatalogMarkup(db: any, now: any, actor: string, previewToken?: string) {
  let labelAsset: {grfId:string;publicUrl:string} | undefined;
  if (previewToken) {
    const checked = await syncCatalogMarkup(db, now, actor);
    if (checked.previewToken !== previewToken) throw Object.assign(new Error('Products or saved pricing changed. Preview again before applying.'), {status:409});
    if (checked.blocked.length) throw Object.assign(new Error('Resolve the products listed in the preview before applying pricing. No prices were changed.'), {status:409});
    if (checked.products.some((p: any) => p.restoreInsideLabel)) {
      const registrar = createGrfRegistrar({db,now:()=>now,bucket:()=>{throw new Error('Brand label must use its existing artwork.');}});
      labelAsset = await registrar.registerGrfAsset({sourceUrl:QR_GEAR_BRANDED_TAG_URL,mimeType:'image/png',createdBy:actor,...GRF_PACKET_SLOTS.qrComposite});
    }
  }
  const candidates = await db.collection('admin_catalog_instances').limit(201).get();
  if (candidates.docs.length > 200) throw Object.assign(new Error('This catalog exceeds the 200-product atomic update limit. No prices were changed.'), { status: 409 });
  const imports = new Map<string, string | null>();
  for (const doc of candidates.docs) {
    const item = doc.data();
    if (['deleted', 'archived'].includes(item.status) || !item.currentPacketId) continue;
    const packet = (await db.collection('productPackets').doc(item.currentPacketId).get()).data();
    const snapshot = packet?.builderSnapshot;
    const masterId = snapshot?.metadata?.selectedProductDocId, provider = snapshot?.metadata?.fulfillmentProvider;
    const key = `${masterId}:${provider}`;
    if (imports.has(key)) continue;
    try { await refreshQrgProviderPricing(db, masterId, provider); imports.set(key, null); }
    catch (error: any) { imports.set(key, error.message); }
  }
  return db.runTransaction(async (tx: any) => {
    const settingsRef = db.collection('testSettings').doc('pricing');
    const settingsDoc = await tx.get(settingsRef);
    const settings = pricingSettingsSchema.safeParse(settingsDoc.data());
    if (!settings.success) throw Object.assign(new Error('Save valid Admin Pricing settings before previewing markup.'), { status: 409 });
    const snapshot = await tx.get(db.collection('admin_catalog_instances').limit(201));
    // Keep every instance + packet write in one transaction; never partially apply a catalog.
    if (snapshot.docs.length > 200) throw Object.assign(new Error('This catalog exceeds the 200-product atomic update limit. No prices were changed.'), { status: 409 });
    const plans: any[] = [], blocked: { id: string; title: string; reason: string }[] = [];
    const packetIds = new Set<string>();
    for (const doc of snapshot.docs) {
      const item = doc.data();
      if (['deleted', 'archived'].includes(item.status)) continue;
      const title = item.resolved?.title || item.baseSnapshot?.title || doc.id;
      const reject = (reason: string) => blocked.push({ id: doc.id, title, reason });
      if (!item.baseSnapshot || !item.currentPacketId) { reject('Missing saved product or packet.'); continue; }
      const resolved = resolveInstance(item.baseSnapshot, item.overrides || {});
      const pricing = resolved.pricing;
      if (!pricing || typeof pricing.subtotal !== 'number' || !Number.isFinite(pricing.subtotal) || pricing.subtotal < 0 ||
          typeof pricing.customerPrice !== 'number' || !Number.isFinite(pricing.customerPrice) || pricing.customerPrice <= 0) {
        reject('Recorded cost subtotal or current price is missing or invalid.'); continue;
      }
      if (item.resolved?.pricing?.customerPrice !== pricing.customerPrice || item.resolved?.pricing?.subtotal !== pricing.subtotal) {
        reject('Displayed pricing disagrees with the saved product. Repair the catalog product first.'); continue;
      }
      if (packetIds.has(item.currentPacketId)) { reject('The same packet is attached to more than one catalog product.'); continue; }
      packetIds.add(item.currentPacketId);
      const packet = await tx.get(db.collection('productPackets').doc(item.currentPacketId));
      if (!packet.exists || packet.data().ownerInstanceId !== doc.id) { reject('Product and packet ownership disagree.'); continue; }
      let updatedPricing, pricedBuild, restoreInsideLabel = false;
      const build = packet.data().builderSnapshot;
      try {
        const masterId = build?.metadata?.selectedProductDocId, provider = build?.metadata?.fulfillmentProvider;
        const importError = imports.get(`${masterId}:${provider}`);
        if (importError) throw new Error(importError);
        if (!/^qrg_[1-6][1-9]\d{3}$/.test(masterId)) throw new Error('Saved packet has no canonical QRG blank.');
        const master = (await tx.get(db.collection('master_catalog').doc(masterId))).data();
        pricedBuild = withInsideLabel(master, build);
        const labelId = packet.data().placementGrfIds?.label_inside;
        const existingLabel = labelId ? (await tx.get(db.collection('grf_assets').doc(labelId))).data() : null;
        if (labelId && (!existingLabel || existingLabel.grfId !== labelId || existingLabel.isActive === false || inspectGrfAsset(existingLabel).length || existingLabel.publicUrl !== packet.data().placementGraphicUrls?.label_inside)) throw new Error('Repair the existing registered inside-label artwork before applying pricing.');
        if (!labelId && packet.data().placementGraphicUrls?.label_inside && packet.data().placementGraphicUrls.label_inside !== QR_GEAR_BRANDED_TAG_URL) throw new Error('Register the existing custom inside-label artwork before applying pricing.');
        restoreInsideLabel = !labelId;
        updatedPricing = calculatePacketPricing(master, pricedBuild, settings.data);
      } catch (error: any) { reject(error.message); continue; }
      const customerPrice = updatedPricing.customerPrice;
      const overrides = { ...item.overrides, pricing: updatedPricing };
      plans.push({ doc, packet, item, overrides, pricedBuild, restoreInsideLabel, resolved: resolveInstance(item.baseSnapshot, overrides),
        row: { id: doc.id, title, currentPrice: pricing.customerPrice, customerPrice, subtotal: updatedPricing.subtotal, pricing: updatedPricing,
          restoreInsideLabel, changed: restoreInsideLabel || JSON.stringify(build) !== JSON.stringify(pricedBuild) || JSON.stringify(pricing) !== JSON.stringify(updatedPricing) || JSON.stringify(packet.data().pricing) !== JSON.stringify(updatedPricing) } });
    }
    plans.sort((a, b) => a.row.id.localeCompare(b.row.id));
    const token = createHash('sha256').update(JSON.stringify({ settings: settings.data,
      products: plans.map(p => [p.row, p.item.version, p.item.currentPacketId, p.resolved.pricing, p.packet.data().pricing, p.packet.data().builderSnapshot, p.packet.data().placementGraphicUrls, p.packet.data().placementGrfIds]), blocked })).digest('hex');
    if (previewToken && previewToken !== token) throw Object.assign(new Error('Products or saved pricing changed. Preview again before applying.'), { status: 409 });
    if (previewToken && blocked.length) throw Object.assign(new Error('Resolve the products listed in the preview before applying pricing. No prices were changed.'), { status: 409 });
    const changed = plans.filter(p => p.row.changed);
    if (previewToken) {
      for (const p of changed) {
        tx.update(p.doc.ref, { overrides: p.overrides, resolved: p.resolved, customerPrice: p.row.customerPrice,
          version: (p.item.version || 0) + 1, updatedAt: now, updatedBy: actor });
        tx.update(p.packet.ref, { pricing: p.resolved.pricing, customerPrice: p.row.customerPrice, updatedAt: now,
          builderSnapshot:p.pricedBuild, selectedPlacements:p.pricedBuild.layoutConfig.selectedPlacements, placements:p.pricedBuild.layoutConfig.selectedPlacements,
          ...(p.restoreInsideLabel ? {placementGraphicUrls:{...p.packet.data().placementGraphicUrls,label_inside:labelAsset!.publicUrl},placementGrfIds:{...p.packet.data().placementGrfIds,label_inside:labelAsset!.grfId}} : {}) });
      }
      if (changed.length) tx.update(settingsRef, { lastSyncedAt: now });
    }
    return { success: blocked.length === 0, dryRun: !previewToken, previewToken: token,
      productsUpdated: previewToken ? changed.length : 0, productsToUpdate: changed.length,
      markupPercent: settings.data.markupPercent, markupFixed: settings.data.markupFixed,
      products: plans.map(p => p.row), blocked };
  });
}
