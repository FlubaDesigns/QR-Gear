/** Environment configuration only; canonical product identities stay unchanged. */
export function isSandboxRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.QRGEAR_ENVIRONMENT === 'sandbox' || env.GCLOUD_PROJECT === 'qr-gear-sandbox' || env.GOOGLE_CLOUD_PROJECT === 'qr-gear-sandbox';
}
export function resolveRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const firebase = env.FIREBASE_CONFIG ? JSON.parse(env.FIREBASE_CONFIG) : {};
  const projectId = env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || firebase.projectId;
  if (!projectId) throw new Error('[Runtime] Firebase project configuration is required.');
  if (!['qrgear-c1ffd', 'qr-gear-sandbox'].includes(projectId)) throw new Error('[Runtime] Unknown QR Gear project.');
  const sandbox = isSandboxRuntime(env) || projectId === 'qr-gear-sandbox';
  if (sandbox && projectId !== 'qr-gear-sandbox') throw new Error('[Runtime] Sandbox cannot use Main resources.');
  const storageBucket = firebase.storageBucket || `${projectId}.firebasestorage.app`;
  if (storageBucket !== `${projectId}.firebasestorage.app`) throw new Error('[Runtime] Storage bucket belongs to a different project.');
  const origin = sandbox ? `https://${projectId}.web.app` : 'https://qrgear.com';
  return { projectId, storageBucket, origin, sandbox };
}
export function requireLiveCommerce(operation: string): void {
  if (isSandboxRuntime()) throw new Error(`[Sandbox] ${operation} is disabled. Your build remains saved for review.`);
}
