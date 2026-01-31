import { getFirestoreDb } from "./firebase-admin";

export interface BuyerInstance {
  instanceId: string;
  buyerEmail: string;
  buyerUserId?: string;
  orderId: string;
  packetId: string;
  templateId?: string;
  destinationUrl: string;
  hostingExpiresAt: string;
  status: 'active' | 'expired' | 'renewed';
  remindersSent: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuyerInstanceInput {
  buyerEmail: string;
  buyerUserId?: string;
  orderId: string;
  packetId: string;
  templateId?: string;
  destinationUrl?: string;
}

export async function createBuyerInstance(input: CreateBuyerInstanceInput): Promise<BuyerInstance> {
  const db = getFirestoreDb();
  
  const instanceId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  
  const instance: BuyerInstance = {
    instanceId,
    buyerEmail: input.buyerEmail,
    buyerUserId: input.buyerUserId || undefined,
    orderId: input.orderId,
    packetId: input.packetId,
    templateId: input.templateId || undefined,
    destinationUrl: input.destinationUrl || '',
    hostingExpiresAt: oneYearFromNow.toISOString(),
    status: 'active',
    remindersSent: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  
  await db.collection('buyerInstances').doc(instanceId).set(instance);
  
  console.log(`[BuyerInstance] Created ${instanceId} for ${input.buyerEmail}, expires ${oneYearFromNow.toISOString()}`);
  
  return instance;
}

export async function getBuyerInstance(instanceId: string): Promise<BuyerInstance | null> {
  const db = getFirestoreDb();
  const doc = await db.collection('buyerInstances').doc(instanceId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as BuyerInstance;
}

export async function getBuyerInstancesByEmail(email: string): Promise<BuyerInstance[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection('buyerInstances')
    .where('buyerEmail', '==', email)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  
  return snapshot.docs.map(doc => doc.data() as BuyerInstance);
}

export async function getBuyerInstancesByUserId(userId: string): Promise<BuyerInstance[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection('buyerInstances')
    .where('buyerUserId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  
  return snapshot.docs.map(doc => doc.data() as BuyerInstance);
}

export async function updateInstanceDestination(instanceId: string, destinationUrl: string): Promise<void> {
  const db = getFirestoreDb();
  await db.collection('buyerInstances').doc(instanceId).update({
    destinationUrl,
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`[BuyerInstance] Updated destination for ${instanceId}`);
}

export async function extendInstanceHosting(instanceId: string, yearsToAdd: number = 3): Promise<BuyerInstance | null> {
  const db = getFirestoreDb();
  const instance = await getBuyerInstance(instanceId);
  
  if (!instance) {
    return null;
  }
  
  const currentExpiry = new Date(instance.hostingExpiresAt);
  const now = new Date();
  const startDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(startDate.getTime() + yearsToAdd * 365 * 24 * 60 * 60 * 1000);
  
  await db.collection('buyerInstances').doc(instanceId).update({
    hostingExpiresAt: newExpiry.toISOString(),
    status: 'active',
    remindersSent: [],
    updatedAt: new Date().toISOString(),
  });
  
  console.log(`[BuyerInstance] Extended ${instanceId} hosting to ${newExpiry.toISOString()}`);
  
  return getBuyerInstance(instanceId);
}

export async function getExpiringInstances(daysUntilExpiry: number): Promise<BuyerInstance[]> {
  const db = getFirestoreDb();
  const now = new Date();
  const targetDate = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);
  
  const snapshot = await db.collection('buyerInstances')
    .where('status', '==', 'active')
    .where('hostingExpiresAt', '<=', targetDate.toISOString())
    .where('hostingExpiresAt', '>', now.toISOString())
    .limit(500)
    .get();
  
  return snapshot.docs.map(doc => doc.data() as BuyerInstance);
}

export async function markReminderSent(instanceId: string, reminderType: string): Promise<void> {
  const db = getFirestoreDb();
  const instance = await getBuyerInstance(instanceId);
  
  if (!instance) {
    return;
  }
  
  const remindersSent = [...instance.remindersSent, `${reminderType}:${new Date().toISOString()}`];
  
  await db.collection('buyerInstances').doc(instanceId).update({
    remindersSent,
    updatedAt: new Date().toISOString(),
  });
}

export async function checkAndUpdateExpiredInstances(): Promise<number> {
  const db = getFirestoreDb();
  const now = new Date();
  
  const snapshot = await db.collection('buyerInstances')
    .where('status', '==', 'active')
    .where('hostingExpiresAt', '<', now.toISOString())
    .limit(500)
    .get();
  
  let count = 0;
  const batch = db.batch();
  
  for (const doc of snapshot.docs) {
    batch.update(doc.ref, {
      status: 'expired',
      updatedAt: now.toISOString(),
    });
    count++;
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`[BuyerInstance] Marked ${count} instances as expired`);
  }
  
  return count;
}

export function isInstanceActive(instance: BuyerInstance): boolean {
  const now = new Date();
  const expiry = new Date(instance.hostingExpiresAt);
  return instance.status === 'active' && expiry > now;
}
