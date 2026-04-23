"use strict";
/**
 * eBay OAuth 2.0 routes
 *
 * GET  /marketplace/ebay/oauth/start?accountId=XXX
 *   → Returns the eBay authorization URL for the admin to open.
 *
 * GET  /marketplace/ebay/oauth/callback?code=XXX&state=ACCOUNT_ID
 *   → Exchanges auth code for tokens, stores refresh token + user info on the
 *     marketplace_accounts document, then redirects back to the admin UI.
 *
 * DELETE /admin/surfaces/accounts/:accountId/ebay-disconnect
 *   → Removes stored eBay credentials from the account document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const constants_1 = require("../constants");
const ebay_api_1 = require("../services/ebay-api");
const ADMIN_UI_BASE = process.env.EBAY_ADMIN_REDIRECT_BASE || 'https://qrgear.com/admin/marketplaces';
function register(app) {
    // ── Start OAuth flow ────────────────────────────────────────────────────────
    // Called by the frontend. Returns the eBay authorization URL for the admin to open.
    // We use the accountId as the OAuth state so the callback knows which account
    // to store the resulting credentials on.
    app.get('/marketplace/ebay/oauth/start', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.query;
            if (!accountId) {
                res.status(400).json({ error: 'accountId is required' });
                return;
            }
            // Verify the account exists and is an eBay account
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            const data = doc.data();
            if (data.platform !== 'ebay') {
                res.status(400).json({ error: 'Account is not an eBay account' });
                return;
            }
            let oauthUrl;
            try {
                oauthUrl = (0, ebay_api_1.buildOAuthUrl)(accountId);
            }
            catch (err) {
                res.status(503).json({
                    error: 'eBay app credentials not configured on this server yet.',
                    detail: err.message,
                    setupRequired: true,
                });
                return;
            }
            res.json({ oauthUrl, accountId });
        }
        catch (error) {
            console.error('[eBay OAuth] start error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ── OAuth callback ──────────────────────────────────────────────────────────
    // eBay redirects here after the seller authorizes the app.
    // Query params from eBay:
    //   code   — authorization code to exchange for tokens
    //   state  — the accountId we passed in the OAuth URL
    //   expires_in — code expiry (informational)
    app.get('/marketplace/ebay/oauth/callback', async (req, res) => {
        const { code, state: accountId, error: oauthError, error_description } = req.query;
        if (oauthError) {
            console.error('[eBay OAuth] callback error from eBay:', oauthError, error_description);
            res.redirect(`${ADMIN_UI_BASE}?ebay_connect=error&reason=${encodeURIComponent(error_description || oauthError)}`);
            return;
        }
        if (!code || !accountId) {
            res.redirect(`${ADMIN_UI_BASE}?ebay_connect=error&reason=missing_params`);
            return;
        }
        try {
            // Exchange authorization code for tokens
            const tokens = await (0, ebay_api_1.exchangeAuthCodeForTokens)(code);
            const accessToken = tokens.access_token;
            const refreshToken = tokens.refresh_token || '';
            if (!refreshToken) {
                console.error('[eBay OAuth] No refresh token in token response — check scopes include offline_access or user-token scopes');
                res.redirect(`${ADMIN_UI_BASE}?ebay_connect=error&reason=no_refresh_token`);
                return;
            }
            // Retrieve eBay user info
            let userId = '';
            let username = '';
            try {
                const userInfo = await (0, ebay_api_1.getEbayUserInfo)(accessToken);
                userId = userInfo.userId;
                username = userInfo.username;
            }
            catch (err) {
                console.warn('[eBay OAuth] Could not auto-retrieve eBay user info:', err.message);
            }
            // Verify the account document still exists
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.redirect(`${ADMIN_UI_BASE}?ebay_connect=error&reason=account_not_found`);
                return;
            }
            // Store credentials on the account document
            const updates = {
                ebayConnected: true,
                ebayRefreshToken: refreshToken,
                ebayConnectedAt: new Date().toISOString(),
            };
            if (userId)
                updates.ebayUserId = userId;
            if (username)
                updates.ebayUsername = username;
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update(updates);
            console.log(`[eBay OAuth] Connected account ${accountId}, username=${username}, userId=${userId}`);
            res.redirect(`${ADMIN_UI_BASE}?ebay_connect=success&accountId=${accountId}`);
        }
        catch (error) {
            console.error('[eBay OAuth] callback processing error:', error);
            res.redirect(`${ADMIN_UI_BASE}?ebay_connect=error&reason=${encodeURIComponent(error.message)}`);
        }
    });
    // ── Disconnect eBay account ─────────────────────────────────────────────────
    app.delete('/admin/surfaces/accounts/:accountId/ebay-disconnect', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update({
                ebayConnected: false,
                ebayRefreshToken: '',
                ebayUserId: '',
                ebayUsername: '',
                ebayConnectedAt: null,
            });
            res.json({ success: true, accountId });
        }
        catch (error) {
            console.error('[eBay OAuth] disconnect error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=ebay-oauth.js.map