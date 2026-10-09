import { AI_BUILD_RULES } from '../../../shared/aiProductBuilder';
export function validateBuildRules(rules:unknown):string[] {
  if(!Array.isArray(rules)||rules.length<1||rules.length>100||rules.some(r=>typeof r!=='string'||!r.trim()||r.length>6000)||JSON.stringify(rules).length>100000)
    throw Object.assign(new Error('Provide 1–100 nonempty instructions, each at most 6,000 characters.'),{status:400});
  return rules.map(r=>r.trim());
}
export async function readBuildRules(db:any) {
  const ref=db.collection('system_config').doc('ai_build_rules');
  // One-time migration preserves all existing instructions. Subsequent reads use only the saved record.
  return db.runTransaction(async(tx:any)=>{
    const doc=await tx.get(ref);
    if(doc.exists){const data=doc.data();return {...data,rules:validateBuildRules(data.rules)};}
    const data={rules:[...AI_BUILD_RULES],version:1,updatedAt:new Date().toISOString(),updatedBy:'migration'};
    tx.set(ref,data);return data;
  });
}
export async function saveBuildRules(db:any,body:any,actor:string){
  const rules=validateBuildRules(body.rules),ref=db.collection('system_config').doc('ai_build_rules');
  return db.runTransaction(async(tx:any)=>{
    const current=(await tx.get(ref)).data();
    if(!current||body.version!==current.version) throw Object.assign(new Error('Instructions changed. Reload before saving.'),{status:409});
    const next={rules,version:current.version+1,updatedAt:new Date().toISOString(),updatedBy:actor};tx.set(ref,next);return next;
  });
}
