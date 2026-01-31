import { signWidgetToken, createWidgetUrl, type WidgetTokenPayload } from "./widget-auth";

/**
 * Helper utility for Kingdom Connects to generate widget tokens
 * 
 * Usage in Kingdom Connects Firebase Functions:
 * 
 * ```javascript
 * const payload = {
 *   businessId: business.id,
 *   businessName: business.name,
 *   businessLogoUrl: business.logoUrl,
 *   kcListingUrl: `https://kingdomconnects.com/business/${business.slug}`
 * };
 * 
 * const widgetUrl = createQRGearWidgetUrl(payload);
 * // Embed: <iframe src={widgetUrl} width="100%" height="600"></iframe>
 * ```
 */

export function createQRGearWidgetUrl(business: {
  id: string;
  name: string;
  logoUrl?: string;
  listingUrl: string;
}): string {
  const payload: WidgetTokenPayload = {
    businessId: business.id,
    businessName: business.name,
    businessLogoUrl: business.logoUrl,
    kcListingUrl: business.listingUrl,
  };

  const baseUrl = process.env.QRGEAR_BASE_URL || "http://localhost:5000";
  return createWidgetUrl(baseUrl, payload);
}

// Example for testing/development
export function generateDemoWidgetUrl(): string {
  return createQRGearWidgetUrl({
    id: "demo-business-123",
    name: "Joe's Plumbing & Heating",
    logoUrl: "https://via.placeholder.com/100x100.png?text=JP",
    listingUrl: "https://kingdomconnects.com/business/joes-plumbing",
  });
}

// CLI test - run with: tsx server/lib/widget-token-generator.ts
if (require.main === module) {
  console.log("\n🎨 QR Gear Widget Demo URL Generator\n");
  console.log("Copy this URL into Kingdom Connects iframe:");
  console.log("\n" + generateDemoWidgetUrl() + "\n");
  
  console.log("\nOr use in Kingdom Connects admin panel:");
  console.log(`<iframe src="${generateDemoWidgetUrl()}" width="100%" height="600" frameborder="0"></iframe>\n`);
}
