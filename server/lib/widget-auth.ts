import jwt from "jsonwebtoken";
import { z } from "zod";

const JWT_SECRET = process.env.WIDGET_JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRY = "1h";

export interface WidgetTokenPayload {
  businessId: string;
  businessName: string;
  businessSlug?: string;
  businessLogoUrl?: string | null;
  kcListingUrl: string;
  ownerEmail?: string;
  partnerId?: string;
  allowedSegments?: string[];
  context?: 'homepage' | 'dashboard' | 'listing';
  iat?: number;
  exp?: number;
}

export const widgetTokenSchema = z.object({
  businessId: z.string(),
  businessName: z.string(),
  businessSlug: z.string().optional(),
  businessLogoUrl: z.string().url().optional().nullable(),
  kcListingUrl: z.string().url(),
  ownerEmail: z.string().email().optional(),
  partnerId: z.string().optional(),
  allowedSegments: z.array(z.string()).optional(),
  context: z.enum(['homepage', 'dashboard', 'listing']).optional(),
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

export function createWidgetUrl(baseUrl: string, payload: WidgetTokenPayload, segment?: string): string {
  const token = signWidgetToken(payload);
  let url = `${baseUrl}/widget?token=${encodeURIComponent(token)}`;
  if (segment) {
    url += `&segment=${encodeURIComponent(segment)}`;
  }
  return url;
}
