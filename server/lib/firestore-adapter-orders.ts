import type { Firestore } from 'firebase-admin/firestore';
import { firestoreToDate, prepareForFirestore } from './firestore-adapter-helpers';
import type {
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  CartItem, InsertCartItem,
  OrderUnified, InsertOrderUnified,
} from '@shared/schema';

function docToOrder(doc: FirebaseFirestore.DocumentSnapshot): Order {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDate(data.createdAt),
    updatedAt: firestoreToDate(data.updatedAt),
  } as Order;
}

function docToOrderUnified(doc: FirebaseFirestore.DocumentSnapshot): OrderUnified {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDate(data.createdAt),
    updatedAt: firestoreToDate(data.updatedAt),
  } as OrderUnified;
}

function docToOrderItem(doc: FirebaseFirestore.DocumentSnapshot, orderId: string): OrderItem {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    orderId: orderId,
  } as OrderItem;
}

function docToCartItem(doc: FirebaseFirestore.DocumentSnapshot): CartItem {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDate(data.createdAt),
  } as CartItem;
}

export async function getOrder(db: Firestore, id: string): Promise<Order | undefined> {
  const doc = await db.collection('orders').doc(id).get();
  if (!doc.exists) return undefined;
  return docToOrder(doc);
}

export async function getOrders(db: Firestore): Promise<OrderUnified[]> {
  const snapshot = await db.collection('ordersUnified').get();
  return snapshot.docs.map(doc => docToOrderUnified(doc));
}

export async function getOrdersByUser(db: Firestore, userId: string): Promise<Order[]> {
  const snapshot = await db.collection('orders')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map(doc => docToOrder(doc));
}

export async function getOrdersByStatus(db: Firestore, status: string): Promise<Order[]> {
  const snapshot = await db.collection('orders')
    .where('status', '==', status)
    .get();
  return snapshot.docs.map(doc => docToOrder(doc));
}

export async function getOrderByStripeSession(db: Firestore, sessionId: string): Promise<Order | undefined> {
  const snapshot = await db.collection('orders')
    .where('stripeSessionId', '==', sessionId)
    .limit(1)
    .get();
  if (snapshot.empty) return undefined;
  return docToOrder(snapshot.docs[0]);
}

export async function createOrder(db: Firestore, order: InsertOrder): Promise<Order> {
  const orderData = order as any;
  const docId = orderData.id?.toString() || undefined;
  const docRef = docId 
    ? db.collection('orders').doc(docId)
    : db.collection('orders').doc();
  const now = new Date();
  const data = prepareForFirestore({
    ...orderData,
    id: docRef.id,
    createdAt: orderData.createdAt || now,
    updatedAt: orderData.updatedAt || now,
  });
  await docRef.set(data, { merge: true });
  const doc = await docRef.get();
  return docToOrder(doc);
}

export async function updateOrder(db: Firestore, id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
  const docRef = db.collection('orders').doc(id);
  const data = prepareForFirestore({ ...order as any, id });
  if (!data.updatedAt) {
    data.updatedAt = new Date();
  }
  await docRef.set(data, { merge: true });
  const updated = await docRef.get();
  return docToOrder(updated);
}

export async function getOrderUnified(db: Firestore, id: string): Promise<OrderUnified | undefined> {
  const doc = await db.collection('ordersUnified').doc(id).get();
  if (!doc.exists) return undefined;
  return docToOrderUnified(doc);
}

export async function createOrderUnified(db: Firestore, order: InsertOrderUnified): Promise<OrderUnified> {
  const orderData = order as any;
  const docId = orderData.id?.toString() || undefined;
  const docRef = docId
    ? db.collection('ordersUnified').doc(docId)
    : db.collection('ordersUnified').doc();
  const now = new Date();
  const data = prepareForFirestore({
    ...orderData,
    id: docRef.id,
    createdAt: orderData.createdAt || now,
    updatedAt: orderData.updatedAt || now,
  });
  await docRef.set(data, { merge: true });
  const doc = await docRef.get();
  return docToOrderUnified(doc);
}

export async function updateOrderUnified(db: Firestore, id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined> {
  const docRef = db.collection('ordersUnified').doc(id);
  const data = prepareForFirestore({ ...order as any, id });
  if (!data.updatedAt) {
    data.updatedAt = new Date();
  }
  await docRef.set(data, { merge: true });
  const updated = await docRef.get();
  return docToOrderUnified(updated);
}

export async function getOrderItems(db: Firestore, orderId: string): Promise<OrderItem[]> {
  const snapshot = await db.collection('orders').doc(orderId)
    .collection('items').get();
  return snapshot.docs.map(doc => docToOrderItem(doc, orderId));
}

export async function createOrderItem(db: Firestore, item: InsertOrderItem): Promise<OrderItem> {
  const itemData = item as any;
  const docId = itemData.id?.toString() || undefined;
  const docRef = docId 
    ? db.collection('orders').doc(item.orderId).collection('items').doc(docId)
    : db.collection('orders').doc(item.orderId).collection('items').doc();
  const data = prepareForFirestore({ ...itemData, id: docId || docRef.id });
  await docRef.set(data, { merge: true });
  const doc = await docRef.get();
  return docToOrderItem(doc, item.orderId);
}

export async function getCartItemsByUser(db: Firestore, userId: string): Promise<CartItem[]> {
  const snapshot = await db.collection('cartItems')
    .where('userId', '==', userId)
    .get();
  return snapshot.docs.map(doc => docToCartItem(doc));
}

export async function addCartItem(db: Firestore, item: InsertCartItem): Promise<CartItem> {
  const docRef = db.collection('cartItems').doc();
  const now = new Date();
  const data = prepareForFirestore({
    ...item,
    id: docRef.id,
    createdAt: now,
  });
  await docRef.set(data);
  const doc = await docRef.get();
  return docToCartItem(doc);
}

export async function updateCartItem(db: Firestore, id: string, quantity: number): Promise<CartItem | undefined> {
  const docRef = db.collection('cartItems').doc(id);
  const existing = await docRef.get();
  if (!existing.exists) return undefined;
  await docRef.update({ quantity });
  const updated = await docRef.get();
  return docToCartItem(updated);
}

export async function deleteCartItem(db: Firestore, id: string): Promise<void> {
  await db.collection('cartItems').doc(id).delete();
}

export async function clearCart(db: Firestore, userId: string): Promise<void> {
  const snapshot = await db.collection('cartItems')
    .where('userId', '==', userId)
    .get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
