import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const state = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (name:string) => state.db.collection(name), runTransaction: (fn:any) => state.db.runTransaction(fn) } }));
import { productProof, saveProductProof, approveProductProof, requireApprovedProductProof } from '../product-proof';
let store: Map<string,any>;
const actor = { id:'signed-in-member', type:'member' as const };
beforeEach(() => {
  const fixture = database({ 'productPackets/p': { ownerType:'member', memberId:actor.id, selectedColor:'Black', selectedShirtSize:'M',
    qrContent:'https://example.test', placementGraphicUrls:{ front:'https://files.test/immutable-grf.png' },
    builderSnapshot:{ graphics:{ content:{ headerStyle:{ enabled:true,text:'Test',colorMode:'dark',color:'#000000' } } }, qrConfig:{selectedColor:{name:'Black',hex:'#000000'}} } } });
  state.db=fixture.db;store=fixture.store;
});
it('requires an explicit checkbox assertion for a generated proof and records its exact binding', async () => {
  const packet=store.get('productPackets/p'), proof=await saveProductProof('p',packet,{mockupUrl:'https://files.test/mockup.png'});
  for (const input of [undefined,{proofId:proof.proofId},{approved:false,proofId:proof.proofId},{approved:true,proofId:'stale'}]) {
    await expect(approveProductProof('p',actor,input)).rejects.toThrow('current design');
    expect(store.get('productPackets/p').proofApproval).toBeUndefined();
  }
  const result=await approveProductProof('p',actor,{approved:true,proofId:proof.proofId});
  expect(result).toMatchObject({approved:true,method:'proof_checkbox',approvedBy:actor.id,actorType:'member',packetId:'p',proofId:proof.proofId,selectedColor:'Black',selectedSize:'M'});
  expect(Date.parse(result.approvedAt)).not.toBeNaN();expect(result.warnings[0]).toContain('difficult to read');
  expect(requireApprovedProductProof(store.get('productPackets/p'))).toEqual(result);
  expect(await approveProductProof('p',actor,{approved:true,proofId:proof.proofId})).toEqual(result);
});
it.each(['selectedColor','selectedShirtSize','qrContent','placementGraphicUrls'])('invalidates prior approval when %s changes',async field=>{
  const packet=store.get('productPackets/p');const proof=await saveProductProof('p',packet,{mockupUrl:'https://files.test/mockup.png'});
  await approveProductProof('p',actor,{approved:true,proofId:proof.proofId});
  const changed=store.get('productPackets/p');changed[field]=field==='placementGraphicUrls'?{front:'https://files.test/new.png'}:'changed';
  expect(productProof(changed).proofId).not.toBe(proof.proofId);
  expect(()=>requireApprovedProductProof(changed)).toThrow('current product proof');
  await expect(approveProductProof('p',actor,{approved:true,proofId:proof.proofId})).rejects.toThrow('current design');
});
it('cannot claim approval for another member or before a preview exists',async()=>{
  const proof=productProof(store.get('productPackets/p'));
  await expect(approveProductProof('p',{...actor,id:'other'},{approved:true,proofId:proof.proofId})).rejects.toMatchObject({status:403});
  await expect(approveProductProof('p',actor,{approved:true,proofId:proof.proofId})).rejects.toThrow('current design');
});
