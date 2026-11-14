import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../firebase', () => ({ auth: { authStateReady: async () => {}, currentUser: null } }));
import { apiRequest } from '../queryClient';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it.each(['POST', 'PATCH', 'DELETE', 'PUT'])('does not silently replay %s after a lost response', async method => {
  const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetch);
  await expect(apiRequest(method, '/api/checkout', { reviewed: true })).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('retains automatic recovery for safe reads', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const result = apiRequest('GET', '/api/catalog');
  await vi.runAllTimersAsync();
  expect((await result).status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(2);
});
