import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
import { MEMBER_PACKETS_COLLECTION } from '../../constants';

const m = vi.hoisted(() => ({ db: null as any, verify: vi.fn(), retrieve: vi.fn(), create: vi.fn(), link: vi.fn(), login: vi.fn(), checkout: vi.fn(), event: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...args: any[]) => m.db.collection(...args) }, admin: { auth: () => ({ verifyIdToken: m.verify }) } }));
vi.mock('../fluba-provider-keys', () => ({ readFlubaProviderKey: async () => 'fixture-key' }));
vi.mock('stripe', () => ({ default: class { accounts = { retrieve: m.retrieve, create: m.create, createLoginLink: m.login }; accountLinks = { create: m.link }; checkout = { sessions: { create: m.checkout } }; webhooks = { constructEvent: m.event }; } }));
vi.mock('../member-build', () => ({ memberBuildProjection: async () => ({ status: 'published', memberId: 'owner', title: 'Fixture' }) }));
vi.mock('../order-service', () => ({ prepareMemberOrder: async () => ({ orderId: 'o', amount: 4000 }) }));
vi.mock('../email', () => ({}));
vi.mock('../order-fulfillment', () => ({}));
import { register as connect } from '../../routes/connect';
import { register as checkout } from '../../routes/checkout';
import { register as webhooks } from '../../routes/stripe-webhooks';
import { assertConnectAccountOwner } from '../connect-accounts';

let store: Map<string, any>;
const owned = () => ({ id: 'acct_owner', type: 'express', metadata: { entityId: 'owner' }, payouts_enabled: true, charges_enabled: true });
function app() { const a = express(); a.use(express.json()); connect(a); checkout(a); webhooks(a); return a; }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'fixture-secret');
  const fixture = database({
    'member_profiles/owner': { stripeConnectAccountId: 'acct_owner', stripePayoutsEnabled: true },
    [`${MEMBER_PACKETS_COLLECTION}/p`]: { memberId: 'owner' }, 'orders/o': {},
  }); m.db = fixture.db; store = fixture.store;
  m.verify.mockResolvedValue({ uid: 'owner' }); m.retrieve.mockResolvedValue(owned());
  m.create.mockResolvedValue(owned()); m.link.mockResolvedValue({ url: 'https://fixture.invalid/onboard' });
  m.login.mockResolvedValue({ url: 'https://fixture.invalid/dashboard' });
  m.checkout.mockResolvedValue({ id: 'session', url: 'https://fixture.invalid/checkout' });
});
afterEach(() => vi.unstubAllEnvs());

describe('Connect account ownership', () => {
  it('preserves a verified owner dashboard and uses live payout eligibility', async () => {
    const a = app();
    expect((await request(a).post('/connect/dashboard-link/owner').set('Authorization', 'Bearer valid')).status).toBe(200);
    expect(m.retrieve).toHaveBeenCalledWith('acct_owner'); expect(m.login).toHaveBeenCalledWith('acct_owner');
    m.login.mockClear(); m.retrieve.mockResolvedValue({ ...owned(), payouts_enabled: false });
    expect((await request(a).post('/connect/dashboard-link/owner').set('Authorization', 'Bearer valid')).status).toBe(400);
    expect(m.login).not.toHaveBeenCalled();
  });
  it('rejects a poisoned profile binding on every privileged link/status path', async () => {
    m.retrieve.mockResolvedValue({ ...owned(), metadata: { entityId: 'another-owner' } });
    const a = app();
    for (const [method, route] of [['post', '/connect/onboard'], ['post', '/connect/dashboard-link/owner'], ['get', '/connect/status/owner']] as const) {
      expect((await request(a)[method](route).set('Authorization', 'Bearer valid')).status).toBe(403);
    }
    const refresh = await request(a).get('/connect/onboard/refresh/owner');
    expect(refresh.headers.location).toContain('/members?connect_refresh=true');
    expect(m.link).not.toHaveBeenCalled(); expect(m.login).not.toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  });
  it('keeps authentication and entity ownership ahead of Stripe access', async () => {
    const a = app();
    expect((await request(a).post('/connect/dashboard-link/owner')).status).toBe(401);
    m.verify.mockResolvedValue({ uid: 'other' });
    expect((await request(a).post('/connect/dashboard-link/owner').set('Authorization', 'Bearer valid')).status).toBe(403);
    expect(m.retrieve).not.toHaveBeenCalled(); expect(m.login).not.toHaveBeenCalled();
  });
  it('never creates a link or reads a Stripe account from an anonymous refresh URL', async () => {
    for (const id of ['owner', 'other', 'unknown']) {
      const result = await request(app()).get(`/connect/onboard/refresh/${id}`);
      expect(result.status).toBe(302);
      expect(result.headers.location).toBe('https://qrgear-c1ffd.web.app/members?connect_refresh=true');
      expect(result.headers['cache-control']).toContain('no-store');
    }
    expect(m.retrieve).not.toHaveBeenCalled(); expect(m.link).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
  it('requires sign-in to renew onboarding and ignores another member supplied by the caller', async () => {
    expect((await request(app()).post('/connect/onboard')).status).toBe(401);
    expect(m.link).not.toHaveBeenCalled();
    const result = await request(app()).post('/connect/onboard').set('Authorization', 'Bearer valid').send({ entityId: 'other' });
    expect(result.status).toBe(200);
    expect(m.link).toHaveBeenCalledWith(expect.objectContaining({ account: 'acct_owner', refresh_url: 'https://qrgear-c1ffd.web.app/members?connect_refresh=true' }));
  });
  it('creates new accounts with the authenticated entity binding', async () => {
    store.delete('member_profiles/owner');
    expect((await request(app()).post('/connect/onboard').set('Authorization', 'Bearer valid')).status).toBe(200);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'express', metadata: { entityId: 'owner', entityType: 'member' } }));
    expect(store.get('member_profiles/owner').stripeConnectAccountId).toBe('acct_owner');
  });
  it('refuses missing, deleted and non-Express account ownership', () => {
    for (const account of [{ ...owned(), metadata: {} }, { id: 'acct_owner', deleted: true }, { ...owned(), type: 'standard' }]) {
      expect(() => assertConnectAccountOwner(account as any, 'owner')).toThrow('ownership could not be verified');
    }
  });
  it('blocks checkout before creating a payment session for a foreign account', async () => {
    m.retrieve.mockResolvedValue({ ...owned(), metadata: { entityId: 'other' } });
    const r = await request(app()).post('/public/packet-checkout').send({ packetId: 'p' });
    expect(r.status).toBeGreaterThanOrEqual(400); expect(m.checkout).not.toHaveBeenCalled();
  });
  it('keeps verified-owner checkout and pending-payout checkout usable', async () => {
    const a = app();
    expect((await request(a).post('/public/packet-checkout').send({ packetId: 'p' })).status).toBe(200);
    expect(m.checkout.mock.calls[0][0].payment_intent_data.transfer_data.destination).toBe('acct_owner');
    m.checkout.mockClear(); m.retrieve.mockResolvedValue({ ...owned(), payouts_enabled: false });
    expect((await request(a).post('/public/packet-checkout').send({ packetId: 'p' })).status).toBe(200);
    expect(m.checkout.mock.calls[0][0].payment_intent_data).toBeUndefined();
  });
  it('syncs a signed account event only to its bound owner, not the first matching profile', async () => {
    store.set('member_profiles/attacker', { stripeConnectAccountId: 'acct_owner', stripePayoutsEnabled: false });
    m.event.mockReturnValue({ type: 'account.updated', data: { object: owned() } });
    expect((await request(app()).post('/webhooks/stripe').set('stripe-signature', 'fixture').send({})).status).toBe(200);
    expect(store.get('member_profiles/owner').stripePayoutsEnabled).toBe(true);
    expect(store.get('member_profiles/attacker').stripePayoutsEnabled).toBe(false);
  });
  it('does not sync an event into an owner profile whose account binding differs', async () => {
    store.set('member_profiles/owner', { stripeConnectAccountId: 'acct_replacement', stripePayoutsEnabled: false });
    m.event.mockReturnValue({ type: 'account.updated', data: { object: owned() } });
    expect((await request(app()).post('/webhooks/stripe').set('stripe-signature', 'fixture').send({})).status).toBe(200);
    expect(store.get('member_profiles/owner').stripePayoutsEnabled).toBe(false);
  });
});
