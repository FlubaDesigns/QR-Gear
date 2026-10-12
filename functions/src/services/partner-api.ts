import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { insertPartnerStoreSchema } from '../../../shared/schema-stores';
import { catalogProductOptions } from './catalog-sale-variants';
import { buildPacketImageOrder } from '../../../shared/productImages';
import { publicProductText } from '../../../shared/descriptionLayers';

// The existing partner registry is shared by Admin Partners and Store Builder.
export const PARTNER_STORES_COLLECTION = 'partnerStores';
const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
const httpsUrl = z.string().url().refine(v => new URL(v).protocol === 'https:', 'Use an HTTPS URL');
const origin = httpsUrl.refine(v => new URL(v).origin === v, 'Use an origin without a path or trailing slash');
const input = insertPartnerStoreSchema.omit({ apiKey: true }).extend({
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(150),
  websiteUrl: httpsUrl.nullable().optional(),
  logoUrl: httpsUrl.nullable().optional(),
  allowedOrigins: z.array(origin).max(30).nullable().optional(),
  commissionPercent: z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine(v => Number(v) <= 100).optional(),
}).strict();
export function newPartnerApiKey() { return `psk-${randomBytes(32).toString('hex')}`; }
export function publicPartner(store: any) {
  const { id, slug, name, description, logoUrl, websiteUrl, primaryColor, accentColor, isInternal, isActive, availableSegments } = store;
  return { id, slug, name, description, logoUrl, websiteUrl, primaryColor, accentColor, isInternal, isActive, availableSegments };
}
export async function savePartner(db: any, value: unknown, id?: string) {
  const parsed = (id ? input.partial() : input).safeParse(value);
  if (!parsed.success) fail(400, parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  const data = parsed.data!;
  const ref = id ? db.collection(PARTNER_STORES_COLLECTION).doc(id) : db.collection(PARTNER_STORES_COLLECTION).doc();
  await db.runTransaction(async (tx: any) => {
    const current = id ? await tx.get(ref) : null;
    if (id && !current.exists) fail(404, 'Partner not found');
    const slug = data.slug ?? current?.data()?.slug;
    const duplicate = await tx.get(db.collection(PARTNER_STORES_COLLECTION).where('slug', '==', slug));
    if (duplicate.docs.some((d: any) => d.id !== ref.id)) fail(409, 'This partner slug is already in use');
    const now = new Date().toISOString();
    if (id) tx.update(ref, { ...data, updatedAt: now });
    else tx.create(ref, { ...data, apiKey: newPartnerApiKey(), isActive: data.isActive ?? true, isInternal: data.isInternal ?? false, createdAt: now, updatedAt: now });
  });
  const saved = await ref.get();
  return { ...saved.data(), id: saved.id };
}
export async function rotatePartnerKey(db: any, id: string) {
  const ref = db.collection(PARTNER_STORES_COLLECTION).doc(id);
  const apiKey = newPartnerApiKey();
  await db.runTransaction(async (tx: any) => {
    if (!(await tx.get(ref)).exists) fail(404, 'Partner not found');
    tx.update(ref, { apiKey, updatedAt: new Date().toISOString() });
  });
  return { success: true, apiKey };
}
export async function authenticatePartner(db: any, req: any) {
  const id = req.query.partnerId;
  if (typeof id !== 'string' || !id || id.length > 150 || id.includes('/')) fail(400, 'A valid partnerId is required');
  const key = req.headers['x-api-key'];
  // Partner keys belong on the partner backend, never in public embeds.
  if (typeof key !== 'string' || !/^psk-[a-f0-9]{64}$/.test(key)) fail(401, 'Invalid or missing partner API key');
  let doc = await db.collection(PARTNER_STORES_COLLECTION).doc(id).get();
  if (!doc.exists) {
    const matches = await db.collection(PARTNER_STORES_COLLECTION).where('slug', '==', id).limit(2).get();
    if (matches.docs.length !== 1) fail(401, 'Invalid or missing partner API key');
    doc = matches.docs[0];
  }
  const store = { ...doc.data(), id: doc.id };
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (typeof store.apiKey !== 'string' || !store.apiKey || !timingSafeEqual(hash(key), hash(store.apiKey))) fail(401, 'Invalid or missing partner API key');
  if (store.isActive !== true) fail(403, 'Partner is inactive');
  if (req.headers.origin && (!Array.isArray(store.allowedOrigins) || !store.allowedOrigins.includes(req.headers.origin))) fail(403, 'Origin is not allowed for this partner');
  return store;
}
export async function partnerProducts(db: any, store: any, query: any) {
  if (query.memberId !== undefined || query.storeId !== undefined) fail(400, 'Member storefront access requires a verified partner/member binding; it is not enabled by this endpoint');
  const channelId = query.channelId;
  if (channelId !== undefined) {
    if (typeof channelId !== 'string' || !channelId || channelId.includes('/')) fail(400, 'Invalid channelId');
    const channel = await db.collection('storeChannels').doc(channelId).get();
    if (!channel.exists || channel.data().storeId !== store.id) fail(404, 'Channel not found for this partner');
  }
  const q = db.collection('admin_catalog_instances').where('storeId', '==', store.id);
  // Equality-only store query avoids a new composite index and checks every row's ownership.
  const snap = await q.get();
  const products = [];
  for (const doc of snap.docs) {
    const instance = doc.data();
    if (instance.isActive === false || instance.isVisible === false || ['draft', 'deleted', 'archived', 'blocked'].includes(instance.status) || (channelId && instance.channelId !== channelId)) continue;
    if (!instance.currentPacketId) fail(409, `Product ${doc.id} has no saved production packet`);
    const packetDoc = await db.collection('productPackets').doc(instance.currentPacketId).get();
    if (!packetDoc.exists) fail(409, `Product ${doc.id} has a missing production packet`);
    const packet = packetDoc.data();
    const options = await catalogProductOptions(db, instance, packet);
    const price = instance.resolved?.pricing?.customerPrice ?? packet.pricing?.customerPrice;
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) fail(409, `Product ${doc.id} has no valid saved price`);
    const images = buildPacketImageOrder(packet);
    products.push({ id: doc.id, packetId: packetDoc.id, storeId: store.id, channelId: instance.channelId ?? null,
      name: publicProductText(instance.resolved?.title || packet.productName || ''),
      description: publicProductText(instance.resolved?.description || ''),
      imageUrl: images[0] ?? null, images, basePrice: Number(price), ...options,
      qrgBaseCode: instance.resolved?.qrgBaseCode ?? null,
      productPath: `/shop/product/${encodeURIComponent(doc.id)}` });
  }
  return { store: publicPartner(store), products, count: products.length };
}
