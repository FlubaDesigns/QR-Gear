const _BUILD_ID = '20260506-073933-29671';
console.log('[CF Boot] Build:', _BUILD_ID);
import { onRequest } from 'firebase-functions/v2/https';
import express, { Request, Response, NextFunction } from 'express';
import { corsMiddleware, apiPrefixMiddleware } from './middleware';

import { register as registerWidget } from './routes/widget';
import { register as registerPartner } from './routes/partner';
import { register as registerMockupRoutes } from './routes/mockup-routes';
import { register as registerDesigns } from './routes/designs';
import { register as registerCategories } from './routes/categories';
import { register as registerAuth } from './routes/auth';
import { register as registerAdminSettings } from './routes/admin-settings';
import { register as registerAdminStores } from './routes/admin-stores';
import { register as registerAdminProducts } from './routes/admin-products';
import { register as registerPublic } from './routes/public';
import { register as registerFileRoutes } from './routes/file-routes';
import { register as registerAdminOrders } from './routes/admin-orders';
import { register as registerStripeWebhooks } from './routes/stripe-webhooks';
import { register as registerClaims } from './routes/claims';
import { register as registerProductsPage } from './routes/products-page';
import { register as registerBrain } from './routes/brain';
import { register as registerAdminDashboard } from './routes/admin-dashboard';
import { register as registerMembers } from './routes/members';
import { register as registerPublicStores } from './routes/public-stores';
import { register as registerDynamics } from './routes/dynamics';
import { register as registerReferral } from './routes/referral';
import { register as registerCheckout } from './routes/checkout';
import { register as registerCatalog } from './routes/catalog';
import { register as registerTiers } from './routes/tiers';
import { register as registerAdminMisc } from './routes/admin-misc';
import { register as registerGifts } from './routes/gifts';
import { register as registerOrchestration } from './routes/orchestration';
import { register as registerPackets } from './routes/packets';
import { register as registerImages } from './routes/images';
import { register as registerMemberFiles } from './routes/member-files';
import { register as registerStoreFiles } from './routes/store-files';
import { register as registerSeo } from './routes/seo';
import { register as registerMarketplace } from './routes/marketplace';
import { register as registerExternalSites } from './routes/external-sites';
import { register as registerCoreRoutes } from './routes/core-routes';
import { register as registerMasterCatalog } from './routes/master-catalog';
import { register as registerAdminCatalogInstances } from './routes/admin-catalog-instances';
import { register as registerMemberCatalogInstances } from './routes/member-catalog-instances';
import { register as registerPrintPlacements } from './routes/print-placements';
import { register as registerAmCrud } from './routes/am-crud';
import { register as registerAmSync } from './routes/am-sync';
import { register as registerAmUtility } from './routes/am-utility';
import { registerMembersLibraryRoutes } from './routes/members-library';
import { registerCoreCheckoutRoutes } from './routes/core-routes-checkout';
import { registerExternalSitesPublicRoutes } from './routes/external-sites-public';
import { register as registerPpBuilder } from './routes/pp-builder';
import { register as registerPpCatalog } from './routes/pp-catalog';
import { registerPpCatalogBrowseRoutes } from './routes/pp-catalog-browse';
import { register as registerPpPricingPackets } from './routes/pp-pricing-packets';
import { registerAdminBuildSessions } from './routes/admin-build-sessions';
import { registerBld } from './routes/bld';
import { registerAssemblies } from './routes/assemblies';
import { register as registerAmazonOAuth } from './routes/amazon-oauth';
import { register as registerEbayOAuth } from './routes/ebay-oauth';
import { register as registerEtsyOAuth } from './routes/etsy-oauth';
import { register as registerConnect } from './routes/connect';

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(apiPrefixMiddleware);

registerWidget(app);
registerPartner(app);
registerMockupRoutes(app);
registerDesigns(app);
registerCategories(app);
registerAuth(app);
registerAdminSettings(app);
registerAdminStores(app);
registerAdminProducts(app);
registerPublic(app);
registerFileRoutes(app);
registerAdminOrders(app);
registerStripeWebhooks(app);
registerClaims(app);
registerProductsPage(app);
registerBrain(app);
registerAdminDashboard(app);
registerMembers(app);
registerPublicStores(app);
registerDynamics(app);
registerReferral(app);
registerCheckout(app);
registerCatalog(app);
registerTiers(app);
registerAdminMisc(app);
registerGifts(app);
registerOrchestration(app);
registerPackets(app);
registerImages(app);
registerMemberFiles(app);
registerStoreFiles(app);
registerSeo(app);
registerMarketplace(app);
registerExternalSites(app);
registerCoreRoutes(app);
registerMasterCatalog(app);
registerAdminCatalogInstances(app);
registerMemberCatalogInstances(app);
registerPrintPlacements(app);
registerAmCrud(app);
registerAmSync(app);
registerAmUtility(app);
registerMembersLibraryRoutes(app);
registerCoreCheckoutRoutes(app);
registerExternalSitesPublicRoutes(app);
registerPpBuilder(app);
registerPpCatalog(app);
registerPpCatalogBrowseRoutes(app);
registerPpPricingPackets(app);
registerAdminBuildSessions(app);
registerBld(app);
registerAssemblies(app);
registerAmazonOAuth(app);
registerEbayOAuth(app);
registerEtsyOAuth(app);
registerConnect(app);

app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export const api = onRequest(
  {
    timeoutSeconds: 3600,
    memory: '256MiB',
    cors: true,
    labels: { 'build-id': '20260503-timeout-fix-retry' },
  },
  app
);

// deployed: 20260418T234106Z
// deployed: 2026-04-19T00:21:12Z
// deployed: 2026-04-19T06:23:38Z — full audit fix: registered 10 missing route files + admin-build-sessions
// deployed: 2026-04-19T06:35:00Z — audit v2: added sync-master-products alias to master-catalog

// deploy-1776830756

export const BUILD_TAG = "oil-change-rules-indexes-20260423";
