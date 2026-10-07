import { beforeEach, describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const m = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, any>>, batches: [] as number[], writes: [] as string[] }));
vi.mock('../../core', () => {
  const ref = (name: string, id: string): any => ({ id, path: `${name}/${id}`, get: async () => ({ exists: !!m.rows[name]?.[id], id, ref: ref(name,id), data: () => m.rows[name]?.[id] }) });
  const collection = (name: string) => {
    const filters: any[] = [];
    const q: any = { doc: (id: string) => ref(name,id), where: (f: string, _op: string,v: any) => { filters.push([f,v]); return q; },
      get: async () => { const docs = Object.entries(m.rows[name] || {}).filter(([,v]) => filters.every(([f,x]) => v[f] === x)).map(([id,data]) => ({ id, ref: ref(name,id), data: () => data })); return { docs, size: docs.length, empty: !docs.length, forEach: (f: any) => docs.forEach(f) }; },
    }; return q;
  };
  const writer = () => {
    const ops: any[] = [];
    return { get: (r: any) => r.get(), create: (r: any,d: any) => ops.push(['create',r,d]), update: (r: any,d: any) => ops.push(['update',r,d]), delete: (r: any) => ops.push(['delete',r]),
      commit: async () => {
        m.batches.push(ops.length); expect(ops.length).toBeLessThanOrEqual(500);
        for (const [action,r,data] of ops) { const [name,id] = r.path.split('/'); m.writes.push(r.path); m.rows[name] ||= {};
          if (action === 'delete') delete m.rows[name][id];
          else { if (action === 'create' && m.rows[name][id]) throw new Error('Existing record'); m.rows[name][id] = { ...m.rows[name][id], ...data }; }
        }
      },
    };
  };
  return { db: { collection, batch: writer, runTransaction: async (fn: any) => { const tx=writer(); const result=await fn(tx); await tx.commit(); return result; } }, admin: { firestore: { FieldValue: { serverTimestamp: () => 'now' } } } };
});
vi.mock('../../middleware', () => ({ requireAdmin: (req: any,res: any,next: any) => req.headers['x-test-admin'] ? next() : res.status(401).json({ error:'Unauthorized' }) }));
vi.mock('../../services/printful',()=>({})); vi.mock('../../services/printify',()=>({})); vi.mock('../../services/storage-helpers',()=>({})); vi.mock('../../services/pricing',()=>({})); vi.mock('../../services/mockup-generator',()=>({})); vi.mock('../../services/email',()=>({})); vi.mock('../../services/composite-image',()=>({}));
import { register as adminRoutes } from '../../routes/admin-stores';
import { register as publicRoutes } from '../../routes/public-stores';
const app=express(); app.use(express.json()); adminRoutes(app); publicRoutes(app);
const post=(p: string,b: any)=>request(app).post(p).set('x-test-admin','yes').send(b);
const remove=(p: string)=>request(app).delete(p).set('x-test-admin','yes');
beforeEach(()=>{m.rows={stores:{a:{name:'A',roleType:'internal',channelCount:0},b:{name:'B',roleType:'internal'}}};m.writes=[];m.batches=[];});
describe('Store/channel blast radius across both existing route adapters',()=>{
  it.each(['/admin',''])('rejects duplicate stores on %s without overwriting',async prefix=>{
    expect((await post(`${prefix}/stores`,{name:'A',roleType:'external'})).status).toBe(409); expect(m.rows.stores.a.roleType).toBe('internal');expect(m.writes).toHaveLength(0);
  });
  it.each(['internal','external','member','marketplace'])('accepts shared role %s',async roleType=>{
    const res=await post('/admin/stores',{name:'New store',roleType});expect(res.status).toBe(200);expect(res.body.roleType).toBe(roleType);
  });
  it.each([{name:'!!!',roleType:'internal'},{name:'Valid',roleType:'invalid'},{name:123,roleType:'internal'}])('rejects invalid store input',async input=>{
    expect((await post('/admin/stores',input)).status).toBe(400);expect(m.writes).toHaveLength(0);
  });
  it('supports the same channel name in two stores and preserves legacy IDs',async()=>{
    m.rows.storeChannels={general:{name:'General',storeId:'a'}};
    expect((await post('/admin/stores/a/channels',{name:'General'})).status).toBe(409);
    const res=await post('/stores/b/channels',{name:'General'});expect(res.status).toBe(200);expect(res.body.id).toBe('b--general');expect(m.rows.storeChannels.general.storeId).toBe('a');expect(m.rows.stores.b.channelCount).toBe(1);
  });
  it.each(['/admin',''])('checks parent and duplicate channels on %s',async prefix=>{
    expect((await post(`${prefix}/stores/missing/channels`,{name:'General'})).status).toBe(404);
    expect((await post(`${prefix}/stores/a/channels`,{name:'General'})).status).toBe(200);
    expect((await post(`${prefix}/stores/a/channels`,{name:' General '})).status).toBe(409);expect(m.rows.stores.a.channelCount).toBe(1);
  });
  it.each(['/admin',''])('rejects deleting another store channel on %s',async prefix=>{
    m.rows.storeChannels={legacy:{name:'General',storeId:'a'}};
    expect((await remove(`${prefix}/stores/b/channels/legacy`)).status).toBe(409);expect(m.writes).toHaveLength(0);
  });
  it('archives only the targeted channel, including more than 500 instances',async()=>{
    m.rows.storeChannels={legacy:{name:'General',storeId:'a'},other:{name:'Other',storeId:'a'}};
    m.rows.admin_catalog_instances=Object.fromEntries(Array.from({length:501},(_,i)=>[`i${i}`,{storeId:'a',channelId:'legacy',isVisible:true}]));m.rows.admin_catalog_instances.keep={storeId:'a',channelId:'other',isVisible:true};
    const res=await remove('/admin/stores/a/channels/legacy');expect(res.status).toBe(200);expect(res.body.archivedInstances).toBe(501);expect(m.rows.storeChannels.legacy).toBeUndefined();expect(m.rows.admin_catalog_instances.keep.isVisible).toBe(true);expect(m.rows.admin_catalog_instances.i0.status).toBe('deleted');expect(m.rows.stores.a.channelCount).toBe(1);
  });
  it('direct channel deletion shares the archive behavior',async()=>{
    m.rows.storeChannels={legacy:{name:'General',storeId:'a'}};m.rows.admin_catalog_instances={i:{storeId:'a',channelId:'legacy'}};
    expect((await remove('/admin/channels/legacy')).status).toBe(200);expect(m.rows.admin_catalog_instances.i.status).toBe('deleted');
  });
  it.each(['/admin',''])('store deletion on %s leaves other destinations intact',async prefix=>{
    m.rows.storeChannels={c:{storeId:'a',name:'General'},d:{storeId:'b',name:'General'}};m.rows.admin_catalog_instances={i:{storeId:'a',channelId:'c'},keep:{storeId:'b',channelId:'d',isVisible:true}};
    expect((await remove(`${prefix}/stores/a`)).status).toBe(200);expect(m.rows.stores.a).toBeUndefined();expect(m.rows.stores.b).toBeDefined();expect(m.rows.storeChannels.d).toBeDefined();expect(m.rows.admin_catalog_instances.keep.isVisible).toBe(true);
  });
  it('preserves older Store Builder parents and ordinary channel IDs',async()=>{
    m.rows.partnerStores={partner:{name:'Partner'}};
    const res=await post('/admin/stores/partner/channels',{name:'New Channel'});
    expect(res.status).toBe(200);expect(res.body.id).toBe('new-channel');expect(m.rows.partnerStores.partner.channelCount).toBe(1);
    expect((await remove('/admin/stores/partner/channels/new-channel')).status).toBe(200);expect(m.rows.partnerStores.partner.channelCount).toBe(0);
  });
  it('keeps admin authentication on both route families',async()=>{
    for(const p of ['/admin','']) {expect((await request(app).post(`${p}/stores`).send({name:'X',roleType:'internal'})).status).toBe(401);expect((await request(app).delete(`${p}/stores/a`)).status).toBe(401);expect((await request(app).post(`${p}/stores/a/channels`).send({name:'X'})).status).toBe(401);}expect(m.writes).toHaveLength(0);
  });
});
