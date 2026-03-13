import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { checkProviderHealth } from "./route-helpers";

export function registerAdminCommerceRoutes(app: Express): void {
  app.get("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/product-categories", async (req, res) => {
    try {
      const taxonomyType = req.query.taxonomy as string | undefined;
      let categories;
      if (taxonomyType) {
        categories = await storage.getProductCategoriesByTaxonomy(taxonomyType);
      } else {
        categories = await storage.getActiveProductCategories();
      }
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/product-categories/:id/products", async (req, res) => {
    try {
      const products = await storage.getProductsByCategory(req.params.id);
      const enabledProducts = products.filter(p => p.isEnabled);
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id/categories", async (req, res) => {
    try {
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const { name, slug, description, taxonomyType, icon, parentId, sortOrder, isActive } = req.body;
      const category = await storage.createProductCategory({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        taxonomyType,
        icon,
        parentId,
        sortOrder,
        isActive,
      });
      res.status(201).json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateProductCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteProductCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/:id/categories", isAdmin, async (req: any, res) => {
    try {
      const { categoryIds } = req.body;
      await storage.syncProductCategories(req.params.id, categoryIds || []);
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/product-categories/seed", isAdmin, async (req: any, res) => {
    try {
      const defaultCategories = [
        { name: "Spring", slug: "spring", taxonomyType: "season", icon: "Flower2", sortOrder: 1 },
        { name: "Summer", slug: "summer", taxonomyType: "season", icon: "Sun", sortOrder: 2 },
        { name: "Fall", slug: "fall", taxonomyType: "season", icon: "Leaf", sortOrder: 3 },
        { name: "Winter", slug: "winter", taxonomyType: "season", icon: "Snowflake", sortOrder: 4 },
        { name: "Christmas", slug: "christmas", taxonomyType: "holiday", icon: "Gift", sortOrder: 1 },
        { name: "Easter", slug: "easter", taxonomyType: "holiday", icon: "Egg", sortOrder: 2 },
        { name: "Valentine's Day", slug: "valentines", taxonomyType: "holiday", icon: "Heart", sortOrder: 3 },
        { name: "Halloween", slug: "halloween", taxonomyType: "holiday", icon: "Ghost", sortOrder: 4 },
        { name: "Thanksgiving", slug: "thanksgiving", taxonomyType: "holiday", icon: "Utensils", sortOrder: 5 },
        { name: "Fourth of July", slug: "july-4th", taxonomyType: "holiday", icon: "Flag", sortOrder: 6 },
        { name: "Mother's Day", slug: "mothers-day", taxonomyType: "holiday", icon: "Heart", sortOrder: 7 },
        { name: "Father's Day", slug: "fathers-day", taxonomyType: "holiday", icon: "Trophy", sortOrder: 8 },
        { name: "Birthday", slug: "birthday", taxonomyType: "occasion", icon: "Cake", sortOrder: 1 },
        { name: "Anniversary", slug: "anniversary", taxonomyType: "occasion", icon: "HeartHandshake", sortOrder: 2 },
        { name: "Graduation", slug: "graduation", taxonomyType: "occasion", icon: "GraduationCap", sortOrder: 3 },
        { name: "Wedding", slug: "wedding", taxonomyType: "occasion", icon: "Gem", sortOrder: 4 },
        { name: "Baby Shower", slug: "baby-shower", taxonomyType: "occasion", icon: "Baby", sortOrder: 5 },
        { name: "Religious", slug: "religious", taxonomyType: "other", icon: "Church", sortOrder: 1 },
        { name: "Sports", slug: "sports", taxonomyType: "other", icon: "Trophy", sortOrder: 2 },
        { name: "Business", slug: "business", taxonomyType: "other", icon: "Briefcase", sortOrder: 3 },
        { name: "Patriotic", slug: "patriotic", taxonomyType: "other", icon: "Flag", sortOrder: 4 },
      ];

      const created = [];
      for (const cat of defaultCategories) {
        try {
          const category = await storage.createProductCategory({
            ...cat,
            isActive: true,
          });
          created.push(category);
        } catch (e) {
        }
      }
      res.json({ created: created.length, categories: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/dashboard/metrics", isAdmin, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;
      let pendingOrders = 0;
      let inProductionOrders = 0;
      let shippedOrders = 0;

      for (const order of orders) {
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        const amount = parseFloat(order.total || "0");
        
        if (orderDate && orderDate >= today) todayRevenue += amount;
        if (orderDate && orderDate >= weekAgo) weekRevenue += amount;
        if (orderDate && orderDate >= monthAgo) monthRevenue += amount;
        
        if (order.status === "pending") pendingOrders++;
        if (order.status === "in_production") inProductionOrders++;
        if (order.status === "shipped") shippedOrders++;
      }

      const users = await storage.getUsers();
      const newUsersThisWeek = users.filter(u => {
        const created = u.createdAt ? new Date(u.createdAt) : null;
        return created && created >= weekAgo;
      }).length;

      const products = await storage.getProducts();
      const activeProducts = products.filter(p => p.isEnabled !== false).length;

      res.json({
        revenue: {
          today: todayRevenue,
          week: weekRevenue,
          month: monthRevenue,
          trend: 0,
        },
        orders: {
          total: orders.length,
          pending: pendingOrders,
          inProduction: inProductionOrders,
          shipped: shippedOrders,
          trend: 0,
        },
        customers: {
          total: users.length,
          newThisWeek: newUsersThisWeek,
          returning: users.length - newUsersThisWeek,
        },
        products: {
          active: activeProducts,
          lowStock: 0,
          syncErrors: 0,
        },
        health: await checkProviderHealth(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/customers", isAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const orders = await storage.getOrders();

      const customerStats = users.map(user => {
        const userOrders = orders.filter(o => o.customerEmail === user.email);
        const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
        const lastOrder = userOrders.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })[0];

        return {
          ...user,
          orderCount: userOrders.length,
          totalSpent,
          lastOrderDate: lastOrder?.createdAt?.toISOString() || null,
        };
      });

      customerStats.sort((a, b) => b.totalSpent - a.totalSpent);

      res.json(customerStats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/customers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const orders = await storage.getOrders();
      const userOrders = orders.filter(o => o.customerEmail === user.email);
      const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const lastOrder = userOrders[0];

      res.json({
        customer: {
          ...user,
          orderCount: userOrders.length,
          totalSpent,
          lastOrderDate: lastOrder?.createdAt?.toISOString() || null,
        },
        recentOrders: userOrders.slice(0, 10),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/health", isAdmin, async (req, res) => {
    try {
      const healthLogs = await storage.getProviderHealthLogs(50);

      const providerStatus: Record<string, { healthy: number; total: number; lastCheck: Date | null; avgResponse: number }> = {};
      
      for (const log of healthLogs) {
        const provider = log.providerType;
        if (!providerStatus[provider]) {
          providerStatus[provider] = { healthy: 0, total: 0, lastCheck: null, avgResponse: 0 };
        }
        providerStatus[provider].total++;
        if (log.isHealthy) providerStatus[provider].healthy++;
        if (!providerStatus[provider].lastCheck || log.checkTime > providerStatus[provider].lastCheck) {
          providerStatus[provider].lastCheck = log.checkTime;
        }
        if (log.responseTimeMs) {
          providerStatus[provider].avgResponse += log.responseTimeMs;
        }
      }

      const providers = Object.entries(providerStatus).map(([provider, stats]) => {
        const successRate = stats.total > 0 ? (stats.healthy / stats.total) * 100 : 100;
        let status: "healthy" | "degraded" | "down" = "healthy";
        if (successRate < 50) status = "down";
        else if (successRate < 90) status = "degraded";

        return {
          provider,
          status,
          lastCheck: stats.lastCheck?.toISOString() || new Date().toISOString(),
          responseMs: stats.total > 0 ? Math.round(stats.avgResponse / stats.total) : 0,
          successRate: Math.round(successRate * 10) / 10,
          recentErrors: stats.total - stats.healthy,
        };
      });

      if (providers.length === 0) {
        providers.push(
          { provider: "printify", status: "healthy", lastCheck: new Date().toISOString(), responseMs: 200, successRate: 100, recentErrors: 0 },
          { provider: "stripe", status: "healthy", lastCheck: new Date().toISOString(), responseMs: 100, successRate: 100, recentErrors: 0 }
        );
      }

      res.json({
        providers,
        recentLogs: healthLogs.slice(0, 20),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const coupons = await storage.getCoupons();
      res.json(coupons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1),
        discountType: z.enum(["percent", "fixed"]),
        discountValue: z.string().refine(val => parseFloat(val) > 0, "Must be greater than 0"),
        currency: z.string().optional().default("usd"),
        minOrderAmount: z.string().nullable().optional(),
        maxRedemptions: z.number().nullable().optional(),
        validFrom: z.string().nullable().optional(),
        validUntil: z.string().nullable().optional(),
        isActive: z.boolean().optional().default(true),
      });

      const validated = createSchema.parse(req.body);

      const existing = await storage.getCouponByCode(validated.code);
      if (existing) {
        return res.status(409).json({ error: "A coupon with this code already exists" });
      }

      let stripeCouponId: string | null = null;
      let stripePromotionCodeId: string | null = null;

      try {
        const { getUncachableStripeClient } = await import("../stripeClient");
        const stripe = await getUncachableStripeClient();

        const stripeCoupon = await stripe.coupons.create({
          ...(validated.discountType === "percent"
            ? { percent_off: parseFloat(validated.discountValue) }
            : { amount_off: Math.round(parseFloat(validated.discountValue) * 100), currency: validated.currency }),
          name: validated.name,
          ...(validated.validUntil && { redeem_by: Math.floor(new Date(validated.validUntil).getTime() / 1000) }),
          ...(validated.maxRedemptions && { max_redemptions: validated.maxRedemptions }),
        });
        stripeCouponId = stripeCoupon.id;

        const promoCode = await stripe.promotionCodes.create({
          promotion: {
            type: 'coupon',
            coupon: stripeCoupon.id,
          },
          code: validated.code.toUpperCase(),
          active: validated.isActive,
        });
        stripePromotionCodeId = promoCode.id;
      } catch (stripeError: any) {
        console.error("Stripe coupon creation failed:", stripeError.message);
      }

      const coupon = await storage.createCoupon({
        code: validated.code,
        name: validated.name,
        discountType: validated.discountType,
        discountValue: validated.discountValue,
        currency: validated.currency,
        minOrderAmount: validated.minOrderAmount ?? null,
        maxRedemptions: validated.maxRedemptions ?? null,
        validFrom: validated.validFrom ? new Date(validated.validFrom) : null,
        validUntil: validated.validUntil ? new Date(validated.validUntil) : null,
        stripeCouponId,
        stripePromotionCodeId,
        isActive: validated.isActive,
      });

      res.json(coupon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        maxRedemptions: z.number().nullable().optional(),
        validUntil: z.string().nullable().optional(),
      });

      const validated = updateSchema.parse(req.body);
      
      const existingCoupon = await storage.getCoupon(id);
      if (existingCoupon?.stripePromotionCodeId && validated.isActive !== undefined) {
        try {
          const { getUncachableStripeClient } = await import("../stripeClient");
          const stripe = await getUncachableStripeClient();
          await stripe.promotionCodes.update(existingCoupon.stripePromotionCodeId, {
            active: validated.isActive,
          });
        } catch (stripeError: any) {
          console.error("Stripe promo code update failed:", stripeError.message);
        }
      }

      const updated = await storage.updateCoupon(id, {
        ...(validated.name && { name: validated.name }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
        ...(validated.maxRedemptions !== undefined && { maxRedemptions: validated.maxRedemptions }),
        ...(validated.validUntil !== undefined && { validUntil: validated.validUntil ? new Date(validated.validUntil) : null }),
      });

      if (!updated) {
        return res.status(404).json({ error: "Coupon not found" });
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const existingCoupon = await storage.getCoupon(id);
      if (existingCoupon?.stripePromotionCodeId) {
        try {
          const { getUncachableStripeClient } = await import("../stripeClient");
          const stripe = await getUncachableStripeClient();
          await stripe.promotionCodes.update(existingCoupon.stripePromotionCodeId, {
            active: false,
          });
        } catch (stripeError: any) {
          console.error("Stripe promo code deactivation failed:", stripeError.message);
        }
      }

      await storage.deleteCoupon(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const validateSchema = z.object({
        code: z.string().min(1),
        orderTotal: z.number().optional(),
      });

      const { code, orderTotal } = validateSchema.parse(req.body);
      const coupon = await storage.getCouponByCode(code);

      if (!coupon) {
        return res.status(404).json({ valid: false, error: "Invalid coupon code" });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ valid: false, error: "This coupon is no longer active" });
      }

      const now = new Date();
      if (coupon.validFrom && now < new Date(coupon.validFrom)) {
        return res.status(400).json({ valid: false, error: "This coupon is not yet active" });
      }

      if (coupon.validUntil && now > new Date(coupon.validUntil)) {
        return res.status(400).json({ valid: false, error: "This coupon has expired" });
      }

      if (coupon.maxRedemptions && (coupon.redemptionCount || 0) >= coupon.maxRedemptions) {
        return res.status(400).json({ valid: false, error: "This coupon has reached its usage limit" });
      }

      if (coupon.minOrderAmount && orderTotal && orderTotal < parseFloat(coupon.minOrderAmount)) {
        return res.status(400).json({ 
          valid: false, 
          error: `Minimum order of $${coupon.minOrderAmount} required for this coupon` 
        });
      }

      let discountAmount = 0;
      if (orderTotal) {
        if (coupon.discountType === "percent") {
          discountAmount = orderTotal * (parseFloat(coupon.discountValue) / 100);
        } else {
          discountAmount = Math.min(parseFloat(coupon.discountValue), orderTotal);
        }
      }

      res.json({
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          stripePromotionCodeId: coupon.stripePromotionCodeId,
        },
        discountAmount: discountAmount.toFixed(2),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ valid: false, error: error.errors });
      }
      res.status(500).json({ valid: false, error: error.message });
    }
  });
}
