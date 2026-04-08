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
        fulfillmentProvider: fulfillmentProvider || 'printify',
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
              fulfillmentProvider: fulfillmentProvider || 'printify',
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
        fulfillmentProvider: fulfillmentProvider || 'printify',
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
              fulfillmentProvider: fulfillmentProvider || 'printify',
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

}
