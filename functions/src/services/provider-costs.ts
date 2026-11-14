import { commercialPurpose } from '../../../shared/orderFunding';
/** Provider-reported costs, never retail prices or an assumed zero. */
export function providerCostSnapshot(costs: any, status: string) {
  const cents = (value: unknown): number | null => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value ?? ''))) return null;
    const result = Math.round(Number(value) * 100);
    return Number.isSafeInteger(result) ? result : null;
  };
  return {
    source: 'printful', currency: String(costs.currency || '').toLowerCase(),
    productionCents: cents(costs.subtotal), shippingCents: cents(costs.shipping), totalCents: cents(costs.total),
    // A draft quote is not an incurred marketing expense; cancellation needs reconciliation.
    status: ['pending', 'inprocess', 'partial', 'fulfilled'].includes(status) ? 'confirmed' : 'unconfirmed',
    recordedAt: new Date().toISOString(),
  };
}

export function marketingExpenseCents(order: any): number | null {
  const marketing = commercialPurpose(order) === 'marketing_loss_leader';
  if (!marketing) return 0;
  const costs = order.providerCosts;
  if (!costs || costs.source !== 'printful' || costs.status !== 'confirmed' || costs.currency !== 'usd' ||
      !Number.isSafeInteger(costs.totalCents) || costs.totalCents < 0 || order.status === 'cancelled') return null;
  return costs.totalCents;
}
