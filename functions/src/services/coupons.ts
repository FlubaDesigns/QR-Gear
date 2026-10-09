import {z} from 'zod';
type CouponStripe = {coupons:{create:(body:any,options?:any)=>Promise<any>;update:(id:string,body:any)=>Promise<any>};promotionCodes:{create:(body:any,options?:any)=>Promise<any>;update:(id:string,body:any)=>Promise<any>}};
import {isSandboxRuntime} from '../runtime-config';
const schema=z.object({code:z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/).transform(s=>s.toUpperCase()),name:z.string().trim().min(1).max(200),
 discountType:z.enum(['percent','fixed']),discountValue:z.coerce.number().positive(),currency:z.string().default('usd'),isActive:z.boolean().default(true),
 minOrderAmount:z.coerce.number().nonnegative().nullable().optional(),maxRedemptions:z.number().int().positive().nullable().optional(),
 validFrom:z.string().nullable().optional(),validUntil:z.string().nullable().optional()}).superRefine((d,c)=>{
 if(d.discountType==='percent'&&d.discountValue>100)c.addIssue({code:'custom',message:'Percent cannot exceed 100.'});
 for(const key of ['validFrom','validUntil'] as const)if(d[key]&&!Number.isFinite(new Date(d[key]!).getTime()))c.addIssue({code:'custom',message:'Invalid date.'});
 if(d.isActive&&d.validFrom&&new Date(d.validFrom)>new Date())c.addIssue({code:'custom',message:'Scheduled activation is not connected. Save this coupon inactive and enable it on the intended date.'});
});
export async function createCoupon(db:any,body:any,stripe?:CouponStripe){
 const value=schema.parse(body),id=value.code,ref=db.collection('coupons').doc(id);
 const normalized={...value,discountValue:String(value.discountValue),minOrderAmount:value.minOrderAmount==null?null:String(value.minOrderAmount),
 maxRedemptions:value.maxRedemptions??null,validFrom:value.validFrom??null,validUntil:value.validUntil??null};
 const duplicates=await db.collection('coupons').where('code','==',id).get();
 if(duplicates.docs.some((d:any)=>d.id!==id))throw Object.assign(new Error('This coupon code already exists.'),{status:409});
 await db.runTransaction(async(tx:any)=>{const doc=await tx.get(ref);if(doc.exists){
   if(JSON.stringify(doc.data().creationInput)!==JSON.stringify(normalized))throw Object.assign(new Error('This coupon code already exists.'),{status:409});
 }else tx.set(ref,{...normalized,creationInput:normalized,redemptionCount:0,syncStatus:'pending',createdAt:new Date().toISOString()});});
 if(isSandboxRuntime()) {await ref.update({syncStatus:'sandbox',syncMessage:'Saved in sandbox. Stripe synchronization and checkout are disabled.'});return {id,...(await ref.get()).data()};}
 if(!stripe)throw Object.assign(new Error('Coupon saved pending synchronization. Stripe is not configured.'),{status:503});
 try {
   let data=(await ref.get()).data();
   if(!data.stripeCouponId){const coupon=await stripe.coupons.create({name:value.name,
     ...(value.discountType==='percent'?{percent_off:value.discountValue}:{amount_off:Math.round(value.discountValue*100),currency:value.currency}),
     ...(value.validUntil?{redeem_by:Math.floor(new Date(value.validUntil).getTime()/1000)}:{}),
     ...(value.maxRedemptions?{max_redemptions:value.maxRedemptions}:{})},{idempotencyKey:`qrgear-coupon-${id}`});
     await ref.update({stripeCouponId:coupon.id});data={...data,stripeCouponId:coupon.id};}
   if(!data.stripePromotionCodeId){const promotion=await stripe.promotionCodes.create({coupon:data.stripeCouponId,code:id,active:value.isActive,
     ...(value.minOrderAmount!=null?{restrictions:{minimum_amount:Math.round(value.minOrderAmount*100),minimum_amount_currency:value.currency}}:{})},
     {idempotencyKey:`qrgear-promotion-${id}`});await ref.update({stripePromotionCodeId:promotion.id});}
   await ref.update({syncStatus:'synced',syncMessage:null});return {id,...(await ref.get()).data()};
 } catch(e:any){await ref.update({syncStatus:'failed',syncMessage:'Stripe synchronization failed. Retry the same coupon.'});throw Object.assign(new Error('Coupon saved, but Stripe synchronization failed. Retry the same coupon.'),{status:502});}
}
export async function updateCoupon(db:any,id:string,body:any,stripe?:CouponStripe){
 const changes=z.object({isActive:z.boolean().optional(),name:z.string().min(1).optional()}).strict().parse(body),ref=db.collection('coupons').doc(id),doc=await ref.get();
 if(!doc.exists)throw Object.assign(new Error('Coupon not found.'),{status:404});
 const current=doc.data();
 if(changes.isActive && current.validFrom && new Date(current.validFrom)>new Date())throw Object.assign(new Error('This coupon cannot be activated before its saved start date.'),{status:400});
 if(current.stripePromotionCodeId&&!isSandboxRuntime()){
   if(!stripe)throw Object.assign(new Error('Stripe is not configured. Coupon was not changed.'),{status:503});
   if(changes.isActive!==undefined)await stripe.promotionCodes.update(current.stripePromotionCodeId,{active:changes.isActive});
   if(changes.name&&current.stripeCouponId)await stripe.coupons.update(current.stripeCouponId,{name:changes.name});
 }
 await ref.update({...changes,updatedAt:new Date().toISOString()});return{id,...(await ref.get()).data()};
}

/** Public eligibility check; the checkout amount must still be calculated server-side. */
export async function validateCoupon(db:any,code:unknown,orderTotal?:unknown){
 const input=z.object({code:z.string().trim().min(1),orderTotal:z.coerce.number().nonnegative().optional()}).parse({code,orderTotal});
 const docs=await db.collection('coupons').where('code','==',input.code.toUpperCase()).get();
 const doc=docs.docs[0],c=doc?.data();
 const fail=(message:string)=>{throw Object.assign(new Error(message),{status:400});};
 if(!c)fail('Invalid coupon code.');
 if(c.archivedAt||!c.isActive)fail('This coupon is inactive.');
 if(!c.stripePromotionCodeId||c.syncStatus==='failed'||c.syncStatus==='sandbox')fail('This coupon is not synchronized with checkout.');
 const date=(v:any)=>v?.toDate?v.toDate():new Date(v);
 if(c.validFrom&&date(c.validFrom)>new Date())fail('This coupon is not yet active.');
 if((c.validUntil||c.expiresAt)&&date(c.validUntil||c.expiresAt)<=new Date())fail('This coupon has expired.');
 if(c.maxRedemptions!=null&&(c.redemptionCount??0)>=c.maxRedemptions)fail('This coupon has reached its usage limit.');
 if(Number(c.minOrderAmount)>0&&(input.orderTotal==null||input.orderTotal<Number(c.minOrderAmount)))fail('The minimum order amount has not been met.');
 const total=input.orderTotal??0,value=Number(c.discountValue);
 if(!Number.isFinite(value)||value<=0)fail('This coupon has an invalid discount.');
 return {valid:true,coupon:{id:doc.id,code:c.code,name:c.name,discountType:c.discountType,discountValue:c.discountValue,stripePromotionCodeId:c.stripePromotionCodeId},discountAmount:(Math.min(total,c.discountType==='percent'?total*value/100:value)).toFixed(2)};
}
