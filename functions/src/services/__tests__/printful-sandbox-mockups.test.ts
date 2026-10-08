import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../core', () => ({ db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ printfulApiKey: 'test-only-not-a-real-credential' }) }) }) }) } }));
import { PrintfulClient, getPrintfulApiKeyAsync } from '../printful';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Sandbox provider boundary', () => {
  it('allows mockup tasks without enabling product catalog reads', async () => {
    vi.stubEnv('QRGEAR_ENVIRONMENT','sandbox');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { task_key: 'task', status: 'pending' } }) });
    vi.stubGlobal('fetch',fetch);
    const client = new PrintfulClient();
    await client.createMockupTask(71,[123],[{ placement: 'front', image_url: 'https://example.test/art.png' }]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(client.getProduct(71)).rejects.toThrow('disabled');
    await expect(getPrintfulApiKeyAsync()).rejects.toThrow('disabled');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
