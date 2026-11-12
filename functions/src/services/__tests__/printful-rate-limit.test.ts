import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../fluba-provider-keys',()=>({readFlubaProviderKey:vi.fn(async()=> 'test-only-key')}));
vi.mock('../../core',()=>({db:{collection:()=>({doc:()=>({get:async()=>({data:()=>({})})})})}}));
import {PrintfulClient} from '../printful';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
const limited=(seconds?:string)=>new Response(JSON.stringify({error:{message:'Please try again after 13 seconds.'}}),{status:429,headers:seconds===undefined?{}:{'Retry-After':seconds}});
const success=(result:unknown)=>new Response(JSON.stringify({result}));
it('honors the provider delay and retries the same polling task without creating another',async()=>{
 vi.useFakeTimers();vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');
 const fetch=vi.fn().mockResolvedValueOnce(limited('13')).mockResolvedValueOnce(success({status:'completed',mockups:[]}));vi.stubGlobal('fetch',fetch);
 const pending=new PrintfulClient().waitForMockupTask('existing-task');
 await vi.advanceTimersByTimeAsync(13000);expect(fetch).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1000);expect((await pending).status).toBe('completed');
 expect(fetch.mock.calls.map(c=>c[0])).toEqual(Array(2).fill('https://api.printful.com/mockup-generator/task?task_key=existing-task'));
 expect(fetch.mock.calls.every(c=>c[1].method==='GET')).toBe(true);
 expect(fetch.mock.calls[0][1].signal).not.toBe(fetch.mock.calls[1][1].signal);
});
it('uses the provider body cooldown when its header is absent',async()=>{
 vi.useFakeTimers();vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');
 const fetch=vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(success({variants:[]}));vi.stubGlobal('fetch',fetch);
 const pending=new PrintfulClient().getProduct(71);await vi.advanceTimersByTimeAsync(13000);expect(fetch).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1000);await pending;expect(fetch).toHaveBeenCalledTimes(2);
});
it('bounds provider retries and surfaces the original rate limit',async()=>{
 vi.useFakeTimers();vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');
 const fetch=vi.fn(async()=>limited('1'));vi.stubGlobal('fetch',fetch);
 const pending=expect(new PrintfulClient().getPrintfiles(71)).rejects.toMatchObject({status:429});
 await vi.runAllTimersAsync();await pending;expect(fetch).toHaveBeenCalledTimes(3);
});
it('does not retry order creation or confirmation',async()=>{
 vi.stubEnv('QRGEAR_ENVIRONMENT','production');
 const fetch=vi.fn(async()=>limited('1'));vi.stubGlobal('fetch',fetch);const client=new PrintfulClient();
 await expect(client.createOrder({external_id:'existing',recipient:{},items:[]})).rejects.toMatchObject({status:429});
 await expect(client.confirmOrder('existing')).rejects.toMatchObject({status:429});expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not retry validation failures or a cooldown beyond the request budget',async()=>{
 vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');
 const fetch=vi.fn().mockResolvedValueOnce(new Response('Invalid variant',{status:400})).mockResolvedValueOnce(limited('120'));vi.stubGlobal('fetch',fetch);const client=new PrintfulClient();
 await expect(client.createMockupTask(71,[123],[])).rejects.toMatchObject({status:400});
 await expect(client.getPrintfiles(71)).rejects.toMatchObject({status:429});expect(fetch).toHaveBeenCalledTimes(2);
});
