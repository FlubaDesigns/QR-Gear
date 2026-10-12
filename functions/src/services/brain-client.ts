import crypto from 'node:crypto';
import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';

const ORIGIN = 'https://us-central1-flubadesigns-25482.cloudfunctions.net';
export type BrainInput = { prompt: string; idempotencyKey: string; action?: 'draft' | 'analyze' } | { requestId: string };
export function createBrainClient(appId: 'qr-gear' | 'pollsit', env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch,
  accessToken: () => Promise<string> = async () => {
    const app = getApps()[0] || initializeApp({ credential: applicationDefault() });
    const token = await app.options.credential!.getAccessToken();
    return token.access_token;
  }) {
  let cached: { value: string; expires: number } | undefined;
  async function siteSecret() {
    const resource = env.FLUBA_BRAIN_SECRET_RESOURCE;
    if (!resource) throw new Error('Managed Brain connection is not configured.');
    const prefix = 'projects/flubadesigns-25482/secrets/BRAIN_SITE_SECRET__' + appId.toUpperCase().replace(/-/g, '_') + '/versions/';
    if (!resource.startsWith(prefix) || !/^[1-9][0-9]*$/.test(resource.slice(prefix.length))) throw new Error('Invalid Brain secret binding.');
    if (cached && cached.expires > Date.now()) return cached.value;
    const response = await request('https://secretmanager.googleapis.com/v1/' + resource + ':access', {
      redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Authorization: 'Bearer ' + await accessToken() },
    });
    if (!response.ok) throw new Error('Brain secret access is unavailable.');
    const data = await response.json() as any;
    if (typeof data.payload?.data !== 'string') throw new Error('Brain secret is unavailable.');
    const value = Buffer.from(data.payload.data, 'base64').toString('utf8');
    if (value.length < 20 || value === 'DISABLED_NOT_CONFIGURED') throw new Error('Brain secret is not configured.');
    cached = { value, expires: Date.now() + 60000 };
    return value;
  }
  async function call(appCheckToken: string, input: BrainInput, connectionProbe = false) {
    const status = 'requestId' in input;
    const expected = ORIGIN + (status ? '/brainStatusHttp' : '/brainIngressHttp');
    const endpoint = status ? env.FLUBA_BRAIN_STATUS_URL : env.FLUBA_BRAIN_URL;
    if (endpoint !== expected) throw new Error('Brain connection is not configured.');
    if (!appCheckToken) throw new Error('Brain App Check attestation is required.');
    if (status && !/^[A-Za-z0-9_-]{1,160}$/.test(input.requestId)) throw new Error('Invalid Brain request identity.');
    if (!status && (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 100000 ||
      typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(input.idempotencyKey) ||
      !['draft', 'analyze'].includes(input.action || 'draft'))) throw new Error('Invalid Brain request.');
    const secret = await siteSecret();
    if (!secret || secret === 'DISABLED_NOT_CONFIGURED') throw new Error('Brain connection is not configured.');
    const raw = status ? `${appId}\n${input.requestId}` : JSON.stringify({ appId, action: input.action || 'draft', prompt: input.prompt, idempotencyKey: input.idempotencyKey });
    const url = new URL(expected);
    if (status) { url.searchParams.set('appId', appId); url.searchParams.set('requestId', input.requestId); }
    const response = await request(url.toString(), {
      method: status ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { 'content-type': 'application/json', 'x-app-id': appId, 'X-Firebase-AppCheck': appCheckToken,
        'x-signature': crypto.createHmac('sha256', secret).update(raw).digest('hex') },
      ...(!status ? { body: raw } : {}),
    });
    const data = await response.json().catch(() => ({})) as any;
    if (connectionProbe && response.status === 404 && data.error === 'Request not found' && status && data.requestId === input.requestId) {
      return { connected: true, appId, checkedAt: new Date().toISOString(), release: env.FLUBA_BRAIN_RELEASE || null };
    }
    if (!response.ok) throw new Error(`Brain request failed (${response.status}).`);
    if (connectionProbe) throw new Error('Unexpected Brain connection-check response.');
    if (typeof data.requestId !== 'string' || (status && data.requestId !== input.requestId)) throw new Error('Brain response identity mismatch.');
    return data;
  }
  return {
    request: (token: string, input: BrainInput) => call(token, input),
    check: (token: string) => call(token, { requestId: 'connection-check-' + crypto.randomUUID() }, true),
  };
}

const client = createBrainClient('qr-gear');
export const brainRequest = client.request;
export const checkBrainConnection = client.check;
