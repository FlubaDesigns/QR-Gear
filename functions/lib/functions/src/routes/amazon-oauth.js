"use strict";
/**
 * Amazon SP-API OAuth routes
 *
 * GET  /marketplace/amazon/oauth/start?accountId=XXX
 *   → Returns the Seller Central authorization URL for the admin to open.
 *
 * GET  /marketplace/amazon/oauth/callback?spapi_oauth_code=XXX&state=ACCOUNT_ID&selling_partner_id=SELLER_ID
 *   → Exchanges auth code for tokens, stores refresh token + seller ID on the
 *     marketplace_accounts document, then redirects back to the admin UI.
 *
 * DELETE /admin/surfaces/accounts/:accountId/amazon-disconnect
 *   → Removes stored Amazon credentials from the account document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const constants_1 = require("../constants");
const amazon_sp_api_1 = require("../services/amazon-sp-api");
const ADMIN_UI_BASE = process.env.AMAZON_SP_ADMIN_REDIRECT_BASE || 'https://qrgear.com/admin/marketplaces';
function register(app) {
    // ── Start OAuth flow ────────────────────────────────────────────────────────
    // Called by the frontend. Returns the Seller Central URL for the admin to open.
    // We use the accountId as the OAuth state so the callback knows which account
    // to store the resulting credentials on.
    app.get('/marketplace/amazon/oauth/start', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.query;
            if (!accountId) {
                res.status(400).json({ error: 'accountId is required' });
                return;
            }
            // Verify the account exists and is an Amazon account
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            const data = doc.data();
            if (data.platform !== 'amazon') {
                res.status(400).json({ error: 'Account is not an Amazon account' });
                return;
            }
            let oauthUrl;
            try {
                oauthUrl = (0, amazon_sp_api_1.buildOAuthUrl)(accountId);
            }
            catch (err) {
                res.status(503).json({
                    error: 'Amazon SP-API app credentials not configured on this server yet.',
                    detail: err.message,
                    setupRequired: true,
                });
                return;
            }
            res.json({ oauthUrl, accountId });
        }
        catch (error) {
            console.error('[Amazon OAuth] start error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── OAuth callback ──────────────────────────────────────────────────────────
    // Amazon redirects here after the seller authorizes the app.
    // Query params from Amazon:
    //   spapi_oauth_code   — authorization code to exchange for tokens
    //   state              — the accountId we passed in the OAuth URL
    //   selling_partner_id — seller ID provided directly by Amazon (use this first)
    app.get('/marketplace/amazon/oauth/callback', async (req, res) => {
        const { spapi_oauth_code, state: accountId, selling_partner_id, error: oauthError } = req.query;
        if (oauthError) {
            console.error('[Amazon OAuth] callback error from Amazon:', oauthError);
            res.redirect(`${ADMIN_UI_BASE}?amazon_connect=error&reason=${encodeURIComponent(oauthError)}`);
            return;
        }
        if (!spapi_oauth_code || !accountId) {
            res.redirect(`${ADMIN_UI_BASE}?amazon_connect=error&reason=missing_params`);
            return;
        }
        try {
            // Exchange authorization code for tokens
            const tokens = await (0, amazon_sp_api_1.exchangeAuthCodeForTokens)(spapi_oauth_code);
            const accessToken = tokens.access_token;
            const refreshToken = tokens.refresh_token || '';
            // Use the seller_id Amazon gave us directly; fall back to SP-API lookup
            let sellerId = selling_partner_id || '';
            let marketplaceIds = [];
            if (!sellerId || sellerId === 'undefined') {
                try {
                    const info = await (0, amazon_sp_api_1.getSellerIdFromToken)(accessToken);
                    sellerId = info.sellerId;
                    marketplaceIds = info.marketplaceIds;
                }
                catch (err) {
                    console.warn('[Amazon OAuth] Could not auto-retrieve seller info:', err.message);
                }
            }
            // Verify the account document still exists
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.redirect(`${ADMIN_UI_BASE}?amazon_connect=error&reason=account_not_found`);
                return;
            }
            // Store credentials on the account document
            const updates = {
                amazonConnected: true,
                amazonRefreshToken: refreshToken,
                amazonConnectedAt: new Date().toISOString(),
            };
            if (sellerId)
                updates.amazonSellerId = sellerId;
            if (marketplaceIds.length > 0)
                updates.amazonMarketplaceIds = marketplaceIds;
            // Default marketplace to US if we got an ID list
            if (marketplaceIds.length > 0 && !doc.data()?.amazonMarketplaceId) {
                updates.amazonMarketplaceId = marketplaceIds.includes('ATVPDKIKX0DER') ? 'ATVPDKIKX0DER' : marketplaceIds[0];
            }
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update(updates);
            console.log(`[Amazon OAuth] Connected account ${accountId}, seller=${sellerId}`);
            res.redirect(`${ADMIN_UI_BASE}?amazon_connect=success&accountId=${accountId}`);
        }
        catch (error) {
            console.error('[Amazon OAuth] callback processing error:', error);
            res.redirect(`${ADMIN_UI_BASE}?amazon_connect=error&reason=${encodeURIComponent(error.message)}`);
        }
    });
    // ── Disconnect Amazon account ───────────────────────────────────────────────
    app.delete('/admin/surfaces/accounts/:accountId/amazon-disconnect', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update({
                amazonConnected: false,
                amazonRefreshToken: '',
                amazonSellerId: '',
                amazonConnectedAt: null,
            });
            res.json({ success: true, accountId });
        }
        catch (error) {
            console.error('[Amazon OAuth] disconnect error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=amazon-oauth.js.map