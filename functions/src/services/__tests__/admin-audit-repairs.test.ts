import {expect,it,vi} from 'vitest';
import {database} from './composition-fixture';
import {QrAnalyticsService} from '../qr-analytics';
import {HealthMonitorService} from '../health-monitor';
import {readBuildRules,saveBuildRules} from '../ai-build-rules';
import {aiProductPrompt} from '../../../../shared/aiProductBuilder';
it('aggregates current and historical scans and writes only canonical events',async()=>{
 const today=new Date().toISOString();const {db,store}=database({'qr_scan_events/a':{scanDate:today,scanCount:3,masterProductId:'qrg_11001',country:'US'},'qr_scans/b':{scannedAt:today,masterProductId:'qrg_11001'},'master_catalog/qrg_11001':{title:'Shirt'}});
 const service=new QrAnalyticsService(db);expect(await service.getSummary()).toMatchObject({totalScans:4,scansToday:4,uniqueProducts:1});
 expect(await service.getProductAnalytics()).toEqual([expect.objectContaining({productName:'Shirt',totalScans:4})]);
 const trends=await service.getTrends(30);expect(trends).toHaveLength(30);expect(trends.reduce((n,t)=>n+t.scans,0)).toBe(4);
 await service.logScan({qrUrl:'https://example.com'});expect([...store.keys()].filter(k=>k.startsWith('qr_scans/'))).toHaveLength(1);
 expect((await service.getSummary()).totalScans).toBe(5);
});
it('does not disguise failed analytics reads as zero',async()=>{
 const db={collection:()=>({get:async()=>{throw Error('unavailable');}})};
 await expect(new QrAnalyticsService(db).getSummary()).rejects.toThrow('unavailable');
});
it('reports absent credentials and unmeasured health without invented success',async()=>{
 const {db}=database();const request=vi.fn();const service=new HealthMonitorService(db,{},request);
 const overview=await service.getOverview();expect(overview.providers.every(p=>p.status==='not_configured'&&p.responseMs===null&&p.successRate===null)).toBe(true);
 await service.checkAllProviders();expect(request).not.toHaveBeenCalled();expect((await service.getKeyStatus()).printify.status).toBe('not_configured');
});
it('records real check results and invalidates stale credential results',async()=>{
 const {db,store}=database({'system_config/api_keys':{printfulApiKey:'private-test-value'}});const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({result:[{}]})});
 const service=new HealthMonitorService(db,{},request);await service.checkProvider('printful');
 expect((await service.getKeyStatus()).printful.status).toBe('valid');expect(JSON.stringify(await service.getOverview())).not.toContain('private-test-value');
 store.set('system_config/api_keys',{printfulApiKey:'replacement-value'});expect((await service.getKeyStatus()).printful.status).toBe('not_checked');
 request.mockResolvedValue({ok:false,status:401});expect(await service.checkProvider('printful')).toMatchObject({status:'down',isHealthy:false});
});
it('migrates existing AI rules once and saves with conflict protection',async()=>{
 const {db}=database();const original=await readBuildRules(db);expect(original.rules.length).toBeGreaterThan(20);
 const saved=await saveBuildRules(db,{rules:['Owner saved rule'],version:original.version},'owner');expect((await readBuildRules(db)).rules).toEqual(saved.rules);
 await expect(saveBuildRules(db,{rules:['stale edit'],version:original.version},'owner')).rejects.toThrow('changed');
 expect(aiProductPrompt('Make shirt',{},undefined,saved.rules)).toContain('Owner saved rule');
});
import {createCoupon,updateCoupon} from '../coupons';
import {readHostingTiers,changeHostingTier} from '../hosting-tiers';
it('retains sandbox coupons without claiming Stripe sync and preserves activation edits',async()=>{
 vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');const {db}=database();const stripe:any={coupons:{create:vi.fn()}};
 const coupon=await createCoupon(db,{code:'test10',name:'Test',discountType:'percent',discountValue:'10',isActive:false},stripe);
 expect(coupon.syncStatus).toBe('sandbox');expect(stripe.coupons.create).not.toHaveBeenCalled();
 expect((await updateCoupon(db,coupon.id,{isActive:true},stripe)).isActive).toBe(true);vi.unstubAllEnvs();
});
it('does not claim Stripe sync on provider failure and reuses the same coupon record',async()=>{
 vi.stubEnv('QRGEAR_ENVIRONMENT','production');const {db,store}=database();const stripe:any={coupons:{create:vi.fn().mockRejectedValue(Error('offline'))}};
 const body={code:'RETRY',name:'Retry',discountType:'fixed',discountValue:'2'};
 await expect(createCoupon(db,body,stripe)).rejects.toThrow('synchronization failed');await expect(createCoupon(db,body,stripe)).rejects.toThrow('synchronization failed');
 expect([...store.keys()]).toEqual(['coupons/RETRY']);expect(store.get('coupons/RETRY').syncStatus).toBe('failed');vi.unstubAllEnvs();
});
it('reads hosting prices exclusively from Pricing and rejects competing missing configuration',async()=>{
 const {db}=database({'testSettings/pricing':{hostingTiers:[{code:'1_year',name:'One Year',price:0}]},'hosting_tiers/old':{price:999}});
 expect(await readHostingTiers(db)).toEqual([{id:'1_year',code:'1_year',name:'One Year',price:0}]);
 await expect(readHostingTiers(database().db)).rejects.toThrow();
});

import {validateCoupon} from '../coupons';
import {listStoreChannels} from '../store-admin';
it('rejects unsynchronized and expired codes and enforces minimums',async()=>{
 const {db,store}=database({'coupons/CODE':{code:'CODE',isActive:true,discountType:'percent',discountValue:'10'}});
 await expect(validateCoupon(db,'CODE',100)).rejects.toThrow('synchronized');
 Object.assign(store.get('coupons/CODE'),{stripePromotionCodeId:'promo',validUntil:'2000-01-01'});
 await expect(validateCoupon(db,'CODE',100)).rejects.toThrow('expired');
 Object.assign(store.get('coupons/CODE'),{validUntil:null,minOrderAmount:'20'});
 await expect(validateCoupon(db,'CODE',0)).rejects.toThrow('minimum');
 expect(await validateCoupon(db,'CODE',100)).toMatchObject({valid:true,discountAmount:'10.00'});
});
it('counts the same visible catalog instances used by store channels',async()=>{
 const {db}=database({'stores/a':{name:'A'},'storeChannels/c':{storeId:'a',name:'C',productCount:0},'admin_catalog_instances/one':{storeId:'a',channelId:'c'},'admin_catalog_instances/two':{storeId:'a',channelId:'c',status:'deleted'},'admin_catalog_instances/three':{storeId:'b',channelId:'c'}});
 expect(await listStoreChannels(db,'a')).toEqual([expect.objectContaining({id:'c',productCount:1})]);
});
