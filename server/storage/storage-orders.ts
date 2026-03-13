import type {
  CartItem,
  InsertCartItem,
  Order,
  InsertOrder,
  OrderItem,
  InsertOrderItem,
  OrderUnified,
  InsertOrderUnified,
  PricingRule,
  InsertPricingRule,
  Coupon,
  InsertCoupon,
} from "@shared/schema";

export const orderMethods = {
  async getCartItemsByUser(this: any, userId: string): Promise<CartItem[]> {
    return (Array.from(this.cartItems.values()) as CartItem[]).filter((item) => item.userId === userId);
  },

  async addCartItem(this: any, item: InsertCartItem): Promise<CartItem> {
    const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem: CartItem = {
      ...item,
      id,
      designId: item.designId ?? null,
      quantity: item.quantity ?? 1,
      createdAt: new Date()
    };
    this.cartItems.set(id, newItem);
    return newItem;
  },

  async updateCartItem(this: any, id: string, quantity: number): Promise<CartItem | undefined> {
    const existing = this.cartItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, quantity };
    this.cartItems.set(id, updated);
    return updated;
  },

  async deleteCartItem(this: any, id: string): Promise<void> {
    this.cartItems.delete(id);
  },

  async clearCart(this: any, userId: string): Promise<void> {
    const entries = Array.from(this.cartItems.entries()) as [string, CartItem][];
    for (const [id, item] of entries) {
      if (item.userId === userId) {
        this.cartItems.delete(id);
      }
    }
  },

  async getOrder(this: any, id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  },

  async getOrdersByUser(this: any, userId: string): Promise<Order[]> {
    return (Array.from(this.orders.values()) as Order[]).filter((order) => order.userId === userId);
  },

  async getOrdersByStatus(this: any, status: string): Promise<Order[]> {
    return (Array.from(this.orders.values()) as Order[]).filter((order) => order.status === status);
  },

  async getOrderByStripeSession(this: any, sessionId: string): Promise<Order | undefined> {
    return (Array.from(this.orders.values()) as Order[]).find((order) => order.stripeSessionId === sessionId);
  },

  async createOrder(this: any, order: InsertOrder): Promise<Order> {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: Order = {
      ...order,
      id,
      stripePaymentId: order.stripePaymentId ?? null,
      stripeSessionId: order.stripeSessionId ?? null,
      stripePaymentIntentId: order.stripePaymentIntentId ?? null,
      printifyOrderId: order.printifyOrderId ?? null,
      trackingNumber: order.trackingNumber ?? null,
      shippingAddress: order.shippingAddress ?? null,
      carrier: order.carrier ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.orders.set(id, newOrder);
    return newOrder;
  },

  async updateOrder(this: any, id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...order, updatedAt: new Date() };
    this.orders.set(id, updated);
    return updated;
  },

  async getOrderItems(this: any, orderId: string): Promise<OrderItem[]> {
    return (Array.from(this.orderItems.values()) as OrderItem[]).filter((item) => item.orderId === orderId);
  },

  async createOrderItem(this: any, item: InsertOrderItem): Promise<OrderItem> {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem: OrderItem = {
      ...item,
      id,
      printifyItemId: item.printifyItemId ?? null
    };
    this.orderItems.set(id, newItem);
    return newItem;
  },

  async getOrders(this: any): Promise<OrderUnified[]> {
    return (Array.from(this.ordersUnified.values()) as OrderUnified[]).sort((a, b) =>
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  },

  async getOrderUnified(this: any, id: string): Promise<OrderUnified | undefined> {
    return this.ordersUnified.get(id);
  },

  async createOrderUnified(this: any, order: InsertOrderUnified): Promise<OrderUnified> {
    const newOrder: OrderUnified = {
      id: crypto.randomUUID(),
      sourceChannel: order.sourceChannel,
      externalOrderId: order.externalOrderId ?? null,
      customerEmail: order.customerEmail ?? null,
      customerName: order.customerName ?? null,
      shippingAddress: order.shippingAddress ?? null,
      items: order.items,
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal ?? null,
      taxTotal: order.taxTotal ?? null,
      total: order.total,
      routedProvider: order.routedProvider ?? null,
      providerOrderId: order.providerOrderId ?? null,
      status: order.status ?? "pending",
      statusHistory: order.statusHistory ?? null,
      trackingNumber: order.trackingNumber ?? null,
      trackingUrl: order.trackingUrl ?? null,
      shippedAt: null,
      deliveredAt: null,
      productionCost: order.productionCost ?? null,
      profit: order.profit ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ordersUnified.set(newOrder.id, newOrder);
    return newOrder;
  },

  async updateOrderUnified(this: any, id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined> {
    const existing = this.ordersUnified.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...order, updatedAt: new Date() };
    this.ordersUnified.set(id, updated);
    return updated;
  },

  async getPricingRules(this: any): Promise<PricingRule[]> {
    return Array.from(this.pricingRules.values());
  },

  async getPricingRule(this: any, id: string): Promise<PricingRule | undefined> {
    return this.pricingRules.get(id);
  },

  async createPricingRule(this: any, rule: InsertPricingRule): Promise<PricingRule> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule: PricingRule = {
      ...rule,
      id,
      scopeValue: rule.scopeValue ?? null,
      qrProductionCost: rule.qrProductionCost ?? "0",
      priority: rule.priority ?? 0,
      isActive: rule.isActive ?? true,
      createdAt: new Date(),
    };
    this.pricingRules.set(id, newRule);
    return newRule;
  },

  async updatePricingRule(this: any, id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const existing = this.pricingRules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...rule };
    this.pricingRules.set(id, updated);
    return updated;
  },

  async deletePricingRule(this: any, id: string): Promise<void> {
    this.pricingRules.delete(id);
  },

  async getCoupons(this: any): Promise<Coupon[]> {
    return Array.from(this.couponsMap.values());
  },

  async getActiveCoupons(this: any): Promise<Coupon[]> {
    return (Array.from(this.couponsMap.values()) as Coupon[]).filter((c) => c.isActive);
  },

  async getCoupon(this: any, id: string): Promise<Coupon | undefined> {
    return this.couponsMap.get(id);
  },

  async getCouponByCode(this: any, code: string): Promise<Coupon | undefined> {
    return (Array.from(this.couponsMap.values()) as Coupon[]).find((c) => c.code === code.toUpperCase());
  },

  async createCoupon(this: any, coupon: InsertCoupon): Promise<Coupon> {
    const id = `coupon_${Date.now()}`;
    const newCoupon: Coupon = {
      ...coupon,
      id,
      code: coupon.code.toUpperCase(),
      currency: coupon.currency ?? "usd",
      minOrderAmount: coupon.minOrderAmount ?? null,
      maxRedemptions: coupon.maxRedemptions ?? null,
      redemptionCount: 0,
      validFrom: coupon.validFrom ?? null,
      validUntil: coupon.validUntil ?? null,
      stripeCouponId: coupon.stripeCouponId ?? null,
      stripePromotionCodeId: coupon.stripePromotionCodeId ?? null,
      isActive: coupon.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.couponsMap.set(id, newCoupon);
    return newCoupon;
  },

  async updateCoupon(this: any, id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const existing = this.couponsMap.get(id);
    if (!existing) return undefined;
    const updated: Coupon = { ...existing, ...coupon, updatedAt: new Date() };
    if (coupon.code) updated.code = coupon.code.toUpperCase();
    this.couponsMap.set(id, updated);
    return updated;
  },

  async deleteCoupon(this: any, id: string): Promise<void> {
    this.couponsMap.delete(id);
  },

  async incrementCouponRedemption(this: any, id: string): Promise<void> {
    const existing = this.couponsMap.get(id);
    if (existing) {
      existing.redemptionCount = (existing.redemptionCount || 0) + 1;
      this.couponsMap.set(id, existing);
    }
  },
};
