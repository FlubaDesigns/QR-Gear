import crypto from 'node:crypto';

const ORIGIN = 'https://us-central1-flubadesigns-25482.cloudfunctions.net';
export type BrainInput = { prompt: string; idempotencyKey: string; action?: 'draft' | 'analyze' } | { requestId: string };
export function createBrainClient(appId: 'qr-gear' | 'pollsit', env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  async function call(appCheckToken: string, input: BrainInput, connectionProbe = false) {
    const status = 'requestId' in input;
    const expected = ORIGIN + (status ? '/brainStatusHttp' : '/brainIngressHttp');
    const endpoint = status ? env.FLUBA_BRAIN_STATUS_URL : env.FLUBA_BRAIN_URL;
    const secret = env.FLUBA_SITE_SECRET;
    if (!secret || secret === 'DISABLED_NOT_CONFIGURED' || endpoint !== expected) throw new Error('Brain connection is not configured.');
    if (!appCheckToken) throw new Error('Brain App Check attestation is required.');
    if (status && !/^[A-Za-z0-9_-]{1,160}$/.test(input.requestId)) throw new Error('Invalid Brain request identity.');
    if (!status && (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 100000 ||
      typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(input.idempotencyKey) ||
      !['draft', 'analyze'].includes(input.action || 'draft'))) throw new Error('Invalid Brain request.');
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
      return { connected: true, appId, checkedAt: new Date().toISOString() };
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
