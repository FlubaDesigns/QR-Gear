import { expect, it, vi, afterEach } from 'vitest';
import { createFlubaProviderReader } from '../fluba-provider-keys';
afterEach(()=>vi.unstubAllEnvs());
const response=(value:string,version='2')=>new Response(JSON.stringify({name:`projects/flubadesigns-25482/secrets/OPENAI_API_KEY/versions/${version}`,payload:{data:Buffer.from(value).toString('base64')}}));
it('reads the Fluba source, shares concurrent requests, and exposes only version metadata',async()=>{
  vi.stubEnv('OPENAI_API_KEY','revoked-site-placeholder');
  const request=vi.fn(async(_url: Parameters<typeof fetch>[0], _init?: RequestInit)=>response('central-provider-placeholder'));
  const reader=createFlubaProviderReader(async()=>'identity-token',request);
  expect(await Promise.all([reader.read('OPENAI_API_KEY'),reader.read('OPENAI_API_KEY')])).toEqual(['central-provider-placeholder','central-provider-placeholder']);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]![0]).toBe('https://secretmanager.googleapis.com/v1/projects/flubadesigns-25482/secrets/OPENAI_API_KEY/versions/latest:access');
  expect(JSON.stringify(reader.status())).not.toContain('placeholder');
});
it('rotation refreshes after expiry and an access failure never falls back to the old key',async()=>{
  let now=0;const request=vi.fn().mockResolvedValueOnce(response('central-old-placeholder')).mockResolvedValueOnce(response('central-new-placeholder','3')).mockResolvedValueOnce(new Response('',{status:403}));
  const reader=createFlubaProviderReader(async()=>'identity-token',request,()=>now);
  expect(await reader.read('OPENAI_API_KEY')).toBe('central-old-placeholder');now=60001;
  expect(await reader.read('OPENAI_API_KEY')).toBe('central-new-placeholder');now=120002;
  vi.stubEnv('OPENAI_API_KEY','revoked-local-placeholder');
  await expect(reader.read('OPENAI_API_KEY')).rejects.toThrow('403');
  expect(reader.status()).toEqual({});
});
it('does not turn a missing shared key into a local fallback or allow arbitrary secret names',async()=>{
 const request=vi.fn(async()=>new Response('',{status:404}));
 const reader=createFlubaProviderReader(async()=>'identity-token',request);
 vi.stubEnv('OPENAI_API_KEY','revoked-local-placeholder');
 expect(await reader.read('OPENAI_API_KEY')).toBe('');
 await expect(reader.read('DATABASE_PASSWORD' as any)).rejects.toThrow('Unsupported');
 expect(request).toHaveBeenCalledTimes(1);
});
