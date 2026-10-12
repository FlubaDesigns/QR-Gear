import { applicationDefault } from 'firebase-admin/app';

// Server-only reads from the owner's one authoritative provider vault.
export const FLUBA_PROVIDER_PROJECT = 'flubadesigns-25482';
export const PROVIDER_SECRET_NAMES = ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','XAI_API_KEY','DEEPSEEK_API_KEY','PRINTFUL_API_KEY','PRINTIFY_API_TOKEN','SQUARE_ACCESS_TOKEN','RESEND_API_KEY','STRIPE_SECRET_KEY','APLIIQ_API_KEY'] as const;
export type ProviderSecretName = typeof PROVIDER_SECRET_NAMES[number];
type Entry = { value: string; version: string; expires: number };
export function createFlubaProviderReader(token: () => Promise<string>, request: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string,Entry>();
  const pending = new Map<string,Promise<string>>();
  async function read(name: ProviderSecretName): Promise<string> {
    if (!PROVIDER_SECRET_NAMES.includes(name)) throw new Error('Unsupported Fluba provider credential');
    const cached = cache.get(name);
    if (cached && cached.expires > now()) return cached.value;
    if (pending.has(name)) return pending.get(name)!;
    const operation = (async () => {
      let response: Response;
      try {
        response = await request(`https://secretmanager.googleapis.com/v1/projects/${FLUBA_PROVIDER_PROJECT}/secrets/${name}/versions/latest:access`, {
          headers: { Authorization: `Bearer ${await token()}` }, redirect: 'error', signal: AbortSignal.timeout(8000),
        });
      } catch { throw new Error(`Fluba credential unavailable: ${name}`); }
      if (response.status === 404) { cache.delete(name); return ''; }
      if (!response.ok) { cache.delete(name); throw new Error(`Fluba credential access failed: ${name} (${response.status})`); }
      const body = await response.json() as {name?:string;payload?:{data?:string}};
      const value = Buffer.from(body.payload?.data || '', 'base64').toString('utf8');
      if (!value || value === 'DISABLED_NOT_CONFIGURED') { cache.delete(name); return ''; }
      if (value.length < 20 || value.length > 4096 || /[\s\u0000-\u001f\u007f]/.test(value)) throw new Error(`Fluba credential format invalid: ${name}`);
      const version = String(body.name || '').split('/').pop() || '';
      if (!/^[1-9][0-9]*$/.test(version)) throw new Error('Fluba credential version missing');
      cache.set(name, {value, version, expires: now()+60000});
      return value;
    })();
    pending.set(name,operation);
    try { return await operation; } finally { pending.delete(name); }
  }
  return {read, clear: () => cache.clear(), status: () => Object.fromEntries(Array.from(cache.entries()).map(([name,e])=>[name,{source:'fluba',projectId:FLUBA_PROVIDER_PROJECT,version:e.version,current:e.expires>now()}]))};
}
const reader = createFlubaProviderReader(async () => (await applicationDefault().getAccessToken()).access_token);
export const readFlubaProviderKey = reader.read;
export const flubaProviderKeyStatus = reader.status;
export const clearFlubaProviderKeyCache = reader.clear;
