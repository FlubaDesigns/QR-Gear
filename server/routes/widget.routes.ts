import type { Express } from "express";
import { widgetCorsMiddleware } from "./route-helpers";
import { verifyWidgetToken, signWidgetToken } from "../lib/widget-auth";
import { storage } from "../storage";

export function registerWidgetRoutes(app: Express): void {
  app.get("/api/widget/session", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ ok: false, error: "Token required" });
      }

      const { normalizeWidgetPayload } = await import("../lib/widget-auth");
      const payload = verifyWidgetToken(token);
      
      if (!payload) {
        return res.status(401).json({ ok: false, error: "Invalid or expired token" });
      }

      const normalized = normalizeWidgetPayload(payload);
      const { storeId, channelId, entityType, entityId, entityName, entityLogoUrl, mode, capabilities, viewType, storeOwner, programId } = normalized;
      
      if (!channelId && viewType !== 'program_series') {
        return res.status(400).json({ ok: false, error: "Token missing channelId" });
      }

      if (storeOwner) {
        const { resolveOrCreateStore } = await import("../lib/siteWidgetService");
        await resolveOrCreateStore(storeOwner.ownerType, storeOwner.ownerId, {
          name: entityName,
          logoUrl: entityLogoUrl || undefined,
          theme: payload.theme,
        });
      }

      let items: any[] = [];
      let moments: any[] = [];
      let programData: any = null;

      if (viewType === 'channel_products' || viewType === 'create_product') {
        const { getChannelItems } = await import("../lib/channelItemsService");
        const channelItems = await getChannelItems({ storeId, channelId, limit: 50 });
        items = channelItems.map(item => ({
          itemId: item.itemId,
          packetId: item.packetId,
          title: item.title,
          description: item.description,
          previewImageUrl: item.previewImageUrl,
          shareUrl: item.shareUrl,
          price: item.price,
          collectionId: item.collectionId || item.collectionTag,
          collectionTag: item.collectionId || item.collectionTag,
          shareImageSquareUrl: item.shareImageSquareUrl,
          shareCaption: item.shareCaption,
        }));
      }

      if (viewType === 'program_series' && programId) {
        const { getProgramMoments } = await import("../lib/programService");
        const result = await getProgramMoments(programId);
        if (result) {
          programData = {
            programId: result.program.programId,
            title: result.program.title,
            description: result.program.description,
            coverImageUrl: result.program.coverImageUrl,
            scheduleType: result.program.scheduleType,
            totalDays: result.program.totalDays,
            status: result.program.status,
          };
          moments = result.moments;
        }
      }
      
      res.set('Cache-Control', 'public, max-age=60');
      
      res.json({
        ok: true,
        mode: viewType === 'create_product' ? 'create' : 'display',
        viewType,
        storeId,
        channelId,
        entityType,
        entityId,
        storeOwner: storeOwner || undefined,
        programId: programId || undefined,
        program: programData || undefined,
        items,
        moments,
        display: {
          entityName,
          entityLogoUrl,
          placement: payload.placement,
          mode,
          returnUrl: payload.returnUrl,
          theme: payload.theme,
        },
        capabilities,
      });
    } catch (error: any) {
      console.error("Widget session error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/widget/token", async (req, res) => {
    try {
      const { verifyKCServiceAuth, mintWidgetToken, mintTokenInputSchema } = await import("../lib/widget-auth");
      
      const authHeader = req.headers['x-api-key'] as string || req.headers['authorization'];
      const authResult = await verifyKCServiceAuth(authHeader);
      
      if (!authResult.valid) {
        return res.status(401).json({ ok: false, error: authResult.error || "Unauthorized" });
      }
      
      const parsed = mintTokenInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          ok: false, 
          error: "Invalid token request", 
          details: parsed.error.errors 
        });
      }
      
      const { token, expiresIn } = mintWidgetToken(parsed.data);
      
      const channelId = parsed.data.target?.channelId || `${parsed.data.entityType}_${parsed.data.entityId}`;
      const storeId = parsed.data.storeOwner
        ? `${parsed.data.storeOwner.ownerType}:${parsed.data.storeOwner.ownerId}`
        : `${parsed.data.entityType}_${parsed.data.entityId}`;
      
      console.log(`[WidgetToken] Minted token for ${storeId} viewType=${parsed.data.viewType}`);
      
      res.json({ 
        ok: true,
        token,
        expiresIn,
        channelId,
        storeId,
        viewType: parsed.data.viewType || 'channel_products',
        widgetUrl: `${process.env.VITE_BASE_URL || 'https://qrgear-c1ffd.web.app'}/widget?token=${encodeURIComponent(token)}`,
      });
    } catch (error: any) {
      console.error("[WidgetToken] Mint error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/verify", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.json({ valid: false, error: "No token provided" });
      }
      
      const { normalizeWidgetPayload } = await import("../lib/widget-auth");
      const payload = verifyWidgetToken(token);
      
      if (!payload) {
        return res.json({ valid: false, error: "Invalid or expired token" });
      }
      
      const normalized = normalizeWidgetPayload(payload);
      
      res.json({
        valid: true,
        payload: {
          ...normalized,
          returnUrl: payload.returnUrl,
          theme: payload.theme,
        }
      });
    } catch (error: any) {
      console.error("[Widget] Verify error:", error);
      res.json({ valid: false, error: error.message });
    }
  });

  app.get("/api/widget/items", widgetCorsMiddleware, async (req, res) => {
    try {
      const { channelId, storeId } = req.query;
      
      if (!channelId || typeof channelId !== 'string') {
        return res.status(400).json({ error: "channelId is required" });
      }
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('catalogItemLinks')
        .where('channelId', '==', channelId)
        .where('status', '==', 'published')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      const memberSnapshot = await firestoreDb.collection('memberLibraryLinks')
        .where('channelId', '==', channelId)
        .where('status', '==', 'published')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      const items = [
        ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...memberSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];
      
      items.sort((a: any, b: any) => {
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bDate.getTime() - aDate.getTime();
      });
      
      res.json({ items: items.slice(0, 50) });
    } catch (error: any) {
      console.error("[Widget] Items error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/widget/events", widgetCorsMiddleware, (req, res) => {
    res.json({
      events: [
        { type: "qrgear:ready", description: "Widget has loaded and is ready", data: { viewType: "string" } },
        { type: "qrgear:height", description: "Widget height changed", data: { height: "number" } },
        { type: "qrgear:navigate", description: "User clicked return/back", data: { returnUrl: "string" } },
        { type: "qrgear:item_click", description: "User clicked on an item", data: { itemId: "string", packetId: "string" } },
        { type: "qrgear:item_share", description: "User shared an item", data: { itemId: "string", packetId: "string" } },
        { type: "qrgear:share_copied", description: "Share URL copied to clipboard", data: { url: "string" } },
        { type: "qrgear:create_start", description: "Admin started create flow", data: { channelId: "string" } },
        { type: "qrgear:publish_success", description: "Product published successfully", data: { productId: "string", channelId: "string" } },
        { type: "qrgear:program_started", description: "User started a program/series", data: { programId: "string" } },
        { type: "qrgear:checkout_start", description: "User started checkout" },
        { type: "qrgear:checkout_complete", description: "User completed checkout" },
      ]
    });
  });

  app.post("/api/widget/programs", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.headers['x-widget-token'] as string;
      if (!token) return res.status(401).json({ ok: false, error: "Widget token required" });

      const payload = verifyWidgetToken(token);
      if (!payload) return res.status(401).json({ ok: false, error: "Invalid token" });

      const { normalizeWidgetPayload } = await import("../lib/widget-auth");
      const normalized = normalizeWidgetPayload(payload);

      if (!normalized.capabilities.canCreate && !normalized.capabilities.canManage) {
        return res.status(403).json({ ok: false, error: "No create/manage permission" });
      }

      const { createProgram } = await import("../lib/programService");
      const program = await createProgram({
        storeId: normalized.storeId,
        channelId: req.body.channelId || normalized.channelId,
        title: req.body.title,
        description: req.body.description,
        coverImageUrl: req.body.coverImageUrl,
        scheduleType: req.body.scheduleType,
        entries: req.body.entries,
      });

      res.json({ ok: true, program });
    } catch (error: any) {
      console.error("[Widget] Create program error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/programs/:programId", widgetCorsMiddleware, async (req, res) => {
    try {
      const { getProgram } = await import("../lib/programService");
      const program = await getProgram(req.params.programId);
      if (!program) return res.status(404).json({ ok: false, error: "Program not found" });
      res.json({ ok: true, program });
    } catch (error: any) {
      console.error("[Widget] Get program error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/programs/:programId/moments", widgetCorsMiddleware, async (req, res) => {
    try {
      const { getProgramMoments } = await import("../lib/programService");
      const result = await getProgramMoments(req.params.programId);
      if (!result) return res.status(404).json({ ok: false, error: "Program not found" });
      res.json({ ok: true, program: result.program, moments: result.moments });
    } catch (error: any) {
      console.error("[Widget] Get program moments error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.patch("/api/widget/programs/:programId", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.headers['x-widget-token'] as string;
      if (!token) return res.status(401).json({ ok: false, error: "Widget token required" });

      const payload = verifyWidgetToken(token);
      if (!payload) return res.status(401).json({ ok: false, error: "Invalid token" });

      const { normalizeWidgetPayload } = await import("../lib/widget-auth");
      const normalized = normalizeWidgetPayload(payload);

      if (!normalized.capabilities.canManage) {
        return res.status(403).json({ ok: false, error: "No manage permission" });
      }

      const { updateProgram } = await import("../lib/programService");
      const success = await updateProgram(req.params.programId, req.body);
      if (!success) return res.status(500).json({ ok: false, error: "Update failed" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Widget] Update program error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/stores/:storeId/programs", widgetCorsMiddleware, async (req, res) => {
    try {
      const { getProgramsByStore } = await import("../lib/programService");
      const programs = await getProgramsByStore(req.params.storeId);
      res.json({ ok: true, programs });
    } catch (error: any) {
      console.error("[Widget] List programs error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/partner/products", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const expectedKey = process.env.WIDGET_API_KEY;
      
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid or missing API key" });
      }
      
      const { partnerId, context, slug } = req.query;
      
      if (!partnerId || typeof partnerId !== 'string') {
        return res.status(400).json({ error: "partnerId query parameter required" });
      }
      
      const store = await storage.getPartnerStoreBySlug(partnerId);
      if (!store || !store.isActive) {
        return res.status(404).json({ error: "Partner not found or inactive" });
      }
      
      const storeProducts = await storage.getPartnerStoreProducts(store.id);
      const enabledProducts = storeProducts.filter(sp => sp.isEnabled);
      
      const productDetails = await Promise.all(
        enabledProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          if (!product || !product.isEnabled) return null;
          
          return {
            id: product.id,
            blueprintId: product.blueprintId,
            name: sp.customName || product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            basePrice: sp.customPrice || product.basePrice,
            category: product.category,
            kcBusinessSlug: sp.kcBusinessSlug,
            sortOrder: sp.sortOrder,
          };
        })
      );
      
      let filteredProducts = productDetails.filter(Boolean);
      
      if (context === 'listing' && slug && typeof slug === 'string') {
        filteredProducts = filteredProducts.filter((p: any) => p.kcBusinessSlug === slug);
      } else if (context === 'homepage') {
        filteredProducts = filteredProducts.filter((p: any) => !p.kcBusinessSlug);
      }
      
      res.json({
        partner: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          primaryColor: store.primaryColor,
          accentColor: store.accentColor,
        },
        products: filteredProducts.sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      });
    } catch (error: any) {
      console.error("Partner API error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
