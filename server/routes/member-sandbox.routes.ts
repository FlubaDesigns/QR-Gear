import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { verifyMemberAuth } from "./member-auth";
import { normalizePlacement } from '../../shared/placements';

export function registerMemberSandboxRoutes(app: Express): void {
  app.post("/api/members/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fullName, storeName, creatorSlug, country, useCase, productInterests, socialSurfaces, primarySocial, socialHandle, attributionSource } = req.body;

      if (!fullName || !storeName || !creatorSlug) {
        return res.status(400).json({ error: "fullName, storeName, and creatorSlug are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const profileData = {
        userId,
        fullName,
        storeName,
        creatorSlug,
        country: country || '',
        useCase: useCase || '',
        productInterests: productInterests || [],
        socialSurfaces: socialSurfaces || [],
        primarySocial: primarySocial || '',
        socialHandle: socialHandle || '',
        attributionSource: attributionSource || '',
        isMember: true,
        memberSince: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection('member_profiles').doc(userId).set(profileData, { merge: true });
      console.log(`[MemberProfile] Created/updated profile for ${userId}: ${storeName}`);
      res.json({ success: true, profile: profileData });
    } catch (error: any) {
      console.error('[MemberProfile] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const doc = await db.collection('member_profiles').doc(userId).get();
      if (!doc.exists) {
        return res.json({ isMember: false });
      }
      res.json({ isMember: true, profile: doc.data() });
    } catch (error: any) {
      console.error('[MemberProfile] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/check-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const doc = await db.collection('member_profiles').doc(userId).get();
      res.json({ isMember: doc.exists && doc.data()?.isMember === true });
    } catch (error: any) {
      res.json({ isMember: false });
    }
  });

  app.get("/api/members/:memberId/graphics", async (req: any, res) => {
    try {
      const { memberId } = req.params;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      
      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const images = await storage.getHostedImagesByUser(memberId);
      
      const graphicSets = [{
        id: 'my-uploads',
        name: 'My Uploads',
        thumbnailUrl: images[0]?.storageUrl || '',
        imageCount: images.length,
        images: images.map(img => ({
          id: img.id,
          url: img.storageUrl,
          name: img.fileName,
          createdAt: img.createdAt
        }))
      }];

      res.json(graphicSets);
    } catch (error: any) {
      console.error("[Member Graphics] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/:memberId/channels", async (req: any, res) => {
    try {
      const { memberId } = req.params;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      
      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("channels")
        .where("ownerId", "==", memberId)
        .get();

      const channels = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(channels);
    } catch (error: any) {
      console.error("[Member Channels] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/mockup/priority", isAuthenticated, async (req: any, res) => {
    try {
      const { 
        blueprintId, printProviderId, colorName, colorHex, 
        placement, artworkUrl, qrSize = "medium",
        fulfillmentProvider = "printify"
      } = req.body;

      if (!blueprintId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, colorName, artworkUrl" 
        });
      }

      console.log(`[Member Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);

      const { getMockupWithFallback } = await import("../lib/mockup-service");
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        canonicalPlacementId: placement || "front",
        artworkUrl,
        artworkVariant: "black",
        qrSize: qrSize as 'small' | 'medium' | 'large',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      }, storage);

      console.log(`[Member Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        generatedAt: result.generatedAt,
      });
    } catch (error: any) {
      console.error("[Member Mockup] Error:", error);
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  app.post("/api/members/generate-product-graphic", isAuthenticated, async (req: any, res) => {
    try {
      const { 
        qrUrl,
        headerStyle,
        footerStyle,
        textLayoutChoice,
        qrColor = 'black'
      } = req.body;

      if (!qrUrl) {
        return res.status(400).json({ error: "Missing required field: qrUrl" });
      }

      console.log(`[ProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
      console.log(`[ProductGraphic] headerStyle:`, JSON.stringify(headerStyle));
      console.log(`[ProductGraphic] footerStyle:`, JSON.stringify(footerStyle));
      console.log(`[ProductGraphic] qrUrl:`, qrUrl);

      const { generatePrintifyComposite } = await import("../lib/composite-image-generator");
      
      const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
      const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
      
      console.log(`[ProductGraphic] showHeader: ${showHeader}, showFooter: ${showFooter}`);
      console.log(`[ProductGraphic] headerStyle?.text: "${headerStyle?.text || ''}", footerStyle?.text: "${footerStyle?.text || ''}"`);
      
      const topText = showHeader && (headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl)) ? {
        text: headerStyle.text || '',
        fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48',
        color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0,
        warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor,
        strokeWidth: headerStyle.strokeWidth,
        mode: headerStyle.mode,
        imageUrl: headerStyle.imageUrl,
        verticalOffset: headerStyle.verticalOffset,
        horizontalOffset: headerStyle.horizontalOffset,
        imageScale: headerStyle.imageScale,
      } : null;
      
      const bottomText = showFooter && (footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl)) ? {
        text: footerStyle.text || '',
        fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48',
        color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0,
        warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor,
        strokeWidth: footerStyle.strokeWidth,
        mode: footerStyle.mode,
        imageUrl: footerStyle.imageUrl,
        verticalOffset: footerStyle.verticalOffset,
        horizontalOffset: footerStyle.horizontalOffset,
        imageScale: footerStyle.imageScale,
      } : null;
      
      console.log(`[ProductGraphic] topText:`, topText ? JSON.stringify(topText) : 'null');
      console.log(`[ProductGraphic] bottomText:`, bottomText ? JSON.stringify(bottomText) : 'null');

      const productGraphicDataUrl = await generatePrintifyComposite(
        qrUrl,
        topText,
        bottomText,
        1200,
        1800,
        qrColor as 'black' | 'white'
      );

      console.log(`[ProductGraphic] Generated composite, length: ${productGraphicDataUrl.length}`);

      const { uploadToFirebasePublic } = await import("../lib/firebase-storage-service");
      const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URL format from composite generator");
      }
      
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const uploadResult = await uploadToFirebasePublic(buffer, mimeType, 'member-graphics');
      
      console.log(`[ProductGraphic] Uploaded to Firebase: ${uploadResult.publicUrl}`);

      res.json({
        success: true,
        productGraphic: uploadResult.publicUrl,
      });
    } catch (error: any) {
      console.error("[ProductGraphic] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.post("/api/public/generate-product-graphic", async (req: any, res) => {
    try {
      const { 
        qrUrl,
        headerStyle,
        footerStyle,
        textLayoutChoice,
        qrColor = 'black'
      } = req.body;

      if (!qrUrl) {
        return res.status(400).json({ error: "Missing required field: qrUrl" });
      }

      console.log(`[PublicProductGraphic] Generating composite with layout: ${textLayoutChoice}`);

      const { generatePrintifyComposite } = await import("../lib/composite-image-generator");
      
      const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
      const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
      
      const topText = showHeader && (headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl)) ? {
        text: headerStyle.text || '',
        fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48',
        color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0,
        warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor,
        strokeWidth: headerStyle.strokeWidth,
        mode: headerStyle.mode,
        imageUrl: headerStyle.imageUrl,
        verticalOffset: headerStyle.verticalOffset,
        horizontalOffset: headerStyle.horizontalOffset,
        imageScale: headerStyle.imageScale,
      } : null;
      
      const bottomText = showFooter && (footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl)) ? {
        text: footerStyle.text || '',
        fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48',
        color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0,
        warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor,
        strokeWidth: footerStyle.strokeWidth,
        mode: footerStyle.mode,
        imageUrl: footerStyle.imageUrl,
        verticalOffset: footerStyle.verticalOffset,
        horizontalOffset: footerStyle.horizontalOffset,
        imageScale: footerStyle.imageScale,
      } : null;

      const productGraphicDataUrl = await generatePrintifyComposite(
        qrUrl,
        topText,
        bottomText,
        1200,
        1800,
        qrColor as 'black' | 'white'
      );

      const { uploadToFirebasePublic } = await import("../lib/firebase-storage-service");
      const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URL format from composite generator");
      }
      
      const buffer = Buffer.from(match[2], 'base64');
      const uploadResult = await uploadToFirebasePublic(buffer, match[1], 'public-graphics');
      
      console.log(`[PublicProductGraphic] Uploaded to Firebase: ${uploadResult.publicUrl}`);

      res.json({
        success: true,
        productGraphic: uploadResult.publicUrl,
      });
    } catch (error: any) {
      console.error("[PublicProductGraphic] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.get("/api/members/allowed-products", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { downloadAndStoreFromUrl } = await import("../lib/firebase-storage-service");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("storeAllowedProducts").doc("member-products").get();
      
      if (!doc.exists) {
        return res.json({ products: [], message: "No products added to member-products store yet" });
      }
      
      const data = doc.data();
      const storedProducts = data?.products || [];

      const { fsGet } = await import("../lib/firestore-crud");
      const assignments = await fsGet("systemSettings", "catalog-assignments");
      const defaults = await fsGet("systemSettings", "catalog-defaults");
      const catalogId = assignments?.["member"] || defaults?.defaultCatalogId || null;
      let catalogBlankDescriptions: Record<string, string> = {};
      if (catalogId) {
        const catalog = await fsGet("catalogs", catalogId);
        catalogBlankDescriptions = catalog?.blankDescriptions || {};
      }
      
      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      
      let needsUpdate = false;
      
      const blueprintCache = new Map<number, any>();
      
      const products = await Promise.all(storedProducts.map(async (p: any) => {
        let baseCost = p.baseCost || 0;
        let imageUrl = p.imageUrl;
        let printProviderId = p.printProviderId || null;
        
        if (imageUrl && imageUrl.includes('images.printify.com')) {
          console.log(`[Member Products] Migrating Printify URL for blueprint ${p.blueprintId}...`);
          const firebaseUrl = await downloadAndStoreFromUrl(imageUrl, `product-blueprint-${p.blueprintId}`);
          if (firebaseUrl) {
            imageUrl = firebaseUrl;
            p.imageUrl = firebaseUrl;
            needsUpdate = true;
            console.log(`[Member Products] Migrated to: ${firebaseUrl}`);
          }
        }
        
        if ((!imageUrl || imageUrl.includes('/api/files/')) && p.blueprintId) {
          try {
            if (!blueprintCache.has(p.blueprintId)) {
              const bpDoc = await firestoreDb.collection("printifyBlueprints").doc(String(p.blueprintId)).get();
              if (bpDoc.exists) blueprintCache.set(p.blueprintId, bpDoc.data());
            }
            const bpData = blueprintCache.get(p.blueprintId);
            if (bpData) {
              const bpImage = bpData.images?.[0] || bpData.imageUrl || bpData.image_url;
              if (bpImage) {
                imageUrl = bpImage;
                p.imageUrl = bpImage;
                needsUpdate = true;
                console.log(`[Member Products] Resolved image for blueprint ${p.blueprintId} from catalog`);
              }
            }
          } catch (e: any) {
            console.log(`[Member Products] Could not look up blueprint ${p.blueprintId}: ${e.message}`);
          }
        }
        
        if ((baseCost === 0 || !printProviderId) && p.blueprintId) {
          try {
            const providers = await storage.getPrintifyPrintProviders(p.blueprintId);
            const usaProviders = providers.filter((prov: any) => prov.isUSA);
            const selectedProvider = usaProviders[0] || providers[0];
            if (selectedProvider?.minCost && baseCost === 0) {
              baseCost = selectedProvider.minCost / 100;
            }
            if (selectedProvider?.providerId && !printProviderId) {
              printProviderId = selectedProvider.providerId;
              p.printProviderId = printProviderId;
              needsUpdate = true;
            }
          } catch (e) {
          }
        }
        
        const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
        const profit = retailPrice - baseCost;
        const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
        
        let placements: { id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }[] = [];
        
        if (p.blueprintId && printProviderId) {
          try {
            const { printify } = await import("../lib/printify");
            const variantsResult = await printify.getVariants(p.blueprintId, printProviderId);
            const variants = variantsResult.variants || [];
            
            const placementMap = new Map<string, { widthPx: number; heightPx: number }>();
            for (const variant of variants) {
              if (variant.placeholders) {
                for (const placeholder of variant.placeholders) {
                  if (placeholder.position && !placementMap.has(placeholder.position)) {
                    placementMap.set(placeholder.position, {
                      widthPx: placeholder.width,
                      heightPx: placeholder.height
                    });
                  }
                }
              }
            }
            
            placements = Array.from(placementMap.entries()).map(([position, dims]) => {
              const normalized = normalizePlacement('printify', position);
              const widthInches = (dims.widthPx / 300).toFixed(1);
              const heightInches = (dims.heightPx / 300).toFixed(1);
              return {
                id: normalized,
                title: normalized.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                widthPx: dims.widthPx,
                heightPx: dims.heightPx,
                widthInches: `${widthInches}"`,
                heightInches: `${heightInches}"`,
              };
            });
            
            console.log(`[Member Products] Fetched ${placements.length} placements for blueprint ${p.blueprintId}`);
          } catch (e: any) {
            console.log(`[Member Products] Could not fetch placements: ${e.message}`);
          }
        }
        
        if (placements.length === 0) {
          placements = [
            { id: 'front', title: 'Front', widthInches: '12"', heightInches: '16"' },
            { id: 'back', title: 'Back', widthInches: '12"', heightInches: '16"' },
            { id: 'left_chest', title: 'Left Chest', widthInches: '4"', heightInches: '4"' },
            { id: 'sleeve_left', title: 'Left Sleeve', widthInches: '4"', heightInches: '4"' },
            { id: 'sleeve_right', title: 'Right Sleeve', widthInches: '4"', heightInches: '4"' },
          ];
        }
        
        const isPf = p.fulfillmentProvider === 'printful' || String(p.blueprintId ?? '').startsWith('pf:');
        const canonicalBlankKey = isPf
          ? (String(p.blueprintId ?? '').startsWith('pf:') ? String(p.blueprintId) : `pf:${p.blueprintId}`)
          : String(p.blueprintId ?? '');
        const providerDescription = p.providerDescription || p.description || null;
        const adminCatalogDescription = catalogBlankDescriptions[canonicalBlankKey] || null;
        const effectiveDescription = adminCatalogDescription ?? providerDescription ?? null;

        return {
          ...p,
          imageUrl,
          printProviderId,
          baseCost,
          retailPrice,
          profit,
          memberEarnings,
          placements,
          canonicalBlankKey,
          provider: isPf ? 'printful' : 'printify',
          providerDescription,
          adminCatalogDescription,
          effectiveDescription,
        };
      }));
      
      console.log(`[Member Sandbox] Found ${products.length} products, earnings @ ${memberProfitShare * 100}% share`);
      
      if (needsUpdate) {
        console.log(`[Member Products] Persisting ${storedProducts.length} products with migrated URLs...`);
        await firestoreDb.collection("storeAllowedProducts").doc("member-products").update({
          products: storedProducts,
          updatedAt: new Date().toISOString(),
        });
      }
      
      res.json({ products, storeId: "member-products" });
    } catch (error: any) {
      console.error("[Member Sandbox] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/allowed-products", async (req: any, res) => {
    try {
      const { products } = req.body;
      
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: "products must be an array" });
      }
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      await firestoreDb.collection("storeAllowedProducts").doc("member-products").set({
        products,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`[Member Product Library] Saved ${products.length} products to storeAllowedProducts/member-products`);
      
      res.json({ success: true, count: products.length });
    } catch (error: any) {
      console.error("[Member Product Library] Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/tier-products", async (req: any, res) => {
    try {
      const section = (req.query.section as string) || "member";
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { fsGet, fsGetAll } = await import("../lib/firestore-crud");
      const firestoreDb = getFirestoreDb();

      const assignments = await fsGet("systemSettings", "catalog-assignments");
      const defaults = await fsGet("systemSettings", "catalog-defaults");
      const catalogId = assignments?.[section] || defaults?.defaultCatalogId || null;

      if (!catalogId) {
        return res.json({ hasTiers: false, catalogId: null, catalogName: "", tiers: {}, tierConfig: {} });
      }

      const catalog = await fsGet("catalogs", catalogId);
      if (!catalog || !catalog.blankIds?.length) {
        return res.json({ hasTiers: false, catalogId, catalogName: catalog?.name || "", tiers: {}, tierConfig: {} });
      }

      const blankTiers = catalog.blankTiers || {};
      const tierConfig = catalog.tierConfig || {};
      const hasTierAssignments = Object.values(blankTiers).some((t: any) => t && t !== "");
      if (!hasTierAssignments) {
        return res.json({ hasTiers: false, catalogId, catalogName: catalog.name, tiers: {}, tierConfig });
      }

      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;

      const blueprintCache = new Map<string, any>();
      const allBlueprints = await fsGetAll("printifyBlueprints");
      for (const bp of allBlueprints) {
        blueprintCache.set(String(bp.id), bp);
      }

      const printfulCache = new Map<string, any>();
      const allPrintful = await fsGetAll("printfulProducts");
      for (const pf of allPrintful) {
        printfulCache.set(String(pf.id), pf);
      }

      const blankDescriptions = catalog.blankDescriptions || {};
      const tiers: Record<string, Record<string, any>> = {};
      const category = "all";
      tiers[category] = {};

      for (const blankId of catalog.blankIds) {
        const safeId = String(blankId ?? '');
        const isPrintful = safeId.startsWith('pf:');
        const rawId = isPrintful ? safeId.slice(3) : safeId;
        const canonicalKey = safeId;
        const provider = isPrintful ? 'printful' : 'printify';

        const tierKey = blankTiers[canonicalKey] || "good";
        if (!tiers[category][tierKey]) {
          const cfg = tierConfig[tierKey] || {};
          const defaultNames: Record<string, string> = { good: "Good", better: "Better", best: "Best" };
          const defaultDescs: Record<string, string> = { good: "Quality essentials", better: "Premium picks", best: "Top-tier selection" };
          tiers[category][tierKey] = {
            tier: tierKey,
            displayName: cfg.displayName || defaultNames[tierKey] || tierKey,
            description: cfg.description || defaultDescs[tierKey] || "",
            tagline: cfg.tagline || "",
            products: [],
          };
        }

        let bp: any = null;
        if (isPrintful) {
          bp = printfulCache.get(rawId);
        } else {
          bp = blueprintCache.get(rawId);
        }
        if (!bp) continue;

        const baseCost = bp.minCost ? bp.minCost / 100 : bp.baseCost || 0;
        const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
        const profit = retailPrice - baseCost;
        const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;

        const providerDescription = bp.description || bp.model || null;
        const adminCatalogDescription = blankDescriptions[canonicalKey] || null;
        const effectiveDescription = adminCatalogDescription ?? providerDescription ?? null;

        const colors = bp.colors || bp.availableColors || [];
        const sizes = bp.sizes || bp.availableSizes || [];

        tiers[category][tierKey].products.push({
          blueprintId: typeof bp.id === "string" ? parseInt(bp.id, 10) || bp.id : bp.id,
          canonicalBlankKey: canonicalKey,
          provider,
          title: bp.title || bp.name || `Product ${rawId}`,
          imageUrl: bp.images?.[0] || bp.imageUrl || bp.image_url || "",
          brand: bp.brand || "",
          category: bp.category || "",
          retailPrice,
          memberEarnings,
          providerDescription,
          adminCatalogDescription,
          effectiveDescription,
          colors,
          sizes,
        });
      }

      res.json({ hasTiers: true, catalogId, catalogName: catalog.name, tiers, tierConfig });
    } catch (error: any) {
      console.error("[TierProducts] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/:memberId/library", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { publicUrl, storageUrl, assetType, mediaType, name, fileName } = req.body;
      if (!publicUrl) return res.status(400).json({ error: "publicUrl is required" });
      const { fsInsert } = await import("../lib/firestore-crud");
      const asset = await fsInsert("memberLibrary", {
        memberId,
        publicUrl,
        storageUrl: storageUrl || publicUrl,
        assetType: assetType || "graphic",
        mediaType: mediaType || "image",
        name: name || "Untitled",
        fileName: fileName || "untitled.png",
        isActive: true,
      });
      res.json(asset);
    } catch (error: any) {
      console.error("[MemberLibrary] Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
