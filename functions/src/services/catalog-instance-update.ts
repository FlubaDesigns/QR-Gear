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

/** Apply saved markup to recorded costs, through the same canonical instance resolver.
 * Preview and apply read the same transaction snapshot; a stale preview cannot change prices.
 * This does not regenerate production costs or publish prices to external marketplaces.
 */
export async function syncCatalogMarkup(db: any, now: any, actor: string, previewToken?: string) {
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
      const customerPrice = Math.round((pricing.subtotal * (1 + settings.data.markupPercent / 100) + settings.data.markupFixed) * 100) / 100;
      if (!Number.isFinite(customerPrice) || customerPrice <= 0) { reject('Saved markup would produce an invalid sale price.'); continue; }
      const updatedPricing = { ...pricing, markupPercent: settings.data.markupPercent, markupFixed: settings.data.markupFixed,
        markupAmount: Math.round((customerPrice - pricing.subtotal) * 100) / 100, customerPrice };
      const overrides = { ...item.overrides, pricing: updatedPricing };
      plans.push({ doc, packet, item, overrides, resolved: resolveInstance(item.baseSnapshot, overrides),
        row: { id: doc.id, title, currentPrice: pricing.customerPrice, customerPrice, subtotal: pricing.subtotal,
          changed: JSON.stringify(pricing) !== JSON.stringify(updatedPricing) || JSON.stringify(packet.data().pricing) !== JSON.stringify(updatedPricing) } });
    }
    plans.sort((a, b) => a.row.id.localeCompare(b.row.id));
    const token = createHash('sha256').update(JSON.stringify({ markupPercent: settings.data.markupPercent, markupFixed: settings.data.markupFixed,
      products: plans.map(p => [p.row, p.item.version, p.item.currentPacketId, p.resolved.pricing, p.packet.data().pricing]), blocked })).digest('hex');
    if (previewToken && previewToken !== token) throw Object.assign(new Error('Products or saved markup changed. Preview again before applying.'), { status: 409 });
    if (previewToken && blocked.length) throw Object.assign(new Error('Resolve the products listed in the preview before applying markup. No prices were changed.'), { status: 409 });
    const changed = plans.filter(p => p.row.changed);
    if (previewToken) {
      for (const p of changed) {
        tx.update(p.doc.ref, { overrides: p.overrides, resolved: p.resolved, customerPrice: p.row.customerPrice,
          version: (p.item.version || 0) + 1, updatedAt: now, updatedBy: actor });
        tx.update(p.packet.ref, { pricing: p.resolved.pricing, customerPrice: p.row.customerPrice, updatedAt: now });
      }
      if (changed.length) tx.update(settingsRef, { lastSyncedAt: now });
    }
    return { success: blocked.length === 0, dryRun: !previewToken, previewToken: token,
      productsUpdated: previewToken ? changed.length : 0, productsToUpdate: changed.length,
      markupPercent: settings.data.markupPercent, markupFixed: settings.data.markupFixed,
      products: plans.map(p => p.row), blocked };
  });
}
