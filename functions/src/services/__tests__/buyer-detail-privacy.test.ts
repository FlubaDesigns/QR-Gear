import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, uid: 'owner', create: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a), runTransaction: (...a: any[]) => m.db.runTransaction(...a) }, admin: { auth: () => ({ verifyIdToken: async () => ({ uid: m.uid }) }) } }));
vi.mock('../fluba-provider-keys', () => ({ readFlubaProviderKey: async () => 'sk_live_fixture' }));
vi.mock('stripe', () => ({ default: class { checkout = { sessions: { create: m.create } }; } }));
let records: Map<string, any>;
import { register } from '../../routes/dynamics';
beforeEach(() => { m.uid = 'owner'; const fixture = database({ 'testSettings/pricing': { hostingTiers: [{code:'1_year',name:'One year',price:5},{code:'2_year',name:'Two years',price:8},{code:'3_year',name:'Three years',price:10}] }, 'buyer_instances/i': { buyerUserId: 'owner', buyerEmail: 'private@example.invalid', privateNote: 'do not expose', hostingExpiresAt: '2099-01-01T00:00:00.000Z', destinationUrl: 'https://example.invalid' } }); m.db = fixture.db; records = fixture.store; m.create.mockReset(); m.create.mockResolvedValue({id:'cs_new',livemode:true,url:'https://checkout.example.invalid'}); });
const app = () => { const a = express(); a.use(express.json()); register(a); return a; };
it('requires the buyer for full details', async () => {
  expect((await request(app()).get('/buyer/instances/i')).status).toBe(401);
  m.uid = 'other'; expect((await request(app()).get('/buyer/instances/i').set('Authorization', 'Bearer valid')).status).toBe(403);
  m.uid = 'owner'; const result = await request(app()).get('/buyer/instances/i').set('Authorization', 'Bearer valid');
  expect(result.status).toBe(200); expect(result.body.instance.buyerEmail).toBe('private@example.invalid'); expect(result.headers['cache-control']).toContain('no-store');
});
it('keeps public renewal and resolution usable without disclosing customer fields', async () => {
  const renewal = await request(app()).get('/buyer/instances/i/public');
  expect(renewal.status).toBe(200); expect(renewal.body.instance).toEqual({ id: 'i', status:'active', hostingExpiresAt: '2099-01-01T00:00:00.000Z' }); expect(renewal.body.renewalOptions.map((t:any)=>t.amountCents)).toEqual([500,800,1000]);
  const resolution = await request(app()).get('/resolve/i'); expect(resolution.body.destinationUrl).toBe('https://example.invalid');
  expect(JSON.stringify(resolution.body)).not.toContain('private');
});

it('uses the current QR record instead of a colliding legacy ID and exposes only public status', async () => {
 records.set('qr_dynamics_instances/i',{status:'active',ownerId:'owner',hostingExpiresAt:'2035-01-01T00:00:00.000Z',privateNote:'secret'});
 const result=await request(app()).get('/buyer/instances/i/public');
 expect(result.body.instance).toEqual({id:'i',status:'active',hostingExpiresAt:'2035-01-01T00:00:00.000Z'});
 expect(result.headers['cache-control']).toBe('no-store');expect(JSON.stringify(result.body)).not.toContain('secret');
});
it('freezes Admin Pricing and the current record before creating renewal checkout', async () => {
 records.set('qr_dynamics_instances/i',{status:'active',ownerId:'owner',qrgBaseCode:'QRG-11111-O-000001',hostingExpiresAt:'2035-01-01T00:00:00.000Z'});
 const result=await request(app()).post('/buyer/instances/i/renew').send({checkoutAttemptId:'550e8400-e29b-41d4-a716-446655440000',hostingTierCode:'2_year',expectedAmountCents:800});
 expect(result.status).toBe(200);
 const renewal=[...records.entries()].find(([key])=>key.startsWith('hosting_renewals/'))![1];
 expect(renewal).toMatchObject({version:2,amountCents:800,durationYears:2,instanceCollection:'qr_dynamics_instances',hostingTierCode:'2_year',stripeSessionId:'cs_new'});
 expect(m.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(800);
});
it('rejects stale prices, unknown terms, static and unactivated items without checkout', async () => {
 for (const body of [{hostingTierCode:'2_year',expectedAmountCents:499},{hostingTierCode:'unknown',expectedAmountCents:800}]) expect((await request(app()).post('/buyer/instances/i/renew').send({...body,checkoutAttemptId:'550e8400-e29b-41d4-a716-446655440000'})).status).toBe(409);
 for (const value of [{status:'static'},{status:'active',orderId:'o',claimCode:'private'}]) {
 records.set('qr_dynamics_instances/i',value);
 expect((await request(app()).post('/buyer/instances/i/renew').send({checkoutAttemptId:'550e8400-e29b-41d4-a716-446655440000',hostingTierCode:'2_year',expectedAmountCents:800})).status).toBe(409);
 }
 expect(m.create).not.toHaveBeenCalled();
});
it('expired scans advertise QR Gear without modifying identity or saved content', async () => {
 const qrg='QRG-11111-O-000001';
 records.set('qr_dynamics_instances/item',{status:'active',qrgBaseCode:qrg,packetId:'packet',hostingExpiresAt:'2020-01-01T00:00:00.000Z',slots:[{packetId:'content',durationSeconds:60,order:1}]});
 records.set('productPackets/packet',{status:'published',qrgBaseCode:qrg,composeInstanceId:'item'});
 const before=JSON.stringify([...records]);
 const response=await request(app()).get('/qr/d/item');expect(response.status).toBe(302);expect(response.headers.location).toBe('/');expect(JSON.stringify([...records])).toBe(before);
 records.get('productPackets/packet').qrgBaseCode='wrong';expect((await request(app()).get('/qr/d/item')).status).toBe(409);
});
