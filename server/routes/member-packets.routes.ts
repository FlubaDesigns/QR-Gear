import type { Express } from "express";
import { lookupPrintifyCosts } from "../lib/printify-cost-lookup";
import { verifyMemberAuth } from "./member-auth";
import { QR_DYNAMICS_INSTANCES_COLLECTION, MEMBER_PACKETS_COLLECTION } from "../lib/constants";

export function registerMemberPacketsRoutes(app: Express): void {
  app.post("/api/members/:memberId/channels", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { name, storeId } = req.body;

      if (!memberId || !name) {
        return res.status(400).json({ error: "memberId and name are required" });
      }
      
      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const channelData = {
        name,
        storeId: storeId || 'qr-gear',
        ownerId: memberId,
        type: 'member',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await firestoreDb.collection("channels").add(channelData);

      res.json({
        id: docRef.id,
        ...channelData
      });
    } catch (error: any) {
      console.error("[Member Channels POST] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/:memberId/products", async (req: any, res) => {
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
      
      const snapshot = await firestoreDb.collection("memberProducts")
        .where("memberId", "==", memberId)
        .orderBy("createdAt", "desc")
        .get();

      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(products);
    } catch (error: any) {
      console.error("[Member Products] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/members/:memberId/products", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const body = req.body;
      const {
        printfulProductId,
        variantId,
        graphicUrl,
        name,
        price,
        packetType,
        title,
        description,
        background,
        storeId,
        status,
        qrType,
        channelId,
        headerText,
        footerText,
        videoUrl,
        textLines,
        textUpcharge,
        placementUpcharge,
        memberEarnings,
        boundProduct,
        selectedColor,
        selectedShirtSize,
        selectedPlacements,
        perPlacementConfigs,
        perPlacementSizes,
        graphicSize,
        textLayoutChoice,
        headerStyle,
        footerStyle,
        qrDestination,
        qrGraphic: clientQrGraphic,
        productGraphic: clientProductGraphic,
        originalUrlGraphic,
        qrBasicInputType,
        qrBasicContent,
        qrBasicMockup,
        qrBasicSaveChoice,
        qrPlusMockup,
        qrPlusSaveChoice,
        qrCanvasMockup,
        qrPlayMockup,
        source,
      } = body;

      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const { getFirestoreDb, getStorageBucket } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      if (packetType === 'qr-canvas' || packetType === 'qr-play' || packetType === 'qr-basic' || packetType === 'qr-plus' || packetType === 'qr-compose') {

        const existingPacketId = body.existingPacketId;
        let packetId: string;
        
        if (existingPacketId) {
          packetId = existingPacketId;
          console.log(`[UnifiedPublish] Using existing packet ID from wizard: ${packetId}`);
        } else {
          packetId = `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          const blueprintId = boundProduct?.blueprintId || null;
          if (blueprintId && selectedColor) {
            try {
              const existingSnapshot = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION)
                .where('memberId', '==', memberId)
                .where('packetType', '==', packetType)
                .where('boundProduct.blueprintId', '==', blueprintId)
                .where('selectedColor', '==', selectedColor)
                .where('status', '==', 'building')
                .limit(1)
                .get();
              if (!existingSnapshot.empty) {
                const existingDoc = existingSnapshot.docs[0];
                packetId = existingDoc.id;
                console.log(`[UnifiedPublish] Dedup: replacing existing building packet ${packetId}`);
              }
            } catch (dedupErr) {
              console.warn('[UnifiedPublish] Dedup check failed (non-fatal):', dedupErr);
            }
          }
        }

        const baseUrl = process.env.PUBLIC_URL || 'https://qrgear-c1ffd.web.app';
        const destinationUrl = `${baseUrl}/view/${packetId}`;

        let serverQrGraphicUrl = clientQrGraphic || null;
        let serverProductGraphicUrl = clientProductGraphic || null;
        if (packetType === 'qr-canvas' || packetType === 'qr-play') {
          try {
            const { generateTextQRCode } = await import("../lib/qr-generator");
            const qrGraphicDataUrl = await generateTextQRCode(destinationUrl, { color: '#000000', backgroundColor: '#FFFFFF' });
            const bucket = getStorageBucket();
            const qrGraphicPath = `members/${memberId}/qr-graphics/${packetId}-qr.png`;
            const qrBuffer = Buffer.from(qrGraphicDataUrl.split(',')[1], 'base64');
            const qrFile = bucket.file(qrGraphicPath);
            await qrFile.save(qrBuffer, { contentType: 'image/png' });
            await qrFile.makePublic();
            serverQrGraphicUrl = `https://storage.googleapis.com/${bucket.name}/${qrGraphicPath}`;

            serverProductGraphicUrl = serverQrGraphicUrl;
            if (headerText || footerText) {
              const { generateCompositeImage } = await import("../lib/composite-image-generator");
              const productGraphicDataUrl = await generateCompositeImage({
                width: 1200,
                height: 1800,
                backgroundColor: 'transparent',
                qrUrl: destinationUrl,
                qrSize: 600,
                qrColor: 'black',
                topText: headerText ? { text: headerText, fontFamily: 'Arial', fontSize: '24px', color: '#000000' } : null,
                bottomText: footerText ? { text: footerText, fontFamily: 'Arial', fontSize: '24px', color: '#000000' } : null
              });
              const productGraphicPath = `members/${memberId}/product-graphics/${packetId}-product.png`;
              const productBuffer = Buffer.from(productGraphicDataUrl.split(',')[1], 'base64');
              const productFile = bucket.file(productGraphicPath);
              await productFile.save(productBuffer, { contentType: 'image/png' });
              await productFile.makePublic();
              serverProductGraphicUrl = `https://storage.googleapis.com/${bucket.name}/${productGraphicPath}`;
            }
          } catch (qrErr) {
            console.warn('[UnifiedPublish] QR generation failed (non-fatal):', qrErr);
          }
        }

        const now = new Date().toISOString();
        const packetData: Record<string, any> = {
          id: packetId,
          memberId,
          storeId: storeId || memberId,
          channelId: channelId || null,
          packetType,
          title: title || 'Untitled',
          description: description || '',
          status: status || 'published',
          createdAt: now,
          updatedAt: now,
          source: source || { entryPoint: 'wizard' },
          boundProduct: boundProduct || null,
          selectedColor: selectedColor || null,
          selectedShirtSize: selectedShirtSize || null,
          selectedPlacements: selectedPlacements || null,
          perPlacementConfigs: perPlacementConfigs || null,
          perPlacementSizes: perPlacementSizes || null,
          graphicSize: graphicSize || null,
          textLayoutChoice: textLayoutChoice || null,
          headerStyle: headerStyle || null,
          footerStyle: footerStyle || null,
          qrType: qrType || packetType,
          qrDestination: qrDestination || null,
          qrGraphic: serverQrGraphicUrl || clientQrGraphic || null,
          productGraphic: serverProductGraphicUrl || clientProductGraphic || null,
          urlGraphic: background || null,
          originalUrlGraphic: originalUrlGraphic || null,
          videoUrl: videoUrl || null,
          destinationUrl: (packetType === 'qr-canvas' || packetType === 'qr-play') ? destinationUrl : null,
          qrBasicInputType: qrBasicInputType || null,
          qrBasicContent: qrBasicContent || null,
          qrBasicMockup: qrBasicMockup || null,
          qrBasicSaveChoice: qrBasicSaveChoice || null,
          qrPlusMockup: qrPlusMockup || null,
          qrPlusSaveChoice: qrPlusSaveChoice || null,
          qrCanvasMockup: qrCanvasMockup || null,
          qrPlayMockup: qrPlayMockup || null,
          composeMockup: body.composeMockup || null,
          composeItems: body.composeItems || null,
          composeMode: body.composeMode || 'auto-rotate',
          composeHostingTerm: body.composeHostingTerm || null,
          composeInstanceId: null,
          textLines: textLines || 0,
          textUpcharge: textUpcharge || 0,
          placementUpcharge: placementUpcharge || 0,
          memberEarnings: memberEarnings || 0,
        };

        try {
          if (boundProduct?.blueprintId && boundProduct?.printProviderId) {
            const costData = await lookupPrintifyCosts(boundProduct.blueprintId, boundProduct.printProviderId);

            const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
            const pricingSettings = pricingDoc.exists ? pricingDoc.data() : {};
            const pMarkupPercent = pricingSettings?.markupPercent ?? 25;
            const pMarkupFixed = pricingSettings?.markupFixed ?? 0;
            const pAdditionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
            const pTextLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
            const pMemberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
            const pSizeUpcharges: Record<string, number> = pricingSettings?.sizeUpcharges ?? { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
            const pHostingTiers: Array<{ code: string; name: string; price: number }> = pricingSettings?.hostingTiers ?? [
              { code: "1_year", name: "1 Year", price: 5 },
              { code: "2_year", name: "2 Years", price: 8 },
              { code: "3_year", name: "3 Years", price: 10 },
            ];

            const printifyCostBase = costData.baseCost;
            const numTextLines = textLines || 0;
            const textUpchargeTotal = numTextLines * pTextLineUpcharge;
            const placements = selectedPlacements ? (Array.isArray(selectedPlacements) ? selectedPlacements : [selectedPlacements]) : [];
            const extraPlacements = Math.max(0, placements.length - 1);
            const placementUpchargeTotal = extraPlacements * pAdditionalPlacementCost;

            let hostingTierCode: string | null = null;
            let hostingCost = 0;
            const composeHostingTerm = body.composeHostingTerm || null;
            if (composeHostingTerm) {
              const tier = pHostingTiers.find(t => t.code === composeHostingTerm);
              if (tier) {
                hostingTierCode = tier.code;
                hostingCost = tier.price;
              }
            }

            const totalCostBase = printifyCostBase + textUpchargeTotal + placementUpchargeTotal + hostingCost;
            const retailPriceBase = Math.round((totalCostBase * (1 + pMarkupPercent / 100) + pMarkupFixed) * 100) / 100;
            const profitBase = Math.round((retailPriceBase - printifyCostBase) * 100) / 100;
            const memberEarningsBase = Math.round((profitBase * pMemberProfitShare) * 100) / 100;
            const adminMarginBase = Math.round((profitBase - memberEarningsBase) * 100) / 100;

            const earningsBySize: Record<string, number> = {};
            const earningsValues: number[] = [];
            for (const [size, sizeCost] of Object.entries(costData.variantCosts)) {
              const sizeTotal = sizeCost + textUpchargeTotal + placementUpchargeTotal + hostingCost;
              const sizeRetail = Math.round((sizeTotal * (1 + pMarkupPercent / 100) + pMarkupFixed) * 100) / 100;
              const sizeProfit = Math.round((sizeRetail - sizeCost) * 100) / 100;
              const sizeEarnings = Math.round((sizeProfit * pMemberProfitShare) * 100) / 100;
              earningsBySize[size] = sizeEarnings;
              earningsValues.push(sizeEarnings);
            }

            const memberEarningsRange = earningsValues.length > 0
              ? { min: Math.min(...earningsValues), max: Math.max(...earningsValues) }
              : { min: memberEarningsBase, max: memberEarningsBase };

            const pricingSnapshot = {
              printifyCostBase,
              printifyCostVariants: costData.variantCosts,
              printifySizeUpcharges: costData.sizeUpcharges,
              customerPrice: retailPriceBase,
              textLines: numTextLines,
              textUpchargeTotal,
              extraPlacements,
              placementUpchargeTotal,
              hostingTier: hostingTierCode,
              hostingCost,
              markupPercent: pMarkupPercent,
              markupFixed: pMarkupFixed,
              totalCostBase,
              retailPriceBase,
              profitBase,
              memberProfitShare: pMemberProfitShare,
              memberEarningsBase,
              adminMarginBase,
              earningsBySize,
              memberEarningsRange,
              calculatedAt: new Date().toISOString(),
            };

            packetData.pricingSnapshot = pricingSnapshot;
            console.log(`[UnifiedPublish] Pricing snapshot attached for packet ${packetId}: base=$${printifyCostBase.toFixed(2)}, retail=$${retailPriceBase.toFixed(2)}`);
          }
        } catch (pricingErr: any) {
          console.error(`[UnifiedPublish] Pricing snapshot failed (non-fatal) for packet ${packetId}:`, pricingErr.message || pricingErr);
        }

        await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).set(packetData);
        console.log(`[UnifiedPublish] Saved complete ${packetType} packet ${packetId} for member ${memberId}`);

        if (packetType === 'qr-compose' && body.composeItems && Array.isArray(body.composeItems)) {
          try {
            const nowEpoch = Math.floor(Date.now() / 1000);
            const instanceData = {
              memberId,
              packetId,
              createdAt: nowEpoch,
              startTimestamp: nowEpoch,
              mode: 'loop',
              composeMode: body.composeMode || 'auto-rotate',
              hostingTerm: body.composeHostingTerm || '1-year',
              fallbackUrl: null,
              slots: body.composeItems.map((item: any, index: number) => ({
                slotId: `slot-${Date.now()}-${index}`,
                packetId: item.packetId,
                name: item.name || 'Untitled',
                thumbnailUrl: item.thumbnailUrl || null,
                type: item.type || 'qr-canvas',
                durationSeconds: item.durationSeconds || 86400,
                order: item.order ?? index + 1,
              })),
            };
            const instanceRef = await firestoreDb.collection(QR_DYNAMICS_INSTANCES_COLLECTION).add(instanceData);
            await firestoreDb.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).update({
              composeInstanceId: instanceRef.id,
              destinationUrl: `/qr/d/${instanceRef.id}`,
            });
            packetData.composeInstanceId = instanceRef.id;
            packetData.destinationUrl = `/qr/d/${instanceRef.id}`;
            console.log(`[QR Compose] Created dynamics instance ${instanceRef.id} for packet ${packetId}`);
          } catch (instanceErr: any) {
            console.error('[QR Compose] Instance creation failed (non-fatal):', instanceErr);
          }
        }

        res.json(packetData);
        return;
      }
      
      if (!printfulProductId) {
        return res.status(400).json({ error: "printfulProductId is required for product creation" });
      }
      
      const productData = {
        memberId,
        printfulProductId,
        variantId,
        graphicUrl,
        qrType: qrType || 'play',
        qrDestination,
        channelId,
        name: name || 'My Product',
        price: price || 0,
        textLines: textLines || 0,
        textUpcharge: textUpcharge || 0,
        placementUpcharge: placementUpcharge || 0,
        memberEarnings: memberEarnings || 0,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await firestoreDb.collection("memberProducts").add(productData);

      res.json({
        id: docRef.id,
        ...productData
      });
    } catch (error: any) {
      console.error("[Member Products POST] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/:memberId/published-items", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { types } = req.query;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      const auth = await verifyMemberAuth(req, memberId);
      if (!auth.authorized) {
        return res.status(401).json({ error: auth.error });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const snapshot = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION)
        .where('memberId', '==', memberId)
        .where('status', '==', 'published')
        .get();

      let items = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        packetId: doc.id,
        ...doc.data()
      }));

      if (types) {
        const typeList = (types as string).split(',').map((t: string) => t.trim());
        items = items.filter((item: any) => typeList.includes(item.packetType));
      }

      console.log(`[PublishedItems] Found ${items.length} items for member ${memberId}`);
      res.json({ items });
    } catch (error: any) {
      console.error("[PublishedItems] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/members/:memberId/earnings", async (req: any, res) => {
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
      
      const snapshot = await firestoreDb.collection("memberEarnings")
        .where("memberId", "==", memberId)
        .orderBy("createdAt", "desc")
        .get();

      const earnings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const totalEarnings = earnings.reduce((sum, e: any) => sum + (e.amount || 0), 0);
      const pendingEarnings = earnings
        .filter((e: any) => e.status === 'pending')
        .reduce((sum, e: any) => sum + (e.amount || 0), 0);
      const paidEarnings = earnings
        .filter((e: any) => e.status === 'paid')
        .reduce((sum, e: any) => sum + (e.amount || 0), 0);

      res.json({
        earnings,
        summary: {
          total: totalEarnings,
          pending: pendingEarnings,
          paid: paidEarnings,
          profitShare: 0.25
        }
      });
    } catch (error: any) {
      console.error("[Member Earnings] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
