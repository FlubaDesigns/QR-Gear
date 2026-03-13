import type { Firestore } from 'firebase-admin/firestore';
import { firestoreToDate, firestoreToDateNullable, prepareForFirestore } from './firestore-adapter-helpers';
import type {
  QrDesign, InsertQrDesign,
  HostedImage, InsertHostedImage,
  HostingReminder, InsertHostingReminder,
  PricingRule, InsertPricingRule,
  HostingTier, InsertHostingTier,
  Coupon, InsertCoupon,
  QrTemplate, InsertQrTemplate,
  DynamicPage, InsertDynamicPage,
  DynamicPageAsset, InsertDynamicPageAsset,
  ProviderHealthLog, InsertProviderHealthLog,
  GiftPackage, InsertGiftPackage,
  GiftCode, InsertGiftCode,
  GiftRedemption, InsertGiftRedemption,
  EmailTemplate, InsertEmailTemplate,
  EmailLog,
} from '@shared/schema';

function docToQrDesign(doc: FirebaseFirestore.DocumentSnapshot): QrDesign {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as QrDesign;
}

function docToHostedImage(doc: FirebaseFirestore.DocumentSnapshot): HostedImage {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), expiresAt: firestoreToDateNullable(data.expiresAt) } as HostedImage;
}

function docToHostingReminder(doc: FirebaseFirestore.DocumentSnapshot): HostingReminder {
  const data = doc.data()!;
  return { ...data, id: doc.id, sentAt: firestoreToDate(data.sentAt) } as HostingReminder;
}

function docToPricingRule(doc: FirebaseFirestore.DocumentSnapshot): PricingRule {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as PricingRule;
}

function docToHostingTier(doc: FirebaseFirestore.DocumentSnapshot): HostingTier {
  const data = doc.data()!;
  return { ...data, id: doc.id } as HostingTier;
}

function docToCoupon(doc: FirebaseFirestore.DocumentSnapshot): Coupon {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), expiresAt: firestoreToDateNullable(data.expiresAt), updatedAt: firestoreToDate(data.updatedAt) } as unknown as Coupon;
}

function docToQrTemplate(doc: FirebaseFirestore.DocumentSnapshot): QrTemplate {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as unknown as QrTemplate;
}

function docToDynamicPage(doc: FirebaseFirestore.DocumentSnapshot): DynamicPage {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as DynamicPage;
}

function docToDynamicPageAsset(doc: FirebaseFirestore.DocumentSnapshot): DynamicPageAsset {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as DynamicPageAsset;
}

function docToProviderHealthLog(doc: FirebaseFirestore.DocumentSnapshot): ProviderHealthLog {
  const data = doc.data()!;
  return { ...data, id: doc.id, checkTime: firestoreToDate(data.checkedAt || data.checkTime) } as unknown as ProviderHealthLog;
}

function docToGiftPackage(doc: FirebaseFirestore.DocumentSnapshot): GiftPackage {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as GiftPackage;
}

function docToGiftCode(doc: FirebaseFirestore.DocumentSnapshot): GiftCode {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), expiresAt: firestoreToDateNullable(data.expiresAt) } as GiftCode;
}

function docToGiftRedemption(doc: FirebaseFirestore.DocumentSnapshot): GiftRedemption {
  const data = doc.data()!;
  return { ...data, id: doc.id, redeemedAt: firestoreToDate(data.redeemedAt) } as GiftRedemption;
}

function docToEmailTemplate(doc: FirebaseFirestore.DocumentSnapshot): EmailTemplate {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as EmailTemplate;
}

function docToEmailLog(doc: FirebaseFirestore.DocumentSnapshot): EmailLog {
  const data = doc.data()!;
  return { ...data, id: doc.id, sentAt: firestoreToDate(data.sentAt) } as EmailLog;
}

export async function getQrDesign(db: Firestore, id: string): Promise<QrDesign | undefined> {
  const doc = await db.collection('qrDesigns').doc(id).get();
  if (!doc.exists) return undefined;
  return docToQrDesign(doc);
}

export async function getQrDesignsByUser(db: Firestore, userId: string): Promise<QrDesign[]> {
  const snapshot = await db.collection('qrDesigns')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map(doc => docToQrDesign(doc));
}

export async function getPublicGalleryDesigns(db: Firestore): Promise<QrDesign[]> {
  const snapshot = await db.collection('qrDesigns')
    .where('isPublic', '==', true)
    .get();
  return snapshot.docs.map(doc => docToQrDesign(doc));
}

export async function createQrDesign(db: Firestore, design: InsertQrDesign): Promise<QrDesign> {
  const docRef = db.collection('qrDesigns').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...design, id: docRef.id, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToQrDesign(await docRef.get());
}

export async function updateQrDesign(db: Firestore, id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
  const docRef = db.collection('qrDesigns').doc(id);
  const existing = await docRef.get();
  if (!existing.exists) return undefined;
  const data = prepareForFirestore({ ...design, updatedAt: new Date() });
  await docRef.update(data);
  return docToQrDesign(await docRef.get());
}

export async function deleteQrDesign(db: Firestore, id: string): Promise<void> {
  await db.collection('qrDesigns').doc(id).delete();
}

export async function getHostedImage(db: Firestore, id: string): Promise<HostedImage | undefined> {
  const doc = await db.collection('hostedImages').doc(id).get();
  if (!doc.exists) return undefined;
  return docToHostedImage(doc);
}

export async function getHostedImagesByUser(db: Firestore, userId: string): Promise<HostedImage[]> {
  const snapshot = await db.collection('hostedImages').where('userId', '==', userId).get();
  return snapshot.docs.map(doc => docToHostedImage(doc));
}

export async function getAllHostedImages(db: Firestore): Promise<HostedImage[]> {
  const snapshot = await db.collection('hostedImages').get();
  return snapshot.docs.map(doc => docToHostedImage(doc));
}

export async function createHostedImage(db: Firestore, image: InsertHostedImage): Promise<HostedImage> {
  const docRef = db.collection('hostedImages').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...image, id: docRef.id, createdAt: now, views: 0 });
  await docRef.set(data);
  return docToHostedImage(await docRef.get());
}

export async function updateHostedImage(db: Firestore, id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> {
  const docRef = db.collection('hostedImages').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(image));
  return docToHostedImage(await docRef.get());
}

export async function incrementImageViews(db: Firestore, id: string): Promise<void> {
  const docRef = db.collection('hostedImages').doc(id);
  const { FieldValue } = await import('firebase-admin/firestore');
  await docRef.update({ views: FieldValue.increment(1) });
}

export async function deleteHostedImage(db: Firestore, id: string): Promise<void> {
  await db.collection('hostedImages').doc(id).delete();
}

export async function getHostingReminderByImageAndDays(db: Firestore, imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> {
  const snapshot = await db.collection('hostingReminders')
    .where('imageId', '==', imageId)
    .where('daysRemaining', '==', daysRemaining)
    .limit(1).get();
  if (snapshot.empty) return undefined;
  return docToHostingReminder(snapshot.docs[0]);
}

export async function createHostingReminder(db: Firestore, reminder: InsertHostingReminder): Promise<HostingReminder> {
  const docRef = db.collection('hostingReminders').doc();
  const data = prepareForFirestore({ ...reminder, id: docRef.id, sentAt: new Date() });
  await docRef.set(data);
  return docToHostingReminder(await docRef.get());
}

export async function getPricingRules(db: Firestore): Promise<PricingRule[]> {
  const snapshot = await db.collection('pricingRules').get();
  return snapshot.docs.map(doc => docToPricingRule(doc));
}

export async function getPricingRule(db: Firestore, id: string): Promise<PricingRule | undefined> {
  const doc = await db.collection('pricingRules').doc(id).get();
  if (!doc.exists) return undefined;
  return docToPricingRule(doc);
}

export async function createPricingRule(db: Firestore, rule: InsertPricingRule): Promise<PricingRule> {
  const docRef = db.collection('pricingRules').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...rule, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToPricingRule(await docRef.get());
}

export async function updatePricingRule(db: Firestore, id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
  const docRef = db.collection('pricingRules').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(rule));
  return docToPricingRule(await docRef.get());
}

export async function deletePricingRule(db: Firestore, id: string): Promise<void> {
  await db.collection('pricingRules').doc(id).delete();
}

export async function getHostingTiers(db: Firestore): Promise<HostingTier[]> {
  const snapshot = await db.collection('hostingTiers').get();
  return snapshot.docs.map(doc => docToHostingTier(doc));
}

export async function getHostingTier(db: Firestore, id: string): Promise<HostingTier | undefined> {
  const doc = await db.collection('hostingTiers').doc(id).get();
  if (!doc.exists) return undefined;
  return docToHostingTier(doc);
}

export async function getHostingTierByCode(db: Firestore, code: string): Promise<HostingTier | undefined> {
  const snapshot = await db.collection('hostingTiers').where('code', '==', code).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToHostingTier(snapshot.docs[0]);
}

export async function createHostingTier(db: Firestore, tier: InsertHostingTier): Promise<HostingTier> {
  const docRef = db.collection('hostingTiers').doc();
  const data = prepareForFirestore({ ...tier, id: docRef.id });
  await docRef.set(data);
  return docToHostingTier(await docRef.get());
}

export async function updateHostingTier(db: Firestore, id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> {
  const docRef = db.collection('hostingTiers').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(tier));
  return docToHostingTier(await docRef.get());
}

export async function deleteHostingTier(db: Firestore, id: string): Promise<void> {
  await db.collection('hostingTiers').doc(id).delete();
}

export async function getCoupons(db: Firestore): Promise<Coupon[]> {
  const snapshot = await db.collection('coupons').get();
  return snapshot.docs.map(doc => docToCoupon(doc));
}

export async function getActiveCoupons(db: Firestore): Promise<Coupon[]> {
  const snapshot = await db.collection('coupons').where('isActive', '==', true).get();
  return snapshot.docs.map(doc => docToCoupon(doc));
}

export async function getCoupon(db: Firestore, id: string): Promise<Coupon | undefined> {
  const doc = await db.collection('coupons').doc(id).get();
  if (!doc.exists) return undefined;
  return docToCoupon(doc);
}

export async function getCouponByCode(db: Firestore, code: string): Promise<Coupon | undefined> {
  const snapshot = await db.collection('coupons').where('code', '==', code).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToCoupon(snapshot.docs[0]);
}

export async function createCoupon(db: Firestore, coupon: InsertCoupon): Promise<Coupon> {
  const docRef = db.collection('coupons').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...coupon, id: docRef.id, createdAt: now, timesRedeemed: 0 });
  await docRef.set(data);
  return docToCoupon(await docRef.get());
}

export async function updateCoupon(db: Firestore, id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
  const docRef = db.collection('coupons').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(coupon));
  return docToCoupon(await docRef.get());
}

export async function deleteCoupon(db: Firestore, id: string): Promise<void> {
  await db.collection('coupons').doc(id).delete();
}

export async function incrementCouponRedemption(db: Firestore, id: string): Promise<void> {
  const docRef = db.collection('coupons').doc(id);
  const { FieldValue } = await import('firebase-admin/firestore');
  await docRef.update({ timesRedeemed: FieldValue.increment(1) });
}

export async function getQrTemplates(db: Firestore): Promise<QrTemplate[]> {
  const snapshot = await db.collection('qrTemplates').get();
  return snapshot.docs.map(doc => docToQrTemplate(doc));
}

export async function getActiveQrTemplates(db: Firestore): Promise<QrTemplate[]> {
  const snapshot = await db.collection('qrTemplates').where('isActive', '==', true).get();
  return snapshot.docs.map(doc => docToQrTemplate(doc));
}

export async function getQrTemplate(db: Firestore, id: string): Promise<QrTemplate | undefined> {
  const doc = await db.collection('qrTemplates').doc(id).get();
  if (!doc.exists) return undefined;
  return docToQrTemplate(doc);
}

export async function createQrTemplate(db: Firestore, template: InsertQrTemplate): Promise<QrTemplate> {
  const docRef = db.collection('qrTemplates').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...template, id: docRef.id, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToQrTemplate(await docRef.get());
}

export async function updateQrTemplate(db: Firestore, id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> {
  const docRef = db.collection('qrTemplates').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...template, updatedAt: new Date() }));
  return docToQrTemplate(await docRef.get());
}

export async function deleteQrTemplate(db: Firestore, id: string): Promise<void> {
  await db.collection('qrTemplates').doc(id).delete();
}

export async function getDynamicPage(db: Firestore, id: string): Promise<DynamicPage | undefined> {
  const doc = await db.collection('dynamicPages').doc(id).get();
  if (!doc.exists) return undefined;
  return docToDynamicPage(doc);
}

export async function getDynamicPageBySlug(db: Firestore, slug: string): Promise<DynamicPage | undefined> {
  const snapshot = await db.collection('dynamicPages').where('slug', '==', slug).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToDynamicPage(snapshot.docs[0]);
}

export async function getDynamicPagesByUser(db: Firestore, userId: string): Promise<DynamicPage[]> {
  const snapshot = await db.collection('dynamicPages').where('userId', '==', userId).get();
  return snapshot.docs.map(doc => docToDynamicPage(doc));
}

export async function createDynamicPage(db: Firestore, page: InsertDynamicPage): Promise<DynamicPage> {
  const docRef = db.collection('dynamicPages').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...page, id: docRef.id, createdAt: now, updatedAt: now, views: 0 });
  await docRef.set(data);
  return docToDynamicPage(await docRef.get());
}

export async function updateDynamicPage(db: Firestore, id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> {
  const docRef = db.collection('dynamicPages').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...page, updatedAt: new Date() }));
  return docToDynamicPage(await docRef.get());
}

export async function deleteDynamicPage(db: Firestore, id: string): Promise<void> {
  await db.collection('dynamicPages').doc(id).delete();
}

export async function incrementDynamicPageViews(db: Firestore, id: string): Promise<void> {
  const docRef = db.collection('dynamicPages').doc(id);
  const { FieldValue } = await import('firebase-admin/firestore');
  await docRef.update({ views: FieldValue.increment(1) });
}

export async function getDynamicPageAsset(db: Firestore, id: string): Promise<DynamicPageAsset | undefined> {
  const doc = await db.collection('dynamicPageAssets').doc(id).get();
  if (!doc.exists) return undefined;
  return docToDynamicPageAsset(doc);
}

export async function getDynamicPageAssets(db: Firestore, pageId: string): Promise<DynamicPageAsset[]> {
  const snapshot = await db.collection('dynamicPageAssets').where('pageId', '==', pageId).get();
  return snapshot.docs.map(doc => docToDynamicPageAsset(doc));
}

export async function createDynamicPageAsset(db: Firestore, asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> {
  const docRef = db.collection('dynamicPageAssets').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...asset, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToDynamicPageAsset(await docRef.get());
}

export async function updateDynamicPageAsset(db: Firestore, id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> {
  const docRef = db.collection('dynamicPageAssets').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(asset));
  return docToDynamicPageAsset(await docRef.get());
}

export async function deleteDynamicPageAsset(db: Firestore, id: string): Promise<void> {
  await db.collection('dynamicPageAssets').doc(id).delete();
}

export async function setActiveAsset(db: Firestore, pageId: string, assetId: string): Promise<void> {
  const snapshot = await db.collection('dynamicPageAssets').where('pageId', '==', pageId).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.update(doc.ref, { isActive: doc.id === assetId }));
  await batch.commit();
}

export async function logProviderHealth(db: Firestore, log: InsertProviderHealthLog): Promise<ProviderHealthLog> {
  const docRef = db.collection('providerHealthLogs').doc();
  const data = prepareForFirestore({ ...log, id: docRef.id, checkedAt: new Date() });
  await docRef.set(data);
  return docToProviderHealthLog(await docRef.get());
}

export async function getProviderHealthLogs(db: Firestore, limit: number = 100): Promise<ProviderHealthLog[]> {
  const snapshot = await db.collection('providerHealthLogs').orderBy('checkedAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => docToProviderHealthLog(doc));
}

export async function getProviderHealthLogsByType(db: Firestore, providerType: string, limit: number = 100): Promise<ProviderHealthLog[]> {
  const snapshot = await db.collection('providerHealthLogs')
    .where('providerType', '==', providerType)
    .orderBy('checkedAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => docToProviderHealthLog(doc));
}

export async function getLatestProviderHealth(db: Firestore, providerType: string): Promise<ProviderHealthLog | undefined> {
  const logs = await getProviderHealthLogsByType(db, providerType, 1);
  return logs[0];
}

export async function getAllLatestProviderHealth(db: Firestore): Promise<ProviderHealthLog[]> {
  const allLogs = await getProviderHealthLogs(db, 500);
  const latestByType = new Map<string, ProviderHealthLog>();
  for (const log of allLogs) {
    if (!latestByType.has(log.providerType)) {
      latestByType.set(log.providerType, log);
    }
  }
  return Array.from(latestByType.values());
}

export async function getProviderHealthStats(db: Firestore, providerType: string, hours: number = 24): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const snapshot = await db.collection('providerHealthLogs')
    .where('providerType', '==', providerType)
    .where('checkedAt', '>=', cutoff).get();
  const logs = snapshot.docs.map(doc => docToProviderHealthLog(doc));
  if (logs.length === 0) return { uptimePercent: 0, avgResponseTime: 0, totalChecks: 0 };
  const upCount = logs.filter(l => l.isHealthy).length;
  const avgTime = logs.reduce((sum, l) => sum + (l.responseTimeMs || 0), 0) / logs.length;
  return { uptimePercent: (upCount / logs.length) * 100, avgResponseTime: avgTime, totalChecks: logs.length };
}

export async function getAllGiftPackages(db: Firestore): Promise<GiftPackage[]> {
  const snapshot = await db.collection('giftPackages').get();
  return snapshot.docs.map(doc => docToGiftPackage(doc));
}

export async function getActiveGiftPackages(db: Firestore): Promise<GiftPackage[]> {
  const snapshot = await db.collection('giftPackages').where('isActive', '==', true).get();
  return snapshot.docs.map(doc => docToGiftPackage(doc));
}

export async function getGiftPackage(db: Firestore, id: string): Promise<GiftPackage | undefined> {
  const doc = await db.collection('giftPackages').doc(id).get();
  if (!doc.exists) return undefined;
  return docToGiftPackage(doc);
}

export async function createGiftPackage(db: Firestore, pkg: InsertGiftPackage): Promise<GiftPackage> {
  const docRef = db.collection('giftPackages').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...pkg, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToGiftPackage(await docRef.get());
}

export async function updateGiftPackage(db: Firestore, id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined> {
  const docRef = db.collection('giftPackages').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(pkg));
  return docToGiftPackage(await docRef.get());
}

export async function deleteGiftPackage(db: Firestore, id: string): Promise<void> {
  await db.collection('giftPackages').doc(id).delete();
}

export async function getGiftCode(db: Firestore, id: string): Promise<GiftCode | undefined> {
  const doc = await db.collection('giftCodes').doc(id).get();
  if (!doc.exists) return undefined;
  return docToGiftCode(doc);
}

export async function getGiftCodeByCode(db: Firestore, code: string): Promise<GiftCode | undefined> {
  const snapshot = await db.collection('giftCodes').where('code', '==', code).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToGiftCode(snapshot.docs[0]);
}

export async function getGiftCodesByBuyer(db: Firestore, buyerUserId: string): Promise<GiftCode[]> {
  const snapshot = await db.collection('giftCodes').where('buyerUserId', '==', buyerUserId).get();
  return snapshot.docs.map(doc => docToGiftCode(doc));
}

export async function createGiftCode(db: Firestore, code: InsertGiftCode): Promise<GiftCode> {
  const docRef = db.collection('giftCodes').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...code, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToGiftCode(await docRef.get());
}

export async function updateGiftCode(db: Firestore, id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined> {
  const docRef = db.collection('giftCodes').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(code));
  return docToGiftCode(await docRef.get());
}

export async function getGiftRedemption(db: Firestore, id: string): Promise<GiftRedemption | undefined> {
  const doc = await db.collection('giftRedemptions').doc(id).get();
  if (!doc.exists) return undefined;
  return docToGiftRedemption(doc);
}

export async function getGiftRedemptionByCode(db: Firestore, giftCodeId: string): Promise<GiftRedemption | undefined> {
  const snapshot = await db.collection('giftRedemptions').where('giftCodeId', '==', giftCodeId).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToGiftRedemption(snapshot.docs[0]);
}

export async function getGiftRedemptionsByRecipient(db: Firestore, recipientEmail: string): Promise<GiftRedemption[]> {
  const snapshot = await db.collection('giftRedemptions').where('recipientEmail', '==', recipientEmail).get();
  return snapshot.docs.map(doc => docToGiftRedemption(doc));
}

export async function createGiftRedemption(db: Firestore, redemption: InsertGiftRedemption): Promise<GiftRedemption> {
  const docRef = db.collection('giftRedemptions').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...redemption, id: docRef.id, redeemedAt: now });
  await docRef.set(data);
  return docToGiftRedemption(await docRef.get());
}

export async function updateGiftRedemption(db: Firestore, id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined> {
  const docRef = db.collection('giftRedemptions').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(redemption));
  return docToGiftRedemption(await docRef.get());
}

export async function getEmailTemplates(db: Firestore): Promise<EmailTemplate[]> {
  const snapshot = await db.collection('emailTemplates').get();
  return snapshot.docs.map(doc => docToEmailTemplate(doc));
}

export async function getEmailTemplate(db: Firestore, id: string): Promise<EmailTemplate | undefined> {
  const doc = await db.collection('emailTemplates').doc(id).get();
  if (!doc.exists) return undefined;
  return docToEmailTemplate(doc);
}

export async function getEmailTemplateByTrigger(db: Firestore, trigger: string): Promise<EmailTemplate | undefined> {
  const snapshot = await db.collection('emailTemplates').where('trigger', '==', trigger).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToEmailTemplate(snapshot.docs[0]);
}

export async function createEmailTemplate(db: Firestore, template: InsertEmailTemplate): Promise<EmailTemplate> {
  const docRef = db.collection('emailTemplates').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...template, id: docRef.id, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToEmailTemplate(await docRef.get());
}

export async function updateEmailTemplate(db: Firestore, id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
  const docRef = db.collection('emailTemplates').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...template, updatedAt: new Date() }));
  return docToEmailTemplate(await docRef.get());
}

export async function deleteEmailTemplate(db: Firestore, id: string): Promise<void> {
  await db.collection('emailTemplates').doc(id).delete();
}

export async function getEmailLogs(db: Firestore, limit: number = 100): Promise<EmailLog[]> {
  const snapshot = await db.collection('emailLogs').orderBy('sentAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => docToEmailLog(doc));
}

export async function logEmail(db: Firestore, log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog> {
  const docRef = db.collection('emailLogs').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...log, id: docRef.id, sentAt: now });
  await docRef.set(data);
  return docToEmailLog(await docRef.get());
}
