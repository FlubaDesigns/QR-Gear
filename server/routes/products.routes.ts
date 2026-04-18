import type { Express } from "express";
import { storage } from "../storage";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "../lib/qr-generator";
import { printify, getUSAPrintProviders } from "../lib/printify";

export function registerProductRoutes(app: Express): void {
  app.post("/api/qr/generate", async (req, res) => {
    try {
      const { content, type, style } = req.body;

      if (!validateQRContent(content, type)) {
        return res.status(400).json({ error: "Invalid QR code content" });
      }

      const qrCodeDataUrl =
        type === "text"
          ? await generateTextQRCode(content, style)
          : await generateImageQRCode(content, style);

      res.json({ qrCode: qrCodeDataUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Image (GET - returns actual PNG image for canvas/img loading)
  app.get("/api/qr/image", async (req, res) => {
    try {
      const { text, color = "black" } = req.query;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing 'text' query parameter" });
      }

      const qrColor = color === "white" ? "#FFFFFF" : "#000000";
      const qrCodeDataUrl = await generateTextQRCode(text, { color: qrColor, backgroundColor: "transparent" });
      
      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Note: QR Designs endpoints moved to authenticated section (see SAVED DESIGNS ENDPOINTS)

  // Products - Public endpoint returns only enabled products
  app.get("/api/products", async (req, res) => {
    try {
      const { store, segment, featured } = req.query;
      
      // If store is provided, use the proper store filtering via partner_store_products
      if (store && typeof store === "string") {
        const products = await storage.getProductsForStore(
          store,
          segment && typeof segment === "string" ? segment : undefined
        );
        return res.json(products);
      }
      
      // Get all enabled products
      const products = await storage.getAllProducts();
      let enabledProducts = products.filter(p => p.isEnabled);
      
      // Filter by featured if requested
      if (featured === "true") {
        enabledProducts = enabledProducts.filter(p => p.isFeatured);
        
        // Fetch admin settings for pricing calculations
        const settings = await storage.getAdminSettings();
        const globalMarkupPercent = parseFloat(settings?.globalMarkupPercent || "25");
        const globalMarkupFixed = parseFloat(settings?.globalMarkupFixed || "0");
        const globalQrCost = parseFloat(settings?.globalQrProductionCost || "2");
        const additionalPlacementCost = parseFloat(settings?.additionalPlacementCost || "4");
        
        // For featured products, enrich with mockups and QR artwork from custom_designs
        const designs = await storage.getCustomDesigns();
        
        const enrichedProducts = enabledProducts.map((product) => {
          // IMPORTANT: Use customerPrice set by admin in Admin Products section
          // Only fall back to calculation if customerPrice is not set
          let retailPrice: number;
          if (product.customerPrice) {
            retailPrice = parseFloat(product.customerPrice);
          } else {
            // Fallback calculation only if admin hasn't set customerPrice
            const baseCost = parseFloat(product.basePrice) || 0;
            const qrCost = parseFloat(product.qrProductionCost || "0") || globalQrCost;
            const markupFixed = parseFloat(product.markupFixed || "0") || globalMarkupFixed;
            const markupPercent = parseFloat(product.markupPercent || "0") || globalMarkupPercent;
            const placements = product.availablePlacements || [];
            const extraPlacementCount = Math.max(0, placements.length - 1);
            const placementUpcharge = extraPlacementCount * additionalPlacementCost;
            const totalCost = baseCost + qrCost + placementUpcharge;
            retailPrice = Math.ceil((totalCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
          }
          
          // Try to find the matching custom design by the product ID pattern
          // Custom design IDs are like "qr-gear-main-home-tee-dec2025" 
          // Product IDs are like "custom_qr-gear-main-home-tee-dec2025-1"
          const customDesignId = product.id.replace(/^custom_/, '').replace(/-\d+$/, '');
          const matchingDesign = designs.find(d => d.id === customDesignId || d.productId?.toString() === product.blueprintId?.toString());
          
          // Get all placement images (includes black and white variants for each placement)
          let placementImages: Record<string, string> | null = null;
          let frontChestImage: string | null = null;
          let frontChestImageWhite: string | null = null;
          if (matchingDesign?.placementImages) {
            const placements = typeof matchingDesign.placementImages === 'string' 
              ? JSON.parse(matchingDesign.placementImages) 
              : matchingDesign.placementImages;
            placementImages = placements;
            frontChestImage = placements?.["front"] || placements?.["front-chest"] || null;
            frontChestImageWhite = placements?.["front-white"] || placements?.["front-chest-white"] || null;
          }
          
          // Get Printify mockups if available (realistic product images)
          // First check product.mockupsByColor, then fall back to custom_design.mockupsByColor
          // Normalize mockupsByColor - handle string (older rows), null, or object
          let mockupsByColor: Record<string, any> | null = null;
          // First try the product's own mockupsByColor (populated by star button mockup generation)
          const productMockups = (product as any)?.mockupsByColor;
          const rawMockups = productMockups || (matchingDesign as any)?.mockupsByColor;
          if (rawMockups) {
            if (typeof rawMockups === 'string') {
              try {
                mockupsByColor = JSON.parse(rawMockups);
              } catch {
                mockupsByColor = null;
              }
            } else if (typeof rawMockups === 'object') {
              mockupsByColor = rawMockups;
            }
          }
          
          // Normalize selectedColors - handle string (older rows), null, or array
          let selectedColors: string[] | null = null;
          const rawSelectedColors = (matchingDesign as any)?.selectedColors;
          if (rawSelectedColors) {
            if (typeof rawSelectedColors === 'string') {
              try {
                const parsed = JSON.parse(rawSelectedColors);
                selectedColors = Array.isArray(parsed) ? parsed : null;
              } catch {
                selectedColors = null;
              }
            } else if (Array.isArray(rawSelectedColors)) {
              selectedColors = rawSelectedColors;
            }
          }
          // Fallback to mockupsByColor keys if no selectedColors
          if (!selectedColors && mockupsByColor) {
            selectedColors = Object.keys(mockupsByColor);
          }
          
          // Normalize defaultColor
          const rawDefaultColor = (matchingDesign as any)?.defaultColor;
          let defaultColor: string | null = typeof rawDefaultColor === 'string' ? rawDefaultColor : null;
          
          // Validate defaultColor is in selectedColors or mockupsByColor
          const validDefaultColor = 
            (defaultColor && selectedColors?.includes(defaultColor)) ? defaultColor :
            (defaultColor && mockupsByColor && mockupsByColor[defaultColor]) ? defaultColor :
            (mockupsByColor ? Object.keys(mockupsByColor)[0] : null);
          
          // Get the default mockup image (from validated color or first available)
          let defaultMockupImage: string | null = null;
          if (mockupsByColor && validDefaultColor && mockupsByColor[validDefaultColor]?.front) {
            defaultMockupImage = mockupsByColor[validDefaultColor].front;
          } else if (mockupsByColor) {
            // Fallback to first available color
            const firstColor = Object.keys(mockupsByColor)[0];
            if (firstColor) {
              defaultMockupImage = mockupsByColor[firstColor]?.front || null;
            }
          }
          
          // Get availableColors with hex values from product data
          let availableColorsWithHex: Array<{name: string, hex?: string}> = [];
          const rawAvailableColors = product.availableColors;
          if (rawAvailableColors) {
            if (Array.isArray(rawAvailableColors)) {
              availableColorsWithHex = rawAvailableColors as Array<{name: string, hex?: string}>;
            }
          }
          
          // Determine if this is a customizable product or store template
          // Store templates (pre-made designs) are not customizable
          const metadata = typeof product.metadata === 'object' ? product.metadata as Record<string, any> : {};
          const isCustomizable = metadata?.allowCustomization !== false && 
            !product.id.startsWith('custom_') && 
            !product.id.includes('-template-');
          
          return {
            ...product,
            retailPrice, // Calculated final price with markup and QR cost
            qrCodeUrl: matchingDesign?.qrCodeUrl || null,
            frontChestImage,
            frontChestImageWhite,
            placementImages, // All placements including white variants (e.g., back, back-white, left-sleeve, left-sleeve-white)
            // New mockup fields (normalized and validated)
            mockupsByColor,
            defaultColor: validDefaultColor, // Use validated color that exists in mockups
            selectedColors,
            defaultMockupImage, // Pre-computed default image for quick display
            availableColorsWithHex, // Colors with hex values for color swatches
            isCustomizable, // Whether user can customize the design
          };
        });
        
        return res.json(enrichedProducts);
      }
      
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Printify Catalog API
  app.get("/api/printify/status", async (req, res) => {
    res.json({ 
      configured: printify.isConfigured,
      message: printify.isConfigured 
        ? "Printify API is connected" 
        : "Printify API key or Shop ID not configured"
    });
  });

  app.get("/api/printify/catalog", async (req, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      const [bpSnap, provSnap] = await Promise.all([
        fsDb.collection('printify_blueprints').get(),
        fsDb.collection('printifyPrintProviders').get(),
      ]);

      const blueprints: any[] = bpSnap.docs.map(doc => {
        const d = doc.data();
        const rawDesc = d.richDescription || d.description || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return {
          id: parseInt(doc.id) || d.id,
          title: d.title || '',
          description: cleanDesc,
          brand: d.brand || '',
          model: d.model || '',
          images: d.images || [],
        };
      });

      const allProviders: any[] = provSnap.docs.map(doc => doc.data());

      const providersByBlueprint = new Map<number, { colors: Array<{name: string; hex?: string}>; sizes: string[]; minCost: number; maxCost: number; providerId: number }>();
      for (const prov of allProviders) {
        const existing = providersByBlueprint.get(prov.blueprintId);
        const colors = Array.isArray(prov.availableColors) ? prov.availableColors as Array<{name: string; hex?: string}> : [];
        const sizes = Array.isArray(prov.availableSizes) ? prov.availableSizes : [];
        const minCost = prov.minCost || 0;
        const maxCost = prov.maxCost || 0;
        if (!existing || colors.length > existing.colors.length) {
          providersByBlueprint.set(prov.blueprintId, { colors, sizes, minCost, maxCost, providerId: prov.providerId });
        }
      }

      const USA_BRANDS = ['american apparel','royal apparel','bayside','los angeles apparel','bella+canvas','bella canvas','lane seven','cotton heritage','shaka wear','backpacks usa','american giant','next level'];

      const categories: Record<string, any[]> = {};
      for (const bp of blueprints) {
        const t = (bp.title || '').toLowerCase();
        let category: string;
        if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) {
          category = "T-Shirts & Tops";
        } else if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) {
          category = "Sweatshirts & Hoodies";
        } else if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) {
          category = "Hats & Caps";
        } else if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) {
          category = "Drinkware";
        } else if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) {
          category = "Bags & Accessories";
        } else if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) {
          category = "Phone Cases & Tech";
        } else if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) {
          category = "Stickers & Magnets";
        } else if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) {
          category = "Wall Art & Posters";
        } else if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) {
          category = "Home & Living";
        } else if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) {
          category = "Stationery & Paper";
        } else if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) {
          category = "Activewear & Specialty";
        } else if (t.includes('pet') || t.includes('dog')) {
          category = "Pet Products";
        } else if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) {
          category = "Holiday & Seasonal";
        } else if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) {
          category = "Accessories";
        } else {
          category = "Other";
        }

        if (!categories[category]) categories[category] = [];

        const brandLower = (bp.brand || '').toLowerCase();
        const madeInUSA = USA_BRANDS.some(b => brandLower.includes(b));
        const provData = providersByBlueprint.get(bp.id);

        const rawDesc = bp.description || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        categories[category].push({
          id: bp.id,
          title: bp.title,
          description: cleanDesc,
          brand: bp.brand,
          model: bp.model,
          imageUrl: bp.images?.[0] || null,
          madeInUSA,
          blueprintId: bp.id,
          printProviderId: provData?.providerId || null,
          minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null,
          maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
          colorCount: provData?.colors.length || 0,
          availableColors: provData?.colors || [],
          availableSizes: provData?.sizes || [],
          fulfillmentProvider: 'printify',
        });
      }

      const result = Object.entries(categories)
        .map(([name, items]) => ({ name, items, count: items.length }))
        .sort((a, b) => {
          if (a.name === "T-Shirts & Tops") return -1;
          if (b.name === "T-Shirts & Tops") return 1;
          return a.name.localeCompare(b.name);
        });

      res.json(result);
    } catch (error: any) {
      console.error("Printify catalog error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Master catalog sync ──────────────────────────────────────────────────
  app.post("/api/admin/sync-master-products", async (req, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      const USA_BRANDS_SYNC = ['american apparel','royal apparel','bayside','los angeles apparel','bella+canvas','bella canvas','lane seven','cotton heritage','shaka wear','backpacks usa','american giant','next level'];
      const categorizeMC = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) return "T-Shirts & Tops";
        if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) return "Sweatshirts & Hoodies";
        if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) return "Hats & Caps";
        if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) return "Drinkware";
        if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) return "Bags & Accessories";
        if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) return "Phone Cases & Tech";
        if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) return "Stickers & Magnets";
        if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) return "Wall Art & Posters";
        if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) return "Home & Living";
        if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) return "Stationery & Paper";
        if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('sneaker') || t.includes('shoe')) return "Activewear & Specialty";
        if (t.includes('pet') || t.includes('dog')) return "Pet Products";
        if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt')) return "Holiday & Seasonal";
        if (t.includes('sock') || t.includes('scarf') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('necktie')) return "Accessories";
        return "Other";
      };

      const [bpSnap, provSnap, pfProductsSnap, pfVariantsSnap, existingSnap] = await Promise.all([
        fsDb.collection('printify_blueprints').get(),
        fsDb.collection('printifyPrintProviders').get(),
        fsDb.collection('printful_products').get(),
        fsDb.collection('printful_variants').get(),
        fsDb.collection('master_catalog').get(),
      ]);

      // Build map of existing master_catalog so we can preserve title/description on re-sync
      const existingDocs = new Map<string, any>();
      for (const doc of existingSnap.docs) {
        existingDocs.set(doc.id, doc.data());
      }

      // Build Printify provider lookup (colors/sizes/pricing)
      const providersByBlueprint = new Map<number, any>();
      for (const prov of provSnap.docs.map((d: any) => d.data())) {
        const existing = providersByBlueprint.get(prov.blueprintId);
        const colors = Array.isArray(prov.availableColors) ? prov.availableColors : [];
        if (!existing || colors.length > (existing.colors?.length || 0)) {
          providersByBlueprint.set(prov.blueprintId, { colors, sizes: Array.isArray(prov.availableSizes) ? prov.availableSizes : [], minCost: prov.minCost || 0, maxCost: prov.maxCost || 0, providerId: prov.providerId });
        }
      }

      // Build Printful variant lookup (colors/sizes)
      const variantLookup = new Map<number, { colors: Array<{name: string; hex: string}>; sizes: string[] }>();
      for (const v of pfVariantsSnap.docs.map((d: any) => d.data())) {
        const pid = v.productId; if (!pid) continue;
        if (!variantLookup.has(pid)) variantLookup.set(pid, { colors: [], sizes: [] });
        const entry = variantLookup.get(pid)!;
        if (v.color && !entry.colors.find((c: any) => c.name === v.color)) entry.colors.push({ name: v.color, hex: v.colorCode || '#888' });
        if (v.size && !entry.sizes.includes(v.size)) entry.sizes.push(v.size);
      }

      // Build Printful by-model lookup
      const printfulByModel = new Map<string, any>();
      for (const doc of pfProductsSnap.docs) {
        const p = { id: parseInt((doc as any).id) || (doc.data() as any).id, ...doc.data() } as any;
        const model = ((p.model || '') as string).toLowerCase().trim();
        if (!model || printfulByModel.has(model)) continue;
        const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
        printfulByModel.set(model, { pfId: p.id, title: p.title || '', brand: p.brand || '', imageUrl: p.image || null, madeInUSA: ((p.originCountry || '') as string).toUpperCase() === 'US', minPrice: p.minPrice || null, maxPrice: p.maxPrice || null, colors: vData.colors, sizes: vData.sizes });
      }

      const records: Array<{ docId: string; data: any }> = [];
      const usedPrintfulModels = new Set<string>();
      const now = new Date().toISOString();

      // Printify blueprints → master records (with optional Printful match)
      for (const doc of bpSnap.docs) {
        const d = doc.data() as any;
        const rawDesc = d.richDescription || d.description || '';
        const description = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null;
        const id = parseInt(doc.id) || d.id;
        const modelKey = ((d.model || '') as string).toLowerCase().trim();
        const pfMatch = modelKey ? printfulByModel.get(modelKey) : null;
        if (pfMatch) usedPrintfulModels.add(modelKey);
        const provData = providersByBlueprint.get(id);
        const colors = provData?.colors?.length ? provData.colors : (pfMatch?.colors || []);
        const sizes = provData?.sizes?.length ? provData.sizes : (pfMatch?.sizes || []);
        const brandLower = (d.brand || '').toLowerCase();
        const madeInUSA = USA_BRANDS_SYNC.some(b => brandLower.includes(b)) || (pfMatch?.madeInUSA || false);
        const docId = String(id);
        const existing = existingDocs.get(docId);

        // Printify wins for title/description. Preserve if already set in master (write-once).
        const masterTitle = existing?.title || d.title || '';
        const masterDescription = existing?.description !== undefined ? existing.description : description;

        // Price: use highest across providers so we never under-charge
        const pyMinPrice = provData?.minCost ? parseFloat((provData.minCost / 100).toFixed(2)) : null;
        const pyMaxPrice = provData?.maxCost ? parseFloat((provData.maxCost / 100).toFixed(2)) : null;
        const pfMinPrice = pfMatch?.minPrice ? parseFloat(pfMatch.minPrice) : null;
        const pfMaxPrice = pfMatch?.maxPrice ? parseFloat(pfMatch.maxPrice) : null;
        const finalMinPrice = pyMinPrice !== null && pfMinPrice !== null ? Math.max(pyMinPrice, pfMinPrice) : (pyMinPrice ?? pfMinPrice);
        const finalMaxPrice = pyMaxPrice !== null && pfMaxPrice !== null ? Math.max(pyMaxPrice, pfMaxPrice) : (pyMaxPrice ?? pfMaxPrice);

        records.push({
          docId,
          data: {
            id: docId,
            providers: pfMatch ? ['printify', 'printful'] : ['printify'],
            fulfillmentProvider: 'printify',
            printifyId: id,
            printfulId: pfMatch?.pfId || null,
            title: masterTitle,
            description: masterDescription,
            brand: d.brand || null,
            model: d.model || null,
            imageUrl: (d.images || [])[0] || pfMatch?.imageUrl || null,
            madeInUSA,
            minPrice: finalMinPrice !== null ? String(finalMinPrice) : null,
            maxPrice: finalMaxPrice !== null ? String(finalMaxPrice) : null,
            availableColors: colors,
            availableSizes: sizes,
            colorCount: colors.length,
            category: categorizeMC(d.title || ''),
            blueprintId: id,
            printProviderId: provData?.providerId || null,
            availableVia: pfMatch ? ['printify', 'printful'] : ['printify'],
            lastSyncedAt: now,
          },
        });
      }

      // Printful-only products (no Printify match)
      for (const [model, pf] of Array.from(printfulByModel.entries())) {
        if (usedPrintfulModels.has(model)) continue;
        const pfDocId = `pf:${pf.pfId}`;
        const pfExisting = existingDocs.get(pfDocId);

        // Preserve title if already set; never write description for Printful-only (no source for it)
        const pfMasterTitle = pfExisting?.title || pf.title;
        const pfMasterDescription = pfExisting?.description !== undefined ? pfExisting.description : null;

        records.push({
          docId: pfDocId,
          data: {
            id: pfDocId,
            providers: ['printful'],
            fulfillmentProvider: 'printful',
            printifyId: null,
            printfulId: pf.pfId,
            title: pfMasterTitle,
            description: pfMasterDescription,
            brand: pf.brand || null,
            model: pf.model || model,
            imageUrl: pf.imageUrl,
            madeInUSA: pf.madeInUSA,
            minPrice: pf.minPrice,
            maxPrice: pf.maxPrice,
            availableColors: pf.colors,
            availableSizes: pf.sizes,
            colorCount: pf.colors.length,
            category: categorizeMC(pf.title),
            blueprintId: null,
            printProviderId: null,
            availableVia: ['printful'],
            lastSyncedAt: now,
          },
        });
      }

      // Batch write to master_catalog (500 per batch limit)
      const BATCH_SIZE = 400;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = fsDb.batch();
        for (const { docId, data } of records.slice(i, i + BATCH_SIZE)) {
          batch.set(fsDb.collection('master_catalog').doc(docId), data);
        }
        await batch.commit();
      }

      console.log(`[SyncMasterProducts] Wrote ${records.length} records to master_catalog`);
      res.json({ success: true, total: records.length, printify: bpSnap.size, printfulOnly: records.filter(r => r.data.fulfillmentProvider === 'printful').length });
    } catch (error: any) {
      console.error("[SyncMasterProducts] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Category classifier (title-based fallback since Firestore docs lack category field) ──
  function classifyCategory(title: string): string {
    const t = (title || '').toLowerCase();
    if (/christmas|holiday|ornament|halloween|easter|thanksgiving|valentine|xmas/.test(t)) return 'Holiday & Seasonal';
    if (/\bpet\b|\bdog\b|\bcat\b|puppy|kitten|\banimal\b/.test(t)) return 'Pet Products';
    if (/notebook|journal|planner|stationery|greeting card|postcard|notepad/.test(t)) return 'Stationery & Paper';
    if (/acrylic print|acrylic sign|metal print|gallery wrap|art board|canvas wrap|canvas gallery|canvas print|wall art|poster|framed|tapestry|\bbanner\b|\bflag\b|art print/.test(t)) return 'Wall Art & Posters';
    if (/tote bag|backpack|fanny pack|drawstring bag|duffel|duffle|messenger bag|crossbody|\bpouch\b|shopping bag|laptop bag/.test(t)) return 'Bags & Accessories';
    if (/phone case|iphone|samsung case|airpod|laptop sleeve|mouse pad|mousepad|tablet case/.test(t)) return 'Phone Cases & Tech';
    if (/sticker|magnet|decal|\bpatch\b/.test(t)) return 'Stickers & Magnets';
    if (/mugs?|tumbler|water bottle|wine glass|beer stein|beer mug|\bflask\b|thermos|travel mug|\bpint\b|drinkware|insulated bottle|insulated tumbler|shot glass/.test(t)) return 'Drinkware';
    if (/snapback|trucker hat|dad hat|baseball cap|bucket hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t)) return 'Hats & Caps';
    if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew neck|\bsweater\b/.test(t)) return 'Sweatshirts & Hoodies';
    if (/swimsuit|bikini|rash guard|windbreaker|biker short|boxer brief|bodycon|legging|yoga|jogger|sweatpant|sport bra|compression|activewear|athletic short/.test(t)) return 'Activewear & Specialty';
    if (/t-shirt|tshirt|\btee\b|tank top|\bpolo\b|v-neck|\bhenley\b|long sleeve|\bjersey\b|raglan|crop top|camisole|\bblouse\b|\bshirt\b/.test(t)) return 'T-Shirts & Tops';
    if (/\bpillow\b|blanket|\btowel\b|\bapron\b|\brug\b|doormat|table runner|cushion|coaster|shower curtain|duvet|bedding|\bbath\b|face mask|\bbandana\b|\bsock\b|calendar|\bclock\b|\bcandle\b|keychain|\bwallet\b|serving tray|phone stand/.test(t)) return 'Home & Living';
    if (/bracelet|necklace|earring|\bring\b|\bwatch\b|sunglasse|\bscarf\b|\bglove\b|\bbelt\b|headband|neck gaiter|hair/.test(t)) return 'Accessories';
    return 'Other';
  }

  // ── Master catalog read ───────────────────────────────────────────────────
  app.get("/api/master-catalog", async (req, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      const snap = await fsDb.collection('master_catalog').get();
      const categories: Record<string, any[]> = {};

      for (const doc of snap.docs) {
        const p = doc.data() as any;
        const category = (p.category && p.category !== 'Other') ? p.category : classifyCategory(p.title || '');
        if (!categories[category]) categories[category] = [];

        // Resolve fields — handle both CF schema (printifyBlueprintId/printfulProductId/colors/images)
        // and legacy Express schema (printifyId/printfulId/availableColors/imageUrl)
        const blueprintId = p.printifyBlueprintId ?? p.blueprintId ?? null;
        const printfulId = p.printfulProductId ?? p.printfulId ?? null;
        const resolvedId = blueprintId ?? printfulId;
        const colors = p.colors ?? p.availableColors ?? [];
        const sizes = p.sizes ?? p.availableSizes ?? [];
        const imageUrl = (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null) ?? p.imageUrl ?? null;
        const madeInUSA = p.madeInUSA ?? ((p.originCountry || '').toUpperCase() === 'US');
        const fulfillmentProvider = p.fulfillmentProvider ?? (blueprintId != null ? 'printify' : 'printful');
        const providers = p.providers ?? (printfulId != null && blueprintId != null ? ['printify', 'printful'] : [fulfillmentProvider]);

        categories[category].push({
          docId: doc.id,
          qrgId: p.qrgId ?? null,
          qrgCategory: p.qrgCategory ?? null,
          id: resolvedId,
          title: (p.title || "").trim(),
          description: (p.description || "").trim() || null,
          brand: p.brand ?? null,
          model: p.model ?? null,
          imageUrl,
          madeInUSA,
          blueprintId,
          printProviderId: p.printProviderId ?? null,
          minPrice: p.minPrice != null ? String(p.minPrice) : null,
          maxPrice: p.maxPrice != null ? String(p.maxPrice) : null,
          colorCount: colors.length,
          availableColors: colors,
          availableSizes: sizes,
          fulfillmentProvider,
          availableVia: p.availableVia ?? providers,
          printfulId,
          providers,
        });
      }

      const CATEGORY_ORDER = ["T-Shirts & Tops","Sweatshirts & Hoodies","Hats & Caps","Drinkware","Bags & Accessories","Phone Cases & Tech","Stickers & Magnets","Wall Art & Posters","Home & Living","Stationery & Paper","Activewear & Specialty","Accessories","Pet Products","Holiday & Seasonal","Other"];
      const result = Object.entries(categories)
        .map(([name, items]) => ({ name, items: items.sort((a, b) => a.title.localeCompare(b.title)), count: items.length }))
        .sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a.name); const bi = CATEGORY_ORDER.indexOf(b.name);
          if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });

      res.json(result);
    } catch (error: any) {
      console.error("[MasterCatalog] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Joint catalog: products where BOTH master description AND at least one admin catalog description exist ──
  app.get("/api/master-catalog/joint", async (req, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      if (!fsDb) return res.status(503).json({ error: "Firestore not available" });

      const [masterSnap, catalogsSnap] = await Promise.all([
        fsDb.collection('master_catalog').get(),
        fsDb.collection('catalogs').get(),
      ]);

      // Build a set of all blankIds that have an admin description in any catalog
      const adminDescribedKeys = new Set<string>();
      for (const catDoc of catalogsSnap.docs) {
        const blankDescriptions = catDoc.data().blankDescriptions || {};
        for (const [key, val] of Object.entries(blankDescriptions)) {
          if (val && String(val).trim().length > 0) adminDescribedKeys.add(key);
        }
      }

      const CATEGORY_ORDER = ["T-Shirts & Tops","Sweatshirts & Hoodies","Hats & Caps","Drinkware","Bags & Accessories","Phone Cases & Tech","Stickers & Magnets","Wall Art & Posters","Home & Living","Stationery & Paper","Activewear & Specialty","Accessories","Pet Products","Holiday & Seasonal","Other"];
      const categories: Record<string, any[]> = {};

      for (const doc of masterSnap.docs) {
        const p = doc.data() as any;
        const masterDesc = (p.description || "").trim();
        if (!masterDesc) continue;

        // Resolve fields for both CF and legacy schema
        const blueprintId = p.printifyBlueprintId ?? p.blueprintId ?? p.printifyId ?? null;
        const printfulId = p.printfulProductId ?? p.printfulId ?? null;
        const blankKey = blueprintId ? String(blueprintId) : (printfulId ? `pf:${printfulId}` : null);
        if (!blankKey) continue;
        if (!adminDescribedKeys.has(blankKey)) continue;

        const colors = p.colors ?? p.availableColors ?? [];
        const sizes = p.sizes ?? p.availableSizes ?? [];
        const imageUrl = (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null) ?? p.imageUrl ?? null;
        const madeInUSA = p.madeInUSA ?? ((p.originCountry || '').toUpperCase() === 'US');
        const fulfillmentProvider = p.fulfillmentProvider ?? (blueprintId != null ? 'printify' : 'printful');
        const providers = p.providers ?? (printfulId != null && blueprintId != null ? ['printify', 'printful'] : [fulfillmentProvider]);

        const category = (p.category && p.category !== 'Other') ? p.category : classifyCategory(p.title || '');
        if (!categories[category]) categories[category] = [];
        categories[category].push({
          id: blueprintId ?? printfulId,
          title: (p.title || "").trim(),
          description: masterDesc,
          brand: p.brand ?? null,
          model: p.model ?? null,
          imageUrl,
          madeInUSA,
          blueprintId,
          printProviderId: p.printProviderId ?? null,
          minPrice: p.minPrice != null ? String(p.minPrice) : null,
          maxPrice: p.maxPrice != null ? String(p.maxPrice) : null,
          colorCount: colors.length,
          availableColors: colors,
          availableSizes: sizes,
          fulfillmentProvider,
          availableVia: p.availableVia ?? providers,
          printfulId,
          providers,
        });
      }

      const result = Object.entries(categories)
        .map(([name, items]) => ({ name, items: items.sort((a: any, b: any) => a.title.localeCompare(b.title)), count: items.length }))
        .sort((a, b) => {
          const ai = CATEGORY_ORDER.indexOf(a.name); const bi = CATEGORY_ORDER.indexOf(b.name);
          if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
          if (ai === -1) return 1; if (bi === -1) return -1;
          return ai - bi;
        });

      const total = result.reduce((sum, c) => sum + c.count, 0);
      console.log(`[JointCatalog] ${total} products with both master + admin descriptions across ${result.length} categories`);
      res.json(result);
    } catch (error: any) {
      console.error("[JointCatalog] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/catalog/:blueprintId", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      const [blueprint, providers] = await Promise.all([
        printify.getBlueprintDetails(blueprintId),
        getUSAPrintProviders(blueprintId),
      ]);
      res.json({ blueprint, providers });
    } catch (error: any) {
      console.error("Printify blueprint error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/catalog/:blueprintId/variants", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      const printProviderId = parseInt(req.query.providerId as string);
      
      if (!printProviderId) {
        return res.status(400).json({ error: "providerId query param required" });
      }
      
      const variants = await printify.getVariants(blueprintId, printProviderId);
      res.json(variants);
    } catch (error: any) {
      console.error("Printify variants error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/products", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const products = await printify.getShopProducts();
      res.json(products);
    } catch (error: any) {
      console.error("Printify products error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/local-blueprints", async (req: any, res) => {
    try {
      const localBlueprints = await storage.getPrintifyBlueprints();
      res.json({ blueprints: localBlueprints.map(bp => ({ id: bp.id, title: bp.title })) });
    } catch (error: any) {
      console.error('[LocalBlueprints] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
