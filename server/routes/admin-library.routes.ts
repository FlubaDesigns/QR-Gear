import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin, isAuthenticated } from "../firebaseAuth";
import { uploadImageFromBuffer } from "../lib/image-upload";
import { generatePrintifyComposite } from "../lib/composite-image-generator";
import QRCode from "qrcode";

export function registerAdminLibraryRoutes(app: Express): void {
  // ============ LIBRARY ASSET ENDPOINTS ============

  // Admin: Get all library assets with optional filters
  app.get("/api/admin/library", isAdmin, async (req: any, res) => {
    try {
      const { ownerType, assetType, mediaType, category, season, event } = req.query;
      const assets = await storage.getLibraryAssets({ 
        ownerType, assetType, mediaType, category, season, event 
      });
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get admin-owned library assets
  app.get("/api/admin/library/admin", isAdmin, async (req: any, res) => {
    try {
      const { assetType, mediaType, category, season, event } = req.query;
      const assets = await storage.getAdminLibraryAssets({ 
        assetType, mediaType, category, season, event 
      });
      
      // Add proxyUrl to each asset for authenticated frontend display
      const assetsWithProxy = assets.map(asset => {
        const filename = (asset.storageUrl || '').split('/').pop() || '';
        return {
          ...asset,
          proxyUrl: asset.storageUrl ? `/api/library-files/${encodeURIComponent(filename)}` : null,
        };
      });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get library templates (custom designs saved to library)
  app.get("/api/admin/library/templates", isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getCustomDesignsForLibrary();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEMPLATE CATEGORY ENDPOINTS ============

  // Admin: Get all template categories (hierarchical)
  app.get("/api/admin/template-categories", isAdmin, async (req: any, res) => {
    try {
      const categories = await storage.getTemplateCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get template categories by parent (null for top-level)
  app.get("/api/admin/template-categories/by-parent", isAdmin, async (req: any, res) => {
    try {
      const { parentId } = req.query;
      const categories = await storage.getTemplateCategoriesByParent(parentId || null);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create template category
  app.post("/api/admin/template-categories", isAdmin, async (req: any, res) => {
    try {
      const category = await storage.createTemplateCategory(req.body);
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update template category
  app.put("/api/admin/template-categories/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateTemplateCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Template category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete template category (soft delete)
  app.delete("/api/admin/template-categories/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteTemplateCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // GRAPHIC SETS ROUTES
  // ============================================

  // Admin: Get all graphic sets
  app.get("/api/admin/graphic-sets", isAdmin, async (req: any, res) => {
    try {
      const graphicSets = await storage.getGraphicSets();
      res.json(graphicSets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get graphic set by ID
  app.get("/api/admin/graphic-sets/:id", isAdmin, async (req: any, res) => {
    try {
      const graphicSet = await storage.getGraphicSet(req.params.id);
      if (!graphicSet) {
        return res.status(404).json({ error: "Graphic set not found" });
      }
      res.json(graphicSet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get graphic sets by category
  app.get("/api/admin/graphic-sets/category/:categoryId", isAdmin, async (req: any, res) => {
    try {
      const graphicSets = await storage.getGraphicSetsByCategory(req.params.categoryId);
      res.json(graphicSets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create graphic set with generated artwork
  app.post("/api/admin/graphic-sets", isAdmin, async (req: any, res) => {
    try {
      const { name, categoryId, subcategoryId, destinationUrl, description, topText, bottomText, qrContentType } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const graphicSetId = `gs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let fullGraphicUrl: string | null = null;
      let qrOnlyUrl: string | null = null;
      
      // Generate QR code image (standalone QR)
      const qrDestination = destinationUrl || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/dynamic/${graphicSetId}`;
      const qrBuffer = await QRCode.toBuffer(qrDestination, {
        width: 1000,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      
      // Upload QR-only image to Firebase Storage
      const qrFileName = `qr-only-${graphicSetId}.png`;
      const qrUploadResult = await uploadImageFromBuffer(qrBuffer, qrFileName, 'image/png', `graphic-sets/${graphicSetId}`);
      qrOnlyUrl = qrUploadResult.publicUrl;
      
      // Generate full graphic (header + QR + footer) using composite generator
      if (topText || bottomText) {
        // generatePrintifyComposite returns a data URL string
        const compositeDataUrl = await generatePrintifyComposite(
          qrDestination,
          topText,
          bottomText,
          1200, // width
          1800, // height
          'black' // qrColor
        );
        
        // Convert data URL to buffer
        const base64Data = compositeDataUrl.replace(/^data:image\/png;base64,/, '');
        const compositeBuffer = Buffer.from(base64Data, 'base64');
        
        const fullFileName = `full-graphic-${graphicSetId}.png`;
        const fullUploadResult = await uploadImageFromBuffer(compositeBuffer, fullFileName, 'image/png', `graphic-sets/${graphicSetId}`);
        fullGraphicUrl = fullUploadResult.publicUrl;
      } else {
        // No text elements, use QR as full graphic
        fullGraphicUrl = qrOnlyUrl;
      }
      
      // Create the graphic set record
      const graphicSet = await storage.createGraphicSet({
        name,
        description: description || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        fullGraphicUrl,
        qrOnlyUrl,
        destinationUrl: destinationUrl || null,
        storagePath: `graphic-sets/${graphicSetId}`,
        isActive: true,
        isFeatured: false,
      });
      
      res.json(graphicSet);
    } catch (error: any) {
      console.error('[GraphicSet] Create error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update graphic set
  app.put("/api/admin/graphic-sets/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateGraphicSet(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Graphic set not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete graphic set (soft delete)
  app.delete("/api/admin/graphic-sets/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteGraphicSet(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Increment graphic set usage count
  app.post("/api/admin/graphic-sets/:id/use", isAdmin, async (req: any, res) => {
    try {
      await storage.incrementGraphicSetUsage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create library asset
  app.post("/api/admin/library", isAdmin, async (req: any, res) => {
    try {
      const asset = await storage.createLibraryAsset(req.body);
      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update library asset
  app.put("/api/admin/library/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateLibraryAsset(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Library asset not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete library asset
  app.delete("/api/admin/library/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteLibraryAsset(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Upload library asset to organized folder structure
  app.post("/api/admin/library/upload", isAdmin, async (req: any, res) => {
    try {
      const chunks: Buffer[] = [];
      let fileName = "upload";
      let mimeType = "image/png";
      let boundary = "";
      let assetType = "background";
      let mediaType = "image";
      let category = "";
      let season = "";
      let event = "";
      let name = "";
      let description = "";
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        boundary = boundaryMatch[1];
      }
      
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts: Buffer[] = [];
      let start = 0;
      
      while (true) {
        const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        if (start > 0) {
          parts.push(rawBody.slice(start, boundaryIndex - 2));
        }
        start = boundaryIndex + boundaryBuffer.length + 2;
      }
      
      let fileBuffer: Buffer | null = null;
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        } else if (nameMatch) {
          const fieldName = nameMatch[1];
          const fieldValue = body.toString().trim();
          if (fieldName === "assetType") assetType = fieldValue;
          else if (fieldName === "mediaType") mediaType = fieldValue;
          else if (fieldName === "category") category = fieldValue;
          else if (fieldName === "season") season = fieldValue;
          else if (fieldName === "event") event = fieldValue;
          else if (fieldName === "name") name = fieldValue;
          else if (fieldName === "description") description = fieldValue;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Determine folder path - CANONICAL PATH ONLY for backgrounds
      // ALL background assets go to library/backgrounds/raw/ - no subdirectories
      let folderPath = "libraries";
      if (assetType === "background") {
        folderPath = "library/backgrounds/raw"; // CANONICAL - no subdirectories
      } else if (assetType === "design") {
        folderPath = "libraries/designs";
      } else if (assetType === "video") {
        folderPath = "libraries/videos";
      }
      
      // Upload to object storage
      const uploadResult = await uploadImageFromBuffer(fileBuffer, fileName, mimeType, folderPath);
      
      // Create library asset record
      const asset = await storage.createLibraryAsset({
        ownerType: "admin",
        userId: null,
        assetType,
        mediaType: mimeType.startsWith("video") ? "video" : "image",
        name: name || fileName,
        originalName: fileName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        description: description || null,
        fileName: uploadResult.fileName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        category: category || null,
        season: season || null,
        event: event || null,
        tags: null,
        sortOrder: 0,
        isActive: true,
      });
      
      res.json(asset);
    } catch (error: any) {
      console.error("Library upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User: Get own library assets
  app.get("/api/library/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { assetType, mediaType } = req.query;
      const assets = await storage.getUserLibraryAssets(userId, { assetType, mediaType });
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User: Upload own library asset
  app.post("/api/library/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const chunks: Buffer[] = [];
      let fileName = "upload";
      let mimeType = "image/png";
      let boundary = "";
      let assetType = "background";
      let name = "";
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        boundary = boundaryMatch[1];
      }
      
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts: Buffer[] = [];
      let start = 0;
      
      while (true) {
        const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        if (start > 0) {
          parts.push(rawBody.slice(start, boundaryIndex - 2));
        }
        start = boundaryIndex + boundaryBuffer.length + 2;
      }
      
      let fileBuffer: Buffer | null = null;
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        } else if (nameMatch) {
          const fieldName = nameMatch[1];
          const fieldValue = body.toString().trim();
          if (fieldName === "assetType") assetType = fieldValue;
          else if (fieldName === "name") name = fieldValue;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // User folder structure
      const folderPath = `library/users/${userId}/${assetType}s`;
      
      const uploadResult = await uploadImageFromBuffer(fileBuffer, fileName, mimeType, folderPath);
      
      const asset = await storage.createLibraryAsset({
        ownerType: "user",
        userId,
        assetType,
        mediaType: mimeType.startsWith("video") ? "video" : "image",
        name: name || fileName,
        originalName: fileName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        description: null,
        fileName: uploadResult.fileName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        category: null,
        season: null,
        event: null,
        tags: null,
        sortOrder: 0,
        isActive: true,
      });
      
      res.json(asset);
    } catch (error: any) {
      console.error("User library upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Get partner store by slug (for widget embedding)
  // Optional query param: ?placement=homepage|dashboard|static_page to filter by kcPlacements
  app.get("/api/widget/stores/:slug", async (req, res) => {
    try {
      const store = await storage.getPartnerStoreBySlug(req.params.slug);
      if (!store || !store.isActive) {
        return res.status(404).json({ error: "Partner store not found" });
      }
      const storeProducts = await storage.getPartnerStoreProducts(store.id);
      
      // Filter by placement if provided
      const placement = req.query.placement as string | undefined;
      let filteredProducts = storeProducts.filter(sp => sp.isEnabled);
      if (placement) {
        filteredProducts = filteredProducts.filter(sp => 
          sp.kcPlacements && sp.kcPlacements.includes(placement)
        );
      }
      
      // Fetch actual product details including color options
      const productDetails = await Promise.all(
        filteredProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          if (!product || !product.isEnabled) return null;
          
          // Get available colors from the store product config or fall back to product's colors
          // Guard against null/malformed availableColors data
          let availableColors: string[] = [];
          if (sp.enabledColors && Array.isArray(sp.enabledColors)) {
            availableColors = sp.enabledColors;
          } else if (product.availableColors) {
            try {
              const parsed = typeof product.availableColors === 'string' 
                ? JSON.parse(product.availableColors) 
                : product.availableColors;
              if (Array.isArray(parsed)) {
                availableColors = parsed.map((c: any) => typeof c === 'string' ? c : (c?.name || ''));
              }
            } catch {
              availableColors = [];
            }
          }
          
          return {
            id: product.id,
            name: sp.customName || product.name,
            imageUrl: product.imageUrl,
            customPrice: sp.customPrice,
            sortOrder: sp.sortOrder,
            kcPlacements: sp.kcPlacements,
            selectedColors: availableColors,
            defaultColor: sp.defaultColor || availableColors[0] || null,
          };
        })
      );
      
      res.json({
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
        primaryColor: store.primaryColor,
        accentColor: store.accentColor,
        availableSegments: store.availableSegments,
        products: productDetails.filter(Boolean).sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Get store products by store type/name/channel/collection (for internal store pages)
  // Supports both legacy segment-based queries and the new channel/collection hierarchy.
  // Route: /api/store/:storeType/:storeName?channel=usa250&collection=armed-forces
  app.get("/api/store/:storeType/:storeName", async (req, res) => {
    try {
      const { storeType: rawStoreType, storeName } = req.params;
      const segment = req.query.segment as string | undefined;
      const channel = req.query.channel as string | undefined;
      const collection = req.query.collection as string | undefined;

      const normalizedType = rawStoreType.toLowerCase();
      if (!["internal", "external"].includes(normalizedType)) {
        return res.status(400).json({ error: "Invalid store type. Use 'internal' or 'external'" });
      }

      // ── Channel-scoped path: queries admin_catalog_instances ─────────────────
      if (channel) {
        const { getFirestoreDb } = await import("../lib/firebase-admin");
        const db = getFirestoreDb();

        // Resolve storeId from stores collection — match by name slug
        const storesSnap = await db.collection('stores')
          .where('roleType', '==', normalizedType)
          .limit(20)
          .get();

        let matchedStoreId: string | null = null;
        let matchedStoreName: string | null = null;
        for (const doc of storesSnap.docs) {
          const data = doc.data();
          const slug = (data.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          const slugCompact = slug.replace(/-/g, '');
          if (doc.id === storeName || slug === storeName || slugCompact === storeName) {
            matchedStoreId = doc.id;
            matchedStoreName = data.name || doc.id;
            break;
          }
        }

        // Fallback: resolve via the channel doc itself
        if (!matchedStoreId) {
          const chanDoc = await db.collection('storeChannels').doc(channel).get();
          if (chanDoc.exists) {
            const storeId = chanDoc.data()?.storeId;
            if (storeId) {
              const storeDoc = await db.collection('stores').doc(storeId).get();
              if (storeDoc.exists) {
                matchedStoreId = storeDoc.id;
                matchedStoreName = storeDoc.data()?.name || storeDoc.id;
              }
            }
          }
        }

        if (!matchedStoreId) {
          return res.status(404).json({ error: 'Store not found' });
        }

        // Verify channel belongs to this store
        const channelDoc = await db.collection('storeChannels').doc(channel).get();
        if (!channelDoc.exists || channelDoc.data()?.storeId !== matchedStoreId) {
          return res.status(404).json({ error: 'Channel not found in this store' });
        }
        const channelData = channelDoc.data() || {};

        // Query catalog instances
        const instancesSnap = await db.collection('admin_catalog_instances')
          .where('storeId', '==', matchedStoreId)
          .where('channelId', '==', channel)
          .get();

        const toSlug = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '-');
        const collectionSlug = collection ? toSlug(collection) : null;

        const toImgUrl = (img: any): string | null =>
          typeof img === 'string' ? img : (img?.url || null);
        const toStrArr = (arr: any[]): string[] =>
          (arr || []).map((v: any) => typeof v === 'string' ? v : v?.name || v?.label || String(v)).filter(Boolean);

        const buildOptions = (colors: string[], sizes: string[]) => {
          const opts: any[] = [];
          if (colors.length) opts.push({ name: 'Color', values: colors });
          if (sizes.length) opts.push({ name: 'Size', values: sizes });
          return opts;
        };

        const products = await Promise.all(
          instancesSnap.docs
            .filter((doc: any) => {
              const d = doc.data();
              if (d.isVisible === false || d.status === 'deleted' || d.status === 'archived') return false;
              if (!collection) return true;
              const name: string = d.collectionName || '';
              return name === collection || toSlug(name) === collectionSlug;
            })
            .map(async (doc: any) => {
              const d = doc.data();
              const resolved = d.resolved || {};
              let price: number | null = resolved.pricing?.customerPrice ?? null;

              const providerImgs = (resolved.images || []).map(toImgUrl).filter(Boolean) as string[];
              let packetImageUrl: string | null = null;
              let pktMockupImages: string[] = [];
              let pktMockupsByColor: Record<string, any> | null = null;
              let pktDefaultColor: string | null = null;

              if (d.currentPacketId) {
                try {
                  const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
                  if (pDoc.exists) {
                    const pkt = pDoc.data()!;
                    packetImageUrl = pkt.priorityMockupUrl || pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                    if (price === null && pkt.pricing?.customerPrice) price = pkt.pricing.customerPrice;
                    const byColor = pkt.mockupsByColor || {};
                    const colorKeys = Object.keys(byColor);
                    if (colorKeys.length) {
                      pktMockupsByColor = byColor;
                      pktDefaultColor = colorKeys[0];
                      colorKeys.forEach(c => {
                        const m = byColor[c];
                        const urls = [m.lifestyle, m.front, ...(m.angles || [])].filter(Boolean) as string[];
                        urls.forEach(u => { if (!pktMockupImages.includes(u)) pktMockupImages.push(u); });
                      });
                    }
                  }
                } catch (e: any) {
                  console.error('[Store API] failed to read packet', d.currentPacketId, e.message);
                }
              }

              const allImages: string[] = [];
              pktMockupImages.forEach(u => { if (!allImages.includes(u)) allImages.push(u); });
              providerImgs.forEach(u => { if (!allImages.includes(u)) allImages.push(u); });
              if (pktMockupImages.length === 0 && packetImageUrl && !allImages.includes(packetImageUrl)) {
                allImages.unshift(packetImageUrl);
              }

              const colors = toStrArr(d.enabledColors || resolved.colors || []);
              const sizes = toStrArr(d.enabledSizes || resolved.sizes || []);

              return {
                id: doc.id,
                name: resolved.title || 'Untitled',
                imageUrl: allImages[0] || null,
                images: allImages,
                packetImageUrl,
                segment: d.collectionName || null,
                isFeatured: false,
                isSeasonalPromo: false,
                templateVariant: null,
                qrProductType: d.qrProductType || 'qr-canvas',
                qrCodeUrl: null,
                selectedColors: colors,
                availableSizes: sizes,
                defaultColor: pktDefaultColor,
                mockupsByColor: pktMockupsByColor,
                price: price !== null ? Math.round(price * 100) / 100 : null,
                createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                options: buildOptions(colors, sizes),
                media: { images: allImages, mockupPriority: true, heroStrategy: 'mockupFirst' },
              };
            })
        );

        console.log(`[Store API] Channel "${channel}" in "${matchedStoreName}": ${products.length} products${collection ? ` / collection: ${collection}` : ''}`);
        return res.json({
          storeType: normalizedType,
          storeName: matchedStoreName,
          channelId: channel,
          channelName: channelData.name || channel,
          collection: collection || null,
          segment: null,
          products,
        });
      }

      // ── Legacy segment-based path: queries customDesigns ─────────────────────
      const storeType = normalizedType === "internal" ? "Internal" : "External";
      const designs = await storage.getCustomDesignsByStoreSegment(storeType, storeName, segment);

      const allStores = await storage.getPartnerStores();
      const matchingStore = allStores.find((s: any) =>
        s.name.toLowerCase() === storeName.toLowerCase() &&
        (storeType === "Internal" ? s.isInternal === true : s.isInternal !== true)
      );

      let storeProducts: any[] = [];
      if (matchingStore) {
        storeProducts = await storage.getPartnerStoreProducts(matchingStore.id);
      }

      const storeProductMap = new Map<string, any>();
      for (const sp of storeProducts) {
        storeProductMap.set(sp.productId, sp);
      }

      const products = designs.map((d: any) => {
        let qrProductType = "qr-basics";
        const hasTopText = d.topText && typeof d.topText === 'object' && (d.topText as any).text;
        const hasBottomText = d.bottomText && typeof d.bottomText === 'object' && (d.bottomText as any).text;
        const hasBackground = !!d.backgroundImageUrl;
        const hasVideo = !!(d as any).videoUrl;
        const overlay = d.landingOverlay as any;
        const hasLandingOverlay = overlay?.enabled;

        if (d.templateVariant === "plain-text") {
          qrProductType = "qr-basics";
        } else if (d.templateVariant === "dynamics") {
          qrProductType = "qr-dynamics";
        } else if (d.templateVariant === "external-url") {
          qrProductType = "qr-basics";
        } else if (d.templateVariant === "url") {
          if (hasVideo) qrProductType = "qr-play";
          else if (hasBackground || hasLandingOverlay) qrProductType = "qr-canvas";
          else if (hasTopText || hasBottomText) qrProductType = "qr-plus";
          else qrProductType = "qr-canvas";
        }

        const productId = d.id.startsWith('custom_') ? d.id : `custom_${d.id}`;
        const storeProduct = storeProductMap.get(productId) || storeProductMap.get(d.id);

        return {
          id: d.id,
          name: d.productName,
          imageUrl: d.productImage || d.printifyCompositeUrl,
          segment: d.segment,
          isFeatured: d.isFeatured,
          isSeasonalPromo: d.isSeasonalPromo,
          templateVariant: d.templateVariant,
          qrProductType,
          qrCodeUrl: d.qrCodeUrl || null,
          selectedColors: storeProduct?.enabledColors || (d as any).selectedColors || null,
          defaultColor: storeProduct?.defaultColor || (d as any).defaultColor || null,
          mockupsByColor: storeProduct?.mockupsByColor || (d as any).mockupsByColor || null,
          createdAt: d.createdAt,
        };
      });

      res.json({
        storeType,
        storeName,
        segment: segment || null,
        products,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
