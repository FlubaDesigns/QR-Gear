import { it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { database } from './composition-fixture';
import { readStoreProducts, saveStoreProducts, registerStoreProductRoutes } from '../store-products';
import { listCatalogInstances } from '../catalog-list';
import { listStoreChannels, listStoreCollections, deleteStoreCollection, registerStoreAdminRoutes } from '../store-admin';
import { updateCatalogInstance } from '../catalog-instance-update';
const blank = (provider: string, id: number) => ({ qrgBlankId: '11101', canonicalTitle: 'Canonical shirt', minPrice: 10, isActive: true,
  providerMappings: { [provider]: provider === 'printful' ? { productId: id } : { blueprintId: id, printProviderId: 99 } },
  qrgVariants: { '0301': { sizeLabel: 'M', colorLabel: 'Black' } },
});
function fixture() { return database({ 'stores/a': { name: 'A', roleType: 'marketplace' },
  'master_catalog/qrg_11101': blank('printify', 6), 'master_catalog/qrg_11102': blank('printful', 71) }); }
const auth = (req: any,res: any,next: any) => req.headers['x-admin'] ? next() : res.status(401).json({ error:'Unauthorized' });
it('saves QRG references, reads both providers and preserves explicit empty choices', async () => {
  const {db,store}=fixture();
  await saveStoreProducts(db,'a',[{canonicalBlankKey:'qrg_11101',colors:[],sizes:[],title:'Stale'},{canonicalBlankKey:'qrg_11102'}]);
  expect(store.get('storeAllowedProducts/a').products).toEqual([{canonicalBlankKey:'qrg_11101',colors:[],sizes:[]},{canonicalBlankKey:'qrg_11102'}]);
  const {products}=await readStoreProducts(db,'a');expect(products.map(p=>p.provider)).toEqual(['printify','printful']);
  expect(products[0].title).toBe('Canonical shirt');expect(products[0].colors).toEqual([]);expect(products[0].sizes).toEqual([]);expect(products[0].availableColors).toEqual([]);expect(products[0].availableSizes).toEqual([]);
  expect(products[1].colors[0].name).toBe('Black');expect(products[1].sizes).toEqual(['M']);
  expect([...store.keys()].filter(k=>k.startsWith('printify')||k.startsWith('printful'))).toEqual([]);
});
it('rejects invalid choices without overwriting saved data', async () => {
  const {db,store}=fixture();await saveStoreProducts(db,'a',[]);
  await expect(saveStoreProducts(db,'a',[{canonicalBlankKey:'qrg_11101',colors:['Blue']}])).rejects.toThrow('Invalid colors');
  expect(store.get('storeAllowedProducts/a').products).toEqual([]);await expect(saveStoreProducts(db,'missing',[])).rejects.toThrow('Store not found');
});
it('uses assigned catalog QRG membership and respects an intentionally empty member list', async () => {
  const {db,store}=fixture();store.set('systemSettings/catalog-assignments',{member:'c'});store.set('catalogs/c',{blankIds:['qrg_11102'],blankTitles:{qrg_11102:'Catalog shirt'}});
  expect((await readStoreProducts(db,'member-products','member')).products.map(p=>p.title)).toEqual(['Catalog shirt']);
  await saveStoreProducts(db,'member-products',[]);expect((await readStoreProducts(db,'member-products','member')).products).toEqual([]);
});
it('reads old provider IDs only when exactly one QRG blank matches', async () => {
  const {db,store}=fixture();store.set('storeAllowedProducts/a',{products:[{blueprintId:6}]});
  expect((await readStoreProducts(db,'a')).products[0].canonicalBlankKey).toBe('qrg_11101');store.set('master_catalog/qrg_11103',blank('printify',6));
  await expect(readStoreProducts(db,'a')).rejects.toThrow('cannot be matched');
});
it.each(['','/api'])('enforces authentication and the same contracts under %s', async prefix => {
  const {db}=fixture(),app=express();app.use(express.json());registerStoreProductRoutes(app,prefix,auth,()=>db);registerStoreAdminRoutes(app,prefix,auth,()=>db,()=> 'now');
  expect((await request(app).post(`${prefix}/admin/stores/a/allowed-products`).send({products:[]})).status).toBe(401);
  expect((await request(app).post(`${prefix}/admin/stores/a/allowed-products`).set('x-admin','1').send({products:[{canonicalBlankKey:'qrg_11102'}]})).status).toBe(200);
  expect((await request(app).get(`${prefix}/stores/a/allowed-products`)).body.products[0].provider).toBe('printful');
  expect((await request(app).post(`${prefix}/admin/stores`).set('x-admin','1').send({name:'Marketplace',roleType:'marketplace'})).status).toBe(200);
  expect((await request(app).post(`${prefix}/admin/stores/marketplace/channels`).set('x-admin','1').send({name:'General'})).status).toBe(200);
});
it('finds unplaced products beyond 500 and products missing just their channel', async () => {
  const {db,store}=database();for(let i=0;i<510;i++)store.set(`admin_catalog_instances/${i}`,{storeId:'a',channelId:'c',createdAt:'2026-10-07'});
  store.set('admin_catalog_instances/old',{storeId:'a'});store.set('admin_catalog_instances/none',{});store.set('admin_catalog_instances/deleted',{status:'deleted'});store.set('admin_catalog_instances/archived',{status:'archived'});
  expect((await listCatalogInstances(db,{unplaced:'true'})).instances.map((i:any)=>i.id)).toEqual(['old','none']);expect((await listCatalogInstances(db,{channelId:'c'})).count).toBe(510);
});
it('does not infer missing stores from their names or crash on timestamp objects', async () => {
  const {db}=database({'stores/a':{name:'The orphaned store'},'partnerStores/p':{name:'Older partner'},'storeChannels/c':{name:'C',storeId:'a',createdAt:{seconds:1}},'storeChannels/p':{name:'P',storeId:'p'},'storeChannels/m':{name:'M',storeId:'missing'}});
  const rows=await listStoreChannels(db);expect(rows.find((r:any)=>r.id==='c').storeExists).toBe(true);expect(rows.find((r:any)=>r.id==='p').storeExists).toBe(true);expect(rows.find((r:any)=>r.id==='m').storeExists).toBe(false);
});
it('deletes collection listings in bounded batches and prevents legacy resurrection', async () => {
  const {db,store}=database();const batchSizes:number[]=[];
  db.batch=()=>{const ops:any[]=[];return {update:(ref:any,data:any)=>ops.push([ref,data]),commit:async()=>{batchSizes.push(ops.length);for(const [ref,data]of ops)await ref.update(data);}};};
  for(let i=0;i<501;i++)store.set(`admin_catalog_instances/${i}`,{storeId:'a',channelId:'c',collectionName:'Delete'});
  store.set('storeProductLinks/l',{storeId:'a',channel:'c',collection:'Delete'});store.set('dynamicsCollections/t',{storeId:'a',channelId:'c',name:'Delete'});store.set('admin_catalog_instances/keep',{storeId:'a',channelId:'c',collectionName:'Keep'});store.set('productPackets/p',{assemblyId:'ASM-000001'});
  expect((await listStoreCollections(db,'a','c')).collections).toEqual(['Delete','Keep']);await deleteStoreCollection(db,'a','c','Delete','now');expect(batchSizes).toEqual([500,3]);
  expect((await listStoreCollections(db,'a','c')).collections).toEqual(['Keep']);expect(store.get('productPackets/p')).toEqual({assemblyId:'ASM-000001'});
});
it('persists zero enabled choices and rejects invalid ones atomically', async () => {
  const {db,store}=database({'admin_catalog_instances/i':{baseSnapshot:{colors:['Black'],sizes:['M']},version:1}});
  await updateCatalogInstance(db,'i',{enabledColors:[],enabledSizes:[]},'now','admin');expect(store.get('admin_catalog_instances/i').enabledColors).toEqual([]);
  await expect(updateCatalogInstance(db,'i',{enabledColors:['Blue']},'now','admin')).rejects.toThrow('Invalid enabledColors');expect(store.get('admin_catalog_instances/i').version).toBe(2);
});
