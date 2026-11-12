import { beforeEach, expect, it, vi } from 'vitest';
import { database, legacyFixture } from './composition-fixture';
import { createGrfRegistrar } from '../grf-store';
import { resolveBuilderBld } from '../bld-store';
import { createAutoAssembly, validatePacketContent } from '../assembly-store';
import { requireBuilderSnapshot } from '../../../../shared/builderSnapshot';
import { freezeProductionSource } from '../dynamics-order';
import { saveMasterTextColor } from '../master-text-color';
const state = vi.hoisted(() => ({ db:null as any, registrar:null as any, render:vi.fn() }));
vi.mock('../../core', () => ({ get db(){return state.db;}, admin:{firestore:{FieldValue:{serverTimestamp:()=> 'now'}}} }));
vi.mock('../grf-registrar', () => ({ registerGrfAsset:(input:any)=>state.registrar.registerGrfAsset(input) }));
vi.mock('../product-graphic-renderer', () => ({ renderSavedProductGraphic:(...args:any[])=>state.render(...args) }));
import { resolvePacketColorArtwork } from '../packet-color-artwork';
let store:Map<string,any>, packet:any, master:any;
beforeEach(async()=>{
  const original=legacyFixture();
  const snapshot=requireBuilderSnapshot({...original.snapshot, metadata:{...original.snapshot.metadata,selectedProductDocId:'qrg_11111'},
    qrConfig:{selectedColor:{name:'Black',hex:'#000000'}},graphics:{content:{graphicLayoutMode:'zone',footerStyle:{enabled:true,text:'Printed text',colorMode:'auto',color:'#FFFFFF'}}}});
  master={qrgBlankId:'11111',isActive:true,qrgVariants:{'0401':{colorLabel:'Black',sizeLabel:'M'},'0402':{colorLabel:'White',sizeLabel:'M'},'0403':{colorLabel:'Navy',sizeLabel:'M'}}};
  const fixture=database({'master_catalog/qrg_11111':master,'productPackets/p':{qrgBlankId:'11111',selectedColor:'Black',selectedShirtSize:'M',builderSnapshot:snapshot,qrContent:'https://example.test',compositeUrl:'https://files/original.png'}});
  state.db=fixture.db;store=fixture.store;state.registrar=createGrfRegistrar({db:state.db,now:()=> 'now',bucket:original.bucket});
  const grfs=await state.registrar.registerPacketGrfAssets(store.get('productPackets/p'),'s','p');
  const bld=await resolveBuilderBld(state.db,()=> 'now',snapshot,'p');
  await createAutoAssembly(state.db,()=> 'now',{working:snapshot,qrgId:'11111',bldId:bld.bldId,packetId:'p',sourceSessionId:null,grfIds:grfs});
  packet=store.get('productPackets/p');
  state.render.mockReset().mockResolvedValue('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=');
});
it('registers alternate color artwork once, links a static Assembly, and preserves the original and frozen production',async()=>{
  const frozen=freezeProductionSource(packet,'11111');const frozenBefore=structuredClone(frozen);const original=structuredClone(packet);
  const white=await resolvePacketColorArtwork('p',packet,master,'White');
  expect(white.builderSnapshot.graphics.content.footerStyle.color).toBe('#000000');
  expect(white.assemblyId).not.toBe(packet.assemblyId);expect(white.compositeUrl).not.toBe(packet.compositeUrl);
  const assembly=store.get('assemblies/'+white.assemblyId);
  expect(assembly.packetIds).toContain('p');expect(assembly.mappings.find((v:any)=>v.type==='txt').color).toBe('#000000');
  await expect(validatePacketContent(state.db,white,assembly)).resolves.toBeTruthy();
  const again=await resolvePacketColorArtwork('p',packet,master,'White');expect(again.colorArtworkKey).toBe(white.colorArtworkKey);expect(state.render).toHaveBeenCalledTimes(1);
  expect(packet).toEqual(original);expect(frozen).toEqual(frozenBefore);
  store.get('assemblies/'+white.assemblyId).packetIds=[];
  await expect(resolvePacketColorArtwork('p',packet,master,'White')).rejects.toThrow('not linked');
});
it('reuses the same registered print file when two garments resolve to the same text color',async()=>{
  const navy=await resolvePacketColorArtwork('p',packet,master,'Navy');
  expect(navy.selectedColor).toBe('Navy');expect(navy.compositeUrl).toBe(packet.compositeUrl);expect(state.render).not.toHaveBeenCalled();
});
it('updates only an exact canonical fabric exception and applies it to a future catalog proof',async()=>{
  store.set('master_catalog/qrg_12111',structuredClone(master));
  await saveMasterTextColor(state.db,'qrg_11111',{colorName:'Black',mode:'dark'});
  const changed=store.get('master_catalog/qrg_11111');
  expect(changed.printTextColorOverrides).toEqual({Black:'dark'});expect(store.get('master_catalog/qrg_12111').printTextColorOverrides).toBeUndefined();
  const updated=await resolvePacketColorArtwork('p',packet,changed,'Black');expect(updated.builderSnapshot.graphics.content.footerStyle.color).toBe('#000000');
  await saveMasterTextColor(state.db,'qrg_11111',{colorName:'Black',mode:'auto'});expect(store.get('master_catalog/qrg_11111').printTextColorOverrides).toEqual({});
  await expect(saveMasterTextColor(state.db,'qrg_11111',{colorName:'Black Heather',mode:'light'})).rejects.toThrow('does not belong');
  await expect(resolvePacketColorArtwork('p',packet,master,'Unknown')).rejects.toThrow('does not belong');
});
