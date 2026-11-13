import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({rows:{} as Record<string,any>,build:vi.fn(),commit:vi.fn(),render:vi.fn(),providerOrders:0,catalogs:{} as Record<string,any>,stripe:vi.fn()}));
vi.mock('../../core',()=>{
 const ref=(path:string):any=>({id:path.split('/').slice(-1)[0],path,collection:(name:string)=>collection(path+'/'+name),get:async()=>({exists:!!m.rows[path],data:()=>m.rows[path]}),set:async(data:any)=>{m.rows[path]=data;},update:async(data:any)=>{m.rows[path]={...m.rows[path],...data};}});
 const collection=(path:string):any=>({doc:(id:string)=>ref(path+'/'+id)});
 return {db:{collection,runTransaction:async(fn:any)=>fn({get:(r:any)=>r.get(),set:(r:any,d:any)=>r.set(d),update:(r:any,d:any)=>r.update(d),create:(r:any,d:any)=>{if(m.rows[r.path])throw Error('already exists');return r.set(d);}})}};
});
vi.mock('../partner-api',()=>({partnerStoreId:async(_db:any,p:any)=>p.storeId,publicPartner:(p:any)=>({id:p.id,storeId:p.storeId})}));
vi.mock('../store-products',()=>({readStoreProducts:async(_db:any,id:string)=>m.catalogs[id]}));
vi.mock('../member-build',()=>({preparePartnerBuild:(...args:any[])=>m.build(...args),saveMemberArtwork:async(_owner:string,id:string,place:string)=>{m.rows['productPackets/'+id].placementGraphicUrls={[place]:'https://qrgear.test/graphic.png'};},commitOwnerBuild:(...args:any[])=>m.commit(...args)}));
vi.mock('../product-graphic-renderer',()=>({renderSavedProductGraphic:(...args:any[])=>m.render(...args)}));
vi.mock('../reward-graphic-input',()=>({rewardGraphicInput:()=>({headerStyle:{enabled:true,text:'customer.example',colorMode:'auto'}})}));
vi.mock('../grf-registrar',()=>({registerGrfAsset:async()=>({publicUrl:'https://qrgear.test/logo.png'})}));
vi.mock('../../runtime-config',()=>({resolveRuntimeConfig:()=>({origin:'https://qrgear.test'}),requireLiveCommerce:()=>{}}));
vi.mock('../order-fulfillment',()=>({resolveSaleItem:async()=>({productTitle:'Catalog shirt',frozenProduction:{sourceHash:'saved-artwork'},fulfillment:{provider:'printful'},quantity:1}),verifyProviderItems:async()=>{},syncFulfillment:async()=>{},fulfillOrder:async(id:string)=>{const order=m.rows['orders/'+id];if(order.fulfillmentState!=='submitted'){m.providerOrders++;order.fulfillmentState='submitted';}}}));
vi.mock('../fluba-provider-keys',()=>({readFlubaProviderKey:async()=> 'sk_live_fixture'}));
vi.mock('stripe',()=>({default:class{paymentIntents={retrieve:m.stripe};}}));
import {partnerRewardProducts,partnerRewardPreview,partnerRewardStatus,approvePartnerReward} from '../partner-rewards';
import {productionFundingDate,assertProductionPayment} from '../payment-state';
const partner={id:'fluba',storeId:'fluba-store',isActive:true,sponsoredRewards:true};
const input={claimId:'project-shirt',customerRef:'customer',channelId:'rewards',productId:'qrg_11111',color:'Black',size:'M',websiteUrl:'https://customer.example/',sourceHash:'saved-logo-and-url',graphicChoice:'full',logoData:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCqkAAAAASUVORK5CYII='};
const address={name:'Customer',address1:'One Street',city:'City',region:'FL',postalCode:'12345',country:'US'};
beforeEach(()=>{
 vi.clearAllMocks();m.rows={'storeChannels/rewards':{storeId:'fluba-store',isActive:true},'partnerStores/fluba':partner};m.providerOrders=0;
 const product={id:'qrg_11111',canonicalBlankKey:'qrg_11111',title:'Live catalog title',description:'',availableColors:[{name:'Black'}],availableVariants:[{color:'Black',size:'M'}],fulfillmentProvider:'printful',placements:[{id:'front',dimensions:{widthPx:3600,heightPx:4800},dpi:300}]};
 m.catalogs={'fluba-store':{configured:true,catalogId:'fluba-auto',products:[product]},'other-store':{configured:true,catalogId:'other',products:[]}};
 m.build.mockImplementation(async(owner:any,recipe:any,scope:any)=>{const packet={ownerId:owner,ownerType:'owner',selectedColor:recipe.selectedColor,selectedShirtSize:recipe.selectedShirtSize,builderSnapshot:{graphics:{content:{headerStyle:recipe.headerStyle}},qrConfig:{selectedColor:{name:recipe.selectedColor,hex:'#000000'}},layoutConfig:{selectedPlacements:['front'],perPlacementConfigs:recipe.perPlacementConfigs}},qrContent:input.websiteUrl,status:'building'};m.rows['productPackets/'+scope.packetId]??=packet;return m.rows['productPackets/'+scope.packetId];});
 m.render.mockResolvedValue('rendered-png');
 m.commit.mockImplementation(async(_owner:any,id:string)=>{Object.assign(m.rows['productPackets/'+id],{status:'ready',mockupUrl:'https://qrgear.test/exact-variant.png',compositeUrl:'https://qrgear.test/graphic.png'});return m.rows['productPackets/'+id];});
});
it('keeps the store catalog authoritative and rejects another store’s channel',async()=>{
 const result=await partnerRewardProducts(partner,'rewards');expect(result.products[0]).toMatchObject({name:'Live catalog title',description:'',mockupsByColor:{}});
 await expect(partnerRewardProducts({...partner,id:'other',storeId:'other-store'},'rewards')).rejects.toMatchObject({status:404});
});
it('reuses a preview, binds the selected graphic choice, and changes revisions only for an actual choice change',async()=>{
 const first=await partnerRewardPreview(partner,input),second=await partnerRewardPreview(partner,input);expect(second.previewId).toBe(first.previewId);expect(m.build).toHaveBeenCalledTimes(1);
 const changed=await partnerRewardPreview(partner,{...input,graphicChoice:'qr-only'});expect(changed.previewId).not.toBe(first.previewId);expect(m.build.mock.calls[1][1].perPlacementConfigs.front.graphicChoice).toBe('qr-only');
 await expect(partnerRewardPreview(partner,{...input,customerRef:'other'})).rejects.toMatchObject({status:403});
 await expect(partnerRewardStatus(partner,input.claimId,'other')).rejects.toMatchObject({status:403});
});
it('records explicit failure and resumes the same packet after interrupted generation',async()=>{
 m.commit.mockRejectedValueOnce(Error('provider mockup unavailable'));
 await expect(partnerRewardPreview(partner,input)).rejects.toThrow('unavailable');
 expect((await partnerRewardStatus(partner,input.claimId,input.customerRef)).status).toBe('failed');
 const packet=m.build.mock.calls[0][2].packetId;
 const ready=await partnerRewardPreview(partner,input);expect(ready.packetId).toBe(packet);expect(ready.status).toBe('ready');expect(m.render).toHaveBeenCalledTimes(1);
});
it('blocks unavailable variants, stale approval and unapproved sponsor funding; reuses one production order',async()=>{
 await expect(partnerRewardPreview(partner,{...input,color:'Unavailable'})).rejects.toThrow('unavailable');expect(m.build).not.toHaveBeenCalled();
 const preview=await partnerRewardPreview(partner,input);
 const approval={claimId:input.claimId,customerRef:input.customerRef,previewId:preview.previewId,proofApproval:{approved:true,proofId:preview.proofId},shipping:address,authorization:{websiteOrderId:'website-paid-order',verifiedAt:'2026-11-12T00:00:00Z'}};
 await expect(approvePartnerReward({...partner,sponsoredRewards:false},approval)).rejects.toMatchObject({status:403});
 await expect(approvePartnerReward(partner,{...approval,previewId:'stale'})).rejects.toThrow('current personalized preview');
 await expect(approvePartnerReward(partner,{...approval,proofApproval:{approved:false,proofId:preview.proofId}})).rejects.toThrow('approve this proof');
 expect(m.providerOrders).toBe(0);
 const first=await approvePartnerReward(partner,approval),again=await approvePartnerReward(partner,approval);expect(again.orderId).toBe(first.orderId);expect(first.orderId!.length).toBeLessThanOrEqual(32);expect(m.providerOrders).toBe(1);
 const order=m.rows['orders/'+first.orderId];expect(order.paymentStatus).toBe('sponsored');expect(order.stripePaymentIntentId).toBeUndefined();expect(order.customerChargeCents).toBe(0);
 expect(order.proofApproval).toMatchObject({approved:true,proofId:preview.proofId,method:'proof_checkbox'});
 await expect(assertProductionPayment(order)).resolves.toBeUndefined();expect(m.stripe).not.toHaveBeenCalled();
 m.rows['partnerStores/fluba']={...partner,sponsoredRewards:false};await expect(assertProductionPayment(order)).rejects.toThrow('no longer authorized');
 await expect(partnerRewardPreview(partner,{...input,graphicChoice:'qr-only'})).rejects.toThrow('already been approved');
});
it('keeps ordinary Stripe, refunds and forged funding behind their existing boundary',async()=>{
 expect(productionFundingDate({paymentStatus:'sponsored',paymentVerifiedAt:'now'})).toBeNull();
 expect(productionFundingDate({paymentStatus:'paid',paymentVerifiedAt:'now',productionHold:true})).toBeNull();
 await expect(assertProductionPayment({paymentStatus:'paid'})).rejects.toThrow('Stripe reconciliation');
 m.stripe.mockResolvedValue({livemode:true,status:'succeeded',amount_received:1000,currency:'usd',latest_charge:{livemode:true,paid:true,amount_refunded:0,disputed:false,payment_intent:'pi_test'}});
 await expect(assertProductionPayment({paymentStatus:'paid',stripePaymentIntentId:'pi_test',amountTotalCents:1000,currency:'usd'})).resolves.toBeUndefined();expect(m.stripe).toHaveBeenCalledTimes(1);
 await expect(assertProductionPayment({paymentStatus:'paid',productionHold:true})).rejects.toThrow('held payment');
});
