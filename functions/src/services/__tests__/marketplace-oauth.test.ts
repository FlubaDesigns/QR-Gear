import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const mocks = vi.hoisted(() => ({ db: null as any, exchange: vi.fn(), identity: vi.fn(), markets: vi.fn(), shop: vi.fn() }));
vi.mock('../../core', () => ({ get db() { return mocks.db; } }));
vi.mock('../../middleware', () => ({ requireAdmin: (req: any, res: any, next: any) => req.headers.authorization === 'Bearer test-admin' ? next() : res.status(401).json({ error: 'Sign in' }) }));
vi.mock('../amazon-sp-api', () => ({ buildOAuthUrl: (s: string) => `https://sellercentral.amazon.com/authorize?state=${s}`, exchangeAuthCodeForTokens: mocks.exchange, getSellerMarketplaceIds: mocks.markets }));
vi.mock('../ebay-api', () => ({ buildOAuthUrl: (s: string) => `https://auth.ebay.com/authorize?state=${s}`, exchangeAuthCodeForTokens: mocks.exchange, getEbayUserInfo: mocks.identity }));
vi.mock('../etsy-api', () => ({ buildOAuthUrl: (s: string) => `https://www.etsy.com/authorize?state=${s}`, exchangeAuthCodeForTokens: mocks.exchange, getEtsyShopInfo: mocks.shop, generateCodeVerifier: () => 'verifier', generateCodeChallenge: () => 'challenge' }));
import { registerMarketplaceOAuth, publicMarketplaceAccount } from '../marketplace-oauth';
const app = express(); app.use(express.json()); for (const p of ['amazon', 'ebay', 'etsy'] as const) registerMarketplaceOAuth(app, p);
const ui = 'https://qrgear-c1ffd.web.app/admin/marketplaces';
let fixture: ReturnType<typeof database>;
beforeEach(() => {
  vi.clearAllMocks(); fixture = database(Object.fromEntries(['amazon', 'ebay', 'etsy'].map(platform => [`marketplaceAccounts/${platform}`, { platform, isActive: true }]))); mocks.db = fixture.db;
  for (const key of ['AMAZON_SP_APP_ID', 'AMAZON_SP_CLIENT_ID', 'AMAZON_SP_CLIENT_SECRET', 'EBAY_APP_ID', 'EBAY_CERT_ID', 'EBAY_RUNAME', 'ETSY_KEYSTRING', 'ETSY_SHARED_SECRET']) vi.stubEnv(key, 'test-config');
  for (const p of ['amazon', 'ebay', 'etsy']) vi.stubEnv(p === 'amazon' ? 'AMAZON_SP_REDIRECT_URI' : `${p.toUpperCase()}_REDIRECT_URI`, `https://qrgear-c1ffd.web.app/api/marketplace/${p}/oauth/callback`);
  mocks.exchange.mockResolvedValue({ access_token: 'verified-access', refresh_token: 'private-refresh' });
  mocks.identity.mockResolvedValue({ userId: 'seller', username: 'shop' }); mocks.markets.mockResolvedValue(['ATVPDKIKX0DER']); mocks.shop.mockResolvedValue({ userId: '123', shopId: '456', shopName: 'MyShop' });
});
afterEach(() => vi.unstubAllEnvs());
async function begin(platform: string) {
  const res = await request(app).get(`/marketplace/${platform}/oauth/start`).query({ accountId: platform, returnTo: ui }).set('Authorization', 'Bearer test-admin').expect(200);
  return { state: new URL(res.body.oauthUrl).searchParams.get('state')!, cookie: res.headers['set-cookie'][0].split(';')[0] };
}
function callback(platform: string, state: string, cookie: string) {
  return request(app).get(`/marketplace/${platform}/oauth/callback`).query({ state, code: 'code', spapi_oauth_code: 'code', selling_partner_id: 'SELLER123' }).set('Cookie', cookie);
}
describe('Real seller connection contract', () => {
  it.each(['amazon', 'ebay', 'etsy'])('verifies %s identity and persists the authorized account once', async platform => {
    const { state, cookie } = await begin(platform); expect(state).not.toBe(platform); expect(cookie).toMatch(/^__session=/);
    const res = await callback(platform, state, cookie).expect(302); expect(res.headers.location).toContain(`${platform}_connect=success`);
    const saved = fixture.store.get(`marketplaceAccounts/${platform}`); expect(saved[`${platform}Connected`]).toBe(true); expect(saved[`${platform}RefreshToken`]).toBe('private-refresh');
    expect(JSON.stringify(publicMarketplaceAccount(saved, platform))).not.toContain('private-refresh');
    await callback(platform, state, cookie); expect(mocks.exchange).toHaveBeenCalledTimes(1);
    if (platform === 'etsy') expect(mocks.exchange).toHaveBeenCalledWith('code', 'verifier');
  });
  it('requires admin access and validates app configuration before redirecting', async () => {
    await request(app).get('/marketplace/amazon/oauth/start?accountId=amazon').expect(401);
    vi.stubEnv('AMAZON_SP_CLIENT_SECRET', ''); await request(app).get('/marketplace/amazon/oauth/start?accountId=amazon').set('Authorization', 'Bearer test-admin').expect(503);
  });
  it('rejects callbacks from another browser and expired attempts before token exchange', async () => {
    const { state, cookie } = await begin('amazon'); await callback('amazon', state, '__session=wrong'); expect(mocks.exchange).not.toHaveBeenCalled();
    for (const [key, value] of fixture.store) if (key.startsWith('oauth_pkce_state/')) value.expiresAt = 0;
    await callback('amazon', state, cookie); expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it.each(['token', 'seller', 'shop'])('never marks connected when verification fails: %s', async failure => {
    const platform = failure === 'shop' ? 'etsy' : 'ebay', { state, cookie } = await begin(platform);
    if (failure === 'token') mocks.exchange.mockResolvedValue({ access_token: 'access' });
    if (failure === 'seller') mocks.identity.mockRejectedValue(new Error('private-provider-response'));
    if (failure === 'shop') mocks.shop.mockRejectedValue(new Error('private-provider-response'));
    const res = await callback(platform, state, cookie); expect(res.headers.location).toContain('_connect=error'); expect(res.headers.location).not.toContain('private-provider-response');
    expect(fixture.store.get(`marketplaceAccounts/${platform}`)[`${platform}Connected`]).not.toBe(true);
  });
  it('rejects an account disabled during authorization', async () => {
    const { state, cookie } = await begin('amazon'); fixture.store.get('marketplaceAccounts/amazon').isActive = false;
    const res = await callback('amazon', state, cookie); expect(res.headers.location).toContain('_connect=error');
    expect(fixture.store.get('marketplaceAccounts/amazon').amazonRefreshToken).toBeUndefined();
  });
  it('clears authorization and pending attempts on disconnect', async () => {
    const { state, cookie } = await begin('amazon'); await callback('amazon', state, cookie);
    await request(app).delete('/admin/surfaces/accounts/amazon/amazon-disconnect').set('Authorization', 'Bearer test-admin').expect(200);
    expect(fixture.store.get('marketplaceAccounts/amazon')).toMatchObject({ amazonConnected: false, amazonRefreshToken: '', oauthAttempt: null });
  });
  it('hides incomplete legacy connections and credential fields', () => {
    const visible = publicMarketplaceAccount({ platform: 'amazon', amazonConnected: true, amazonRefreshToken: 'secret', feePercent: 5, oauthAttempt: 'pending' }, 'id');
    expect(visible.amazonConnected).toBe(false); expect(visible.feePercent).toBeUndefined(); expect(visible.oauthAttempt).toBeUndefined();
  });
});
