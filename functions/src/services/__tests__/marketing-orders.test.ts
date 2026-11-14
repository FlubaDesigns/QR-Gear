import { expect, it } from 'vitest';
import { productionFundingDate } from '../../../../shared/orderFunding';
import { needsFulfillmentAttention, orderNetPaidCents } from '../order-metrics';
import { providerCostSnapshot, marketingExpenseCents } from '../provider-costs';

const reward = { id: 'reward-1', source: 'partner_reward', paymentStatus: 'sponsored', status: 'approved',
  commercialPurpose: 'marketing_loss_leader', amountTotalCents: 0, customerChargeCents: 0, fulfillmentState: 'pending',
  funding: { type: 'partner_sponsored', partnerId: 'fluba', claimId: 'claim-1', previewId: 'proof-1',
    authorizedAt: '2026-11-13T00:00:00Z', authorization: { websiteOrderId: 'site-1', verifiedAt: '2026-11-13T00:00:00Z' } } };
it('approved sponsor funding enters attention without being represented as sales revenue', () => {
  expect(productionFundingDate(reward)).toBe(reward.funding.authorizedAt);
  expect(needsFulfillmentAttention(reward)).toBe(true);
  expect(orderNetPaidCents(reward)).toBe(0);
  expect(needsFulfillmentAttention({ ...reward, fulfillmentState: 'failed' })).toBe(true);
  expect(needsFulfillmentAttention({ ...reward, productionHold: true })).toBe(false);
  expect(needsFulfillmentAttention({ ...reward, funding: {} })).toBe(false);
  expect(needsFulfillmentAttention({ ...reward, status: 'cancelled' })).toBe(false);
});
it('tracks actual provider totals separately, including shipping and fees', () => {
  const costs = { currency: 'USD', subtotal: '12.00', shipping: '4.50', total: '17.20' };
  const providerCosts = providerCostSnapshot(costs, 'pending');
  expect(providerCosts).toMatchObject({ productionCents: 1200, shippingCents: 450, totalCents: 1720 });
  expect(marketingExpenseCents({ ...reward, providerCosts })).toBe(1720);
  expect(orderNetPaidCents({ ...reward, providerCosts })).toBe(0);
  expect(marketingExpenseCents({ ...reward, providerCosts: providerCostSnapshot(costs, 'draft') })).toBeNull();
  expect(marketingExpenseCents({ ...reward, providerCosts: { ...providerCosts, currency: 'eur' } })).toBeNull();
  expect(marketingExpenseCents({ ...reward, providerCosts, status: 'cancelled' })).toBeNull();
});
it('missing or invalid supplier amounts remain unreconciled, not zero expenses', () => {
  expect(marketingExpenseCents(reward)).toBeNull();
  for (const total of [undefined, '', '-1', '1.001', 'NaN']) {
    expect(marketingExpenseCents({ ...reward, providerCosts: providerCostSnapshot({ currency: 'USD', total }, 'pending') })).toBeNull();
  }
  expect(marketingExpenseCents({ paymentStatus: 'paid' })).toBe(0);
});
