import { getFirestoreDb } from './firebase-admin';
import { nanoid } from 'nanoid';

export interface ClaimCode {
  claimCode: string;
  templateId: string;
  packetType: 'qr_canvas' | 'qr_play' | 'qr_doc' | 'qr_basics' | 'qr_plus';
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  status: 'unclaimed' | 'claimed' | 'expired';
  instanceId?: string;
  claimedByUserId?: string;
  claimedAt?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export interface CreateClaimCodeParams {
  templateId: string;
  packetType: ClaimCode['packetType'];
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

export async function generateClaimCode(params: CreateClaimCodeParams): Promise<ClaimCode> {
  const db = getFirestoreDb();
  const claimCode = nanoid(12);
  
  const claimData: ClaimCode = {
    claimCode,
    templateId: params.templateId,
    packetType: params.packetType,
    productName: params.productName,
    productDescription: params.productDescription,
    previewImageUrl: params.previewImageUrl,
    status: 'unclaimed',
    createdAt: new Date().toISOString(),
    expiresAt: params.expiresAt,
    metadata: params.metadata,
  };
  
  await db.collection('claimCodes').doc(claimCode).set(claimData);
  console.log(`[ClaimService] Generated claim code: ${claimCode} for template: ${params.templateId}`);
  
  return claimData;
}

export async function generateBulkClaimCodes(
  params: CreateClaimCodeParams,
  count: number
): Promise<ClaimCode[]> {
  const db = getFirestoreDb();
  const batch = db.batch();
  const codes: ClaimCode[] = [];
  
  for (let i = 0; i < count; i++) {
    const claimCode = nanoid(12);
    const claimData: ClaimCode = {
      claimCode,
      templateId: params.templateId,
      packetType: params.packetType,
      productName: params.productName,
      productDescription: params.productDescription,
      previewImageUrl: params.previewImageUrl,
      status: 'unclaimed',
      createdAt: new Date().toISOString(),
      expiresAt: params.expiresAt,
      metadata: params.metadata,
    };
    
    batch.set(db.collection('claimCodes').doc(claimCode), claimData);
    codes.push(claimData);
  }
  
  await batch.commit();
  console.log(`[ClaimService] Generated ${count} claim codes for template: ${params.templateId}`);
  
  return codes;
}

export async function getClaimCode(claimCode: string): Promise<ClaimCode | null> {
  const db = getFirestoreDb();
  const doc = await db.collection('claimCodes').doc(claimCode).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as ClaimCode;
}

export async function validateClaimCode(claimCode: string): Promise<{
  valid: boolean;
  reason?: string;
  claimData?: ClaimCode;
}> {
  const claimData = await getClaimCode(claimCode);
  
  if (!claimData) {
    return { valid: false, reason: 'Claim code not found' };
  }
  
  if (claimData.status === 'claimed') {
    return { valid: false, reason: 'This item has already been claimed' };
  }
  
  if (claimData.status === 'expired') {
    return { valid: false, reason: 'This claim code has expired' };
  }
  
  if (claimData.expiresAt && new Date(claimData.expiresAt) < new Date()) {
    const db = getFirestoreDb();
    await db.collection('claimCodes').doc(claimCode).update({ status: 'expired' });
    return { valid: false, reason: 'This claim code has expired' };
  }
  
  return { valid: true, claimData };
}

export async function claimItem(
  claimCode: string,
  userId: string,
  userEmail: string
): Promise<{
  success: boolean;
  instanceId?: string;
  error?: string;
}> {
  const firestoreDb = getFirestoreDb();
  
  const validation = await validateClaimCode(claimCode);
  if (!validation.valid || !validation.claimData) {
    return { success: false, error: validation.reason };
  }
  
  const claimData = validation.claimData;
  
  const instanceId = nanoid(16);
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  
  const instanceData = {
    instanceId,
    claimCode,
    templateId: claimData.templateId,
    packetType: claimData.packetType,
    ownerUserId: userId,
    ownerEmail: userEmail,
    productName: claimData.productName,
    productDescription: claimData.productDescription,
    previewImageUrl: claimData.previewImageUrl,
    destinationUrl: null,
    customConfig: null,
    status: 'active',
    hostingExpiresAt: oneYearFromNow.toISOString(),
    remindersSent: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    claimedAt: now.toISOString(),
    metadata: claimData.metadata,
  };
  
  const batch = firestoreDb.batch();
  
  batch.set(firestoreDb.collection('claimedInstances').doc(instanceId), instanceData);
  
  batch.update(firestoreDb.collection('claimCodes').doc(claimCode), {
    status: 'claimed',
    instanceId,
    claimedByUserId: userId,
    claimedAt: now.toISOString(),
  });
  
  await batch.commit();
  
  console.log(`[ClaimService] Item claimed: ${claimCode} -> Instance: ${instanceId} by User: ${userId}`);
  
  return { success: true, instanceId };
}

export async function getClaimedInstance(instanceId: string): Promise<any | null> {
  const db = getFirestoreDb();
  const doc = await db.collection('claimedInstances').doc(instanceId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data();
}

export async function getClaimedInstancesByUser(userId: string): Promise<any[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection('claimedInstances')
    .where('ownerUserId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  
  return snapshot.docs.map(doc => doc.data());
}

export async function updateClaimedInstanceDestination(
  instanceId: string,
  destinationUrl: string
): Promise<void> {
  const db = getFirestoreDb();
  await db.collection('claimedInstances').doc(instanceId).update({
    destinationUrl,
    updatedAt: new Date().toISOString(),
  });
}

export function isClaimedInstanceActive(instance: any): boolean {
  const now = new Date();
  const expiry = new Date(instance.hostingExpiresAt);
  return instance.status === 'active' && expiry > now;
}

// Generates a human-readable activation code (format: XXXX-XXXX)
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part()}-${part()}`;
}

export interface OrderItemClaimParams {
  orderId: string;
  packetId?: string;
  templateId?: string;
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  buyerEmail: string;
  buyerUserId?: string;
  qrgId?: string;
}

// Called at checkout completion — generates a pending claim code for each QR product
export async function generateClaimCodeForOrderItem(params: OrderItemClaimParams): Promise<string> {
  const db = getFirestoreDb();

  // Generate unique activation code, retry on collision
  let activationCode = generateActivationCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.collection('claimCodes').doc(activationCode).get();
    if (!existing.exists) break;
    activationCode = generateActivationCode();
    attempts++;
  }

  const claimData = {
    claimCode: activationCode,
    templateId: params.templateId || params.packetId || '',
    packetId: params.packetId || null,
    orderId: params.orderId,
    packetType: 'qr_canvas' as const,
    productName: params.productName,
    productDescription: params.productDescription || null,
    previewImageUrl: params.previewImageUrl || null,
    status: 'unclaimed',
    buyerEmail: params.buyerEmail,
    buyerUserId: params.buyerUserId || null,
    qrgId: params.qrgId || null,
    createdAt: new Date().toISOString(),
    source: 'order',
  };

  await db.collection('claimCodes').doc(activationCode).set(claimData);
  console.log(`[ClaimService] Generated activation code ${activationCode} for order ${params.orderId}`);

  return activationCode;
}
