"use strict";
/**
 * Etsy OAuth 2.0 (PKCE) routes
 *
 * GET  /marketplace/etsy/oauth/start?accountId=XXX
 *   → Generates PKCE verifier, stores it in Firestore, returns the Etsy auth URL.
 *
 * GET  /marketplace/etsy/oauth/callback?code=XXX&state=ACCOUNT_ID
 *   → Retrieves PKCE verifier from Firestore, exchanges code for tokens,
 *     fetches shop info, stores everything on the account doc, redirects to admin UI.
 *
 * DELETE /admin/surfaces/accounts/:accountId/etsy-disconnect
 *   → Removes stored Etsy credentials from the account document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const constants_1 = require("../constants");
const etsy_api_1 = require("../services/etsy-api");
const ADMIN_UI_BASE = process.env.ETSY_ADMIN_REDIRECT_BASE || 'https://qrgear.com/admin/marketplaces';
const PKCE_COLLECTION = 'oauth_pkce_state';
function register(app) {
    // ── Start OAuth flow ────────────────────────────────────────────────────────
    app.get('/marketplace/etsy/oauth/start', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.query;
            if (!accountId) {
                res.status(400).json({ error: 'accountId is required' });
                return;
            }
            // Verify the account exists and is an Etsy account
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            const data = doc.data();
            if (data.platform !== 'etsy') {
                res.status(400).json({ error: 'Account is not an Etsy account' });
                return;
            }
            // Generate PKCE verifier + challenge
            const codeVerifier = (0, etsy_api_1.generateCodeVerifier)();
            const codeChallenge = (0, etsy_api_1.generateCodeChallenge)(codeVerifier);
            // Store verifier in Firestore keyed by accountId (TTL: 10 minutes)
            await core_1.db.collection(PKCE_COLLECTION).doc(accountId).set({
                codeVerifier,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            });
            let oauthUrl;
            try {
                oauthUrl = (0, etsy_api_1.buildOAuthUrl)(accountId, codeChallenge);
            }
            catch (err) {
                res.status(503).json({
                    error: 'Etsy app credentials not configured on this server yet.',
                    detail: err.message,
                    setupRequired: true,
                });
                return;
            }
            res.json({ oauthUrl, accountId });
        }
        catch (error) {
            console.error('[Etsy OAuth] start error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── OAuth callback ──────────────────────────────────────────────────────────
    app.get('/marketplace/etsy/oauth/callback', async (req, res) => {
        const { code, state: accountId, error: oauthError, error_description } = req.query;
        if (oauthError) {
            console.error('[Etsy OAuth] callback error from Etsy:', oauthError, error_description);
            res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=${encodeURIComponent(error_description || oauthError)}`);
            return;
        }
        if (!code || !accountId) {
            res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=missing_params`);
            return;
        }
        try {
            // Retrieve stored PKCE verifier
            const pkceDoc = await core_1.db.collection(PKCE_COLLECTION).doc(accountId).get();
            if (!pkceDoc.exists) {
                res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=pkce_state_not_found`);
                return;
            }
            const pkceData = pkceDoc.data();
            const codeVerifier = pkceData?.codeVerifier;
            if (!codeVerifier) {
                res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=pkce_verifier_missing`);
                return;
            }
            // Check expiry
            if (pkceData.expiresAt && new Date(pkceData.expiresAt) < new Date()) {
                res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=pkce_state_expired`);
                return;
            }
            // Clean up PKCE state
            await core_1.db.collection(PKCE_COLLECTION).doc(accountId).delete();
            // Exchange code for tokens
            const tokens = await (0, etsy_api_1.exchangeAuthCodeForTokens)(code, codeVerifier);
            const accessToken = tokens.access_token;
            const refreshToken = tokens.refresh_token;
            if (!refreshToken) {
                console.error('[Etsy OAuth] No refresh token in token response');
                res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=no_refresh_token`);
                return;
            }
            // Fetch shop info
            let userId = '';
            let shopId = '';
            let shopName = '';
            try {
                const shopInfo = await (0, etsy_api_1.getEtsyShopInfo)(accessToken);
                userId = shopInfo.userId;
                shopId = shopInfo.shopId;
                shopName = shopInfo.shopName;
            }
            catch (err) {
                console.warn('[Etsy OAuth] Could not auto-retrieve shop info:', err.message);
            }
            // Verify account still exists
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=account_not_found`);
                return;
            }
            // Store credentials
            const updates = {
                etsyConnected: true,
                etsyRefreshToken: refreshToken,
                etsyConnectedAt: new Date().toISOString(),
            };
            if (userId)
                updates.etsyUserId = userId;
            if (shopId)
                updates.etsyShopId = shopId;
            if (shopName)
                updates.etsyShopName = shopName;
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update(updates);
            console.log(`[Etsy OAuth] Connected account ${accountId}, shopId=${shopId}, shopName=${shopName}`);
            res.redirect(`${ADMIN_UI_BASE}?etsy_connect=success&accountId=${accountId}`);
        }
        catch (error) {
            console.error('[Etsy OAuth] callback processing error:', error);
            res.redirect(`${ADMIN_UI_BASE}?etsy_connect=error&reason=${encodeURIComponent(error.message)}`);
        }
    });
    // ── Disconnect Etsy account ─────────────────────────────────────────────────
    app.delete('/admin/surfaces/accounts/:accountId/etsy-disconnect', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update({
                etsyConnected: false,
                etsyRefreshToken: '',
                etsyUserId: '',
                etsyShopId: '',
                etsyShopName: '',
                etsyConnectedAt: null,
            });
            res.json({ success: true, accountId });
        }
        catch (error) {
            console.error('[Etsy OAuth] disconnect error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=etsy-oauth.js.map