import jwt from "jsonwebtoken";
import { z } from "zod";

const JWT_SECRET = process.env.WIDGET_JWT_SECRET || "REMOVED-CONFIGURE-ENV-VARS";
const JWT_EXPIRY = "1h";

export interface WidgetTokenPayload {
  // Entity identification (at least one should be present for non-homepage)
  businessId?: string;
  businessName?: string;
  businessSlug?: string;
  businessLogoUrl?: string | null;
  churchId?: string;
  churchName?: string;
  churchSlug?: string;
  memberId?: string;
  memberEmail?: string;
  
  // KC Segment ID (format: KC-{TYPE}-{slug}, e.g., KC-BIZ-joes-plumbing)
  segmentId?: string;
  
  // Listing URL for QR destination
  kcListingUrl?: string;
  ownerEmail?: string;
  
  // Partner and placement context
  partnerId?: string;
  placement?: 'homepage' | 'church' | 'business' | 'member' | 'dashboard' | 'listing';
  allowedSegments?: string[];
  
  // JWT standard fields
  iat?: number;
  exp?: number;
}

export const widgetTokenSchema = z.object({
  // Entity identification
  businessId: z.string().optional(),
  businessName: z.string().optional(),
  businessSlug: z.string().optional(),
  businessLogoUrl: z.string().url().optional().nullable(),
  churchId: z.string().optional(),
  churchName: z.string().optional(),
  churchSlug: z.string().optional(),
  memberId: z.string().optional(),
  memberEmail: z.string().email().optional(),
  
  // URLs and contact
  kcListingUrl: z.string().url().optional(),
  ownerEmail: z.string().email().optional(),
  
  // Partner and placement
  partnerId: z.string().optional(),
  placement: z.enum(['homepage', 'church', 'business', 'member', 'dashboard', 'listing']).optional(),
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
    
    const validated = widgetTokenSchema.parse(decoded);
    
    return {
      ...validated,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    console.error("Widget token verification failed:", error);
    return null;
  }
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
