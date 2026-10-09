import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../core', () => ({db:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({printfulApiKey:'test-only-catalog-key'})})})})}}));
import { printfulClient } from '../printful';
const fetchMock=vi.fn();
beforeEach(()=>{
  vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');vi.stubEnv('GCLOUD_PROJECT','qr-gear-sandbox');
  vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset();
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('permits only catalog reads needed for pricing in sandbox',async()=>{
  fetchMock.mockResolvedValue({ok:true,json:async()=>({result:{variants:[{id:1,price:'12.00'}]}})});
  expect(await printfulClient.getProduct(71)).toMatchObject({variants:[{price:'12.00'}]});
  fetchMock.mockResolvedValue({ok:true,json:async()=>({result:[{id:71}]})});
  expect(await printfulClient.getCatalogProducts()).toEqual([{id:71}]);
  expect(fetchMock.mock.calls.map(c=>[c[0],c[1].method])).toEqual([
    ['https://api.printful.com/products/71','GET'],['https://api.printful.com/products','GET'],
  ]);
});
it('still blocks order reads, creation and production confirmation before any network request',async()=>{
  await expect(printfulClient.getOrder('77')).rejects.toThrow('disabled');
  await expect(printfulClient.createOrder({external_id:'test',recipient:{},items:[]})).rejects.toThrow('disabled');
  await expect(printfulClient.confirmOrder('77')).rejects.toThrow('disabled');
  expect(fetchMock).not.toHaveBeenCalled();
});
