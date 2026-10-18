import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../core', () => ({ db: { collection: (...args: any[]) => m.db.collection(...args) } }));
import { freezeMemberCompensation, reconcileMemberTransfer } from '../member-compensation';
let store: Map<string, any>;
beforeEach(() => { const f = database({ 'testSettings/pricing': { memberProfitShare: 0.25 } }); m.db = f.db; store = f.store; });
it.each([[0, 0], [0.25, 400], [0.5, 800]])('uses saved %s share of $16 profit, not $40 gross', async (share, amount) => {
  store.get('testSettings/pricing').memberProfitShare = share;
  const policy = await freezeMemberCompensation(4000, 24); expect(policy.amountCents).toBe(amount);
  store.get('testSettings/pricing').memberProfitShare = 1; expect(policy.amountCents).toBe(amount);
});
it('requires a valid configured policy and does not invent a default', async () => {
  store.set('testSettings/pricing', {}); await expect(freezeMemberCompensation(4000, 24)).rejects.toThrow();
});
it('marks transferred only when actual Stripe amount, currency, destination and reversals agree', async () => {
  const policy = await freezeMemberCompensation(4000, 24);
  const transfer = { id: 'tr_fixture', amount: 400, amount_reversed: 0, currency: 'usd', destination: 'acct_owner' };
  const charge = { paid: true, amount_refunded: 0, transfer };
  const payment = { status: 'succeeded', currency: 'usd', amount_received: 4000, latest_charge: charge };
  const stripe = { paymentIntents: { retrieve: vi.fn().mockResolvedValue(payment) } } as any;
  const order = { memberCompensation: policy, amountTotalCents: 4000, stripePaymentIntentId: 'pi_fixture', connectAccountId: 'acct_owner' };
  expect(await reconcileMemberTransfer(stripe, order)).toMatchObject({ status: 'transferred', amountCents: 400, transferId: 'tr_fixture' });
  for (const patch of [{ amount: 1000 }, { destination: 'acct_other' }, { amount_reversed: 1 }, { currency: 'eur' }]) {
    payment.latest_charge = { ...charge, transfer: { ...transfer, ...patch } };
    expect(await reconcileMemberTransfer(stripe, order)).toMatchObject({ status: 'needs_review' });
  }
  expect(await reconcileMemberTransfer(stripe, { ...order, connectAccountId: null })).toMatchObject({ status: 'pending' });
});
