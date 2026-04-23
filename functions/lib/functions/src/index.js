"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILD_TAG = exports.api = void 0;
const _BUILD_ID = '20260423-stripe-connect-payouts-v1';
console.log('[CF Boot] Build:', _BUILD_ID);
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const middleware_1 = require("./middleware");
const widget_1 = require("./routes/widget");
const partner_1 = require("./routes/partner");
const mockup_routes_1 = require("./routes/mockup-routes");
const designs_1 = require("./routes/designs");
const categories_1 = require("./routes/categories");
const auth_1 = require("./routes/auth");
const admin_settings_1 = require("./routes/admin-settings");
const admin_stores_1 = require("./routes/admin-stores");
const admin_products_1 = require("./routes/admin-products");
const public_1 = require("./routes/public");
const file_routes_1 = require("./routes/file-routes");
const admin_orders_1 = require("./routes/admin-orders");
const stripe_webhooks_1 = require("./routes/stripe-webhooks");
const claims_1 = require("./routes/claims");
const products_page_1 = require("./routes/products-page");
const brain_1 = require("./routes/brain");
const members_1 = require("./routes/members");
const public_stores_1 = require("./routes/public-stores");
const dynamics_1 = require("./routes/dynamics");
const referral_1 = require("./routes/referral");
const checkout_1 = require("./routes/checkout");
const catalog_1 = require("./routes/catalog");
const tiers_1 = require("./routes/tiers");
const admin_misc_1 = require("./routes/admin-misc");
const gifts_1 = require("./routes/gifts");
const orchestration_1 = require("./routes/orchestration");
const packets_1 = require("./routes/packets");
const images_1 = require("./routes/images");
const member_files_1 = require("./routes/member-files");
const store_files_1 = require("./routes/store-files");
const seo_1 = require("./routes/seo");
const marketplace_1 = require("./routes/marketplace");
const external_sites_1 = require("./routes/external-sites");
const core_routes_1 = require("./routes/core-routes");
const master_catalog_1 = require("./routes/master-catalog");
const admin_catalog_instances_1 = require("./routes/admin-catalog-instances");
const member_catalog_instances_1 = require("./routes/member-catalog-instances");
const print_placements_1 = require("./routes/print-placements");
const am_crud_1 = require("./routes/am-crud");
const am_sync_1 = require("./routes/am-sync");
const am_utility_1 = require("./routes/am-utility");
const members_library_1 = require("./routes/members-library");
const core_routes_checkout_1 = require("./routes/core-routes-checkout");
const external_sites_public_1 = require("./routes/external-sites-public");
const pp_builder_1 = require("./routes/pp-builder");
const pp_catalog_1 = require("./routes/pp-catalog");
const pp_catalog_browse_1 = require("./routes/pp-catalog-browse");
const pp_pricing_packets_1 = require("./routes/pp-pricing-packets");
const admin_build_sessions_1 = require("./routes/admin-build-sessions");
const amazon_oauth_1 = require("./routes/amazon-oauth");
const ebay_oauth_1 = require("./routes/ebay-oauth");
const etsy_oauth_1 = require("./routes/etsy-oauth");
const connect_1 = require("./routes/connect");
const app = (0, express_1.default)();
app.use(middleware_1.corsMiddleware);
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: false }));
app.use(middleware_1.apiPrefixMiddleware);
(0, widget_1.register)(app);
(0, partner_1.register)(app);
(0, mockup_routes_1.register)(app);
(0, designs_1.register)(app);
(0, categories_1.register)(app);
(0, auth_1.register)(app);
(0, admin_settings_1.register)(app);
(0, admin_stores_1.register)(app);
(0, admin_products_1.register)(app);
(0, public_1.register)(app);
(0, file_routes_1.register)(app);
(0, admin_orders_1.register)(app);
(0, stripe_webhooks_1.register)(app);
(0, claims_1.register)(app);
(0, products_page_1.register)(app);
(0, brain_1.register)(app);
(0, members_1.register)(app);
(0, public_stores_1.register)(app);
(0, dynamics_1.register)(app);
(0, referral_1.register)(app);
(0, checkout_1.register)(app);
(0, catalog_1.register)(app);
(0, tiers_1.register)(app);
(0, admin_misc_1.register)(app);
(0, gifts_1.register)(app);
(0, orchestration_1.register)(app);
(0, packets_1.register)(app);
(0, images_1.register)(app);
(0, member_files_1.register)(app);
(0, store_files_1.register)(app);
(0, seo_1.register)(app);
(0, marketplace_1.register)(app);
(0, external_sites_1.register)(app);
(0, core_routes_1.register)(app);
(0, master_catalog_1.register)(app);
(0, admin_catalog_instances_1.register)(app);
(0, member_catalog_instances_1.register)(app);
(0, print_placements_1.register)(app);
(0, am_crud_1.register)(app);
(0, am_sync_1.register)(app);
(0, am_utility_1.register)(app);
(0, members_library_1.registerMembersLibraryRoutes)(app);
(0, core_routes_checkout_1.registerCoreCheckoutRoutes)(app);
(0, external_sites_public_1.registerExternalSitesPublicRoutes)(app);
(0, pp_builder_1.register)(app);
(0, pp_catalog_1.register)(app);
(0, pp_catalog_browse_1.registerPpCatalogBrowseRoutes)(app);
(0, pp_pricing_packets_1.register)(app);
(0, admin_build_sessions_1.registerAdminBuildSessions)(app);
(0, amazon_oauth_1.register)(app);
(0, ebay_oauth_1.register)(app);
(0, etsy_oauth_1.register)(app);
(0, connect_1.register)(app);
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
exports.api = (0, https_1.onRequest)({
    timeoutSeconds: 540,
    memory: '1GiB',
    cors: true,
    labels: { 'build-id': '20260423-oil-change-rules-indexes-v1' },
}, app);
// deployed: 20260418T234106Z
// deployed: 2026-04-19T00:21:12Z
// deployed: 2026-04-19T06:23:38Z — full audit fix: registered 10 missing route files + admin-build-sessions
// deployed: 2026-04-19T06:35:00Z — audit v2: added sync-master-products alias to master-catalog
// deploy-1776830756
exports.BUILD_TAG = "oil-change-rules-indexes-20260423";
//# sourceMappingURL=index.js.map