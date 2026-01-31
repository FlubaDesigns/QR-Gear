import jwt from "jsonwebtoken";
import { z } from "zod";

const JWT_SECRET = process.env.WIDGET_JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRY = "1h";

// KC Canonical Contract issuer/audience
const KC_ISSUER = 'kingdom_connects';
const QR_GEAR_AUDIENCE = 'qrgear_widget';

export interface WidgetTokenPayload {
  // ============ KC CANONICAL CONTRACT FIELDS ============
  // JWT standard fields
  iss?: string;  // Should be "kingdom_connects"
  aud?: string;  // Should be "qrgear_widget"
  iat?: number;
  exp?: number;
  
  // KC Required fields
  storeId?: string;  // "kingdom_connects"
  channelId?: string;  // Entity-scoped channel
  entityType?: 'business' | 'church' | 'member';
  entityId?: string;  // Original KC ID
  
  // KC Recommended fields
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

export const widgetTokenSchema = z.object({
  // KC Canonical Contract
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

export function signWidgetToken(payload: WidgetTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

export function verifyWidgetToken(token: string): WidgetTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as WidgetTokenPayload;
    
    // Validate KC canonical contract fields if present
    if (decoded.iss && decoded.iss !== KC_ISSUER) {
      console.error("Widget token invalid issuer:", decoded.iss);
      return null;
    }
    if (decoded.aud && decoded.aud !== QR_GEAR_AUDIENCE) {
      console.error("Widget token invalid audience:", decoded.aud);
      return null;
    }
    
    const validated = widgetTokenSchema.parse(decoded);
    
    return {
      ...validated,
      iss: decoded.iss,
      aud: decoded.aud,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    console.error("Widget token verification failed:", error);
    return null;
  }
}

// Normalize token payload to unified format
export function normalizeWidgetPayload(payload: WidgetTokenPayload): {
  channelId: string;
  storeId: string;
  entityType: 'business' | 'church' | 'member';
  entityId: string;
  entityName?: string;
  entityLogoUrl?: string | null;
  mode: 'public' | 'admin';
  capabilities: { canCreate: boolean; canManage: boolean };
} {
  // KC Canonical format takes priority
  if (payload.storeId === 'kingdom_connects' && payload.channelId && payload.entityType && payload.entityId) {
    return {
      channelId: payload.channelId,
      storeId: payload.storeId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      entityName: payload.entityName,
      entityLogoUrl: payload.entityLogoUrl,
      mode: payload.mode || 'public',
      capabilities: {
        canCreate: payload.capabilities?.canCreate || false,
        canManage: payload.capabilities?.canManage || false,
      },
    };
  }
  
  // Legacy format - derive channelId from entity fields
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
  
  return {
    channelId,
    storeId: 'kingdom_connects',
    entityType,
    entityId,
    entityName: entityName || undefined,
    entityLogoUrl,
    mode: payload.mode || (payload.placement === 'admin' || payload.placement === 'dashboard' ? 'admin' : 'public'),
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
