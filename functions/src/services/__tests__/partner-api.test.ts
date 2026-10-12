import { describe, it, expect } from 'vitest';
import { authenticatePartner, newPartnerApiKey, savePartner, rotatePartnerKey, partnerProducts, publicPartner } from '../partner-api';
function database(seed: Record<string, any>) {
  const rows = structuredClone(seed); let next = 0;
  const ref = (path: string): any => ({ id: path.split('/').pop(), path, get: async () => ({ id: path.split('/').pop(), exists: !!rows[path], data: () => rows[path] }) });
  const collection = (name: string) => {
    const make = (filters: any[] = [], max = Infinity): any => ({
      doc: (id?: string) => ref(`${name}/${id ?? `created-${++next}`}`),
      where: (field: string, op: string, value: any) => make([...filters, [field, value]], max),
      limit: (n: number) => make(filters, n),
      get: async () => {
        const docs = Object.entries(rows).filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([f,v]) => data[f] === v)).slice(0,max).map(([path,data]) => ({ id: path.split('/').pop(), exists: true, data: () => data }));
        return { docs, empty: !docs.length };
      },
    }); return make();
  };
  const db: any = { collection, runTransaction: async (fn: any) => {
    const writes: any[] = [];
    const value = await fn({ get: (r: any) => r.get(), create: (r: any,d: any) => writes.push([r.path,d]), update: (r: any,d: any) => writes.push([r.path,{...rows[r.path],...d}]) });
    for (const [path,data] of writes) rows[path]=data;
    return value;
  } };
  return { db, rows };
}
const key = newPartnerApiKey();
const seed = { 'partnerStores/a': { slug:'alpha', name:'Alpha', isActive:true, apiKey:key, allowedOrigins:['https://alpha.example'] }, 'partnerStores/b': { slug:'beta', name:'Beta', isActive:true, apiKey:newPartnerApiKey() } };
const req = (partnerId: string, apiKey = key, origin?: string) => ({ query:{partnerId}, headers:{'x-api-key':apiKey, ...(origin ? {origin} : {})} });
describe('partner API ownership and admin persistence', () => {
  it('accepts the same partner by stable ID or unique slug', async () => {
    const {db}=database(seed);
    expect((await authenticatePartner(db,req('a'))).id).toBe('a');
    expect((await authenticatePartner(db,req('alpha'))).id).toBe('a');
  });
  it('rejects missing, wrong, old-format and cross-partner keys', async () => {
    const {db}=database(seed);
    for(const r of [req('a',''),req('a',newPartnerApiKey()),req('a','psk-old'),req('b')]) await expect(authenticatePartner(db,r)).rejects.toMatchObject({status:401});
  });
  it('blocks disabled partners and unauthorized origins', async () => {
    const {db,rows}=database(seed);
    await expect(authenticatePartner(db,req('a',key,'https://beta.example'))).rejects.toMatchObject({status:403});
    expect((await authenticatePartner(db,req('a',key,'https://alpha.example'))).id).toBe('a');
    rows['partnerStores/a'].isActive=false;
    await expect(authenticatePartner(db,req('a'))).rejects.toMatchObject({status:403});
  });
  it('rotates only the selected partner and immediately rejects its old key', async () => {
    const {db,rows}=database(seed); const before=rows['partnerStores/b'].apiKey;
    const result=await rotatePartnerKey(db,'a');
    await expect(authenticatePartner(db,req('a'))).rejects.toMatchObject({status:401});
    expect((await authenticatePartner(db,req('a',result.apiKey))).id).toBe('a');
    expect(rows['partnerStores/b'].apiKey).toBe(before);
  });
  it('creates securely and saves/clears arrays in the same existing registry', async () => {
    const {db,rows}=database(seed);
    const created=await savePartner(db,{slug:'gamma',name:'Gamma'});
    expect(created.apiKey).toMatch(/^psk-[a-f0-9]{64}$/);
    await savePartner(db,{allowedOrigins:[],name:'Renamed'},'a');
    expect(rows['partnerStores/a'].allowedOrigins).toEqual([]);
    expect(rows['partnerStores/a'].apiKey).toBe(key);
    expect(Object.keys(rows).every(p=>p.startsWith('partnerStores/'))).toBe(true);
  });
  it('rejects duplicate slugs, missing records and credential injection', async () => {
    const {db}=database(seed);
    await expect(savePartner(db,{name:'Duplicate',slug:'alpha'})).rejects.toMatchObject({status:409});
    await expect(savePartner(db,{slug:'beta'},'a')).rejects.toMatchObject({status:409});
    await expect(savePartner(db,{apiKey:'injected'},'a')).rejects.toMatchObject({status:400});
    await expect(savePartner(db,{name:'Absent'},'missing')).rejects.toMatchObject({status:404});
    await expect(rotatePartnerKey(db,'missing')).rejects.toMatchObject({status:404});
  });
  it('does not expose credentials or private fields in public projections', () => {
    const result=publicPartner({...seed['partnerStores/a'],secret:'private',apiKeyHash:'private'});
    expect(JSON.stringify(result)).not.toContain(key); expect(result).not.toHaveProperty('secret'); expect(result).not.toHaveProperty('apiKeyHash');
  });
  it('rejects cross-store channels and unbound member/store requests', async () => {
    const {db}=database({...seed,'storeChannels/b-channel':{storeId:'b'}});
    for(const q of [{channelId:'b-channel'},{memberId:'someone'},{storeId:'b'}]) await expect(partnerProducts(db,{id:'a'},q)).rejects.toHaveProperty('status');
  });
  it('projects only this partner’s visible canonical products with QRG options', async () => {
    const {db}=database({...seed,
      'admin_catalog_instances/item':{storeId:'a',currentPacketId:'pkt',enabledColors:['Black'],enabledSizes:['M'],resolved:{title:'Saved product',pricing:{customerPrice:35}}},
      'admin_catalog_instances/hidden':{storeId:'a',isVisible:false},
      'admin_catalog_instances/foreign':{storeId:'b'},
      'productPackets/pkt':{builderSnapshot:{metadata:{selectedProductDocId:'qrg_11001'}},fulfillmentProvider:'printful',priorityMockupUrl:'https://example.com/saved.png'},
      'master_catalog/qrg_11001':{qrgVariants:{'0401':{sizeLabel:'M',colorLabel:'Black',providerVariants:{printful:{variantId:123,productId:456}}}}},
    });
    const result=await partnerProducts(db,{id:'a'},{});
    expect(result.products).toHaveLength(1);expect(result.products[0]).toMatchObject({id:'item',basePrice:35,availableVariants:[{size:'M',color:'Black'}]});
  });
});
