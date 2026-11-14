import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { checkoutAttemptId, releaseCheckoutAttempt } from './checkoutAttempt';
let memory: Map<string,string>;
beforeEach(() => { memory = new Map(); vi.stubGlobal('window', { sessionStorage: { getItem: (k:string) => memory.get(k) ?? null, setItem: (k:string,v:string) => memory.set(k,v), removeItem: (k:string) => memory.delete(k) } }); });
afterEach(() => vi.unstubAllGlobals());
it('retains the same intent through retries and separates accounts and selections', () => {
 const selection = { quoteToken: 'reviewed' };
 const first = checkoutAttemptId('cart:alice', selection);
 expect(checkoutAttemptId('cart:alice', selection)).toBe(first);
 expect(checkoutAttemptId('cart:bob', selection)).not.toBe(first);
 expect(checkoutAttemptId('cart:alice', { quoteToken: 'changed' })).not.toBe(first);
 releaseCheckoutAttempt('cart:alice', selection);
 expect(checkoutAttemptId('cart:alice', selection)).not.toBe(first);
});
it('fails before checkout when the browser cannot persist its intent', () => {
 window.sessionStorage.setItem = () => { throw new Error('storage disabled'); };
 expect(() => checkoutAttemptId('cart', {})).toThrow('Allow browser storage');
});
