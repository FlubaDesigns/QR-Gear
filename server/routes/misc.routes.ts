import type { Express } from "express";
import { registerSeoGalleryRoutes } from "./misc/seo-gallery.routes";
import { registerStoreProductLinksRoutes } from "./misc/store-product-links.routes";
import { registerHostingTiersRoutes } from "./misc/hosting-tiers.routes";
import { registerQrTemplatesRoutes } from "./misc/qr-templates.routes";
import { registerPartnerStoresEmailRoutes } from "./misc/partner-stores-email.routes";
import { registerBackgroundAssetsRoutes } from "./misc/background-assets.routes";
import { registerFontsAndTestRoutes } from "./misc/fonts-and-test.routes";

export function registerMiscRoutes(app: Express): void {
  registerSeoGalleryRoutes(app);
  registerStoreProductLinksRoutes(app);
  registerHostingTiersRoutes(app);
  registerQrTemplatesRoutes(app);
  registerPartnerStoresEmailRoutes(app);
  registerBackgroundAssetsRoutes(app);
  registerFontsAndTestRoutes(app);
}
