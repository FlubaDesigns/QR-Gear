import { orderDate as canonicalDate, orderNetPaidCents, needsFulfillmentAttention } from './order-metrics';
/** Compatibility names retained for the previous release; reports expose exclusions separately. */
export const orderNetRevenueCents = (order: any) => orderNetPaidCents(order) ?? 0;
export const orderNeedsFulfillment = needsFulfillmentAttention;
export const orderInProduction = (order: any) => order.paymentStatus === 'paid' && !order.productionHold && !orderNeedsFulfillment(order)
 && (order.fulfillmentState === 'submitting' || ['routed', 'in_production', 'partially_shipped'].includes(order.status));
export const orderDate = (value: any) => canonicalDate(value) || null;
