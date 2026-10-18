import type Stripe from 'stripe';
import { db } from '../core';

/** Read-only buyer receipt. A paid Stripe session can precede its order webhook. */
export async function readCheckoutReceipt(session: Stripe.Checkout.Session, userId: string) {
  const fail = (message: string, status: number): never => { throw Object.assign(new Error(message), { status }); };
  if (session.metadata?.userId !== userId) fail('This checkout belongs to another account.', 403);
  const orderId = session.metadata?.orderId;
  if (session.metadata?.source !== 'direct_cart' || !orderId) fail('Checkout has no canonical cart order.', 409);
  const order = (await db.collection('orders').doc(orderId!).get()).data();
  if (!order || order.userId !== userId) fail('Order not found.', 404);
  if ((order!.stripeSessionId && order!.stripeSessionId !== session.id) || order!.amountTotalCents !== session.amount_total || order!.currency !== session.currency) fail('Checkout does not match this order.', 409);
  const refunded = ['refunded', 'partially_refunded'].includes(order!.paymentStatus);
  const state = refunded ? 'refund_review' : session.payment_status !== 'paid' ? 'payment_pending' : order!.paymentStatus !== 'paid' ? 'confirmation_pending' : 'confirmed';
  const items = (await db.collection('orderItems').where('orderId', '==', orderId!).get()).docs.map(doc => {
    const item = doc.data(); return { id: doc.id, productId: item.productId, productTitle: item.productTitle || '', quantity: item.quantity, price: item.price };
  });
  const date = order!.createdAt;
  return { state, status: session.payment_status, order: { id: orderId, status: order!.status, paymentStatus: order!.paymentStatus,
    createdAt: date?.toDate ? date.toDate().toISOString() : date, totalAmount: order!.amountTotalCents / 100, currency: order!.currency, items } };
}
