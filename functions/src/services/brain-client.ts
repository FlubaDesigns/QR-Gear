import crypto from 'crypto';
import { PLATFORM_STORE_ID } from '../constants';

/** Governed Fluba HTTP gateway owns execution. No local pending inbox. */
export async function brainRequest(appCheckToken: string, input: { prompt: string; idempotencyKey: string } | { requestId: string }) {
  const secret = process.env.FLUBA_SITE_SECRET;
  const status = 'requestId' in input;
  const endpoint = status ? process.env.FLUBA_BRAIN_STATUS_URL : process.env.FLUBA_BRAIN_URL;
  if (!secret || !endpoint) throw new Error('Brain connection is not configured. Set the Brain ingress/status URLs and site secret.');
  if (!appCheckToken) throw new Error('Brain App Check attestation is required.');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('Brain endpoints must use HTTPS.');
  const raw = status ? `${PLATFORM_STORE_ID}\n${input.requestId}` : JSON.stringify({ appId: PLATFORM_STORE_ID, action: 'draft', ...input });
  if (status) { url.searchParams.set('appId', PLATFORM_STORE_ID); url.searchParams.set('requestId', input.requestId); }
  const response = await fetch(url.toString(), { method: status ? 'GET' : 'POST', signal: AbortSignal.timeout(25000),
    headers: { 'content-type': 'application/json', 'x-app-id': PLATFORM_STORE_ID, 'X-Firebase-AppCheck': appCheckToken,
      'x-signature': crypto.createHmac('sha256', secret).update(raw).digest('hex') },
    ...(!status ? { body: raw } : {}) });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as any;
    throw new Error(`Brain request failed (${response.status}): ${String(data.error || response.statusText).slice(0, 300)}`);
  }
  return response.json() as Promise<any>;
}
