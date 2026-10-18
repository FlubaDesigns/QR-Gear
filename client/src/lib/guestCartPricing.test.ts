import { expect, it, vi } from 'vitest';
import { mergeGuestCartOnLogin, type GuestCartItem } from '../contexts/CartContext';
import { computePolicyPricing, computePricingSnapshot } from '../../../shared/surfaces';
it('preserves explicit zero sharing and applies saved retail, margin and limits', () => {
 const p = computePolicyPricing({ retailPrice: 40, baseCost: 20 }, { baseRetailPrice: 75, minPrice: 70, platformMarginType: 'fixed', platformMarginValue: 5 }, { affiliatePercent: 0 });
 expect(p).toMatchObject({ displaySalePrice: 75, platformFeeAmount: 5, affiliatePercent: 0, affiliateAmount: 0 });
 expect(computePricingSnapshot({ salePrice: 40, productCost: 20, affiliatePercent: 0 }).affiliateAmount).toBe(0);
 expect(() => computePolicyPricing({ retailPrice: 40, baseCost: 20 }, { minPrice: 70 }, {})).toThrow('limits');
 expect(() => computePolicyPricing({ retailPrice: 40, baseCost: 20 }, { baseCostMode: 'live-cost' }, {})).toThrow('adapter');
});
it('returns only successful guest identities for removal and retries failures with stable identities', async () => {
 const rows = ['a','b'].map(id => ({ id, productId: id, quantity: 1, price: '20', customization: {}, addedAt: 'now' })) as GuestCartItem[];
 const post = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
 const result = await mergeGuestCartOnLogin(rows, post);
 expect(result).toEqual({ merged: 1, failed: 1, mergedIds: ['a'], failedIds: ['b'] });
 const remaining = rows.filter(row => !result.mergedIds.includes(row.id)); expect(remaining.map(x => x.id)).toEqual(['b']);
 await mergeGuestCartOnLogin(remaining, post); expect(post.mock.calls[1][0].guestCartId).toBe('b'); expect(post.mock.calls[2][0].guestCartId).toBe('b');
});
