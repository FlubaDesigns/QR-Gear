import { orderDate, orderNetRevenueCents } from './order-reporting';

/** Current users own orders by userId. Legacy customers remain addressable by ID. */
export async function customerDirectory(db: any) {
  const [users, legacy] = await Promise.all([db.collection('users').get(), db.collection('customers').get()]);
  const records = new Map<string, any>(users.docs.map((d: any) => [d.id, { ...d.data(), id: d.id }]));
  const legacyIds = new Map<string, string>();
  for (const doc of legacy.docs) {
    const data = doc.data();
    const id = data.userId && records.has(data.userId) ? data.userId : doc.id;
    legacyIds.set(doc.id, id);
    records.set(id, { ...data, ...records.get(id), id });
  }
  return { records, legacyIds };
}

export function ordersForCustomer(id: string, orders: any[], legacyIds: Map<string, string>) {
  return orders.filter(order => (order.userId || legacyIds.get(order.customerId) || order.customerId) === id)
    .sort((a, b) => (orderDate(b.createdAt) || '').localeCompare(orderDate(a.createdAt) || ''));
}

export function customerSummary(data: any, orders: any[]) {
  return {
    id: data.id, email: data.email || null,
    firstName: data.firstName || data.displayName?.split(' ')[0] || null,
    lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || null,
    profileImageUrl: data.profileImageUrl || data.photoURL || null,
    createdAt: orderDate(data.createdAt), orderCount: orders.length,
    totalSpent: orders.reduce((sum, order) => sum + orderNetRevenueCents(order), 0) / 100,
    lastOrderDate: orders.length ? orderDate(orders[0].createdAt) : null,
  };
}
