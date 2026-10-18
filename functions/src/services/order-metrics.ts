/** Financial reports sum cents; an incomplete refund must be reconciled, never guessed. */
export function orderNetPaidCents(order: any): number | null {
  const paid = order.paymentStatus ? ['paid', 'partially_refunded', 'refunded'].includes(order.paymentStatus) : ['paid', 'routed', 'in_production', 'shipped', 'delivered'].includes(order.status);
  if (!paid) return 0;
  if (order.currency && String(order.currency).toLowerCase() !== 'usd') return null;
  const legacy = String(order.totalAmount ?? '');
  const cents = Number.isSafeInteger(order.amountTotalCents) ? order.amountTotalCents : /^\d+(?:\.\d{1,2})?$/.test(legacy) ? Math.round(Number(legacy) * 100) : NaN;
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  if (order.paymentStatus === 'refunded' || order.status === 'refunded') return 0;
  const refund = order.refund?.refundedAmountCents;
  if (order.paymentStatus === 'partially_refunded' && !Number.isSafeInteger(refund)) return null;
  if (refund != null && (!Number.isSafeInteger(refund) || refund < 0 || refund > cents)) return null;
  return cents - (refund || 0);
}
export function needsFulfillmentAttention(order: any) {
  if (order.paymentStatus !== 'paid' || order.productionHold || order.refund?.refundedAmountCents > 0 || ['cancelled', 'refunded'].includes(order.status)) return false;
  return ['ready', 'failed'].includes(order.fulfillmentState) || order.fulfillmentStatus === 'pending' ||
    (order.fulfillmentState === 'submitting' && Number(order.fulfillmentLeaseUntil || 0) < Date.now());
}
export function orderDate(value: any): string {
  if (value == null) return "";
  const date = value?.toDate ? value.toDate() : value?._seconds != null ? new Date(value._seconds * 1000) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
