import { getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getLimitedUseToken, getToken, type AppCheck } from 'firebase/app-check';

let attestation: AppCheck | undefined;
/** Attestation only. AI requests go through the authenticated admin backend. */
export async function brainAttestation(mutation: boolean): Promise<Record<string, string>> {
  if (!attestation) {
    const apiKey = import.meta.env.VITE_FLUBA_API_KEY;
    const projectId = import.meta.env.VITE_FLUBA_PROJECT_ID;
    const appId = import.meta.env.VITE_FLUBA_APP_ID;
    const siteKey = import.meta.env.VITE_FLUBA_RECAPTCHA_SITE_KEY;
    if (!apiKey || !projectId || !appId || !siteKey) throw new Error('AI connection needs the Fluba app configuration and App Check site key.');
    const app = getApps().find(item => item.name === 'fluba-brain') || initializeApp({ apiKey, projectId, appId }, 'fluba-brain');
    attestation = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  }
  const result = mutation ? await getLimitedUseToken(attestation) : await getToken(attestation);
  return { 'X-Firebase-AppCheck': result.token };
}
