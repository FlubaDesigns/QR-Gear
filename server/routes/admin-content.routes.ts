import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { z } from "zod";
import { fsGetAll, fsGet, fsInsert, fsUpdate, fsDelete, fsQuery } from "../lib/firestore-crud";

export function registerAdminContentRoutes(app: Express): void {
  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      
      const enrichedProducts = await Promise.all(
        storeProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          return {
            ...sp,
            availableSizes: product?.availableSizes || [],
            availableColors: product?.availableColors || [],
          };
        })
      );
      
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const { productIds } = req.body;
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: "productIds must be an array" });
      }
      await storage.syncPartnerStoreProducts(req.params.id, productIds);
      const products = await storage.getPartnerStoreProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/partner-stores/:storeId/products/:productId", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { enabledSizes, enabledColors, defaultColor, kcPlacements, kcBusinessSlug, customPrice, customName, isEnabled } = req.body;
      
      const updated = await storage.updatePartnerStoreProductByIds(storeId, productId, {
        enabledSizes,
        enabledColors,
        defaultColor,
        kcPlacements,
        kcBusinessSlug,
        customPrice,
        customName,
        isEnabled,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Partner store product not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores/:storeId/products/:productId/generate-mockup", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { color } = req.body;
      
      if (!color) {
        return res.status(400).json({ error: "color is required" });
      }
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const blueprintId = product.blueprintId;
      const printProviderId = product.printProviderId;
      
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      let artworkUrl: string | null = null;
      
      if (productId.startsWith('custom_')) {
        const designId = productId.replace('custom_', '');
        const design = await storage.getCustomDesign(designId);
        if (design) {
          let designPlacements: Record<string, string> = {};
          try {
            if (typeof design.placementImages === 'string') {
              designPlacements = JSON.parse(design.placementImages);
            } else if (design.placementImages && typeof design.placementImages === 'object') {
              designPlacements = design.placementImages as Record<string, string>;
            }
          } catch (e) {
            console.error('[Mockup] Failed to parse placementImages:', e);
          }
          
          const { getProviderColorsWithFallback } = await import("../lib/printify");
          const colors = await getProviderColorsWithFallback(blueprintId, printProviderId, storage);
          const colorInfo = colors.find(
            (c: any) => c.name?.toLowerCase() === color.toLowerCase()
          );
          const colorHex = colorInfo?.hex || null;
          
          const { isColorDark } = await import('../lib/composite-image-generator.js');
          
          const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
          
          const blackArtwork = designPlacements["front"] || designPlacements["front-chest"] || designPlacements["front-chest-black"];
          const whiteArtwork = designPlacements["front-white"] || designPlacements["front-chest-white"];
          
          if (needsWhiteQR && whiteArtwork) {
            artworkUrl = whiteArtwork;
            console.log(`[Mockup] Using WHITE artwork for dark shirt color: ${color} (${colorHex})`);
          } else if (blackArtwork) {
            artworkUrl = blackArtwork;
            console.log(`[Mockup] Using BLACK artwork for light shirt color: ${color} (${colorHex})`);
          } else {
            artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
          }
        }
      }
      
      if (!artworkUrl) {
        return res.status(400).json({ error: "No artwork found for this product" });
      }
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const absoluteArtworkUrl = artworkUrl.startsWith('http') ? artworkUrl : `${baseUrl}${artworkUrl}`;
      
      console.log(`[Mockup] Generating for product ${productId}, color ${color}`);
      console.log(`[Mockup] Blueprint: ${blueprintId}, Provider: ${printProviderId}`);
      console.log(`[Mockup] Artwork: ${absoluteArtworkUrl}`);
      
      const { printify: printifyClient, syncProductVariants: syncVariants, syncProductPlacements: syncPlacements } = await import("../lib/printify");
      
      const { variants } = await syncVariants(blueprintId, printProviderId);
      const colorVariants = variants.filter(v => 
        v.options?.color && v.options.color.toLowerCase() === color.toLowerCase()
      );
      
      if (colorVariants.length === 0) {
        return res.status(400).json({ error: `No variants found for color: ${color}` });
      }
      
      const variantIds = colorVariants.slice(0, 1).map(v => v.id);
      console.log(`[Mockup] Found ${colorVariants.length} variants for ${color}, using: ${variantIds[0]}`);
      
      const imageUpload = await printifyClient.uploadImage(absoluteArtworkUrl, `mockup-${productId}-${color}.png`);
      console.log(`[Mockup] Uploaded image ID: ${imageUpload.id}`);
      
      const { placements: providerPlacements } = await syncPlacements(blueprintId, printProviderId);
      const placement = providerPlacements[0]?.position || "front";
      
      const productData = {
        title: `Mockup - ${product.name} - ${color}`,
        description: `Mockup generation for ${color}`,
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantIds.map(vid => ({
          id: vid,
          price: 2500,
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{
            position: placement,
            images: [{
              id: imageUpload.id,
              x: 0.5,
              y: 0.5,
              scale: 1.0,
              angle: 0,
            }],
          }],
        }],
      };
      
      const printifyProduct = await printifyClient.createProduct(productData);
      console.log(`[Mockup] Created Printify product: ${printifyProduct.id}`);
      
      let attempts = 0;
      const maxAttempts = 10;
      let mockupUrl: string | null = null;
      
      while (attempts < maxAttempts && !mockupUrl) {
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        
        const productDetails = await printifyClient.getProduct(printifyProduct.id);
        if (productDetails.images && productDetails.images.length > 0) {
          mockupUrl = productDetails.images[0].src;
          console.log(`[Mockup] Got mockup URL: ${mockupUrl}`);
        }
      }
      
      if (!mockupUrl) {
        await printifyClient.deleteProduct(printifyProduct.id).catch(() => {});
        return res.status(500).json({ error: "Mockup generation timed out" });
      }
      
      const storeProduct = await storage.getPartnerStoreProduct(storeId, productId);
      const existingMockups = (storeProduct?.mockupsByColor as Record<string, any>) || {};
      existingMockups[color] = { front: mockupUrl };
      
      await storage.updatePartnerStoreProductByIds(storeId, productId, {
        mockupsByColor: existingMockups,
      });
      
      await printifyClient.deleteProduct(printifyProduct.id).catch(() => {});
      
      console.log(`[Mockup] Saved mockup for ${color}`);
      res.json({ success: true, color, mockupUrl, mockupsByColor: existingMockups });
    } catch (error: any) {
      console.error("[Mockup] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/graphics/save", isAdmin, async (req, res) => {
    try {
      const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId, qrContent, pricing } = req.body;

      const baseMetadata: Record<string, any> = {};
      if (storeId) baseMetadata.storeId = storeId;
      if (channelId) baseMetadata.channelId = channelId;
      if (qrContent) baseMetadata.qrContent = qrContent;
      if (pricing) baseMetadata.pricing = pricing;

      let qrAsset = null;
      let compositeAsset = null;

      if (qrOnlyUrl) {
        qrAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - QR Only`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: qrOnlyUrl,
          storageUrl: qrOnlyUrl,
          thumbnailUrl: qrOnlyUrl,
          fileName: `qr-only-${Date.now()}.png`,
          originalName: `qr-only.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "qr-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isQrOnly: true },
        } as any);
      }

      if (compositeUrl) {
        compositeAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - Composite`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: compositeUrl,
          storageUrl: compositeUrl,
          thumbnailUrl: compositeUrl,
          fileName: `composite-${Date.now()}.png`,
          originalName: `composite.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "composite-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isComposite: true },
        } as any);
      }

      const savedParts = [qrAsset ? 'QR' : null, compositeAsset ? 'Composite' : null].filter(Boolean).join(' + ');
      console.log(`[Graphics] Saved graphics: ${savedParts}`);

      res.json({
        success: true,
        qrAsset,
        compositeAsset,
        qrAssetId: qrAsset?.id,
        compositeAssetId: compositeAsset?.id,
        message: "Graphics saved to library",
      });
    } catch (error: any) {
      console.error("[Graphics] Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/published-compose-items", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('packets')
        .where('status', '==', 'published')
        .get();
      const items = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((p: any) => ['qr-canvas', 'qr-play'].includes(p.packetType || p.type));
      res.json({ items });
    } catch (error: any) {
      console.error("[ComposeItems] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/compose/publish", isAdmin, async (req: any, res) => {
    try {
      const { composeItems, composeMode, composeHostingTerm, productId, blueprintId, color, colorHex } = req.body;
      if (!composeItems || !Array.isArray(composeItems) || composeItems.length === 0) {
        return res.status(400).json({ error: 'At least one compose item is required' });
      }
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const nowEpoch = Math.floor(Date.now() / 1000);
      const instanceData = {
        createdAt: nowEpoch,
        startTimestamp: nowEpoch,
        mode: composeMode || 'auto-rotate',
        hostingTerm: composeHostingTerm || '1-year',
        productId: productId || null,
        blueprintId: blueprintId || null,
        color: color || null,
        colorHex: colorHex || null,
        slots: composeItems.map((item: any, index: number) => ({
          slotId: item.slotId || `slot-${Date.now()}-${index}`,
          packetId: item.packetId || item.id,
          durationSeconds: item.durationSeconds || 86400,
          order: item.order ?? index + 1,
        })),
      };
      const docRef = await fsDb.collection("qr_dynamics_instances").add(instanceData);
      console.log(`[ComposePublish] Created instance ${docRef.id} with ${composeItems.length} slots`);
      res.json({ success: true, instanceId: docRef.id, composeInstanceId: docRef.id });
    } catch (error: any) {
      console.error("[ComposePublish] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/nexusmail/status", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const outboxSnapshot = await fsDb.collection('email_outbox').get();
      const records = outboxSnapshot.docs.map((doc: any) => doc.data());
      const queued = records.filter((r: any) => r.status === 'queued').length;
      const sending = records.filter((r: any) => r.status === 'sending').length;
      const sent = records.filter((r: any) => r.status === 'sent').length;
      const failed = records.filter((r: any) => r.status === 'failed').length;
      const dead = records.filter((r: any) => r.status === 'dead').length;
      const consecutiveFailures = records.filter((r: any) => r.status === 'failed').length;
      res.json({
        ready: true,
        provider: process.env.RESEND_API_KEY ? 'resend' : 'none',
        health: {
          score: failed > 5 ? 50 : 100,
          status: failed > 5 ? 'degraded' : 'healthy',
          consecutiveFailures,
          isPaused: false,
        },
        outboxStats: { queued, sending, sent, failed, dead },
      });
    } catch (error: any) {
      console.error("[NexusMail] Status error:", error);
      res.json({
        ready: false,
        provider: 'none',
        health: { score: 0, status: 'unhealthy', consecutiveFailures: 0, isPaused: false },
        outboxStats: { queued: 0, sending: 0, sent: 0, failed: 0, dead: 0 },
      });
    }
  });

  app.get("/api/admin/nexusmail/outbox", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('email_outbox').orderBy('createdAt', 'desc').limit(50).get();
      const records = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json({ records });
    } catch (error: any) {
      console.error("[NexusMail] Outbox error:", error);
      res.json({ records: [] });
    }
  });

  app.post("/api/admin/nexusmail/process-outbox", isAdmin, async (req: any, res) => {
    try {
      const limit = req.body?.limit || 10;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('email_outbox')
        .where('status', '==', 'queued')
        .limit(limit)
        .get();
      let processed = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        try {
          if (process.env.RESEND_API_KEY) {
            const { Resend } = await import("resend");
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
              from: data.from || 'QR Gear <noreply@qrgear.com>',
              to: data.to,
              subject: data.subject,
              html: data.html || data.body || '',
            });
          }
          await doc.ref.update({ status: 'sent', sentAt: new Date().toISOString() });
          processed++;
        } catch (sendErr: any) {
          await doc.ref.update({ status: 'failed', lastError: sendErr.message, retryCount: (data.retryCount || 0) + 1 });
        }
      }
      res.json({ success: true, processed, total: snapshot.size });
    } catch (error: any) {
      console.error("[NexusMail] Process error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/nexusmail/retry-failed", isAdmin, async (req: any, res) => {
    try {
      const limit = req.body?.limit || 10;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('email_outbox')
        .where('status', '==', 'failed')
        .limit(limit)
        .get();
      let retried = 0;
      for (const doc of snapshot.docs) {
        await doc.ref.update({ status: 'queued', lastError: null });
        retried++;
      }
      res.json({ success: true, retried });
    } catch (error: any) {
      console.error("[NexusMail] Retry error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/nexusmail/seed-templates", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const defaults = [
        { slug: 'order-confirmation', name: 'Order Confirmation', subject: 'Your QR Gear Order Confirmation', body: '<h1>Thank you for your order!</h1><p>Your order {{orderId}} has been received.</p>' },
        { slug: 'shipping-notification', name: 'Shipping Notification', subject: 'Your QR Gear Order Has Shipped', body: '<h1>Your order is on its way!</h1><p>Tracking: {{trackingNumber}}</p>' },
        { slug: 'welcome', name: 'Welcome Email', subject: 'Welcome to QR Gear!', body: '<h1>Welcome to QR Gear!</h1><p>We are excited to have you.</p>' },
      ];
      let created = 0;
      for (const tpl of defaults) {
        const existing = await fsDb.collection('email_templates').where('slug', '==', tpl.slug).get();
        if (existing.empty) {
          await fsDb.collection('email_templates').add({ ...tpl, createdAt: new Date().toISOString() });
          created++;
        }
      }
      res.json({ success: true, created, total: defaults.length });
    } catch (error: any) {
      console.error("[NexusMail] Seed templates error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/shelf-groups", isAdmin, async (_req: any, res) => {
    try {
      const groups = await fsGetAll("admin_shelf_groups", "sortOrder", "asc");
      res.json(groups);
    } catch (error: any) {
      console.error("[BuildShelf] List groups error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/shelf-groups", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100),
        sortOrder: z.number().int().optional().default(0),
      });
      const parsed = schema.parse(req.body);

      const existing = await fsQuery("admin_shelf_groups", [["name", "==", parsed.name]]);
      if (existing.length > 0) {
        return res.status(409).json({ error: "A group with that name already exists" });
      }

      const group = await fsInsert("admin_shelf_groups", parsed);
      res.json(group);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Create group error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/shelf-groups/:id", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        sortOrder: z.number().int().optional(),
      });
      const parsed = schema.parse(req.body);

      if (parsed.name) {
        const existing = await fsQuery("admin_shelf_groups", [["name", "==", parsed.name]]);
        if (existing.length > 0 && existing[0].id !== req.params.id) {
          return res.status(409).json({ error: "A group with that name already exists" });
        }
      }

      const updated = await fsUpdate("admin_shelf_groups", req.params.id, parsed);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Update group error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/shelf-groups/:id", isAdmin, async (req: any, res) => {
    try {
      await fsDelete("admin_shelf_groups", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[BuildShelf] Delete group error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/build-shelf", isAdmin, async (req: any, res) => {
    try {
      const { provider, groupId } = req.query;
      let items;

      if (groupId) {
        items = await fsQuery("admin_build_shelf", [["groupIds", "array-contains", groupId]], "createdAt", "desc");
      } else {
        items = await fsGetAll("admin_build_shelf", "createdAt", "desc");
      }

      if (provider) {
        items = items.filter((item: any) => item.providerId === provider);
      }

      res.json(items);
    } catch (error: any) {
      console.error("[BuildShelf] List items error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/build-shelf", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        providerId: z.string().min(1),
        catalogId: z.string().min(1),
        catalog: z.record(z.any()),
        groupIds: z.array(z.string()).optional().default([]),
      });
      const parsed = schema.parse(req.body);

      const key = `${parsed.providerId}:${parsed.catalogId}`;

      const existing = await fsQuery("admin_build_shelf", [["shelfKey", "==", key]]);
      if (existing.length > 0) {
        const updated = await fsUpdate("admin_build_shelf", existing[0].id, {
          catalog: parsed.catalog,
          groupIds: parsed.groupIds,
        });
        return res.json(updated);
      }

      const item = await fsInsert("admin_build_shelf", {
        shelfKey: key,
        providerId: parsed.providerId,
        catalogId: parsed.catalogId,
        catalog: parsed.catalog,
        groupIds: parsed.groupIds,
      });
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Add item error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/build-shelf/:id", isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        groupIds: z.array(z.string()).optional(),
        catalog: z.record(z.any()).optional(),
      });
      const parsed = schema.parse(req.body);
      const updated = await fsUpdate("admin_build_shelf", req.params.id, parsed);
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      console.error("[BuildShelf] Update item error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/build-shelf/:id", isAdmin, async (req: any, res) => {
    try {
      await fsDelete("admin_build_shelf", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[BuildShelf] Delete item error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog/printful", isAdmin, async (req: any, res) => {
    try {
      const products = await fsGetAll('printful_products', 'lastSyncedAt', 'desc');
      const result = products.map((p: any) => ({
        docId: p.id,
        id: typeof p.id === 'string' ? parseInt(p.id, 10) || p.id : p.id,
        title: p.title || "",
        brand: p.brand || null,
        model: p.model || null,
        image: p.image || null,
        variantCount: p.variantCount || 0,
        category: p.typeName || p.type || "Other",
        description: p.description || null,
        type: p.typeName || p.type || null,
      }));
      res.json(result);
    } catch (error: any) {
      console.error("[Catalog/Printful] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog/printful-mappings", isAdmin, async (req: any, res) => {
    try {
      const firestoreMappings = await fsGetAll("printful_mappings");
      res.json({ firestoreMappings, hardcodedMappings: [] });
    } catch (error: any) {
      console.error("[Catalog/PrintfulMappings] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalogs", isAdmin, async (req: any, res) => {
    try {
      const catalogs = await fsGetAll("catalogs", "createdAt", "desc");
      res.json({ catalogs });
    } catch (error: any) {
      console.error("[Catalogs] List error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs", isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "name is required" });
      const catalog = await fsInsert("catalogs", {
        name: name.trim(),
        description: (description || "").trim(),
        blankIds: [],
        blankTiers: {},
        tierConfig: {},
        blankDescriptions: {},
      });
      res.json(catalog);
    } catch (error: any) {
      console.error("[Catalogs] Create error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/catalogs/:id", isAdmin, async (req: any, res) => {
    try {
      const { name, description } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = (description || "").trim();
      const updated = await fsUpdate("catalogs", req.params.id, updates);
      res.json(updated);
    } catch (error: any) {
      console.error("[Catalogs] Update error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/catalogs/:id", isAdmin, async (req: any, res) => {
    try {
      await fsDelete("catalogs", req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Catalogs] Delete error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/duplicate", isAdmin, async (req: any, res) => {
    try {
      const source = await fsGet("catalogs", req.params.id);
      if (!source) return res.status(404).json({ error: "Catalog not found" });
      const duplicate = await fsInsert("catalogs", {
        name: `${source.name} (Copy)`,
        description: source.description || "",
        blankIds: source.blankIds || [],
        blankTiers: source.blankTiers || {},
        tierConfig: source.tierConfig || {},
        blankDescriptions: source.blankDescriptions || {},
      });
      res.json(duplicate);
    } catch (error: any) {
      console.error("[Catalogs] Duplicate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/blanks", isAdmin, async (req: any, res) => {
    try {
      const { blankIds } = req.body;
      if (!Array.isArray(blankIds)) return res.status(400).json({ error: "blankIds must be an array" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const existing = new Set(catalog.blankIds || []);
      const newIds = blankIds.map(String).filter((id: string) => !existing.has(id));
      const merged = [...(catalog.blankIds || []), ...newIds];
      await fsUpdate("catalogs", req.params.id, { blankIds: merged });
      res.json({ success: true, added: newIds.length, total: merged.length });
    } catch (error: any) {
      console.error("[Catalogs] Add blanks error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/catalogs/:id/blanks", isAdmin, async (req: any, res) => {
    try {
      const { blankIds } = req.body;
      if (!Array.isArray(blankIds)) return res.status(400).json({ error: "blankIds must be an array" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const removeSet = new Set(blankIds.map(String));
      const remaining = (catalog.blankIds || []).filter((id: string) => !removeSet.has(id));
      const blankTiers = { ...(catalog.blankTiers || {}) };
      const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
      blankIds.forEach((id: string) => { delete blankTiers[String(id)]; delete blankDescriptions[String(id)]; });
      await fsUpdate("catalogs", req.params.id, { blankIds: remaining, blankTiers, blankDescriptions });
      res.json({ success: true, removed: blankIds.length, total: remaining.length });
    } catch (error: any) {
      console.error("[Catalogs] Remove blanks error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/catalogs/:id/bulk-copy", isAdmin, async (req: any, res) => {
    try {
      const { targetCatalogId, blankIds } = req.body;
      if (!targetCatalogId || !Array.isArray(blankIds)) return res.status(400).json({ error: "targetCatalogId and blankIds required" });
      const target = await fsGet("catalogs", targetCatalogId);
      if (!target) return res.status(404).json({ error: "Target catalog not found" });
      const existing = new Set(target.blankIds || []);
      const newIds = blankIds.map(String).filter((id: string) => !existing.has(id));
      const merged = [...(target.blankIds || []), ...newIds];
      await fsUpdate("catalogs", targetCatalogId, { blankIds: merged });
      res.json({ success: true, added: newIds.length, total: merged.length });
    } catch (error: any) {
      console.error("[Catalogs] Bulk copy error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-tier", isAdmin, async (req: any, res) => {
    try {
      const { blankId, tier } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const blankTiers = { ...(catalog.blankTiers || {}) };
      if (tier) {
        blankTiers[String(blankId)] = tier;
      } else {
        delete blankTiers[String(blankId)];
      }
      await fsUpdate("catalogs", req.params.id, { blankTiers });
      res.json({ success: true, blankTiers });
    } catch (error: any) {
      console.error("[Catalogs] Set blank tier error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalogs/:id/blank-description", isAdmin, async (req: any, res) => {
    try {
      const { blankId, description } = req.body;
      if (!blankId) return res.status(400).json({ error: "blankId is required" });
      const catalog = await fsGet("catalogs", req.params.id);
      if (!catalog) return res.status(404).json({ error: "Catalog not found" });
      const blankDescriptions = { ...(catalog.blankDescriptions || {}) };
      if (description) {
        blankDescriptions[String(blankId)] = description;
      } else {
        delete blankDescriptions[String(blankId)];
      }
      await fsUpdate("catalogs", req.params.id, { blankDescriptions });
      res.json({ success: true, blankDescriptions });
    } catch (error: any) {
      console.error("[Catalogs] Set blank description error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog-defaults", isAdmin, async (req: any, res) => {
    try {
      const doc = await fsGet("systemSettings", "catalog-defaults");
      res.json({ defaultCatalogId: doc?.defaultCatalogId || null });
    } catch (error: any) {
      console.error("[CatalogDefaults] Get error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalog-defaults", isAdmin, async (req: any, res) => {
    try {
      const { defaultCatalogId } = req.body;
      const { fsUpsert } = await import("../lib/firestore-crud");
      await fsUpsert("systemSettings", "catalog-defaults", { defaultCatalogId: defaultCatalogId || null });
      res.json({ success: true, defaultCatalogId: defaultCatalogId || null });
    } catch (error: any) {
      console.error("[CatalogDefaults] Set error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/catalog-assignments", isAdmin, async (req: any, res) => {
    try {
      const doc = await fsGet("systemSettings", "catalog-assignments");
      res.json({
        member: doc?.member || null,
        public: doc?.public || null,
        external: doc?.external || null,
        marketplace: doc?.marketplace || null,
        platform: doc?.platform || null,
      });
    } catch (error: any) {
      console.error("[CatalogAssignments] Get error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/catalog-assignments", isAdmin, async (req: any, res) => {
    try {
      const { member, public: pub, external, marketplace, platform } = req.body;
      const { fsUpsert } = await import("../lib/firestore-crud");
      const updates: any = {};
      if (member !== undefined) updates.member = member;
      if (pub !== undefined) updates.public = pub;
      if (external !== undefined) updates.external = external;
      if (marketplace !== undefined) updates.marketplace = marketplace;
      if (platform !== undefined) updates.platform = platform;
      await fsUpsert("systemSettings", "catalog-assignments", updates);
      res.json({ success: true, ...updates });
    } catch (error: any) {
      console.error("[CatalogAssignments] Set error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
