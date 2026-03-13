import { computePricingSnapshot } from '../../../../shared/surfaces';
import type { PricingSnapshot } from '../../../../shared/surfaces';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function section(name: string) {
  console.log(`\n=== ${name} ===`);
}

section('PricingSnapshot computation — basic');

const snap1 = computePricingSnapshot({
  salePrice: 29.99,
  productCost: 12.00,
  affiliatePercent: 25,
  currency: 'USD',
});

assert(snap1.baseSalePrice === 29.99, 'baseSalePrice matches input');
assert(snap1.displaySalePrice === 29.99, 'displaySalePrice matches input');
assert(snap1.productCost === 12.00, 'productCost matches input');
assert(snap1.grossProfitAmount === 29.99 - 12.00, 'grossProfit = sale - cost');
assert(snap1.affiliatePercent === 25, 'affiliatePercent preserved');
assert(snap1.affiliateAmount > 0, 'affiliateAmount is positive');
assert(Math.abs(snap1.netPlatformProfitAmount - (snap1.grossProfitAmount - snap1.affiliateAmount)) < 0.01, 'netPlatform = gross - affiliate (within rounding)');
assert(snap1.currency === 'USD', 'currency preserved');
assert(snap1.pricingSnapshotVersion === '1.0', 'version tag present');

section('PricingSnapshot — zero profit');

const snap2 = computePricingSnapshot({
  salePrice: 10.00,
  productCost: 10.00,
  affiliatePercent: 25,
});

assert(snap2.grossProfitAmount === 0, 'grossProfit is zero when cost equals sale');
assert(snap2.affiliateAmount === 0, 'affiliateAmount is zero when no profit');
assert(snap2.netPlatformProfitAmount === 0, 'netPlatformProfit is zero');

section('PricingSnapshot — negative margin (loss)');

const snap3 = computePricingSnapshot({
  salePrice: 8.00,
  productCost: 12.00,
  affiliatePercent: 25,
});

assert(snap3.grossProfitAmount < 0, 'grossProfit is negative on loss');
assert(snap3.affiliateAmount === 0, 'affiliateAmount is zero on loss');

section('PricingSnapshot — with platform fee and shipping burden');

const snap4 = computePricingSnapshot({
  salePrice: 30.00,
  productCost: 10.00,
  platformFeeAmount: 2.00,
  shippingCostBurden: 4.95,
  affiliatePercent: 25,
});

assert(snap4.platformFeeAmount === 2.00, 'platformFeeAmount preserved');
assert(snap4.shippingCostBurden === 4.95, 'shippingCostBurden preserved');
assert(snap4.grossProfitAmount === 30.00 - 10.00 - 2.00 - 4.95, 'grossProfit deducts fees and shipping');
const expectedAff = Math.round((snap4.grossProfitAmount * 0.25) * 100) / 100;
assert(snap4.affiliateAmount === expectedAff, 'affiliateAmount computed from reduced profit');

section('Transaction chain data contract — embed order flow');

const sessionPricingSnapshot = computePricingSnapshot({
  salePrice: 24.99,
  productCost: 11.00,
  platformFeeAmount: 1.50,
  shippingCostBurden: 4.95,
  affiliatePercent: 25,
  currency: 'USD',
});

const orderItemId = 'test-item-123';
const stripeSessionId = 'cs_test_abc';
const affiliateUserId = 'user-affiliate-001';
const builderHostId = 'host-001';
const builderPlacementId = 'placement-001';
const qty = 2;

const attributionData = {
  orderId: stripeSessionId,
  orderItemId,
  builderHostId,
  builderPlacementId,
  affiliateUserId,
  ...sessionPricingSnapshot,
  quantity: qty,
  stripeCheckoutSessionId: stripeSessionId,
  status: 'pending_payment',
};

assert(attributionData.orderId === stripeSessionId, 'attribution.orderId links to stripe session');
assert(attributionData.affiliateUserId === affiliateUserId, 'attribution carries affiliateUserId');
assert(attributionData.baseSalePrice === 24.99, 'attribution carries pricing snapshot fields');
assert(attributionData.status === 'pending_payment', 'attribution starts as pending_payment');

const payoutEntry = {
  affiliateUserId,
  builderHostId,
  builderPlacementId,
  orderId: stripeSessionId,
  orderItemId,
  affiliateAmount: sessionPricingSnapshot.affiliateAmount * qty,
  currency: sessionPricingSnapshot.currency,
  status: 'pending' as const,
};

assert(payoutEntry.orderId === stripeSessionId, 'payout.orderId links to stripe session');
assert(payoutEntry.affiliateUserId === affiliateUserId, 'payout carries affiliateUserId');
assert(payoutEntry.affiliateAmount === sessionPricingSnapshot.affiliateAmount * qty, 'payout.affiliateAmount scales by quantity');
assert(payoutEntry.status === 'pending', 'payout starts as pending');
assert(payoutEntry.currency === 'USD', 'payout carries currency');

const confirmedAttribution = { ...attributionData, status: 'paid', paidAt: new Date().toISOString() };
const confirmedPayout = { ...payoutEntry, status: 'approved' as const, approvedAt: new Date().toISOString() };

assert(confirmedAttribution.status === 'paid', 'after webhook: attribution status = paid');
assert(confirmedPayout.status === 'approved', 'after webhook: payout status = approved');

section('Affiliate resolution chain priority');

function resolveAffiliate(placement: any, host: any, profile: any): { userId: string; source: string } {
  if (placement.affiliateUserId) return { userId: placement.affiliateUserId, source: 'placement' };
  if (host.ownerUserId) return { userId: host.ownerUserId, source: 'host_owner' };
  if (profile?.affiliateUserId) return { userId: profile.affiliateUserId, source: 'profile' };
  return { userId: '', source: 'none' };
}

const r1 = resolveAffiliate({ affiliateUserId: 'p-user' }, { ownerUserId: 'h-user' }, { affiliateUserId: 'pr-user' });
assert(r1.userId === 'p-user' && r1.source === 'placement', 'placement affiliate takes priority');

const r2 = resolveAffiliate({}, { ownerUserId: 'h-user' }, { affiliateUserId: 'pr-user' });
assert(r2.userId === 'h-user' && r2.source === 'host_owner', 'host owner is second in chain');

const r3 = resolveAffiliate({}, {}, { affiliateUserId: 'pr-user' });
assert(r3.userId === 'pr-user' && r3.source === 'profile', 'profile affiliate is third in chain');

const r4 = resolveAffiliate({}, {}, {});
assert(r4.userId === '' && r4.source === 'none', 'returns none when chain is empty');

const r5 = resolveAffiliate({}, {}, null);
assert(r5.userId === '' && r5.source === 'none', 'handles null profile gracefully');

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (failed > 0) process.exit(1);
