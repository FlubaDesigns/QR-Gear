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

  // Public: Get store products by store type/name/segment (for internal store pages)
  // Used by pages like /shop/internal/qr-gear/featured or /shop/external/kingdom-connects/homepage
  app.get("/api/store/:storeType/:storeName", async (req, res) => {
    try {
      const { storeType: rawStoreType, storeName } = req.params;
      const segment = req.query.segment as string | undefined;
      
      // Normalize store type to title case (accept internal/Internal/INTERNAL)
      const normalizedType = rawStoreType.toLowerCase();
      if (!["internal", "external"].includes(normalizedType)) {
        return res.status(400).json({ error: "Invalid store type. Use 'Internal' or 'External'" });
      }
      const storeType = normalizedType === "internal" ? "Internal" : "External";
      
      // Get custom designs saved to this store/segment
      const designs = await storage.getCustomDesignsByStoreSegment(storeType, storeName, segment);
      
      // Get partner store for this store type/name to lookup product configurations
      const allStores = await storage.getPartnerStores();
      const matchingStore = allStores.find(s => 
        s.name.toLowerCase() === storeName.toLowerCase() &&
        (storeType === "Internal" ? s.isInternal === true : s.isInternal !== true)
      );
      
      // Get partner store products to get color/mockup configurations
      let storeProducts: any[] = [];
      if (matchingStore) {
        storeProducts = await storage.getPartnerStoreProducts(matchingStore.id);
      }
      
      // Create lookup map for partner store product configs by product ID
      const storeProductMap = new Map<string, any>();
      for (const sp of storeProducts) {
        storeProductMap.set(sp.productId, sp);
      }
      
      // Transform to product display format with QR product type detection
      // Five product types: QR Basics, QR Plus, QR Canvas, QR Play, QR Dynamics
      const products = designs.map(d => {
        let qrProductType = "qr-basics"; // Default fallback
        const hasTopText = d.topText && typeof d.topText === 'object' && (d.topText as any).text;
        const hasBottomText = d.bottomText && typeof d.bottomText === 'object' && (d.bottomText as any).text;
        const hasBackground = !!d.backgroundImageUrl;
        const hasVideo = !!(d as any).videoUrl; // Check for video content
        const overlay = d.landingOverlay as any;
        const hasLandingOverlay = overlay?.enabled;
        
        if (d.templateVariant === "plain-text") {
          qrProductType = "qr-basics"; // Text encoded directly in QR
        } else if (d.templateVariant === "dynamics") {
          qrProductType = "qr-dynamics"; // Updateable destination
        } else if (d.templateVariant === "external-url") {
          qrProductType = "qr-basics"; // External URL redirects, similar to basics
        } else if (d.templateVariant === "url") {
          // Hosted landing page - determine subtype
          if (hasVideo) {
            qrProductType = "qr-play"; // Video playback
          } else if (hasBackground || hasLandingOverlay) {
            qrProductType = "qr-canvas"; // Custom background/landing page
          } else if (hasTopText || hasBottomText) {
            qrProductType = "qr-plus"; // Printed text, no background
          } else {
            qrProductType = "qr-canvas"; // Default hosted type
          }
        }
        
        // Get QR code URL for overlay display
        const qrCodeUrl = d.qrCodeUrl || null;
        
        // Get color/mockup data from partner_store_products (primary) or design (fallback)
        // Product ID for custom designs is the design ID prefixed with 'custom_'
        const productId = d.id.startsWith('custom_') ? d.id : `custom_${d.id}`;
        const storeProduct = storeProductMap.get(productId) || storeProductMap.get(d.id);
        
        const selectedColors = storeProduct?.enabledColors || (d as any).selectedColors || null;
        const defaultColor = storeProduct?.defaultColor || (d as any).defaultColor || null;
        const mockupsByColor = storeProduct?.mockupsByColor || (d as any).mockupsByColor || null;
        
        return {
          id: d.id,
          name: d.productName,
          imageUrl: d.productImage || d.printifyCompositeUrl,
          segment: d.segment,
          isFeatured: d.isFeatured,
          isSeasonalPromo: d.isSeasonalPromo,
          templateVariant: d.templateVariant,
          qrProductType,
          qrCodeUrl,
          selectedColors,
          defaultColor,
          mockupsByColor,
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
