import type { Firestore } from 'firebase-admin/firestore';
import { getFirestoreDb, isFirebaseInitialized } from './firebase-admin';
import type { IStorage } from '../storage';
import type {
  User, InsertUser, UpsertUser,
  Product, InsertProduct,
  CustomDesign, InsertCustomDesign,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  CartItem, InsertCartItem,
  AdminSettings, InsertAdminSettings,
  QrDesign, InsertQrDesign,
  HostedImage, InsertHostedImage,
  HostingReminder, InsertHostingReminder,
  BrowsingHistory, InsertBrowsingHistory,
  PricingRule, InsertPricingRule,
  HostingTier, InsertHostingTier,
  Coupon, InsertCoupon,
  QrTemplate, InsertQrTemplate,
  DynamicPage, InsertDynamicPage,
  DynamicPageAsset, InsertDynamicPageAsset,
  ProductCategory, InsertProductCategory,
  ProductCategoryAssignment, InsertProductCategoryAssignment,
  PartnerStore, InsertPartnerStore,
  PartnerStoreProduct, InsertPartnerStoreProduct,
  ProductVariant, InsertProductVariant,
  PrintifyBlueprint, InsertPrintifyBlueprint,
  PrintifyPrintProvider, InsertPrintifyPrintProvider,
  PrintifyCatalogSync, InsertPrintifyCatalogSync,
  PrintifyCostSync, InsertPrintifyCostSync,
  LibraryAsset, InsertLibraryAsset,
  MasterProduct, InsertMasterProduct,
  ProductDesignVersion, InsertProductDesignVersion,
  ChannelConfig, InsertChannelConfig,
  ChannelPublishState, InsertChannelPublishState,
  ProviderHealthLog, InsertProviderHealthLog,
  GiftPackage, InsertGiftPackage,
  GiftCode, InsertGiftCode,
  GiftRedemption, InsertGiftRedemption,
  TemplateCategory, InsertTemplateCategory,
  GraphicSet, InsertGraphicSet,
  OrderUnified, InsertOrderUnified,
  EmailTemplate, InsertEmailTemplate,
  EmailLog,
} from '@shared/schema';

function notImplemented(methodName: string): never {
  throw new Error(`[FirestoreAdapter] Method not yet implemented: ${methodName}`);
}

function firestoreToDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

function firestoreToDateNullable(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

function dateToFirestore(date: Date | string | null | undefined): any {
  if (!date) return null;
  if (typeof date === 'string') return new Date(date);
  return date;
}

export class FirestoreAdapter implements IStorage {
  private db: Firestore;
  
  constructor() {
    if (!isFirebaseInitialized()) {
      console.log('[FirestoreAdapter] Initializing Firebase...');
    }
    this.db = getFirestoreDb();
  }
  
  // ============================================
  // PRODUCT OPERATIONS (Core - Implemented)
  // ============================================
  
  async getProduct(id: string): Promise<Product | undefined> {
    const doc = await this.db.collection('products').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToProduct(doc);
  }
  
  async getAllProducts(): Promise<Product[]> {
    const snapshot = await this.db.collection('products').get();
    return snapshot.docs.map(doc => this.docToProduct(doc));
  }
  
  async getProducts(): Promise<Product[]> {
    return this.getAllProducts();
  }
  
  async getEnabledProducts(): Promise<Product[]> {
    const snapshot = await this.db.collection('products')
      .where('isEnabled', '==', true)
      .get();
    return snapshot.docs.map(doc => this.docToProduct(doc));
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const productData = product as any;
    const docRef = this.db.collection('products').doc(productData.id);
    const now = new Date();
    const data = this.prepareForFirestore({
      ...productData,
      createdAt: productData.createdAt || now,
      updatedAt: productData.updatedAt || now,
    });
    await docRef.set(data, { merge: true });
    const doc = await docRef.get();
    return this.docToProduct(doc);
  }
  
  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const docRef = this.db.collection('products').doc(id);
    const data = this.prepareForFirestore({ ...product as any, id });
    if (!data.updatedAt) {
      data.updatedAt = new Date();
    }
    await docRef.set(data, { merge: true });
    const updated = await docRef.get();
    return this.docToProduct(updated);
  }
  
  async deleteProduct(id: string): Promise<void> {
    await this.db.collection('products').doc(id).delete();
  }
  
  async toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined> {
    return this.updateProduct(id, { isEnabled: enabled });
  }
  
  private docToProduct(doc: FirebaseFirestore.DocumentSnapshot): Product {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDate(data.createdAt),
      updatedAt: firestoreToDate(data.updatedAt),
    } as Product;
  }
  
  // ============================================
  // CUSTOM DESIGN OPERATIONS (Core - Implemented)
  // ============================================
  
  async getCustomDesign(id: string): Promise<CustomDesign | undefined> {
    const doc = await this.db.collection('customDesigns').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToCustomDesign(doc);
  }
  
  async getCustomDesigns(): Promise<CustomDesign[]> {
    const snapshot = await this.db.collection('customDesigns').get();
    return snapshot.docs.map(doc => this.docToCustomDesign(doc));
  }
  
  async getCustomDesignsForLibrary(): Promise<CustomDesign[]> {
    const snapshot = await this.db.collection('customDesigns')
      .where('savedToLibrary', '==', true)
      .get();
    return snapshot.docs.map(doc => this.docToCustomDesign(doc));
  }
  
  async getCustomDesignsByStoreSegment(storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]> {
    let query = this.db.collection('customDesigns')
      .where('storeType', '==', storeType)
      .where('storeName', '==', storeName);
    
    if (segment) {
      query = query.where('segment', '==', segment);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => this.docToCustomDesign(doc));
  }
  
  async createCustomDesign(design: InsertCustomDesign): Promise<CustomDesign> {
    const designData = design as any;
    const docRef = this.db.collection('customDesigns').doc(designData.id);
    const now = new Date();
    const data = this.prepareForFirestore({
      ...designData,
      createdAt: designData.createdAt || now,
      updatedAt: designData.updatedAt || now,
    });
    await docRef.set(data, { merge: true });
    const doc = await docRef.get();
    return this.docToCustomDesign(doc);
  }
  
  async updateCustomDesign(id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined> {
    const docRef = this.db.collection('customDesigns').doc(id);
    const data = this.prepareForFirestore({ ...design as any, id });
    if (!data.updatedAt) {
      data.updatedAt = new Date();
    }
    await docRef.set(data, { merge: true });
    const updated = await docRef.get();
    return this.docToCustomDesign(updated);
  }
  
  async deleteCustomDesign(id: string): Promise<void> {
    await this.db.collection('customDesigns').doc(id).delete();
  }
  
  private docToCustomDesign(doc: FirebaseFirestore.DocumentSnapshot): CustomDesign {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDate(data.createdAt),
      updatedAt: firestoreToDate(data.updatedAt),
    } as CustomDesign;
  }
  
  // ============================================
  // ORDER OPERATIONS (Core - Implemented)
  // ============================================
  
  async getOrder(id: string): Promise<Order | undefined> {
    const doc = await this.db.collection('orders').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToOrder(doc);
  }
  
  async getOrders(): Promise<OrderUnified[]> {
    const snapshot = await this.db.collection('ordersUnified').get();
    return snapshot.docs.map(doc => this.docToOrderUnified(doc));
  }
  
  async getOrdersByUser(userId: string): Promise<Order[]> {
    const snapshot = await this.db.collection('orders')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => this.docToOrder(doc));
  }
  
  async getOrdersByStatus(status: string): Promise<Order[]> {
    const snapshot = await this.db.collection('orders')
      .where('status', '==', status)
      .get();
    return snapshot.docs.map(doc => this.docToOrder(doc));
  }
  
  async getOrderByStripeSession(sessionId: string): Promise<Order | undefined> {
    const snapshot = await this.db.collection('orders')
      .where('stripeSessionId', '==', sessionId)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    return this.docToOrder(snapshot.docs[0]);
  }
  
  async createOrder(order: InsertOrder): Promise<Order> {
    const orderData = order as any;
    const docId = orderData.id?.toString() || undefined;
    const docRef = docId 
      ? this.db.collection('orders').doc(docId)
      : this.db.collection('orders').doc();
    const now = new Date();
    const data = this.prepareForFirestore({
      ...orderData,
      id: docRef.id,
      createdAt: orderData.createdAt || now,
      updatedAt: orderData.updatedAt || now,
    });
    await docRef.set(data, { merge: true });
    const doc = await docRef.get();
    return this.docToOrder(doc);
  }
  
  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const docRef = this.db.collection('orders').doc(id);
    const data = this.prepareForFirestore({ ...order as any, id });
    if (!data.updatedAt) {
      data.updatedAt = new Date();
    }
    await docRef.set(data, { merge: true });
    const updated = await docRef.get();
    return this.docToOrder(updated);
  }
  
  private docToOrder(doc: FirebaseFirestore.DocumentSnapshot): Order {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDate(data.createdAt),
      updatedAt: firestoreToDate(data.updatedAt),
    } as Order;
  }
  
  // ============================================
  // ORDER UNIFIED OPERATIONS
  // ============================================
  
  async getOrderUnified(id: string): Promise<OrderUnified | undefined> {
    const doc = await this.db.collection('ordersUnified').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToOrderUnified(doc);
  }
  
  async createOrderUnified(order: InsertOrderUnified): Promise<OrderUnified> {
    const orderData = order as any;
    const docId = orderData.id?.toString() || undefined;
    const docRef = docId
      ? this.db.collection('ordersUnified').doc(docId)
      : this.db.collection('ordersUnified').doc();
    const now = new Date();
    const data = this.prepareForFirestore({
      ...orderData,
      id: docRef.id,
      createdAt: orderData.createdAt || now,
      updatedAt: orderData.updatedAt || now,
    });
    await docRef.set(data, { merge: true });
    const doc = await docRef.get();
    return this.docToOrderUnified(doc);
  }
  
  async updateOrderUnified(id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined> {
    const docRef = this.db.collection('ordersUnified').doc(id);
    const data = this.prepareForFirestore({ ...order as any, id });
    if (!data.updatedAt) {
      data.updatedAt = new Date();
    }
    await docRef.set(data, { merge: true });
    const updated = await docRef.get();
    return this.docToOrderUnified(updated);
  }
  
  private docToOrderUnified(doc: FirebaseFirestore.DocumentSnapshot): OrderUnified {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDate(data.createdAt),
      updatedAt: firestoreToDate(data.updatedAt),
    } as OrderUnified;
  }
  
  // ============================================
  // ORDER ITEM OPERATIONS
  // ============================================
  
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const snapshot = await this.db.collection('orders').doc(orderId)
      .collection('items').get();
    return snapshot.docs.map(doc => this.docToOrderItem(doc, orderId));
  }
  
  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const itemData = item as any;
    const docId = itemData.id?.toString() || undefined;
    const docRef = docId 
      ? this.db.collection('orders').doc(item.orderId).collection('items').doc(docId)
      : this.db.collection('orders').doc(item.orderId).collection('items').doc();
    const data = this.prepareForFirestore({ ...itemData, id: docId || docRef.id });
    await docRef.set(data, { merge: true });
    const doc = await docRef.get();
    return this.docToOrderItem(doc, item.orderId);
  }
  
  private prepareForFirestore(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (value instanceof Date) {
        result[key] = value;
      } else if (typeof value === 'string' && (key.endsWith('At') || key === 'createdAt' || key === 'updatedAt')) {
        result[key] = new Date(value);
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
        result[key] = this.prepareForFirestore(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  
  private docToOrderItem(doc: FirebaseFirestore.DocumentSnapshot, orderId: string): OrderItem {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      orderId: orderId,
    } as OrderItem;
  }
  
  // ============================================
  // USER OPERATIONS (Core - Implemented)
  // ============================================
  
  async getUser(id: string): Promise<User | undefined> {
    const doc = await this.db.collection('users').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToUser(doc);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const snapshot = await this.db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snapshot.empty) return undefined;
    return this.docToUser(snapshot.docs[0]);
  }
  
  async getUsers(): Promise<User[]> {
    const snapshot = await this.db.collection('users').get();
    return snapshot.docs.map(doc => this.docToUser(doc));
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const userId = user.id || this.db.collection('users').doc().id;
    const docRef = this.db.collection('users').doc(userId);
    const data = {
      ...user,
      id: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await docRef.set(data);
    const doc = await docRef.get();
    return this.docToUser(doc);
  }
  
  async upsertUser(userData: UpsertUser): Promise<User> {
    const userId = userData.id || this.db.collection('users').doc().id;
    const docRef = this.db.collection('users').doc(userId);
    const data = {
      ...userData,
      id: userId,
      updatedAt: new Date(),
    };
    await docRef.set(data, { merge: true });
    const doc = await docRef.get();
    return this.docToUser(doc);
  }
  
  private docToUser(doc: FirebaseFirestore.DocumentSnapshot): User {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDateNullable(data.createdAt),
      updatedAt: firestoreToDateNullable(data.updatedAt),
    } as User;
  }
  
  // ============================================
  // ADMIN SETTINGS
  // ============================================
  
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const doc = await this.db.collection('settings').doc('admin').get();
    if (!doc.exists) return undefined;
    const data = doc.data()!;
    return {
      id: 'admin',
      ...data,
    } as AdminSettings;
  }
  
  async upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const docRef = this.db.collection('settings').doc('admin');
    await docRef.set(settings, { merge: true });
    const doc = await docRef.get();
    return {
      id: 'admin',
      ...doc.data()!,
    } as AdminSettings;
  }
  
  // ============================================
  // BROWSING HISTORY
  // ============================================
  
  async getBrowsingHistory(userId: string): Promise<BrowsingHistory[]> {
    const snapshot = await this.db.collection('browsingHistory')
      .where('userId', '==', userId)
      .orderBy('viewedAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(doc => this.docToBrowsingHistory(doc));
  }
  
  async addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory> {
    const docRef = this.db.collection('browsingHistory').doc();
    const data = this.prepareForFirestore({
      ...entry,
      id: docRef.id,
      viewedAt: new Date(),
    });
    await docRef.set(data);
    return this.docToBrowsingHistory(await docRef.get());
  }
  
  async clearBrowsingHistory(userId: string): Promise<void> {
    const snapshot = await this.db.collection('browsingHistory')
      .where('userId', '==', userId)
      .get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  private docToBrowsingHistory(doc: FirebaseFirestore.DocumentSnapshot): BrowsingHistory {
    const data = doc.data()!;
    return { ...data, id: doc.id, viewedAt: firestoreToDate(data.viewedAt) } as BrowsingHistory;
  }
  
  // ============================================
  // QR DESIGNS
  // ============================================
  
  async getQrDesign(id: string): Promise<QrDesign | undefined> {
    const doc = await this.db.collection('qrDesigns').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToQrDesign(doc);
  }
  
  async getQrDesignsByUser(userId: string): Promise<QrDesign[]> {
    const snapshot = await this.db.collection('qrDesigns')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => this.docToQrDesign(doc));
  }
  
  async getPublicGalleryDesigns(): Promise<QrDesign[]> {
    const snapshot = await this.db.collection('qrDesigns')
      .where('isPublic', '==', true)
      .get();
    return snapshot.docs.map(doc => this.docToQrDesign(doc));
  }
  
  async createQrDesign(design: InsertQrDesign): Promise<QrDesign> {
    const docRef = this.db.collection('qrDesigns').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...design, id: docRef.id, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToQrDesign(await docRef.get());
  }
  
  async updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
    const docRef = this.db.collection('qrDesigns').doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return undefined;
    const data = this.prepareForFirestore({ ...design, updatedAt: new Date() });
    await docRef.update(data);
    return this.docToQrDesign(await docRef.get());
  }
  
  async deleteQrDesign(id: string): Promise<void> {
    await this.db.collection('qrDesigns').doc(id).delete();
  }
  
  private docToQrDesign(doc: FirebaseFirestore.DocumentSnapshot): QrDesign {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as QrDesign;
  }
  
  // Cart (Implemented for standalone operation)
  async getCartItemsByUser(userId: string): Promise<CartItem[]> {
    const snapshot = await this.db.collection('cartItems')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map(doc => this.docToCartItem(doc));
  }
  
  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const docRef = this.db.collection('cartItems').doc();
    const now = new Date();
    const data = this.prepareForFirestore({
      ...item,
      id: docRef.id,
      createdAt: now,
    });
    await docRef.set(data);
    const doc = await docRef.get();
    return this.docToCartItem(doc);
  }
  
  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const docRef = this.db.collection('cartItems').doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return undefined;
    await docRef.update({ quantity });
    const updated = await docRef.get();
    return this.docToCartItem(updated);
  }
  
  async deleteCartItem(id: string): Promise<void> {
    await this.db.collection('cartItems').doc(id).delete();
  }
  
  async clearCart(userId: string): Promise<void> {
    const snapshot = await this.db.collection('cartItems')
      .where('userId', '==', userId)
      .get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  private docToCartItem(doc: FirebaseFirestore.DocumentSnapshot): CartItem {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDate(data.createdAt),
    } as CartItem;
  }
  
  // ============================================
  // HOSTED IMAGES
  // ============================================
  
  async getHostedImage(id: string): Promise<HostedImage | undefined> {
    const doc = await this.db.collection('hostedImages').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToHostedImage(doc);
  }
  
  async getHostedImagesByUser(userId: string): Promise<HostedImage[]> {
    const snapshot = await this.db.collection('hostedImages').where('userId', '==', userId).get();
    return snapshot.docs.map(doc => this.docToHostedImage(doc));
  }
  
  async getAllHostedImages(): Promise<HostedImage[]> {
    const snapshot = await this.db.collection('hostedImages').get();
    return snapshot.docs.map(doc => this.docToHostedImage(doc));
  }
  
  async createHostedImage(image: InsertHostedImage): Promise<HostedImage> {
    const docRef = this.db.collection('hostedImages').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...image, id: docRef.id, createdAt: now, views: 0 });
    await docRef.set(data);
    return this.docToHostedImage(await docRef.get());
  }
  
  async updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> {
    const docRef = this.db.collection('hostedImages').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(image));
    return this.docToHostedImage(await docRef.get());
  }
  
  async incrementImageViews(id: string): Promise<void> {
    const docRef = this.db.collection('hostedImages').doc(id);
    const { FieldValue } = await import('firebase-admin/firestore');
    await docRef.update({ views: FieldValue.increment(1) });
  }
  
  async deleteHostedImage(id: string): Promise<void> {
    await this.db.collection('hostedImages').doc(id).delete();
  }
  
  private docToHostedImage(doc: FirebaseFirestore.DocumentSnapshot): HostedImage {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), expiresAt: firestoreToDateNullable(data.expiresAt) } as HostedImage;
  }
  
  // ============================================
  // HOSTING REMINDERS
  // ============================================
  
  async getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> {
    const snapshot = await this.db.collection('hostingReminders')
      .where('imageId', '==', imageId)
      .where('daysRemaining', '==', daysRemaining)
      .limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToHostingReminder(snapshot.docs[0]);
  }
  
  async createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder> {
    const docRef = this.db.collection('hostingReminders').doc();
    const data = this.prepareForFirestore({ ...reminder, id: docRef.id, sentAt: new Date() });
    await docRef.set(data);
    return this.docToHostingReminder(await docRef.get());
  }
  
  private docToHostingReminder(doc: FirebaseFirestore.DocumentSnapshot): HostingReminder {
    const data = doc.data()!;
    return { ...data, id: doc.id, sentAt: firestoreToDate(data.sentAt) } as HostingReminder;
  }
  
  // ============================================
  // PRICING RULES
  // ============================================
  
  async getPricingRules(): Promise<PricingRule[]> {
    const snapshot = await this.db.collection('pricingRules').get();
    return snapshot.docs.map(doc => this.docToPricingRule(doc));
  }
  
  async getPricingRule(id: string): Promise<PricingRule | undefined> {
    const doc = await this.db.collection('pricingRules').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToPricingRule(doc);
  }
  
  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const docRef = this.db.collection('pricingRules').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...rule, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToPricingRule(await docRef.get());
  }
  
  async updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const docRef = this.db.collection('pricingRules').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(rule));
    return this.docToPricingRule(await docRef.get());
  }
  
  async deletePricingRule(id: string): Promise<void> {
    await this.db.collection('pricingRules').doc(id).delete();
  }
  
  private docToPricingRule(doc: FirebaseFirestore.DocumentSnapshot): PricingRule {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as PricingRule;
  }
  
  // ============================================
  // HOSTING TIERS
  // ============================================
  
  async getHostingTiers(): Promise<HostingTier[]> {
    const snapshot = await this.db.collection('hostingTiers').get();
    return snapshot.docs.map(doc => this.docToHostingTier(doc));
  }
  
  async getHostingTier(id: string): Promise<HostingTier | undefined> {
    const doc = await this.db.collection('hostingTiers').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToHostingTier(doc);
  }
  
  async getHostingTierByCode(code: string): Promise<HostingTier | undefined> {
    const snapshot = await this.db.collection('hostingTiers').where('code', '==', code).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToHostingTier(snapshot.docs[0]);
  }
  
  async createHostingTier(tier: InsertHostingTier): Promise<HostingTier> {
    const docRef = this.db.collection('hostingTiers').doc();
    const data = this.prepareForFirestore({ ...tier, id: docRef.id });
    await docRef.set(data);
    return this.docToHostingTier(await docRef.get());
  }
  
  async updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> {
    const docRef = this.db.collection('hostingTiers').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(tier));
    return this.docToHostingTier(await docRef.get());
  }
  
  async deleteHostingTier(id: string): Promise<void> {
    await this.db.collection('hostingTiers').doc(id).delete();
  }
  
  private docToHostingTier(doc: FirebaseFirestore.DocumentSnapshot): HostingTier {
    const data = doc.data()!;
    return { ...data, id: doc.id } as HostingTier;
  }
  
  // ============================================
  // COUPONS
  // ============================================
  
  async getCoupons(): Promise<Coupon[]> {
    const snapshot = await this.db.collection('coupons').get();
    return snapshot.docs.map(doc => this.docToCoupon(doc));
  }
  
  async getActiveCoupons(): Promise<Coupon[]> {
    const snapshot = await this.db.collection('coupons').where('isActive', '==', true).get();
    return snapshot.docs.map(doc => this.docToCoupon(doc));
  }
  
  async getCoupon(id: string): Promise<Coupon | undefined> {
    const doc = await this.db.collection('coupons').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToCoupon(doc);
  }
  
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    const snapshot = await this.db.collection('coupons').where('code', '==', code).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToCoupon(snapshot.docs[0]);
  }
  
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const docRef = this.db.collection('coupons').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...coupon, id: docRef.id, createdAt: now, timesRedeemed: 0 });
    await docRef.set(data);
    return this.docToCoupon(await docRef.get());
  }
  
  async updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const docRef = this.db.collection('coupons').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(coupon));
    return this.docToCoupon(await docRef.get());
  }
  
  async deleteCoupon(id: string): Promise<void> {
    await this.db.collection('coupons').doc(id).delete();
  }
  
  async incrementCouponRedemption(id: string): Promise<void> {
    const docRef = this.db.collection('coupons').doc(id);
    const { FieldValue } = await import('firebase-admin/firestore');
    await docRef.update({ timesRedeemed: FieldValue.increment(1) });
  }
  
  private docToCoupon(doc: FirebaseFirestore.DocumentSnapshot): Coupon {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), expiresAt: firestoreToDateNullable(data.expiresAt), updatedAt: firestoreToDate(data.updatedAt) } as unknown as Coupon;
  }
  
  // ============================================
  // QR TEMPLATES
  // ============================================
  
  async getQrTemplates(): Promise<QrTemplate[]> {
    const snapshot = await this.db.collection('qrTemplates').get();
    return snapshot.docs.map(doc => this.docToQrTemplate(doc));
  }
  
  async getActiveQrTemplates(): Promise<QrTemplate[]> {
    const snapshot = await this.db.collection('qrTemplates').where('isActive', '==', true).get();
    return snapshot.docs.map(doc => this.docToQrTemplate(doc));
  }
  
  async getQrTemplate(id: string): Promise<QrTemplate | undefined> {
    const doc = await this.db.collection('qrTemplates').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToQrTemplate(doc);
  }
  
  async createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate> {
    const docRef = this.db.collection('qrTemplates').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...template, id: docRef.id, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToQrTemplate(await docRef.get());
  }
  
  async updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> {
    const docRef = this.db.collection('qrTemplates').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...template, updatedAt: new Date() }));
    return this.docToQrTemplate(await docRef.get());
  }
  
  async deleteQrTemplate(id: string): Promise<void> {
    await this.db.collection('qrTemplates').doc(id).delete();
  }
  
  private docToQrTemplate(doc: FirebaseFirestore.DocumentSnapshot): QrTemplate {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as unknown as QrTemplate;
  }
  
  // ============================================
  // DYNAMIC PAGES
  // ============================================
  
  async getDynamicPage(id: string): Promise<DynamicPage | undefined> {
    const doc = await this.db.collection('dynamicPages').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToDynamicPage(doc);
  }
  
  async getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined> {
    const snapshot = await this.db.collection('dynamicPages').where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToDynamicPage(snapshot.docs[0]);
  }
  
  async getDynamicPagesByUser(userId: string): Promise<DynamicPage[]> {
    const snapshot = await this.db.collection('dynamicPages').where('userId', '==', userId).get();
    return snapshot.docs.map(doc => this.docToDynamicPage(doc));
  }
  
  async createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage> {
    const docRef = this.db.collection('dynamicPages').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...page, id: docRef.id, createdAt: now, updatedAt: now, views: 0 });
    await docRef.set(data);
    return this.docToDynamicPage(await docRef.get());
  }
  
  async updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> {
    const docRef = this.db.collection('dynamicPages').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...page, updatedAt: new Date() }));
    return this.docToDynamicPage(await docRef.get());
  }
  
  async deleteDynamicPage(id: string): Promise<void> {
    await this.db.collection('dynamicPages').doc(id).delete();
  }
  
  async incrementDynamicPageViews(id: string): Promise<void> {
    const docRef = this.db.collection('dynamicPages').doc(id);
    const { FieldValue } = await import('firebase-admin/firestore');
    await docRef.update({ views: FieldValue.increment(1) });
  }
  
  private docToDynamicPage(doc: FirebaseFirestore.DocumentSnapshot): DynamicPage {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as DynamicPage;
  }
  
  // ============================================
  // DYNAMIC PAGE ASSETS
  // ============================================
  
  async getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined> {
    const doc = await this.db.collection('dynamicPageAssets').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToDynamicPageAsset(doc);
  }
  
  async getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]> {
    const snapshot = await this.db.collection('dynamicPageAssets').where('pageId', '==', pageId).get();
    return snapshot.docs.map(doc => this.docToDynamicPageAsset(doc));
  }
  
  async createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> {
    const docRef = this.db.collection('dynamicPageAssets').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...asset, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToDynamicPageAsset(await docRef.get());
  }
  
  async updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> {
    const docRef = this.db.collection('dynamicPageAssets').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(asset));
    return this.docToDynamicPageAsset(await docRef.get());
  }
  
  async deleteDynamicPageAsset(id: string): Promise<void> {
    await this.db.collection('dynamicPageAssets').doc(id).delete();
  }
  
  async setActiveAsset(pageId: string, assetId: string): Promise<void> {
    const snapshot = await this.db.collection('dynamicPageAssets').where('pageId', '==', pageId).get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { isActive: doc.id === assetId }));
    await batch.commit();
  }
  
  private docToDynamicPageAsset(doc: FirebaseFirestore.DocumentSnapshot): DynamicPageAsset {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as DynamicPageAsset;
  }
  
  // ============================================
  // PRODUCT CATEGORIES
  // ============================================
  
  async getProductCategories(): Promise<ProductCategory[]> {
    const snapshot = await this.db.collection('productCategories').get();
    return snapshot.docs.map(doc => this.docToProductCategory(doc));
  }
  
  async getAllProductCategories(): Promise<ProductCategory[]> {
    return this.getProductCategories();
  }
  
  async getActiveProductCategories(): Promise<ProductCategory[]> {
    const snapshot = await this.db.collection('productCategories').where('isActive', '==', true).get();
    return snapshot.docs.map(doc => this.docToProductCategory(doc));
  }
  
  async getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]> {
    const snapshot = await this.db.collection('productCategories').where('taxonomyType', '==', taxonomyType).get();
    return snapshot.docs.map(doc => this.docToProductCategory(doc));
  }
  
  async getProductCategory(id: string): Promise<ProductCategory | undefined> {
    const doc = await this.db.collection('productCategories').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToProductCategory(doc);
  }
  
  async createProductCategory(category: InsertProductCategory): Promise<ProductCategory> {
    const docRef = this.db.collection('productCategories').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...category, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToProductCategory(await docRef.get());
  }
  
  async updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    const docRef = this.db.collection('productCategories').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(category));
    return this.docToProductCategory(await docRef.get());
  }
  
  async deleteProductCategory(id: string): Promise<void> {
    await this.db.collection('productCategories').doc(id).delete();
  }
  
  private docToProductCategory(doc: FirebaseFirestore.DocumentSnapshot): ProductCategory {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as ProductCategory;
  }
  
  // ============================================
  // PRODUCT CATEGORY ASSIGNMENTS
  // ============================================
  
  async getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]> {
    const snapshot = await this.db.collection('productCategoryAssignments').where('productId', '==', productId).get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductCategoryAssignment));
  }
  
  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const assignments = await this.db.collection('productCategoryAssignments').where('categoryId', '==', categoryId).get();
    const productIds = assignments.docs.map(doc => doc.data().productId);
    if (productIds.length === 0) return [];
    const products: Product[] = [];
    for (const pid of productIds) {
      const p = await this.getProduct(pid);
      if (p) products.push(p);
    }
    return products;
  }
  
  async assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> {
    const docRef = this.db.collection('productCategoryAssignments').doc();
    const data = this.prepareForFirestore({ ...assignment, id: docRef.id });
    await docRef.set(data);
    return { ...data, id: docRef.id } as ProductCategoryAssignment;
  }
  
  async removeProductFromCategory(productId: string, categoryId: string): Promise<void> {
    const snapshot = await this.db.collection('productCategoryAssignments')
      .where('productId', '==', productId)
      .where('categoryId', '==', categoryId).get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  async syncProductCategories(productId: string, categoryIds: string[]): Promise<void> {
    const existing = await this.db.collection('productCategoryAssignments').where('productId', '==', productId).get();
    const batch = this.db.batch();
    existing.docs.forEach(doc => batch.delete(doc.ref));
    for (const categoryId of categoryIds) {
      const docRef = this.db.collection('productCategoryAssignments').doc();
      batch.set(docRef, { id: docRef.id, productId, categoryId });
    }
    await batch.commit();
  }
  
  // ============================================
  // PARTNER STORES
  // ============================================
  
  async getPartnerStores(): Promise<PartnerStore[]> {
    const snapshot = await this.db.collection('partnerStores').get();
    return snapshot.docs.map(doc => this.docToPartnerStore(doc));
  }
  
  async getPartnerStore(id: string): Promise<PartnerStore | undefined> {
    const doc = await this.db.collection('partnerStores').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToPartnerStore(doc);
  }
  
  async getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined> {
    const snapshot = await this.db.collection('partnerStores').where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToPartnerStore(snapshot.docs[0]);
  }
  
  async createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore> {
    const docRef = this.db.collection('partnerStores').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...store, id: docRef.id, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToPartnerStore(await docRef.get());
  }
  
  async updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> {
    const docRef = this.db.collection('partnerStores').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...store, updatedAt: new Date() }));
    return this.docToPartnerStore(await docRef.get());
  }
  
  async deletePartnerStore(id: string): Promise<void> {
    await this.db.collection('partnerStores').doc(id).delete();
  }
  
  private docToPartnerStore(doc: FirebaseFirestore.DocumentSnapshot): PartnerStore {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as PartnerStore;
  }
  
  // ============================================
  // PARTNER STORE PRODUCTS
  // ============================================
  
  async getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]> {
    const snapshot = await this.db.collection('partnerStoreProducts').where('partnerStoreId', '==', partnerStoreId).get();
    return snapshot.docs.map(doc => this.docToPartnerStoreProduct(doc));
  }
  
  async getPartnerStoreProduct(partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined> {
    const snapshot = await this.db.collection('partnerStoreProducts')
      .where('partnerStoreId', '==', partnerStoreId)
      .where('productId', '==', productId).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToPartnerStoreProduct(snapshot.docs[0]);
  }
  
  async getProductsForStore(storeSlug: string, segment?: string): Promise<Product[]> {
    const store = await this.getPartnerStoreBySlug(storeSlug);
    if (!store) return [];
    let query = this.db.collection('partnerStoreProducts').where('partnerStoreId', '==', store.id);
    if (segment) query = query.where('segment', '==', segment);
    const snapshot = await query.get();
    const productIds = snapshot.docs.map(doc => doc.data().productId);
    const products: Product[] = [];
    for (const pid of productIds) {
      const p = await this.getProduct(pid);
      if (p) products.push(p);
    }
    return products;
  }
  
  async addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
    const docRef = this.db.collection('partnerStoreProducts').doc();
    const data = this.prepareForFirestore({ ...product, id: docRef.id, addedAt: new Date() });
    await docRef.set(data);
    return this.docToPartnerStoreProduct(await docRef.get());
  }
  
  async updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const docRef = this.db.collection('partnerStoreProducts').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(product));
    return this.docToPartnerStoreProduct(await docRef.get());
  }
  
  async updatePartnerStoreProductByIds(partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const existing = await this.getPartnerStoreProduct(partnerStoreId, productId);
    if (!existing) return undefined;
    return this.updatePartnerStoreProduct(existing.id, product);
  }
  
  async removePartnerStoreProduct(id: string): Promise<void> {
    await this.db.collection('partnerStoreProducts').doc(id).delete();
  }
  
  async syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void> {
    const existing = await this.db.collection('partnerStoreProducts').where('partnerStoreId', '==', partnerStoreId).get();
    const batch = this.db.batch();
    existing.docs.forEach(doc => batch.delete(doc.ref));
    for (const productId of productIds) {
      const docRef = this.db.collection('partnerStoreProducts').doc();
      batch.set(docRef, { id: docRef.id, partnerStoreId, productId, addedAt: new Date() });
    }
    await batch.commit();
  }
  
  private docToPartnerStoreProduct(doc: FirebaseFirestore.DocumentSnapshot): PartnerStoreProduct {
    const data = doc.data()!;
    return { ...data, id: doc.id, addedAt: firestoreToDate(data.addedAt) } as unknown as PartnerStoreProduct;
  }
  
  // ============================================
  // PRODUCT VARIANTS
  // ============================================
  
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    const snapshot = await this.db.collection('productVariants').where('productId', '==', productId).get();
    return snapshot.docs.map(doc => this.docToProductVariant(doc));
  }
  
  async upsertProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    const v = variant as any;
    const existingSnapshot = await this.db.collection('productVariants')
      .where('productId', '==', v.productId)
      .where('variantId', '==', v.variantId).limit(1).get();
    
    if (!existingSnapshot.empty) {
      const docRef = existingSnapshot.docs[0].ref;
      await docRef.update(this.prepareForFirestore({ ...v, updatedAt: new Date() }));
      return this.docToProductVariant(await docRef.get());
    }
    
    const docRef = this.db.collection('productVariants').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...v, id: docRef.id, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToProductVariant(await docRef.get());
  }
  
  async toggleVariantEnabled(id: string, enabled: boolean): Promise<ProductVariant | undefined> {
    const docRef = this.db.collection('productVariants').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update({ isEnabled: enabled, updatedAt: new Date() });
    return this.docToProductVariant(await docRef.get());
  }
  
  private docToProductVariant(doc: FirebaseFirestore.DocumentSnapshot): ProductVariant {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as unknown as ProductVariant;
  }
  
  // ============================================
  // PRINTIFY BLUEPRINTS
  // ============================================
  
  async getPrintifyBlueprints(): Promise<PrintifyBlueprint[]> {
    const snapshot = await this.db.collection('printifyBlueprints').get();
    return snapshot.docs.map(doc => this.docToPrintifyBlueprint(doc));
  }
  
  async getPrintifyBlueprint(id: number): Promise<PrintifyBlueprint | undefined> {
    const doc = await this.db.collection('printifyBlueprints').doc(String(id)).get();
    if (!doc.exists) return undefined;
    return this.docToPrintifyBlueprint(doc);
  }
  
  async upsertPrintifyBlueprint(blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint> {
    const docRef = this.db.collection('printifyBlueprints').doc(String(blueprint.id));
    const now = new Date();
    const data = this.prepareForFirestore({ ...blueprint, syncedAt: now });
    await docRef.set(data, { merge: true });
    return this.docToPrintifyBlueprint(await docRef.get());
  }
  
  async deletePrintifyBlueprint(id: number): Promise<void> {
    await this.db.collection('printifyBlueprints').doc(String(id)).delete();
  }
  
  async clearPrintifyBlueprints(): Promise<void> {
    const snapshot = await this.db.collection('printifyBlueprints').get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  private docToPrintifyBlueprint(doc: FirebaseFirestore.DocumentSnapshot): PrintifyBlueprint {
    const data = doc.data()!;
    return { ...data, id: parseInt(doc.id), createdAt: firestoreToDate(data.createdAt), lastSyncedAt: firestoreToDate(data.syncedAt || data.lastSyncedAt) } as unknown as PrintifyBlueprint;
  }
  
  // ============================================
  // PRINTIFY PRINT PROVIDERS
  // ============================================
  
  async getAllPrintifyProviders(): Promise<PrintifyPrintProvider[]> {
    const snapshot = await this.db.collection('printifyPrintProviders').get();
    return snapshot.docs.map(doc => this.docToPrintifyPrintProvider(doc));
  }
  
  async getPrintifyPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
    const snapshot = await this.db.collection('printifyPrintProviders').where('blueprintId', '==', blueprintId).get();
    return snapshot.docs.map(doc => this.docToPrintifyPrintProvider(doc));
  }
  
  async getPrintifyPrintProvider(blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined> {
    const docId = `${blueprintId}_${providerId}`;
    const doc = await this.db.collection('printifyPrintProviders').doc(docId).get();
    if (!doc.exists) return undefined;
    return this.docToPrintifyPrintProvider(doc);
  }
  
  async upsertPrintifyPrintProvider(provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider> {
    const docId = `${provider.blueprintId}_${provider.providerId}`;
    const docRef = this.db.collection('printifyPrintProviders').doc(docId);
    const now = new Date();
    const data = this.prepareForFirestore({ ...provider, syncedAt: now });
    await docRef.set(data, { merge: true });
    return this.docToPrintifyPrintProvider(await docRef.get());
  }
  
  async updatePrintifyProviderCosts(blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined> {
    const docId = `${blueprintId}_${providerId}`;
    const docRef = this.db.collection('printifyPrintProviders').doc(docId);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...costs, costSyncedAt: new Date() }));
    return this.docToPrintifyPrintProvider(await docRef.get());
  }
  
  async updateProductPricesByProvider(blueprintId: number, providerId: number, basePrice: string): Promise<number> {
    const snapshot = await this.db.collection('products')
      .where('blueprintId', '==', blueprintId)
      .where('printProviderId', '==', providerId).get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { basePrice }));
    await batch.commit();
    return snapshot.size;
  }
  
  async deletePrintifyPrintProvidersByBlueprint(blueprintId: number): Promise<void> {
    const snapshot = await this.db.collection('printifyPrintProviders').where('blueprintId', '==', blueprintId).get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  async clearPrintifyPrintProviders(): Promise<void> {
    const snapshot = await this.db.collection('printifyPrintProviders').get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  
  private docToPrintifyPrintProvider(doc: FirebaseFirestore.DocumentSnapshot): PrintifyPrintProvider {
    const data = doc.data()!;
    return { ...data, id: doc.id, lastSyncedAt: firestoreToDate(data.syncedAt || data.lastSyncedAt), costsFetchedAt: firestoreToDateNullable(data.costSyncedAt || data.costsFetchedAt) } as unknown as PrintifyPrintProvider;
  }
  
  // ============================================
  // CATALOG SYNC
  // ============================================
  
  async createCatalogSync(sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync> {
    const docRef = this.db.collection('catalogSyncs').doc();
    const data = this.prepareForFirestore({ ...sync, id: docRef.id, startedAt: new Date() });
    await docRef.set(data);
    return this.docToCatalogSync(await docRef.get());
  }
  
  async updateCatalogSync(id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined> {
    const docRef = this.db.collection('catalogSyncs').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(sync));
    return this.docToCatalogSync(await docRef.get());
  }
  
  async getLatestCatalogSync(): Promise<PrintifyCatalogSync | undefined> {
    const snapshot = await this.db.collection('catalogSyncs').orderBy('startedAt', 'desc').limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToCatalogSync(snapshot.docs[0]);
  }
  
  async getCatalogSyncHistory(): Promise<PrintifyCatalogSync[]> {
    const snapshot = await this.db.collection('catalogSyncs').orderBy('startedAt', 'desc').limit(50).get();
    return snapshot.docs.map(doc => this.docToCatalogSync(doc));
  }
  
  private docToCatalogSync(doc: FirebaseFirestore.DocumentSnapshot): PrintifyCatalogSync {
    const data = doc.data()!;
    return { ...data, id: doc.id, startedAt: firestoreToDate(data.startedAt), completedAt: firestoreToDateNullable(data.completedAt) } as PrintifyCatalogSync;
  }
  
  // ============================================
  // COST SYNC
  // ============================================
  
  async createCostSync(sync: InsertPrintifyCostSync): Promise<PrintifyCostSync> {
    const docRef = this.db.collection('costSyncs').doc();
    const data = this.prepareForFirestore({ ...sync, id: docRef.id, startedAt: new Date() });
    await docRef.set(data);
    return this.docToCostSync(await docRef.get());
  }
  
  async updateCostSync(id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined> {
    const docRef = this.db.collection('costSyncs').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(sync));
    return this.docToCostSync(await docRef.get());
  }
  
  async getLatestCostSync(): Promise<PrintifyCostSync | undefined> {
    const snapshot = await this.db.collection('costSyncs').orderBy('startedAt', 'desc').limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToCostSync(snapshot.docs[0]);
  }
  
  async getActiveCostSync(): Promise<PrintifyCostSync | undefined> {
    const snapshot = await this.db.collection('costSyncs').where('status', '==', 'running').limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToCostSync(snapshot.docs[0]);
  }
  
  async getCostSyncHistory(): Promise<PrintifyCostSync[]> {
    const snapshot = await this.db.collection('costSyncs').orderBy('startedAt', 'desc').limit(50).get();
    return snapshot.docs.map(doc => this.docToCostSync(doc));
  }
  
  async getProviderCostStats(): Promise<{ total: number; withCosts: number; stale: number }> {
    const providers = await this.getAllPrintifyProviders();
    const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      total: providers.length,
      withCosts: providers.filter(p => p.minCost !== null).length,
      stale: providers.filter(p => p.costsFetchedAt && new Date(p.costsFetchedAt) < staleDate).length
    };
  }
  
  private docToCostSync(doc: FirebaseFirestore.DocumentSnapshot): PrintifyCostSync {
    const data = doc.data()!;
    return { ...data, id: doc.id, startedAt: firestoreToDate(data.startedAt), completedAt: firestoreToDateNullable(data.completedAt) } as PrintifyCostSync;
  }
  
  // ============================================
  // TEMPLATE CATEGORIES
  // ============================================
  
  async getTemplateCategories(): Promise<TemplateCategory[]> {
    const snapshot = await this.db.collection('templateCategories').get();
    return snapshot.docs.map(doc => this.docToTemplateCategory(doc));
  }
  
  async getTemplateCategoriesByParent(parentId: string | null): Promise<TemplateCategory[]> {
    let query = this.db.collection('templateCategories') as FirebaseFirestore.Query;
    if (parentId === null) {
      query = query.where('parentId', '==', null);
    } else {
      query = query.where('parentId', '==', parentId);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => this.docToTemplateCategory(doc));
  }
  
  async createTemplateCategory(category: InsertTemplateCategory): Promise<TemplateCategory> {
    const docRef = this.db.collection('templateCategories').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...category, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToTemplateCategory(await docRef.get());
  }
  
  async updateTemplateCategory(id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined> {
    const docRef = this.db.collection('templateCategories').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(category));
    return this.docToTemplateCategory(await docRef.get());
  }
  
  async deleteTemplateCategory(id: string): Promise<void> {
    await this.db.collection('templateCategories').doc(id).delete();
  }
  
  private docToTemplateCategory(doc: FirebaseFirestore.DocumentSnapshot): TemplateCategory {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as TemplateCategory;
  }
  
  // ============================================
  // GRAPHIC SETS
  // ============================================
  
  async getGraphicSets(): Promise<GraphicSet[]> {
    const snapshot = await this.db.collection('graphicSets')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => this.docToGraphicSet(doc));
  }

  async getGraphicSet(id: string): Promise<GraphicSet | undefined> {
    const doc = await this.db.collection('graphicSets').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToGraphicSet(doc);
  }

  async getGraphicSetsByCategory(categoryId: string): Promise<GraphicSet[]> {
    const snapshot = await this.db.collection('graphicSets')
      .where('categoryId', '==', categoryId)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => this.docToGraphicSet(doc));
  }

  async createGraphicSet(graphicSet: InsertGraphicSet): Promise<GraphicSet> {
    const id = graphicSet.id || this.db.collection('graphicSets').doc().id;
    const now = new Date();
    const data = this.prepareForFirestore({
      ...graphicSet,
      id,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await this.db.collection('graphicSets').doc(id).set(data);
    const doc = await this.db.collection('graphicSets').doc(id).get();
    return this.docToGraphicSet(doc);
  }

  async updateGraphicSet(id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined> {
    const docRef = this.db.collection('graphicSets').doc(id);
    const existing = await docRef.get();
    if (!existing.exists) return undefined;
    const data = this.prepareForFirestore({ ...graphicSet, updatedAt: new Date() });
    await docRef.update(data);
    const updated = await docRef.get();
    return this.docToGraphicSet(updated);
  }

  async deleteGraphicSet(id: string): Promise<void> {
    await this.db.collection('graphicSets').doc(id).update({ isActive: false });
  }

  async incrementGraphicSetUsage(id: string): Promise<void> {
    const docRef = this.db.collection('graphicSets').doc(id);
    const doc = await docRef.get();
    if (doc.exists) {
      const currentCount = doc.data()?.usageCount || 0;
      await docRef.update({ usageCount: currentCount + 1 });
    }
  }

  private docToGraphicSet(doc: FirebaseFirestore.DocumentSnapshot): GraphicSet {
    const data = doc.data()!;
    return {
      ...data,
      id: doc.id,
      createdAt: firestoreToDate(data.createdAt),
      updatedAt: firestoreToDate(data.updatedAt),
    } as GraphicSet;
  }
  
  // ============================================
  // LIBRARY ASSETS
  // ============================================
  
  async getLibraryAsset(id: string): Promise<LibraryAsset | undefined> {
    const doc = await this.db.collection('libraryAssets').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToLibraryAsset(doc);
  }
  
  async getLibraryAssetByUrl(url: string): Promise<LibraryAsset | undefined> {
    const snapshot = await this.db.collection('libraryAssets').where('url', '==', url).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToLibraryAsset(snapshot.docs[0]);
  }
  
  async getLibraryAssets(filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    let query = this.db.collection('libraryAssets') as FirebaseFirestore.Query;
    if (filters?.ownerType) query = query.where('ownerType', '==', filters.ownerType);
    if (filters?.assetType) query = query.where('assetType', '==', filters.assetType);
    if (filters?.mediaType) query = query.where('mediaType', '==', filters.mediaType);
    if (filters?.userId) query = query.where('userId', '==', filters.userId);
    if (filters?.category) query = query.where('category', '==', filters.category);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => this.docToLibraryAsset(doc));
  }
  
  async getAdminLibraryAssets(filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    return this.getLibraryAssets({ ...filters, ownerType: 'admin' });
  }
  
  async getUserLibraryAssets(userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]> {
    return this.getLibraryAssets({ ...filters, userId, ownerType: 'user' });
  }
  
  async createLibraryAsset(asset: InsertLibraryAsset): Promise<LibraryAsset> {
    const docRef = this.db.collection('libraryAssets').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...asset, id: docRef.id, createdAt: now, usageCount: 0 });
    await docRef.set(data);
    return this.docToLibraryAsset(await docRef.get());
  }

  async createLibraryAssetWithId(id: string, asset: InsertLibraryAsset): Promise<LibraryAsset> {
    const docRef = this.db.collection('libraryAssets').doc(id);
    const now = new Date();
    const data = this.prepareForFirestore({ ...asset, id, createdAt: now, usageCount: 0 });
    await docRef.set(data);
    return this.docToLibraryAsset(await docRef.get());
  }
  
  async updateLibraryAsset(id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined> {
    const docRef = this.db.collection('libraryAssets').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(asset));
    return this.docToLibraryAsset(await docRef.get());
  }
  
  async deleteLibraryAsset(id: string): Promise<void> {
    await this.db.collection('libraryAssets').doc(id).delete();
  }
  
  async incrementLibraryAssetUsage(id: string): Promise<void> {
    const docRef = this.db.collection('libraryAssets').doc(id);
    const { FieldValue } = await import('firebase-admin/firestore');
    await docRef.update({ usageCount: FieldValue.increment(1) });
  }
  
  private docToLibraryAsset(doc: FirebaseFirestore.DocumentSnapshot): LibraryAsset {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as LibraryAsset;
  }
  
  // ============================================
  // MASTER PRODUCTS
  // ============================================
  
  async getAllMasterProducts(): Promise<MasterProduct[]> {
    const snapshot = await this.db.collection('masterProducts').get();
    return snapshot.docs.map(doc => this.docToMasterProduct(doc));
  }
  
  async getMasterProduct(id: string): Promise<MasterProduct | undefined> {
    const doc = await this.db.collection('masterProducts').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToMasterProduct(doc);
  }
  
  async createMasterProduct(product: InsertMasterProduct): Promise<MasterProduct> {
    const docRef = this.db.collection('masterProducts').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...product, id: docRef.id, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToMasterProduct(await docRef.get());
  }
  
  async updateMasterProduct(id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined> {
    const docRef = this.db.collection('masterProducts').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...product, updatedAt: new Date() }));
    return this.docToMasterProduct(await docRef.get());
  }
  
  async deleteMasterProduct(id: string): Promise<void> {
    await this.db.collection('masterProducts').doc(id).delete();
  }
  
  private docToMasterProduct(doc: FirebaseFirestore.DocumentSnapshot): MasterProduct {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as MasterProduct;
  }
  
  // ============================================
  // DESIGN VERSIONS
  // ============================================
  
  async getDesignVersions(masterProductId: string): Promise<ProductDesignVersion[]> {
    const snapshot = await this.db.collection('designVersions').where('masterProductId', '==', masterProductId).get();
    return snapshot.docs.map(doc => this.docToDesignVersion(doc));
  }
  
  async getActiveDesignVersion(masterProductId: string): Promise<ProductDesignVersion | undefined> {
    const snapshot = await this.db.collection('designVersions')
      .where('masterProductId', '==', masterProductId)
      .where('isActive', '==', true).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToDesignVersion(snapshot.docs[0]);
  }
  
  async createDesignVersion(version: InsertProductDesignVersion): Promise<ProductDesignVersion> {
    const docRef = this.db.collection('designVersions').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...version, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToDesignVersion(await docRef.get());
  }
  
  async updateDesignVersion(id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined> {
    const docRef = this.db.collection('designVersions').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(version));
    return this.docToDesignVersion(await docRef.get());
  }
  
  private docToDesignVersion(doc: FirebaseFirestore.DocumentSnapshot): ProductDesignVersion {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as ProductDesignVersion;
  }
  
  // ============================================
  // CHANNEL CONFIGS
  // ============================================
  
  async getAllChannelConfigs(): Promise<ChannelConfig[]> {
    const snapshot = await this.db.collection('channelConfigs').get();
    return snapshot.docs.map(doc => this.docToChannelConfig(doc));
  }
  
  async getChannelConfig(channelType: string): Promise<ChannelConfig | undefined> {
    const doc = await this.db.collection('channelConfigs').doc(channelType).get();
    if (!doc.exists) return undefined;
    return this.docToChannelConfig(doc);
  }
  
  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    const docRef = this.db.collection('channelConfigs').doc(config.channelType);
    const now = new Date();
    const data = this.prepareForFirestore({ ...config, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToChannelConfig(await docRef.get());
  }
  
  async updateChannelConfig(channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
    const docRef = this.db.collection('channelConfigs').doc(channelType);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...config, updatedAt: new Date() }));
    return this.docToChannelConfig(await docRef.get());
  }
  
  private docToChannelConfig(doc: FirebaseFirestore.DocumentSnapshot): ChannelConfig {
    const data = doc.data()!;
    return { ...data, channelType: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as ChannelConfig;
  }
  
  // ============================================
  // PUBLISH STATES
  // ============================================
  
  async getPublishStates(masterProductId: string): Promise<ChannelPublishState[]> {
    const snapshot = await this.db.collection('publishStates').where('masterProductId', '==', masterProductId).get();
    return snapshot.docs.map(doc => this.docToPublishState(doc));
  }
  
  async getPublishState(masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined> {
    const docId = `${masterProductId}_${channelType}`;
    const doc = await this.db.collection('publishStates').doc(docId).get();
    if (!doc.exists) return undefined;
    return this.docToPublishState(doc);
  }
  
  async upsertPublishState(state: InsertChannelPublishState): Promise<ChannelPublishState> {
    const docId = `${state.masterProductId}_${state.channelType}`;
    const docRef = this.db.collection('publishStates').doc(docId);
    const now = new Date();
    const data = this.prepareForFirestore({ ...state, updatedAt: now });
    await docRef.set(data, { merge: true });
    return this.docToPublishState(await docRef.get());
  }
  
  private docToPublishState(doc: FirebaseFirestore.DocumentSnapshot): ChannelPublishState {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), publishedAt: firestoreToDateNullable(data.publishedAt), updatedAt: firestoreToDate(data.updatedAt), lastSyncedAt: firestoreToDateNullable(data.lastSyncedAt) } as unknown as ChannelPublishState;
  }
  
  // ============================================
  // PROVIDER HEALTH
  // ============================================
  
  async logProviderHealth(log: InsertProviderHealthLog): Promise<ProviderHealthLog> {
    const docRef = this.db.collection('providerHealthLogs').doc();
    const data = this.prepareForFirestore({ ...log, id: docRef.id, checkedAt: new Date() });
    await docRef.set(data);
    return this.docToProviderHealthLog(await docRef.get());
  }
  
  async getProviderHealthLogs(limit: number = 100): Promise<ProviderHealthLog[]> {
    const snapshot = await this.db.collection('providerHealthLogs').orderBy('checkedAt', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => this.docToProviderHealthLog(doc));
  }
  
  async getProviderHealthLogsByType(providerType: string, limit: number = 100): Promise<ProviderHealthLog[]> {
    const snapshot = await this.db.collection('providerHealthLogs')
      .where('providerType', '==', providerType)
      .orderBy('checkedAt', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => this.docToProviderHealthLog(doc));
  }
  
  async getLatestProviderHealth(providerType: string): Promise<ProviderHealthLog | undefined> {
    const logs = await this.getProviderHealthLogsByType(providerType, 1);
    return logs[0];
  }
  
  async getAllLatestProviderHealth(): Promise<ProviderHealthLog[]> {
    const allLogs = await this.getProviderHealthLogs(500);
    const latestByType = new Map<string, ProviderHealthLog>();
    for (const log of allLogs) {
      if (!latestByType.has(log.providerType)) {
        latestByType.set(log.providerType, log);
      }
    }
    return Array.from(latestByType.values());
  }
  
  async getProviderHealthStats(providerType: string, hours: number = 24): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const snapshot = await this.db.collection('providerHealthLogs')
      .where('providerType', '==', providerType)
      .where('checkedAt', '>=', cutoff).get();
    const logs = snapshot.docs.map(doc => this.docToProviderHealthLog(doc));
    if (logs.length === 0) return { uptimePercent: 0, avgResponseTime: 0, totalChecks: 0 };
    const upCount = logs.filter(l => l.isHealthy).length;
    const avgTime = logs.reduce((sum, l) => sum + (l.responseTimeMs || 0), 0) / logs.length;
    return { uptimePercent: (upCount / logs.length) * 100, avgResponseTime: avgTime, totalChecks: logs.length };
  }
  
  private docToProviderHealthLog(doc: FirebaseFirestore.DocumentSnapshot): ProviderHealthLog {
    const data = doc.data()!;
    return { ...data, id: doc.id, checkTime: firestoreToDate(data.checkedAt || data.checkTime) } as unknown as ProviderHealthLog;
  }
  
  // ============================================
  // GIFT PACKAGES
  // ============================================
  
  async getAllGiftPackages(): Promise<GiftPackage[]> {
    const snapshot = await this.db.collection('giftPackages').get();
    return snapshot.docs.map(doc => this.docToGiftPackage(doc));
  }
  
  async getActiveGiftPackages(): Promise<GiftPackage[]> {
    const snapshot = await this.db.collection('giftPackages').where('isActive', '==', true).get();
    return snapshot.docs.map(doc => this.docToGiftPackage(doc));
  }
  
  async getGiftPackage(id: string): Promise<GiftPackage | undefined> {
    const doc = await this.db.collection('giftPackages').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToGiftPackage(doc);
  }
  
  async createGiftPackage(pkg: InsertGiftPackage): Promise<GiftPackage> {
    const docRef = this.db.collection('giftPackages').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...pkg, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToGiftPackage(await docRef.get());
  }
  
  async updateGiftPackage(id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined> {
    const docRef = this.db.collection('giftPackages').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(pkg));
    return this.docToGiftPackage(await docRef.get());
  }
  
  async deleteGiftPackage(id: string): Promise<void> {
    await this.db.collection('giftPackages').doc(id).delete();
  }
  
  private docToGiftPackage(doc: FirebaseFirestore.DocumentSnapshot): GiftPackage {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as GiftPackage;
  }
  
  // ============================================
  // GIFT CODES
  // ============================================
  
  async getGiftCode(id: string): Promise<GiftCode | undefined> {
    const doc = await this.db.collection('giftCodes').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToGiftCode(doc);
  }
  
  async getGiftCodeByCode(code: string): Promise<GiftCode | undefined> {
    const snapshot = await this.db.collection('giftCodes').where('code', '==', code).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToGiftCode(snapshot.docs[0]);
  }
  
  async getGiftCodesByBuyer(buyerUserId: string): Promise<GiftCode[]> {
    const snapshot = await this.db.collection('giftCodes').where('buyerUserId', '==', buyerUserId).get();
    return snapshot.docs.map(doc => this.docToGiftCode(doc));
  }
  
  async createGiftCode(code: InsertGiftCode): Promise<GiftCode> {
    const docRef = this.db.collection('giftCodes').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...code, id: docRef.id, createdAt: now });
    await docRef.set(data);
    return this.docToGiftCode(await docRef.get());
  }
  
  async updateGiftCode(id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined> {
    const docRef = this.db.collection('giftCodes').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(code));
    return this.docToGiftCode(await docRef.get());
  }
  
  private docToGiftCode(doc: FirebaseFirestore.DocumentSnapshot): GiftCode {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), expiresAt: firestoreToDateNullable(data.expiresAt) } as GiftCode;
  }
  
  // ============================================
  // GIFT REDEMPTIONS
  // ============================================
  
  async getGiftRedemption(id: string): Promise<GiftRedemption | undefined> {
    const doc = await this.db.collection('giftRedemptions').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToGiftRedemption(doc);
  }
  
  async getGiftRedemptionByCode(giftCodeId: string): Promise<GiftRedemption | undefined> {
    const snapshot = await this.db.collection('giftRedemptions').where('giftCodeId', '==', giftCodeId).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToGiftRedemption(snapshot.docs[0]);
  }
  
  async getGiftRedemptionsByRecipient(recipientEmail: string): Promise<GiftRedemption[]> {
    const snapshot = await this.db.collection('giftRedemptions').where('recipientEmail', '==', recipientEmail).get();
    return snapshot.docs.map(doc => this.docToGiftRedemption(doc));
  }
  
  async createGiftRedemption(redemption: InsertGiftRedemption): Promise<GiftRedemption> {
    const docRef = this.db.collection('giftRedemptions').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...redemption, id: docRef.id, redeemedAt: now });
    await docRef.set(data);
    return this.docToGiftRedemption(await docRef.get());
  }
  
  async updateGiftRedemption(id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined> {
    const docRef = this.db.collection('giftRedemptions').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore(redemption));
    return this.docToGiftRedemption(await docRef.get());
  }
  
  private docToGiftRedemption(doc: FirebaseFirestore.DocumentSnapshot): GiftRedemption {
    const data = doc.data()!;
    return { ...data, id: doc.id, redeemedAt: firestoreToDate(data.redeemedAt) } as GiftRedemption;
  }
  
  // ============================================
  // EMAIL TEMPLATES
  // ============================================
  
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    const snapshot = await this.db.collection('emailTemplates').get();
    return snapshot.docs.map(doc => this.docToEmailTemplate(doc));
  }
  
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const doc = await this.db.collection('emailTemplates').doc(id).get();
    if (!doc.exists) return undefined;
    return this.docToEmailTemplate(doc);
  }
  
  async getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined> {
    const snapshot = await this.db.collection('emailTemplates').where('trigger', '==', trigger).limit(1).get();
    if (snapshot.empty) return undefined;
    return this.docToEmailTemplate(snapshot.docs[0]);
  }
  
  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const docRef = this.db.collection('emailTemplates').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...template, id: docRef.id, createdAt: now, updatedAt: now });
    await docRef.set(data);
    return this.docToEmailTemplate(await docRef.get());
  }
  
  async updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const docRef = this.db.collection('emailTemplates').doc(id);
    if (!(await docRef.get()).exists) return undefined;
    await docRef.update(this.prepareForFirestore({ ...template, updatedAt: new Date() }));
    return this.docToEmailTemplate(await docRef.get());
  }
  
  async deleteEmailTemplate(id: string): Promise<void> {
    await this.db.collection('emailTemplates').doc(id).delete();
  }
  
  private docToEmailTemplate(doc: FirebaseFirestore.DocumentSnapshot): EmailTemplate {
    const data = doc.data()!;
    return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as EmailTemplate;
  }
  
  // ============================================
  // EMAIL LOGS
  // ============================================
  
  async getEmailLogs(limit: number = 100): Promise<EmailLog[]> {
    const snapshot = await this.db.collection('emailLogs').orderBy('sentAt', 'desc').limit(limit).get();
    return snapshot.docs.map(doc => this.docToEmailLog(doc));
  }
  
  async logEmail(log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog> {
    const docRef = this.db.collection('emailLogs').doc();
    const now = new Date();
    const data = this.prepareForFirestore({ ...log, id: docRef.id, sentAt: now });
    await docRef.set(data);
    return this.docToEmailLog(await docRef.get());
  }
  
  private docToEmailLog(doc: FirebaseFirestore.DocumentSnapshot): EmailLog {
    const data = doc.data()!;
    return { ...data, id: doc.id, sentAt: firestoreToDate(data.sentAt) } as EmailLog;
  }
}
