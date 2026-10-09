import { randomBytes, createHash } from 'crypto';
import type express from 'express';
import { db } from '../core';
import { requireAdmin } from '../middleware';
import { MARKETPLACE_ACCOUNTS_COLLECTION, type MarketplacePlatform } from '../constants';
import * as amazon from './amazon-sp-api';
import * as ebay from './ebay-api';
import * as etsy from './etsy-api';

// Reuse the existing server-only OAuth state collection for all providers.
const STATE_COLLECTION = 'oauth_pkce_state';
const UI_PATH = '/admin/marketplaces';
const DEFAULT_UI = `https://qrgear-c1ffd.web.app${UI_PATH}`;
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/api/marketplace' };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const config = {
  amazon: ['AMAZON_SP_APP_ID', 'AMAZON_SP_CLIENT_ID', 'AMAZON_SP_CLIENT_SECRET', 'AMAZON_SP_REDIRECT_URI'],
  ebay: ['EBAY_APP_ID', 'EBAY_CERT_ID', 'EBAY_RUNAME', 'EBAY_REDIRECT_URI'],
  etsy: ['ETSY_KEYSTRING', 'ETSY_SHARED_SECRET', 'ETSY_REDIRECT_URI'],
};
function returnUrl(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_UI;
  const url = new URL(raw);
  const allowed = ['https://qrgear.com', 'https://www.qrgear.com', 'https://qrgear-c1ffd.web.app', 'https://qrgear-c1ffd.firebaseapp.com'];
  for (const name of ['AMAZON_SP_ADMIN_REDIRECT_BASE', 'EBAY_ADMIN_REDIRECT_BASE', 'ETSY_ADMIN_REDIRECT_BASE']) {
    if (process.env[name]) allowed.push(new URL(process.env[name]!).origin);
  }
  if (!allowed.includes(url.origin) || url.pathname !== UI_PATH) throw new Error('Invalid marketplace return address.');
  return `${url.origin}${UI_PATH}`;
}
export function publicMarketplaceAccount(data: Record<string, any>, id: string): Record<string, any> & { id: string } {
  const visible: Record<string, any> = Object.fromEntries(Object.entries(data).filter(([key]) => !/token|secret|verifier|oauthAttempt|feePercent/i.test(key)));
  // Old incomplete connections cannot show a connected badge.
  const platform = data.platform;
  const identity = platform === 'amazon' ? data.amazonSellerId && data.amazonMarketplaceId : platform === 'ebay' ? data.ebayUserId : data.etsyShopId;
  visible[`${platform}Connected`] = !!(data[`${platform}Connected`] && data[`${platform}RefreshToken`] && identity);
  if (!visible[`${platform}Connected`]) visible.healthStatus = 'unknown';
  return { ...visible, id };
}

export function registerMarketplaceOAuth(app: express.Express, platform: MarketplacePlatform): void {
  // Firebase Hosting forwards only the __session cookie to Cloud Functions.
  const cookieName = '__session';
  app.get(`/marketplace/${platform}/oauth/start`, requireAdmin, async (req, res): Promise<void> => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const accountId = req.query.accountId;
      if (typeof accountId !== 'string' || !accountId) { res.status(400).json({ error: 'accountId is required' }); return; }
      const ref = db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId), doc = await ref.get();
      if (!doc.exists) { res.status(404).json({ error: 'Account not found' }); return; }
      if (doc.data()!.platform !== platform || !doc.data()!.isActive) { res.status(400).json({ error: 'Select an active account for this marketplace.' }); return; }
      const missing = config[platform].filter(key => !process.env[key]);
      if (missing.length) { res.status(503).json({ error: `${platform} app is not configured. Missing server settings: ${missing.join(', ')}.`, setupRequired: true }); return; }
      const target = returnUrl(req.query.returnTo);
      const redirectKey = platform === 'amazon' ? 'AMAZON_SP_REDIRECT_URI' : `${platform.toUpperCase()}_REDIRECT_URI`;
      const callback = new URL(process.env[redirectKey]!);
      if (callback.origin !== new URL(target).origin || callback.pathname !== `/api/marketplace/${platform}/oauth/callback`) {
        res.status(503).json({ error: `Configure the ${platform} callback for ${new URL(target).origin}/api/marketplace/${platform}/oauth/callback before connecting.`, setupRequired: true }); return;
      }
      const state = randomBytes(32).toString('base64url'), browserSecret = randomBytes(32).toString('base64url');
      const verifier = platform === 'etsy' ? etsy.generateCodeVerifier() : '';
      const oauthUrl = platform === 'amazon' ? amazon.buildOAuthUrl(state) : platform === 'ebay' ? ebay.buildOAuthUrl(state) : etsy.buildOAuthUrl(state, etsy.generateCodeChallenge(verifier));
      await db.collection(STATE_COLLECTION).doc(hash(state)).set({ accountId, platform, returnTo: target, codeVerifier: verifier,
        browserHash: hash(browserSecret), expiresAt: Date.now() + 10 * 60 * 1000 });
      await ref.update({ oauthAttempt: hash(state) });
      res.cookie(cookieName, browserSecret, { ...COOKIE_OPTIONS, maxAge: 10 * 60 * 1000 });
      res.json({ oauthUrl, accountId });
    } catch { console.error('[Marketplace OAuth] Start failed:', platform); res.status(500).json({ error: `Could not start ${platform} authorization. Check app configuration.` }); }
  });

  app.get(`/marketplace/${platform}/oauth/callback`, async (req, res): Promise<void> => {
    res.set('Cache-Control', 'private, no-store');
    let target = DEFAULT_UI;
    try {
      const state = req.query.state;
      if (typeof state !== 'string' || !/^[\w-]{43}$/.test(state)) throw new Error('Invalid or expired authorization. Start Connect again.');
      const secret = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      const attempt = await db.runTransaction(async tx => {
        const ref = db.collection(STATE_COLLECTION).doc(hash(state)), snap = await tx.get(ref), data = snap.data();
        if (!data || data.platform !== platform || !secret || data.browserHash !== hash(secret) || data.expiresAt <= Date.now()) throw new Error('Invalid or expired authorization. Start Connect again.');
        tx.delete(ref); return data;
      });
      target = returnUrl(attempt.returnTo);
      res.clearCookie(cookieName, COOKIE_OPTIONS);
      if (req.query.error) throw new Error('Marketplace authorization was declined.');
      const code = platform === 'amazon' ? req.query.spapi_oauth_code : req.query.code;
      if (typeof code !== 'string' || !code) throw new Error('Marketplace did not return an authorization code.');
      const tokens = platform === 'amazon' ? await amazon.exchangeAuthCodeForTokens(code) : platform === 'ebay' ? await ebay.exchangeAuthCodeForTokens(code) : await etsy.exchangeAuthCodeForTokens(code, attempt.codeVerifier);
      if (!tokens.access_token || !tokens.refresh_token) throw new Error('Marketplace did not grant a complete connection. Start Connect again.');
      const timestamp = new Date().toISOString();
      const updates: Record<string, any> = { [`${platform}Connected`]: true, [`${platform}RefreshToken`]: tokens.refresh_token,
        [`${platform}ConnectedAt`]: timestamp, apiKeyConfigured: true, healthStatus: 'healthy', lastHealthCheck: timestamp, healthError: null, updatedAt: timestamp, oauthAttempt: null };
      if (platform === 'amazon') {
        const sellerId = req.query.selling_partner_id;
        if (typeof sellerId !== 'string' || !/^[A-Z0-9]+$/.test(sellerId)) throw new Error('Amazon did not return a seller ID.');
        const marketplaceIds = await amazon.getSellerMarketplaceIds(tokens.access_token);
        // Publishing currently uses North America/US attributes. Do not silently select an unsupported region.
        if (!marketplaceIds.includes('ATVPDKIKX0DER')) throw new Error('This integration currently requires an active Amazon US marketplace.');
        Object.assign(updates, { amazonSellerId: sellerId, amazonMarketplaceIds: marketplaceIds, amazonMarketplaceId: 'ATVPDKIKX0DER', shopId: sellerId });
      } else if (platform === 'ebay') {
        const identity = await ebay.getEbayUserInfo(tokens.access_token);
        if (!identity.userId) throw new Error('eBay did not confirm the seller identity.');
        Object.assign(updates, { ebayUserId: identity.userId, ebayUsername: identity.username, shopId: identity.userId, shopName: identity.username });
      } else {
        const identity = await etsy.getEtsyShopInfo(tokens.access_token);
        if (!identity.shopId || !identity.userId) throw new Error('Etsy did not confirm the shop identity.');
        Object.assign(updates, { etsyUserId: identity.userId, etsyShopId: identity.shopId, etsyShopName: identity.shopName, shopId: identity.shopId, shopName: identity.shopName });
      }
      await db.runTransaction(async tx => {
        const ref = db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(attempt.accountId), snap = await tx.get(ref), data = snap.data();
        if (!data || data.platform !== platform || !data.isActive || data.oauthAttempt !== hash(state)) throw new Error('Account changed during authorization. Start Connect again.');
        tx.update(ref, updates);
      });
      res.redirect(`${target}?${platform}_connect=success&accountId=${encodeURIComponent(attempt.accountId)}`);
    } catch {
      // Never send provider responses, tokens, or authorization codes to the browser/logs.
      console.error('[Marketplace OAuth] Authorization failed:', platform);
      res.redirect(`${target}?${platform}_connect=error&reason=${encodeURIComponent('Connection could not be verified. Check app configuration, seller permissions and try Connect again.')}`);
    }
  });

  app.delete(`/admin/surfaces/accounts/:accountId/${platform}-disconnect`, requireAdmin, async (req, res): Promise<void> => {
    try {
      const ref = db.collection(MARKETPLACE_ACCOUNTS_COLLECTION).doc(req.params.accountId), snap = await ref.get();
      if (!snap.exists || snap.data()!.platform !== platform) { res.status(404).json({ error: 'Marketplace account not found' }); return; }
      const updates: Record<string, any> = { [`${platform}Connected`]: false, [`${platform}RefreshToken`]: '', [`${platform}ConnectedAt`]: null,
        apiKeyConfigured: false, healthStatus: 'unknown', healthError: null, oauthAttempt: null, updatedAt: new Date().toISOString() };
      for (const key of platform === 'amazon' ? ['amazonSellerId', 'amazonMarketplaceId'] : platform === 'ebay' ? ['ebayUserId', 'ebayUsername'] : ['etsyUserId', 'etsyShopId', 'etsyShopName']) updates[key] = '';
      await ref.update(updates); res.json({ success: true, accountId: req.params.accountId });
    } catch { res.status(500).json({ error: 'Could not disconnect marketplace account.' }); }
  });
}
