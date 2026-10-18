import { db } from '../core';
import { orderDate, orderNetPaidCents } from './order-metrics';
/** Join only explicit user IDs; matching email strings do not prove an account link. */
export async function customerDirectory() {
 const [users, legacy] = await Promise.all([db.collection('users').get(), db.collection('customers').get()]);
 const rows = new Map<string, any>();
 for (const doc of users.docs) rows.set(doc.id, { ...doc.data(), id: doc.id, legacyIds: [doc.id] });
 for (const doc of legacy.docs) {
   const data = doc.data(), id = data.userId && rows.has(data.userId) ? data.userId : doc.id;
   const prior = rows.get(id); rows.set(id, { ...data, ...prior, id, legacyIds: [...new Set([...(prior?.legacyIds || []), doc.id])] });
 }
 return [...rows.values()];
}
export function customerOrders(customer: any, orders: any[]) {
 return orders.filter(order => order.userId === customer.id || (!order.userId && customer.legacyIds.includes(order.customerId))).sort((a, b) => orderDate(b.createdAt).localeCompare(orderDate(a.createdAt)));
}
export function customerSummary(customer: any, orders: any[]) {
 const money = orders.map(orderNetPaidCents);
 return { id: customer.id, email: customer.email || null, firstName: customer.firstName || customer.displayName?.split(' ')[0] || null,
   lastName: customer.lastName || customer.displayName?.split(' ').slice(1).join(' ') || null, profileImageUrl: customer.profileImageUrl || customer.photoURL || null,
   createdAt: orderDate(customer.createdAt) || null, orderCount: orders.length, totalSpent: money.reduce<number>((sum, value) => sum + (value ?? 0), 0) / 100,
   unreconciledOrderCount: money.filter(value => value === null).length, lastOrderDate: orders[0] ? orderDate(orders[0].createdAt) : null };
}
