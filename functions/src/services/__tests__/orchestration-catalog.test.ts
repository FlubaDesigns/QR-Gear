import { beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({db:{collection:(...args:any[])=>m.db.collection(...args)}}));
vi.mock('../../middleware', () => ({requireAdmin:(req:any,res:any,next:any)=>req.headers.authorization==='test-owner'?next():res.sendStatus(401)}));
vi.mock('../health-monitor', () => ({HealthMonitorService:class {}}));
vi.mock('../qr-analytics', () => ({QrAnalyticsService:class {}}));
import {register} from '../../routes/orchestration';
const app=express();app.use(express.json());register(app);
let store:Map<string,any>;
beforeEach(()=>{
 const fixture=database({
  'master_catalog/qrg_11111':{title:'Supplier blank'},
  'admin_catalog_instances/shirt':{resolved:{title:'Army',pricing:{customerPrice:43.58,subtotal:34.864}},qrgBaseCode:'QRG-11111-I-000001',status:'active',currentPacketId:'p'},
  'admin_catalog_instances/old':{status:'deleted'},
  'productPackets/p':{ownerInstanceId:'shirt',pricing:{customerPrice:43.58,subtotal:34.864},fulfillmentProvider:'printful',placementGrfIds:{label_inside:'GRF-21111-000001'},builderSnapshot:{metadata:{fulfillmentProvider:'printful'},layoutConfig:{selectedPlacements:['front','label_inside']}}},
 });m.db=fixture.db;store=fixture.store;
});
it('lists the actual saved catalog, excludes blanks and deleted products, and never writes',async()=>{
 const before=structuredClone(store);const res=await request(app).get('/admin/orchestration/catalog').set('Authorization','test-owner');
 expect(res.status).toBe(200);expect(res.body.products).toEqual([expect.objectContaining({id:'shirt',title:'Army',price:43.58,provider:'printful',issues:[]})]);expect(store).toEqual(before);
});
it('reports mismatched ownership, pricing and missing labels visibly',async()=>{
 Object.assign(store.get('productPackets/p'),{ownerInstanceId:'other',pricing:{customerPrice:1},placementGrfIds:{}});
 const res=await request(app).get('/admin/orchestration/catalog').set('Authorization','test-owner');expect(res.body.products[0].issues).toHaveLength(3);
});
it('does not treat missing costs as zero or calculate invented contribution',async()=>{
 delete store.get('admin_catalog_instances/shirt').resolved.pricing.subtotal;
 const res=await request(app).get('/admin/orchestration/catalog').set('Authorization','test-owner');expect(res.body.products[0]).toMatchObject({cost:null,estimatedContribution:null});
});
it('reads only paid order revenue and leaves unreconciled profit unknown',async()=>{
 store.set('orders/paid',{paymentStatus:'paid',amountTotalCents:4358,currency:'usd'});store.set('orders/unpaid',{paymentStatus:'unpaid',amountTotalCents:99999,currency:'usd'});
 const res=await request(app).get('/admin/orchestration/profit/dashboard').set('Authorization','test-owner');expect(res.status).toBe(200);expect(res.body).toMatchObject({paidOrders:1,revenue:43.58,netProfit:null});
});
it('never adds different currencies or malformed paid amounts into USD revenue',async()=>{
 store.set('orders/paid',{paymentStatus:'paid',amountTotalCents:4358,currency:'eur'});
 const res=await request(app).get('/admin/orchestration/profit/dashboard').set('Authorization','test-owner');expect(res.body.revenue).toBeNull();
});
it('reports no sales truthfully and rejects anonymous reads',async()=>{
 const res=await request(app).get('/admin/orchestration/profit/dashboard').set('Authorization','test-owner');expect(res.body).toMatchObject({paidOrders:0,revenue:0,netProfit:0});
 expect((await request(app).get('/admin/orchestration/catalog')).status).toBe(401);expect((await request(app).get('/admin/orchestration/profit/dashboard')).status).toBe(401);
});
it('surfaces database failures instead of returning an empty catalog',async()=>{
 m.db={collection:()=>({get:async()=>{throw Error('Database unavailable');}})};
 const res=await request(app).get('/admin/orchestration/catalog').set('Authorization','test-owner');expect(res.status).toBe(503);expect(res.body.error).toContain('Database unavailable');
});
