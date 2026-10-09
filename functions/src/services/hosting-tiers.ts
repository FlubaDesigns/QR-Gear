import { pricingSettingsSchema } from '../../../shared/schema-orders';
export async function readHostingTiers(db:any){
  const settings=(await db.collection('testSettings').doc('pricing').get()).data();
  const {hostingTiers}=pricingSettingsSchema.pick({hostingTiers:true}).parse(settings);
  return hostingTiers.map(t=>({...t,id:t.code}));
}
export async function changeHostingTier(db:any,method:string,id:string|undefined,body:any){
  const ref=db.collection('testSettings').doc('pricing');
  return db.runTransaction(async(tx:any)=>{
    const data=(await tx.get(ref)).data();const settings=pricingSettingsSchema.parse(data);
    const existing=settings.hostingTiers.find(t=>t.code===id);
    if(method!=='POST'&&!existing)throw Object.assign(new Error('Hosting tier not found in Admin Pricing.'),{status:404});
    let tiers=settings.hostingTiers;
    if(method==='DELETE') tiers=tiers.filter(t=>t.code!==id);
    else {const next={...existing,...body,code:id||body.code};
      if(method==='POST'&&tiers.some(t=>t.code===next.code))throw Object.assign(new Error('Hosting code already exists.'),{status:409});
      tiers=method==='POST'?[...tiers,next]:tiers.map(t=>t.code===id?next:t);
    }
    const valid=pricingSettingsSchema.parse({...settings,hostingTiers:tiers});
    tx.update(ref,{hostingTiers:valid.hostingTiers,updatedAt:new Date().toISOString()});return valid.hostingTiers;
  });
}
