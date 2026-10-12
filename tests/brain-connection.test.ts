import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createBrainClient } from '../functions/src/services/brain-client';
const origin='https://us-central1-flubadesigns-25482.cloudfunctions.net';
const env={FLUBA_SITE_SECRET:'fixture-only-not-a-live-secret',FLUBA_BRAIN_URL:origin+'/brainIngressHttp',FLUBA_BRAIN_STATUS_URL:origin+'/brainStatusHttp'};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status});
for(const appId of ['qr-gear','pollsit'] as const) {
 test(appId+' signs canonical app-scoped requests and preserves App Check',async()=>{
  let calls=0;
  const client=createBrainClient(appId,env,async(url,options)=>{
   calls++;assert.equal(url,origin+'/brainIngressHttp');assert.equal(options?.redirect,'error');
   const raw=String(options?.body),body=JSON.parse(raw),headers=options?.headers as Record<string,string>;
   assert.deepEqual(body,{appId,action:'draft',prompt:'fixture prompt',idempotencyKey:'fixture-1'});
   assert.equal(headers['X-Firebase-AppCheck'],'fixture-attestation');
   assert.equal(headers['x-app-id'],appId);
   assert.equal(headers['x-signature'],crypto.createHmac('sha256',env.FLUBA_SITE_SECRET).update(raw).digest('hex'));
   assert(!raw.includes(env.FLUBA_SITE_SECRET));return json({requestId:'req_fixture',status:'accepted'},202);
  });
  assert.equal((await client.request('fixture-attestation',{prompt:'fixture prompt',idempotencyKey:'fixture-1'})).requestId,'req_fixture');
  assert.equal(calls,1);
 });
 test(appId+' connection check requires the authenticated missing-request response',async()=>{
  const client=createBrainClient(appId,env,async(url,options)=>{
   const u=new URL(String(url)),id=u.searchParams.get('requestId')!;
   assert.equal(u.pathname,'/brainStatusHttp');assert.equal(u.searchParams.get('appId'),appId);
   assert.equal(options?.method,'GET');assert.equal(options?.body,undefined);
   const h=options?.headers as Record<string,string>;
   assert.equal(h['x-signature'],crypto.createHmac('sha256',env.FLUBA_SITE_SECRET).update(appId+'\n'+id).digest('hex'));
   return json({error:'Request not found',requestId:id},404);
  });
  assert.equal((await client.check('fixture-attestation')).connected,true);
  for(const [body,status] of [[{error:'Invalid App Check token'},401],[{error:'app_status_authentication_failed'},401],[{error:'Request not found',requestId:'wrong-id'},404],[{},200],[{},404]] as const) {
   const reject=createBrainClient(appId,env,async()=>json(body,status));
   await assert.rejects(reject.check('fixture-attestation'));
  }
 });
}
test('invalid configuration, missing attestation and unsafe inputs never send a request',async()=>{
 let calls=0;const request=async()=>{calls++;return json({});};
 for(const config of [{...env,FLUBA_SITE_SECRET:''},{...env,FLUBA_SITE_SECRET:'DISABLED_NOT_CONFIGURED'},{...env,FLUBA_BRAIN_URL:'https://other.invalid'}])
  await assert.rejects(createBrainClient('pollsit',config,request).request('token',{prompt:'fixture',idempotencyKey:'stable'}));
 const client=createBrainClient('pollsit',env,request);
 await assert.rejects(client.request('',{prompt:'fixture',idempotencyKey:'stable'}));
 await assert.rejects(client.request('token',{requestId:'other\nsite'}));
 await assert.rejects(client.request('token',{prompt:'fixture',idempotencyKey:'stable',action:'deploy' as any}));
 assert.equal(calls,0);
});
test('upstream error bodies are not exposed',async()=>{
 const client=createBrainClient('qr-gear',env,async()=>json({error:env.FLUBA_SITE_SECRET},500));
 await assert.rejects(client.request('token',{requestId:'fixture'}),error=>{assert(!String(error).includes(env.FLUBA_SITE_SECRET));return true;});
});
