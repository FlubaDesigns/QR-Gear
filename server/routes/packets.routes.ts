import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";
import { PRODUCT_PACKETS_COLLECTION, STORE_PRODUCT_LINKS_COLLECTION } from "../lib/constants";

export function registerPacketRoutes(app: Express): void {

  // ===== PRODUCTION PACKET ROUTES =====

  app.post("/api/packets", isAdmin, async (req: any, res) => {
    try {
      const { 
        qrOnlyUrl, 
        compositeUrl, 
        qrContent,
        headerText,
        footerText,
        pricing,
        productId,
        productName,
        masterTitle,
        adminCatalogTitle,
        effectiveTitle,
        masterDescription,
        adminCatalogDescription,
        effectiveDescription,
        productDescription,
        productImageUrl,
        blueprintId,
        printProviderId,
        manufacturer,
        madeInUSA,
        category,
        defaultColor,
        defaultColorHex,
        defaultPlacement,
        qrProductState,
        placements,
        availablePlacements,
        sizes,
        colors,
        basePrice,
        customerPrice,
        mockupsByColor,
        landingPageTitle,
        landingPageDescription,
        landingPageBackgroundUrl,
        landingPageSlug,
        headerStyle,
        footerStyle,
        roleType,
        storeId,
        storeName,
        channelId,
        channelName,
        fulfillmentProvider,
        playMediaUrl,
        playMediaType,
        // Lineage fields — preserved on every packet so nothing becomes ambiguous
        ownerType,
        ownerInstanceId,
        sourceMasterId,
        sourceAdminInstanceId,
        sourceMemberInstanceId,
      } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const firestoreDb = getFirestoreDb();
      
      const now = FieldValue.serverTimestamp();
      
      const packetData = {
        // Lineage — mandatory on every packet
        ownerType: ownerType || null,
        ownerInstanceId: ownerInstanceId || null,
        sourceMasterId: sourceMasterId || null,
        sourceAdminInstanceId: sourceAdminInstanceId || null,
        sourceMemberInstanceId: sourceMemberInstanceId || null,

        qrOnlyUrl: qrOnlyUrl || null,
        compositeUrl: compositeUrl || null,
        qrContent: qrContent || null,
        headerText: headerText || null,
        footerText: footerText || null,
        pricing: pricing || null,
        productId: productId || null,
        productName: productName || null,
        masterTitle: masterTitle || null,
        adminCatalogTitle: adminCatalogTitle || null,
        effectiveTitle: effectiveTitle || productName || null,
        masterDescription: masterDescription || null,
        adminCatalogDescription: adminCatalogDescription || null,
        effectiveDescription: effectiveDescription || productDescription || null,
        productDescription: productDescription || null,
        productImageUrl: productImageUrl || null,
        blueprintId: blueprintId || null,
        printProviderId: printProviderId || null,
        manufacturer: manufacturer || null,
        madeInUSA: madeInUSA || false,
        category: category || null,
        defaultColor: defaultColor || null,
        defaultColorHex: defaultColorHex || null,
        defaultPlacement: defaultPlacement || null,
        qrProductState: qrProductState || null,
        placements: placements || [],
        availablePlacements: availablePlacements || [],
        sizes: sizes || [],
        colors: colors || [],
        basePrice: basePrice || null,
        customerPrice: customerPrice || null,
        mockupsByColor: mockupsByColor || null,
        landingPageTitle: landingPageTitle || null,
        landingPageDescription: landingPageDescription || null,
        landingPageBackgroundUrl: landingPageBackgroundUrl || null,
        landingPageSlug: landingPageSlug || null,
        headerStyle: headerStyle || null,
        footerStyle: footerStyle || null,
        roleType: roleType || null,
        storeId: storeId || null,
        storeName: storeName || null,
        channelId: channelId || null,
        channelName: channelName || null,
        fulfillmentProvider: fulfillmentProvider || 'printful',
        playMediaUrl: playMediaUrl || null,
        playMediaType: playMediaType || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const packetRef = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
      const packetId = packetRef.id;
      
      console.log(`[Packets] Created packet: ${packetId}`);

      let mockupJobsQueued = 0;
      const canQueueMockups = blueprintId && colors && Array.isArray(colors) && colors.length > 0 &&
        (fulfillmentProvider === 'printful' || printProviderId);
      if (canQueueMockups) {
        try {
          const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
          
          const artworkUrl = compositeUrl || qrOnlyUrl;
          if (artworkUrl) {
            const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
            const qrSizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
            
            const productIdForMockups = `packet_${packetId}`;
            
            console.log(`[Packets] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
            
            const jobs = await mockupJobQueue.createBatchJobs({
              productId: productIdForMockups,
              colors: colors.map((c: any) => ({ name: c.name || c, hex: c.hex || '#000000' })),
              qrSizes,
              placements: targetPlacements,
              blueprintId: parseInt(blueprintId),
              printProviderId: printProviderId ? parseInt(printProviderId) : 0,
              artworkUrl,
              artworkVariant: "black",
              fulfillmentProvider: fulfillmentProvider || 'printful',
            });
            
            mockupJobsQueued = jobs.length;
            console.log(`[Packets] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
          } else {
            console.log(`[Packets] No artwork URL available yet, skipping mockup queue`);
          }
        } catch (err: any) {
          console.error(`[Packets] Failed to queue mockup jobs:`, err.message);
        }
      }

      res.json({
        success: true,
        packetId,
        mockupJobsQueued,
        message: `Product packet created${mockupJobsQueued > 0 ? ` with ${mockupJobsQueued} mockup jobs queued` : ''}`,
      });
    } catch (error: any) {
      console.error("[Packets] Error creating packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/packets", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      
      const packets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        };
      });
      
      console.log(`[Packets] Retrieved ${packets.length} packets`);
      
      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Packets] Error getting packets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const data = doc.data();
      
      let linkedTemplateId = null;
      const templatesSnapshot = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .limit(1)
        .get();
      
      if (!templatesSnapshot.empty) {
        linkedTemplateId = templatesSnapshot.docs[0].id;
      }
      
      res.json({
        success: true,
        packet: {
          id: doc.id,
          ...data,
          templateId: linkedTemplateId,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        },
      });
    } catch (error: any) {
      console.error("[Packets] Error getting packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PACKETS ============
  app.post("/api/admin/packets", isAdmin, async (req: any, res) => {
    try {
      const { 
        qrOnlyUrl, 
        compositeUrl, 
        qrContent,
        headerText,
        footerText,
        pricing,
        productId,
        productName,
        masterTitle,
        adminCatalogTitle,
        effectiveTitle,
        masterDescription,
        adminCatalogDescription,
        effectiveDescription,
        productDescription,
        productImageUrl,
        blueprintId,
        printProviderId,
        manufacturer,
        madeInUSA,
        category,
        defaultColor,
        defaultColorHex,
        defaultPlacement,
        qrProductState,
        placements,
        availablePlacements,
        sizes,
        colors,
        basePrice,
        customerPrice,
        mockupsByColor,
        landingPageTitle,
        landingPageDescription,
        landingPageBackgroundUrl,
        landingPageSlug,
        headerStyle,
        footerStyle,
        roleType,
        storeId,
        storeName,
        channelId,
        channelName,
        fulfillmentProvider,
        playMediaUrl,
        playMediaType,
      } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const firestoreDb = getFirestoreDb();
      
      const now = FieldValue.serverTimestamp();
      
      const packetData = {
        qrOnlyUrl: qrOnlyUrl || null,
        compositeUrl: compositeUrl || null,
        qrContent: qrContent || null,
        headerText: headerText || null,
        footerText: footerText || null,
        pricing: pricing || null,
        productId: productId || null,
        productName: productName || null,
        masterTitle: masterTitle || null,
        adminCatalogTitle: adminCatalogTitle || null,
        effectiveTitle: effectiveTitle || productName || null,
        masterDescription: masterDescription || null,
        adminCatalogDescription: adminCatalogDescription || null,
        effectiveDescription: effectiveDescription || productDescription || null,
        productDescription: productDescription || null,
        productImageUrl: productImageUrl || null,
        blueprintId: blueprintId || null,
        printProviderId: printProviderId || null,
        manufacturer: manufacturer || null,
        madeInUSA: madeInUSA || false,
        category: category || null,
        defaultColor: defaultColor || null,
        defaultColorHex: defaultColorHex || null,
        defaultPlacement: defaultPlacement || null,
        qrProductState: qrProductState || null,
        placements: placements || [],
        availablePlacements: availablePlacements || [],
        sizes: sizes || [],
        colors: colors || [],
        basePrice: basePrice || null,
        customerPrice: customerPrice || null,
        mockupsByColor: mockupsByColor || null,
        landingPageTitle: landingPageTitle || null,
        landingPageDescription: landingPageDescription || null,
        landingPageBackgroundUrl: landingPageBackgroundUrl || null,
        landingPageSlug: landingPageSlug || null,
        headerStyle: headerStyle || null,
        footerStyle: footerStyle || null,
        roleType: roleType || null,
        storeId: storeId || null,
        storeName: storeName || null,
        channelId: channelId || null,
        channelName: channelName || null,
        fulfillmentProvider: fulfillmentProvider || 'printful',
        playMediaUrl: playMediaUrl || null,
        playMediaType: playMediaType || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const packetRef = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
      const packetId = packetRef.id;
      
      console.log(`[Packets TEST] Created packet: ${packetId}`);

      let mockupJobsQueued = 0;
      const canQueueMockups = blueprintId && colors && Array.isArray(colors) && colors.length > 0 &&
        (fulfillmentProvider === 'printful' || printProviderId);
      if (canQueueMockups) {
        try {
          const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
          
          const artworkUrl = compositeUrl || qrOnlyUrl;
          if (artworkUrl) {
            const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
            const qrSizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
            
            const productIdForMockups = `packet_${packetId}`;
            
            console.log(`[Packets TEST] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
            
            const jobs = await mockupJobQueue.createBatchJobs({
              productId: productIdForMockups,
              colors: colors.map((c: any) => ({ name: c.name || c, hex: c.hex || '#000000' })),
              qrSizes,
              placements: targetPlacements,
              blueprintId: parseInt(blueprintId),
              printProviderId: printProviderId ? parseInt(printProviderId) : 0,
              artworkUrl,
              artworkVariant: "black",
              fulfillmentProvider: fulfillmentProvider || 'printful',
            });
            
            mockupJobsQueued = jobs.length;
            console.log(`[Packets TEST] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
          } else {
            console.log(`[Packets TEST] No artwork URL available yet, skipping mockup queue`);
          }
        } catch (err: any) {
          console.error(`[Packets TEST] Failed to queue mockup jobs:`, err.message);
        }
      }

      res.json({
        success: true,
        packetId,
        mockupJobsQueued,
        message: `Product packet created${mockupJobsQueued > 0 ? ` with ${mockupJobsQueued} mockup jobs queued` : ''}`,
      });
    } catch (error: any) {
      console.error("[Packets TEST] Error creating packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/packets/:packetId", isAdmin, async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const doc = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
      if (!doc.exists) return res.status(404).json({ error: "Packet not found" });
      const data = doc.data()!;
      res.json({
        success: true,
        packet: {
          id: doc.id,
          packetId: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
          printifyPublishedAt: data?.printifyPublishedAt?.toDate?.()?.toISOString() || null,
        },
      });
    } catch (error: any) {
      console.error("[Packets] Error getting packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/packets", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      
      const packets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        };
      });
      
      console.log(`[Packets TEST] Retrieved ${packets.length} packets`);
      
      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Packets TEST] Error getting packets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/public/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const data = doc.data();
      
      let linkedTemplateId = null;
      const templatesSnapshot = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .limit(1)
        .get();
      
      if (!templatesSnapshot.empty) {
        linkedTemplateId = templatesSnapshot.docs[0].id;
      }
      
      res.json({
        success: true,
        packet: {
          id: doc.id,
          ...data,
          templateId: linkedTemplateId,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        },
      });
    } catch (error: any) {
      console.error("[Packets TEST] Error getting packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/packets/:packetId", isAdmin, async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const updates = req.body;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb, FieldValue } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      await docRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[Packets PATCH] Updated packet ${packetId}:`, Object.keys(updates));
      
      res.json({
        success: true,
        packetId,
        message: "Packet updated",
      });
    } catch (error: any) {
      console.error("[Packets PATCH] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/packets/:packetId", isAdmin, async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const cascadeResults = {
        graphics: 0,
        templates: 0,
        storeProductLinks: 0,
      };
      
      const graphicsSnap = await firestoreDb.collection("productGraphics")
        .where("packetId", "==", packetId)
        .get();
      for (const graphicDoc of graphicsSnap.docs) {
        await graphicDoc.ref.delete();
        cascadeResults.graphics++;
      }
      
      const templatesSnap = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .get();
      for (const templateDoc of templatesSnap.docs) {
        await templateDoc.ref.delete();
        cascadeResults.templates++;
      }
      
      const linksSnap = await firestoreDb.collection(STORE_PRODUCT_LINKS_COLLECTION)
        .where("packetId", "==", packetId)
        .get();
      for (const linkDoc of linksSnap.docs) {
        await linkDoc.ref.delete();
        cascadeResults.storeProductLinks++;
      }
      
      await docRef.delete();
      
      console.log(`[Packets DELETE] Deleted packet ${packetId} with cascade:`, cascadeResults);
      
      res.json({
        success: true,
        packetId,
        message: "Packet deleted with cascade cleanup",
        cascade: cascadeResults,
      });
    } catch (error: any) {
      console.error("[Packets DELETE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Publish Packet to Printify ─────────────────────────────────────────────
  // Creates (or re-creates) a Printify product from the packet's composite images.
  // Stores printifyProductId, printifyVariantMap, and printifyPublishedAt back on the packet.
  app.post("/api/admin/packets/:packetId/publish-to-printify", isAdmin, async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const overrideProviderId: number | undefined = req.body.printProviderId
        ? parseInt(req.body.printProviderId, 10)
        : undefined;
      const overrideColors: string[] | undefined = Array.isArray(req.body.colors)
        ? req.body.colors
        : undefined;

      const { getFirestoreDb, FieldValue } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const packetDoc = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: `Packet ${packetId} not found` });
      }
      const packet = packetDoc.data()!;

      if (!packet.blueprintId) {
        return res.status(400).json({ error: "Packet is missing blueprintId" });
      }
      if (!packet.compositeUrl) {
        return res.status(400).json({ error: "Packet is missing compositeUrl — regenerate the composite first" });
      }

      const blueprintId = parseInt(packet.blueprintId, 10);
      const printProviderId = overrideProviderId || packet.printProviderId || 99;

      // ── 1. Resolve enabled colors + sizes ──────────────────────────────────
      const rawColors: any[] = overrideColors || packet.colors || packet.enabledColors || [];
      const enabledColors: string[] = rawColors
        .map((c: any) => (typeof c === "string" ? c : c?.name || c?.label || String(c)))
        .filter(Boolean);
      const enabledSizes: string[] = (packet.sizes || packet.enabledSizes || [])
        .map((s: any) => (typeof s === "string" ? s : s?.name || s?.label || String(s)))
        .filter(Boolean);

      if (enabledColors.length === 0 || enabledSizes.length === 0) {
        return res.status(400).json({ error: "Packet has no enabled colors or sizes — add them before publishing" });
      }

      // ── 2. Fetch Printify variants for this blueprint + provider ───────────
      const { printify } = await import("../lib/printify");
      const variantsData = await printify.getVariants(blueprintId, printProviderId);
      const allVariants: Array<{ id: number; title: string }> = variantsData.variants || [];

      const matchedVariants = allVariants.filter((v) => {
        const parts = (v.title || "").split(" / ");
        const vColor = parts[0]?.trim();
        const vSize = parts[1]?.trim();
        if (!vColor || !vSize) return false;
        const colorMatch = enabledColors.some((c) => c.toLowerCase() === vColor.toLowerCase());
        const sizeMatch = enabledSizes.some((s) => s === vSize);
        return colorMatch && sizeMatch;
      });

      if (matchedVariants.length === 0) {
        return res.status(400).json({
          error: `No Printify variants matched for colors [${enabledColors.join(", ")}] and sizes [${enabledSizes.join(", ")}] on blueprint ${blueprintId} / provider ${printProviderId}. Check spelling or choose a different print provider.`,
        });
      }

      const priceInCents = Math.round((packet.pricing?.customerPrice || 29.99) * 100);
      const variantObjs = matchedVariants.map((v) => ({ id: v.id, price: priceInCents, is_enabled: true }));

      // Build color/size → variantId lookup map
      const printifyVariantMap: Record<string, number> = {};
      for (const v of matchedVariants) {
        const parts = (v.title || "").split(" / ");
        const vColor = parts[0]?.trim();
        const vSize = parts[1]?.trim();
        if (vColor && vSize) printifyVariantMap[`${vColor}/${vSize}`] = v.id;
      }

      // ── 3. Upload composite images to Printify ─────────────────────────────
      const PLACEMENT_URL_MAP: Record<string, string> = {
        front: "compositeUrl",
        left_sleeve: "sleeveCompositeUrl",
        right_sleeve: "rightSleeveCompositeUrl",
        back: "backCompositeUrl",
      };

      const placements: string[] = packet.placements || ["front"];

      const placeholders: Array<{
        position: string;
        images: Array<{ id: string; x: number; y: number; scale: number; angle: number }>;
      }> = [];

      for (const placement of placements) {
        const urlField = PLACEMENT_URL_MAP[placement];
        if (!urlField) {
          console.warn(`[PublishToPrintify] Unknown placement "${placement}" — skipping`);
          continue;
        }
        const imageUrl: string | undefined = packet[urlField];
        if (!imageUrl) {
          console.warn(`[PublishToPrintify] Placement "${placement}" has no image URL — skipping`);
          continue;
        }
        const upload = await printify.uploadImage(imageUrl, `${packetId}-${placement}.png`);
        console.log(`[PublishToPrintify] ${placement} image uploaded: ${upload.id}`);
        placeholders.push({
          position: placement,
          images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
        });
      }

      if (placeholders.length === 0) {
        return res.status(400).json({ error: "No placement images could be uploaded to Printify" });
      }

      // ── 4. Create Printify product ─────────────────────────────────────────
      const variantIds = variantObjs.map((v) => v.id);
      const printifyProduct = await printify.createProduct({
        title: packet.effectiveTitle || packet.masterTitle || "QR Gear Product",
        description: packet.effectiveDescription || packet.masterDescription || "",
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantObjs,
        print_areas: [{ variant_ids: variantIds, placeholders }],
      });

      const printifyProductId: string = printifyProduct.id;

      // ── 5. Persist back to Firestore ───────────────────────────────────────
      const publishedAt = new Date();
      await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).update({
        printifyProductId,
        printifyVariantMap,
        printifyPublishedAt: FieldValue.serverTimestamp(),
        printProviderId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[PublishToPrintify] Packet ${packetId} → Printify product ${printifyProductId} (${matchedVariants.length} variants)`);

      res.json({
        success: true,
        printifyProductId,
        printProviderId,
        variantCount: matchedVariants.length,
        printifyVariantMap,
        enabledColors,
        printifyPublishedAt: publishedAt.toISOString(),
      });
    } catch (error: any) {
      console.error("[PublishToPrintify] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: LANDING PAGE ============
  app.get("/api/public/landing/:slug", async (req: any, res) => {
    try {
      const { slug } = req.params;
      
      if (!slug) {
        return res.status(400).json({ error: "slug is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection(PRODUCT_PACKETS_COLLECTION)
        .where("landingPageSlug", "==", slug)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return res.status(404).json({ error: "Landing page not found" });
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      const landingPage = {
        packetId: doc.id,
        title: data.landingPageTitle || data.productName || "QR Product",
        description: data.landingPageDescription || data.productDescription || "",
        backgroundUrl: data.landingPageBackgroundUrl || data.compositeUrl || null,
        compositeUrl: data.compositeUrl || null,
        qrOnlyUrl: data.qrOnlyUrl || null,
        qrContent: data.qrContent || null,
        productName: data.productName || null,
        productImageUrl: data.productImageUrl || null,
        headerStyle: data.headerStyle || null,
        footerStyle: data.footerStyle || null,
        pricing: data.pricing || null,
        createdAt: data.createdAt?.toDate?.() || null,
        landingPageSnapshotUrl: data.landingPageSnapshotUrl || data.compositeUrl || null,
        qrProductState: data.qrProductState || data.mode || "qr_canvas",
        playMediaUrl: data.playMediaUrl || data.videoUrl || null,
        playMediaType: data.playMediaType || data.mediaType || null,
        landingPageTitle: data.landingPageTitle || data.productName || null,
        landingPageDescription: data.landingPageDescription || null,
        landingPageBackgroundUrl: data.landingPageBackgroundUrl || null,
      };
      
      console.log(`[Landing Page] Found page for slug: ${slug}`);
      
      res.json({
        success: true,
        landingPage,
      });
    } catch (error: any) {
      console.error("[Landing Page] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== MEMBER PRODUCT OVERRIDE =====
  // Allows a member to save their own title/description override per packet product.
  app.patch("/api/packets/:packetId/member-product", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberPacketTitle, memberPacketDescription } = req.body;

      if (!packetId) {
        return res.status(400).json({ error: "Missing packetId" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const firestoreDb = getFirestoreDb();

      const docRef = firestoreDb.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }

      const data = doc.data() as any;
      const adminCatalogDesc = data.adminCatalogDescription || null;
      const masterDesc = data.masterDescription || data.productDescription || null;
      const adminCatalogTitleVal = data.adminCatalogTitle || null;
      const masterTitleVal = data.masterTitle || data.productName || null;

      const updates: Record<string, any> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (memberPacketTitle !== undefined) {
        updates.memberPacketTitle = memberPacketTitle || null;
        updates.effectiveTitle = memberPacketTitle || adminCatalogTitleVal || masterTitleVal || "Untitled Product";
      }

      if (memberPacketDescription !== undefined) {
        updates.memberPacketDescription = memberPacketDescription || null;
        updates.effectiveDescription = memberPacketDescription || adminCatalogDesc || masterDesc || null;
      }

      await docRef.update(updates);

      console.log(`[Packets Member] Updated member overrides for packet ${packetId}`);
      res.json({ success: true, updates });
    } catch (error: any) {
      console.error("[Packets Member] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Admin templates list (Library page → Templates tab) ──────────────────
  app.get("/api/admin/templates", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('productTemplates').orderBy('createdAt', 'desc').get();
      const templates = snapshot.docs.map((d: any) => {
        const data = d.data();
        const hasPacketData = !!(
          data.packetId || data.qrContent || data.artworkUrl ||
          data.thumbnailUrl || data.priorityMockupUrl || data.compositeUrl
        );
        const packet = hasPacketData ? {
          id: data.packetId || null,
          compositeUrl: data.artworkUrl || data.thumbnailUrl || data.compositeUrl || null,
          priorityMockupUrl: data.priorityMockupUrl || null,
          qrOnlyUrl: data.qrOnlyUrl || null,
          qrContent: data.qrContent || null,
          headerText: data.headerText || null,
          footerText: data.footerText || null,
          qrProductState: data.qrProductState || null,
          productName: data.productName || data.name || null,
          landingPageSnapshotUrl: data.landingPageSnapshotUrl || null,
        } : null;
        return {
          id: d.id,
          ...data,
          packetId: data.packetId || null,
          packet,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null,
        };
      });
      res.json({ templates });
    } catch (error: any) {
      console.error('[Templates] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/templates/:templateId", isAdmin, async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('productTemplates').doc(templateId).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Templates] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

}
