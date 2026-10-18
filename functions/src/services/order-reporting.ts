/** Reporting uses captured payment evidence; awaiting-payment records are not sales. */
export function orderNetRevenueCents(order: any): number {
  if (!['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus)) return 0;
  if (order.paymentStatus === 'refunded') return 0;
  const gross = Number.isSafeInteger(order.amountTotalCents) ? order.amountTotalCents
    : /^\d+(\.\d{1,2})?$/.test(String(order.totalAmount)) ? Math.round(Number(order.totalAmount) * 100) : 0;
  const refunded = order.refund?.refundedAmountCents;
  if (order.paymentStatus === 'partially_refunded' && !Number.isSafeInteger(refunded)) return 0;
  return Math.max(0, gross - (Number.isSafeInteger(refunded) ? Math.max(0, refunded) : 0));
}

export function orderNeedsFulfillment(order: any): boolean {
  return order.paymentStatus === 'paid' && !order.productionHold && !(order.refund?.refundedAmountCents > 0)
    && !['cancelled', 'refunded'].includes(order.status)
    && (['ready', 'failed'].includes(order.fulfillmentState)
      || (!order.fulfillmentState && order.fulfillmentStatus === 'pending'));
}

export function orderInProduction(order: any): boolean {
  return order.paymentStatus === 'paid' && !order.productionHold && !orderNeedsFulfillment(order)
    && (order.fulfillmentState === 'submitting' || ['routed', 'in_production', 'partially_shipped'].includes(order.status));
}

export function orderDate(value: any): string | null {
  const date = value?.toDate?.() ?? (value ? new Date(value) : null);
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
