import {createCoupon,updateCoupon,validateCoupon} from '../../functions/src/services/coupons';
import {isSandboxRuntime} from '../../functions/src/runtime-config';
import { registerProductTagRoutes } from "../../functions/src/services/product-tags";
import { getFirestoreDb } from "../lib/firebase-admin";
import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { checkProviderHealth } from "./route-helpers";

export function registerAdminCommerceRoutes(app: Express): void {
  registerProductTagRoutes(app, "/api", isAdmin, getFirestoreDb);

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
      const {healthMonitor}=await import('../services/health-monitor');
      res.json(await healthMonitor.getOverview());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/coupons',isAdmin,async (_req,res)=>{
    try {const docs=await getFirestoreDb().collection('coupons').get();res.json(docs.docs.map(d=>({id:d.id,...d.data()})).filter((c:any)=>!c.archivedAt));}
    catch(e:any){res.status(500).json({error:e.message});}
  });
  // Adapt only the SDK shape; validation, persistence and retry logic are shared with Functions.
  async function stripeAdapter():Promise<any>{
    if(isSandboxRuntime())return undefined;
    const {getUncachableStripeClient}=await import('../stripeClient');const stripe=await getUncachableStripeClient();
    return {coupons:stripe.coupons,promotionCodes:{update:stripe.promotionCodes.update.bind(stripe.promotionCodes),
      create:({coupon,...params}:any,options:any)=>stripe.promotionCodes.create({...params,promotion:{type:'coupon',coupon}},options)}};
  }
  app.post('/api/admin/coupons',isAdmin,async(req,res)=>{
    try{res.json(await createCoupon(getFirestoreDb(),req.body,await stripeAdapter()));}
    catch(e:any){res.status(e.status||(e instanceof z.ZodError?400:500)).json({error:e.message});}
  });
  app.put('/api/admin/coupons/:id',isAdmin,async(req,res)=>{
    try{res.json(await updateCoupon(getFirestoreDb(),req.params.id,req.body,await stripeAdapter()));}
    catch(e:any){res.status(e.status||(e instanceof z.ZodError?400:500)).json({error:e.message});}
  });
  app.delete('/api/admin/coupons/:id',isAdmin,async(req,res)=>{
    try{await updateCoupon(getFirestoreDb(),req.params.id,{isActive:false},await stripeAdapter());await getFirestoreDb().collection('coupons').doc(req.params.id).update({archivedAt:new Date().toISOString()});res.json({success:true});}
    catch(e:any){res.status(e.status||500).json({error:e.message});}
  });
  app.post('/api/coupons/validate',async(req,res)=>{
    try{res.json(await validateCoupon(getFirestoreDb(),req.body.code,req.body.orderTotal));}
    catch(e:any){res.status(e.status||400).json({valid:false,error:e.message});}
  });
}
