import jwt from "jsonwebtoken";
import { z } from "zod";

const JWT_SECRET = process.env.WIDGET_JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRY = "1h";

export interface WidgetTokenPayload {
  businessId: string;
  businessName: string;
  businessLogoUrl?: string;
  kcListingUrl: string;
  iat?: number;
  exp?: number;
}

export const widgetTokenSchema = z.object({
  businessId: z.string(),
  businessName: z.string(),
  businessLogoUrl: z.string().url().optional(),
  kcListingUrl: z.string().url(),
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
  return `${baseUrl}/widget?token=${encodeURIComponent(token)}`;
}
