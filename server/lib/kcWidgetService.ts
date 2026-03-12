import jwt from 'jsonwebtoken';

export interface KCWidgetPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  storeId: string;
  channelId: string;
  entityType: 'business' | 'church' | 'member';
  entityId: string;
  entityName?: string;
  entityLogoUrl?: string;
  placement?: 'profile' | 'admin' | 'homepage';
  mode?: 'public' | 'admin';
  theme?: string;
  returnUrl?: string;
  capabilities?: {
    canCreate?: boolean;
    canManage?: boolean;
  };
}

export interface WidgetContext {
  valid: boolean;
  error?: string;
  payload?: KCWidgetPayload;
}

/**
 * Kingdom Connects partner integration service.
 * This service validates tokens FROM the KC platform specifically.
 * The 'kingdom_connects' values are the partner's identity — not a platform default.
 */
const KC_PARTNER_ISSUER = 'kingdom_connects';
const QR_GEAR_AUDIENCE = 'qrgear_widget';

export function verifyKCToken(token: string): WidgetContext {
  const secret = process.env.KC_JWT_SECRET;
  
  if (!secret) {
    console.error('[KCWidget] KC_JWT_SECRET not configured');
    return { valid: false, error: 'Widget not configured' };
  }
  
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: KC_PARTNER_ISSUER,
      audience: QR_GEAR_AUDIENCE,
    }) as KCWidgetPayload;
    
    if (!decoded.storeId || !decoded.channelId || !decoded.entityType || !decoded.entityId) {
      return { valid: false, error: 'Missing required token fields' };
    }
    
    if (decoded.storeId !== KC_PARTNER_ISSUER) {
      return { valid: false, error: 'Invalid store identifier' };
    }
    
    return { valid: true, payload: decoded };
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Token expired' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid token' };
    }
    console.error('[KCWidget] Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}

export async function getChannelItems(channelId: string, storeId: string = KC_PARTNER_ISSUER) {
  const { getFirestoreDb } = await import('./firebase-admin');
  const db = getFirestoreDb();
  
  const snapshot = await db.collection('catalogItemLinks')
    .where('channelId', '==', channelId)
    .where('storeId', '==', storeId)
    .where('status', '==', 'published')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();
  
  const items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  return items;
}

export async function getChannelCollections(channelId: string) {
  const { getFirestoreDb } = await import('./firebase-admin');
  const db = getFirestoreDb();
  
  const snapshot = await db.collection('collections')
    .where('channelId', '==', channelId)
    .where('isPublic', '==', true)
    .orderBy('displayOrder', 'asc')
    .limit(20)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
