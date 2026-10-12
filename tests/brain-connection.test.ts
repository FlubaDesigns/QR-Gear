import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const { createBrainClient } = createRequire(import.meta.url)('../functions/src/services/brain-client.ts') as typeof import('../functions/src/services/brain-client');
const origin='https://us-central1-flubadesigns-25482.cloudfunctions.net';
const key='fixture-only-not-a-live-secret';
const env={FLUBA_BRAIN_URL:origin+'/brainIngressHttp',FLUBA_BRAIN_STATUS_URL:origin+'/brainStatusHttp'};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status});
type AppId='qr-gear'|'pollsit';
const resource=(appId:AppId)=>'projects/flubadesigns-25482/secrets/BRAIN_SITE_SECRET__'+appId.toUpperCase().replace(/-/g,'_')+'/versions/1';
function fixture(appId:AppId, gateway:typeof fetch, secret=key) {
 let secretReads=0;
 const client=createBrainClient(appId,{...env,FLUBA_BRAIN_SECRET_RESOURCE:resource(appId)},async(url,options)=>{
  if(String(url).startsWith('https://secretmanager.googleapis.com/')) {
   secretReads++;
   assert.equal(url,'https://secretmanager.googleapis.com/v1/'+resource(appId)+':access');
   assert.equal((options?.headers as any).Authorization,'Bearer fixture-identity');
   assert.equal(options?.redirect,'error');
   return json({payload:{data:Buffer.from(secret).toString('base64')}});
  }
  return gateway(url,options);
 },async()=> 'fixture-identity');
 return {client,reads:()=>secretReads};
}
for(const appId of ['qr-gear','pollsit'] as const) {
 test(appId+' signs canonical requests using its managed credential and preserves App Check',async()=>{
  let calls=0;
  const {client,reads}=fixture(appId,async(url,options)=>{
   calls++;assert.equal(url,origin+'/brainIngressHttp');assert.equal(options?.redirect,'error');
   const raw=String(options?.body),body=JSON.parse(raw),headers=options?.headers as Record<string,string>;
   assert.deepEqual(body,{appId,action:'draft',prompt:'fixture prompt',idempotencyKey:'fixture-1'});
   assert.equal(headers['X-Firebase-AppCheck'],'fixture-attestation');assert.equal(headers['x-app-id'],appId);
   assert.equal(headers['x-signature'],crypto.createHmac('sha256',key).update(raw).digest('hex'));
   assert(!raw.includes(key));return json({requestId:'req_fixture',status:'accepted'},202);
  });
  assert.equal((await client.request('fixture-attestation',{prompt:'fixture prompt',idempotencyKey:'fixture-1'})).requestId,'req_fixture');
  assert.equal(calls,1);assert.equal(reads(),1);
 });
 test(appId+' connection checks cache its credential and require an authenticated response',async()=>{
  const {client,reads}=fixture(appId,async(url,options)=>{
   const u=new URL(String(url)),id=u.searchParams.get('requestId')!;
   assert.equal(u.pathname,'/brainStatusHttp');assert.equal(u.searchParams.get('appId'),appId);
   assert.equal(options?.method,'GET');assert.equal(options?.body,undefined);
   const h=options?.headers as Record<string,string>;
   assert.equal(h['x-signature'],crypto.createHmac('sha256',key).update(appId+'\n'+id).digest('hex'));
   return json({error:'Request not found',requestId:id},404);
  });
  assert.equal((await client.check('fixture-attestation')).connected,true);
  await client.check('fixture-attestation');assert.equal(reads(),1);
  for(const [body,status] of [[{error:'Invalid App Check token'},401],[{error:'app_status_authentication_failed'},401],[{error:'Request not found',requestId:'wrong-id'},404],[{},200],[{},404]] as const)
   await assert.rejects(fixture(appId,async()=>json(body,status)).client.check('fixture-attestation'));
 });
}
test('a pasted legacy secret cannot replace a missing or invalid central binding',async()=>{
 let calls=0;const request=async()=>{calls++;return json({});};
 for(const binding of ['',resource('qr-gear'),resource('pollsit').replace('/1','/latest'),'https://other.invalid/secret']) {
  const config={...env,FLUBA_SITE_SECRET:key,FLUBA_BRAIN_SECRET_RESOURCE:binding};
  await assert.rejects(createBrainClient('pollsit',config,request).check('attestation'));
 }
 assert.equal(calls,0);
});
test('missing attestation and unsafe inputs cannot read credentials or send requests',async()=>{
 let calls=0;const request=async()=>{calls++;return json({});};
 const config={...env,FLUBA_BRAIN_SECRET_RESOURCE:resource('pollsit')};
 const client=createBrainClient('pollsit',config,request);
 await assert.rejects(client.request('',{prompt:'fixture',idempotencyKey:'stable'}));
 await assert.rejects(client.request('token',{requestId:'other\nsite'}));
 await assert.rejects(client.request('token',{prompt:'fixture',idempotencyKey:'stable',action:'deploy' as any}));
 await assert.rejects(createBrainClient('pollsit',{...config,FLUBA_BRAIN_URL:'https://other.invalid'},request).request('token',{prompt:'fixture',idempotencyKey:'stable'}));
 assert.equal(calls,0);
});
test('denied central credentials and empty placeholders never reach the Brain',async()=>{
 for(const value of ['', 'DISABLED_NOT_CONFIGURED']) {
  const {client}=fixture('qr-gear',async()=>{assert.fail('gateway must not be called');},value);
  await assert.rejects(client.check('attestation'),/not configured/);
 }
 let calls=0;
 const client=createBrainClient('qr-gear',{...env,FLUBA_BRAIN_SECRET_RESOURCE:resource('qr-gear'),FLUBA_SITE_SECRET:key},async(url)=>{
  calls++;assert(String(url).startsWith('https://secretmanager.googleapis.com/'));return json({error:key},403);
 },async()=> 'fixture-identity');
 await assert.rejects(client.check('attestation'),/access is unavailable/);assert.equal(calls,1);
});
test('upstream error bodies do not expose the signing credential',async()=>{
 const {client}=fixture('qr-gear',async()=>json({error:key},500));
 await assert.rejects(client.request('token',{requestId:'fixture'}),error=>{assert(!String(error).includes(key));return true;});
});
