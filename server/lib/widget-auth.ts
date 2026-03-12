import jwt from "jsonwebtoken";
import { z } from "zod";

// ============ JWT KEY ROTATION SYSTEM ============
// Keys are stored in env as JSON: WIDGET_JWT_KEYS='{"v1":"secret1","v2":"secret2"}'
// Active key for signing: WIDGET_JWT_ACTIVE_KID
const JWT_EXPIRY = "10m";

function getDevFallbackSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[WidgetAuth] Missing WIDGET_JWT_KEYS or WIDGET_JWT_SECRET in production — refusing to use dev fallback');
  }
  return "dev-secret-change-in-production";
}

/**
 * Platform issuer/audience for widget JWT tokens.
 * Value remains 'kingdom_connects' for backward compat with existing tokens.
 * Future: migrate to 'qrgear' issuer once all external integrations update.
 */
const PLATFORM_ISSUER = 'kingdom_connects';
const QR_GEAR_AUDIENCE = 'qrgear_widget';

interface JWTKeys {
  [kid: string]: string;
}

function getJWTKeys(): JWTKeys {
  const keysEnv = process.env.WIDGET_JWT_KEYS;
  if (!keysEnv) {
    return { v1: process.env.WIDGET_JWT_SECRET || getDevFallbackSecret() };
  }
  try {
    return JSON.parse(keysEnv);
  } catch (e) {
    console.error("[WidgetAuth] Failed to parse WIDGET_JWT_KEYS, using fallback");
    return { v1: process.env.WIDGET_JWT_SECRET || getDevFallbackSecret() };
  }
}

function getActiveKid(): string {
  return process.env.WIDGET_JWT_ACTIVE_KID || 'v1';
}

function getSigningKey(): { kid: string; secret: string } {
  const keys = getJWTKeys();
  const kid = getActiveKid();
  const secret = keys[kid];
  if (!secret) {
    console.error(`[WidgetAuth] Active kid '${kid}' not found in keys, using first available`);
    const firstKid = Object.keys(keys)[0];
    return { kid: firstKid, secret: keys[firstKid] };
  }
  return { kid, secret };
}

function getKeyByKid(kid: string): string | null {
  const keys = getJWTKeys();
  return keys[kid] || null;
}

export type ViewType = 'channel_products' | 'program_series' | 'mosaic_series' | 'create_product';

export interface StoreOwner {
  ownerType: string;
  ownerId: string;
}

export interface WidgetTokenPayload {
  // ============ CANONICAL CONTRACT FIELDS ============
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  
  storeId?: string;
  channelId?: string;
  entityType?: 'business' | 'church' | 'member';
  entityId?: string;
  
  viewType?: ViewType;
  
  storeOwner?: StoreOwner;
  
  target?: {
    channelId?: string;
    programId?: string;
  };
  
  entityName?: string;
  entityLogoUrl?: string | null;
  placement?: 'homepage' | 'church' | 'business' | 'member' | 'dashboard' | 'listing' | 'profile' | 'admin';
  mode?: 'public' | 'admin';
  theme?: string;
  returnUrl?: string;
  capabilities?: {
    canCreate?: boolean;
    canManage?: boolean;
  };
  
  // ============ LEGACY FIELDS (backward compatibility) ============
  businessId?: string;
  businessName?: string;
  businessSlug?: string;
  businessLogoUrl?: string | null;
  churchId?: string;
  churchName?: string;
  churchSlug?: string;
  memberId?: string;
  memberEmail?: string;
  segmentId?: string;
  kcListingUrl?: string;
  ownerEmail?: string;
  partnerId?: string;
  allowedSegments?: string[];
}

// Input schema for token minting API
export const mintTokenInputSchema = z.object({
  entityType: z.enum(['business', 'church', 'member']),
  entityId: z.string().min(1),
  entityName: z.string().optional(),
  entityLogoUrl: z.string().url().optional().nullable(),
  placement: z.enum(['homepage', 'church', 'business', 'member', 'dashboard', 'listing', 'profile', 'admin']).optional(),
  mode: z.enum(['public', 'admin']).optional().default('public'),
  returnUrl: z.string().url().optional(),
  theme: z.string().optional(),
  viewType: z.enum(['channel_products', 'program_series', 'mosaic_series', 'create_product']).optional().default('channel_products'),
  storeOwner: z.object({
    ownerType: z.string().min(1),
    ownerId: z.string().min(1),
  }).optional(),
  target: z.object({
    channelId: z.string().optional(),
    programId: z.string().optional(),
  }).optional(),
  capabilities: z.object({
    canCreate: z.boolean().optional(),
    canManage: z.boolean().optional(),
  }).optional(),
});

export type MintTokenInput = z.infer<typeof mintTokenInputSchema>;

export const widgetTokenSchema = z.object({
  iss: z.string().optional(),
  aud: z.string().optional(),
  storeId: z.string().optional(),
  channelId: z.string().optional(),
  entityType: z.enum(['business', 'church', 'member']).optional(),
  entityId: z.string().optional(),
  entityName: z.string().optional(),
  entityLogoUrl: z.string().url().optional().nullable(),
  mode: z.enum(['public', 'admin']).optional(),
  theme: z.string().optional(),
  returnUrl: z.string().url().optional(),
  viewType: z.enum(['channel_products', 'program_series', 'mosaic_series', 'create_product']).optional(),
  storeOwner: z.object({
    ownerType: z.string(),
    ownerId: z.string(),
  }).optional(),
  target: z.object({
    channelId: z.string().optional(),
    programId: z.string().optional(),
  }).optional(),
  capabilities: z.object({
    canCreate: z.boolean().optional(),
    canManage: z.boolean().optional(),
  }).optional(),
  
  // Legacy fields (backward compatibility)
  businessId: z.string().optional(),
  businessName: z.string().optional(),
  businessSlug: z.string().optional(),
  businessLogoUrl: z.string().url().optional().nullable(),
  churchId: z.string().optional(),
  churchName: z.string().optional(),
  churchSlug: z.string().optional(),
  memberId: z.string().optional(),
  memberEmail: z.string().email().optional(),
  kcListingUrl: z.string().url().optional(),
  ownerEmail: z.string().email().optional(),
  partnerId: z.string().optional(),
  placement: z.enum(['homepage', 'church', 'business', 'member', 'dashboard', 'listing', 'profile', 'admin']).optional(),
  allowedSegments: z.array(z.string()).optional(),
});

/**
 * Mint a new widget token for external sites
 * This is the ONLY place tokens should be signed
 */
export function mintWidgetToken(input: MintTokenInput): { token: string; expiresIn: string } {
  const { kid, secret } = getSigningKey();
  
  const storeId = input.storeOwner
    ? `${input.storeOwner.ownerType}:${input.storeOwner.ownerId}`
    : `${input.entityType}_${input.entityId}`;
  
  const channelId = input.target?.channelId || `${input.entityType}_${input.entityId}`;
  
  const payload: Partial<WidgetTokenPayload> = {
    iss: PLATFORM_ISSUER,
    aud: QR_GEAR_AUDIENCE,
    storeId,
    channelId,
    entityType: input.entityType,
    entityId: input.entityId,
    viewType: input.viewType || 'channel_products',
    storeOwner: input.storeOwner,
    target: input.target ? {
      channelId: input.target.channelId,
      programId: input.target.programId,
    } : undefined,
    entityName: input.entityName,
    entityLogoUrl: input.entityLogoUrl,
    placement: input.placement,
    mode: input.mode || 'public',
    returnUrl: input.returnUrl,
    theme: input.theme,
    capabilities: {
      canCreate: input.capabilities?.canCreate || false,
      canManage: input.capabilities?.canManage || false,
    },
  };
  
  const token = jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRY,
    header: { alg: 'HS256', typ: 'JWT', kid },
  });
  
  return { token, expiresIn: JWT_EXPIRY };
}

/**
 * Legacy sign function - kept for backward compatibility
 * New code should use mintWidgetToken
 */
export function signWidgetToken(payload: WidgetTokenPayload): string {
  const { kid, secret } = getSigningKey();
  return jwt.sign(payload, secret, {
    expiresIn: JWT_EXPIRY,
    header: { alg: 'HS256', typ: 'JWT', kid },
  });
}

export function verifyWidgetToken(token: string): WidgetTokenPayload | null {
  try {
    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      console.error("[WidgetAuth] Failed to decode token header");
      return null;
    }
    
    const kid = (decoded.header as any).kid || 'v1';
    const secret = getKeyByKid(kid);
    
    if (!secret) {
      console.error(`[WidgetAuth] Unknown key id: ${kid}`);
      return null;
    }
    
    const verified = jwt.verify(token, secret) as WidgetTokenPayload;
    
    // Validate KC canonical contract fields if present
    if (verified.iss && verified.iss !== PLATFORM_ISSUER) {
      console.error("[WidgetAuth] Invalid issuer:", verified.iss);
      return null;
    }
    if (verified.aud && verified.aud !== QR_GEAR_AUDIENCE) {
      console.error("[WidgetAuth] Invalid audience:", verified.aud);
      return null;
    }
    
    // Validate exp/iat
    const now = Math.floor(Date.now() / 1000);
    if (verified.exp && verified.exp < now) {
      console.error("[WidgetAuth] Token expired");
      return null;
    }
    if (verified.iat && verified.iat > now + 60) {
      console.error("[WidgetAuth] Token issued in future");
      return null;
    }
    
    const validated = widgetTokenSchema.parse(verified);
    
    return {
      ...validated,
      iss: verified.iss,
      aud: verified.aud,
      iat: verified.iat,
      exp: verified.exp,
    };
  } catch (error) {
    console.error("[WidgetAuth] Token verification failed:", error);
    return null;
  }
}

export interface NormalizedWidgetPayload {
  channelId: string;
  storeId: string;
  entityType: 'business' | 'church' | 'member';
  entityId: string;
  entityName?: string;
  entityLogoUrl?: string | null;
  mode: 'public' | 'admin';
  viewType: ViewType;
  storeOwner?: StoreOwner;
  programId?: string;
  capabilities: { canCreate: boolean; canManage: boolean };
}

export function normalizeWidgetPayload(payload: WidgetTokenPayload): NormalizedWidgetPayload {
  const viewType: ViewType = payload.viewType || 'channel_products';
  const storeOwner = payload.storeOwner;
  const programId = payload.target?.programId;

  if (payload.storeId && payload.channelId && payload.entityType && payload.entityId) {
    return {
      channelId: payload.target?.channelId || payload.channelId,
      storeId: payload.storeId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      entityName: payload.entityName,
      entityLogoUrl: payload.entityLogoUrl,
      mode: payload.mode || 'public',
      viewType,
      storeOwner,
      programId,
      capabilities: {
        canCreate: payload.capabilities?.canCreate || false,
        canManage: payload.capabilities?.canManage || false,
      },
    };
  }
  
  let entityType: 'business' | 'church' | 'member' = 'business';
  let entityId = '';
  let channelId = '';
  let entityName = '';
  let entityLogoUrl: string | null = null;
  
  if (payload.businessId || payload.businessSlug) {
    entityType = 'business';
    entityId = payload.businessId || payload.businessSlug || '';
    channelId = `business_${entityId}`;
    entityName = payload.businessName || '';
    entityLogoUrl = payload.businessLogoUrl || null;
  } else if (payload.churchId || payload.churchSlug) {
    entityType = 'church';
    entityId = payload.churchId || payload.churchSlug || '';
    channelId = `church_${entityId}`;
    entityName = payload.churchName || '';
  } else if (payload.memberId) {
    entityType = 'member';
    entityId = payload.memberId;
    channelId = `member_${entityId}`;
  }
  
  const storeId = storeOwner
    ? `${storeOwner.ownerType}:${storeOwner.ownerId}`
    : 'kingdom_connects';
  
  return {
    channelId,
    storeId,
    entityType,
    entityId,
    entityName: entityName || undefined,
    entityLogoUrl,
    mode: payload.mode || (payload.placement === 'admin' || payload.placement === 'dashboard' ? 'admin' : 'public'),
    viewType,
    storeOwner,
    programId,
    capabilities: {
      canCreate: payload.capabilities?.canCreate || false,
      canManage: payload.capabilities?.canManage || false,
    },
  };
}

export function createWidgetUrl(baseUrl: string, payload: WidgetTokenPayload): string {
  const token = signWidgetToken(payload);
  let url = `${baseUrl}/widget?token=${encodeURIComponent(token)}`;
  
  // Add placement and entity IDs to URL for transparency
  if (payload.placement) {
    url += `&placement=${encodeURIComponent(payload.placement)}`;
  }
  if (payload.businessSlug) {
    url += `&businessId=${encodeURIComponent(payload.businessSlug)}`;
  }
  if (payload.churchSlug) {
    url += `&churchId=${encodeURIComponent(payload.churchSlug)}`;
  }
  
  return url;
}

/**
 * Verify KC service authentication for token minting
 * Supports: API key or Firebase Admin token
 */
export async function verifyKCServiceAuth(authHeader: string | undefined): Promise<{ valid: boolean; error?: string }> {
  if (!authHeader) {
    return { valid: false, error: 'Authorization header required' };
  }
  
  // Check API key auth
  const apiKey = process.env['KC-API-KEY'];
  if (apiKey) {
    if (authHeader === `Bearer ${apiKey}` || authHeader === apiKey) {
      return { valid: true };
    }
  }
  
  // Check X-API-Key style
  const widgetApiKey = process.env.WIDGET_API_KEY;
  if (widgetApiKey && authHeader === widgetApiKey) {
    return { valid: true };
  }
  
  // Could add Firebase Admin token verification here
  // For now, just API key auth
  
  return { valid: false, error: 'Invalid service authentication' };
}
