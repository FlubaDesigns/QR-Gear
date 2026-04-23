import type { Express } from "express";
import { storage } from "../storage";
import { verifyMemberAuth } from "./member-auth";

export function registerMemberPublicWizardRoutes(app: Express): void {
  app.post("/api/members/:memberId/claim-temp-packet", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { tempPacketId } = req.body;
      if (!tempPacketId) {
        return res.status(400).json({ error: "tempPacketId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const docRef = db.collection('temp_packets').doc(tempPacketId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Temp packet not found or expired" });
      }

      const packet = doc.data()!;
      if (packet.status === 'completed') {
        return res.status(410).json({ error: "Temp packet already used" });
      }

      await docRef.update({
        claimedByMemberId: memberId,
        claimedAt: new Date().toISOString(),
        status: 'claimed',
        updatedAt: new Date().toISOString(),
      });

      console.log(`[TempPacket] Claimed ${tempPacketId} by member ${memberId}`);

      res.json({
        success: true,
        packetConfig: {
          blueprintId: packet.blueprintId || null,
          productTitle: packet.productTitle || null,
          selectedColor: packet.selectedColor || null,
          selectedShirtSize: packet.selectedShirtSize || null,
          qrType: packet.qrType || null,
          selectedPlacements: packet.selectedPlacements || [],
          graphicSize: packet.graphicSize || null,
          headerStyle: packet.headerStyle || null,
          footerStyle: packet.footerStyle || null,
          textLayoutChoice: packet.textLayoutChoice || null,
          qrBasicContent: packet.qrBasicContent || null,
          mockupUrl: packet.mockupUrl || null,
          lifestyleMockupUrl: packet.lifestyleMockupUrl || null,
        },
      });
    } catch (error: any) {
      console.error("[TempPacket] Claim error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/public/packets", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const packetData = {
        status: 'building',
        ...req.body,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      const docRef = await db.collection('temp_packets').add(packetData);
      console.log(`[TempPacket] Created: ${docRef.id}`);

      res.json({
        success: true,
        tempPacketId: docRef.id,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: any) {
      console.error("[TempPacket] Create error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch("/api/public/packets/:tempPacketId", async (req: any, res) => {
    try {
      const { tempPacketId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const docRef = db.collection('temp_packets').doc(tempPacketId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, error: "Temp packet not found" });
      }

      const existing = doc.data();
      if (existing?.status === 'completed') {
        return res.status(400).json({ success: false, error: "Packet already completed" });
      }

      await docRef.update({
        ...req.body,
        updatedAt: new Date().toISOString(),
      });

      console.log(`[TempPacket] Updated: ${tempPacketId}`);
      res.json({ success: true, tempPacketId });
    } catch (error: any) {
      console.error("[TempPacket] Update error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/public/packets/:tempPacketId", async (req: any, res) => {
    try {
      const { tempPacketId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const doc = await db.collection('temp_packets').doc(tempPacketId).get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, error: "Temp packet not found" });
      }

      res.json({ success: true, packet: { id: doc.id, ...doc.data() } });
    } catch (error: any) {
      console.error("[TempPacket] Get error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/public/packets/:tempPacketId/complete", async (req: any, res) => {
    try {
      const { tempPacketId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const docRef = db.collection('temp_packets').doc(tempPacketId);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ success: false, error: "Temp packet not found" });
      }

      await docRef.update({
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`[TempPacket] Completed: ${tempPacketId}`);
      res.json({ success: true, tempPacketId });
    } catch (error: any) {
      console.error("[TempPacket] Complete error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete("/api/public/packets/cleanup/expired", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();
      const now = new Date().toISOString();

      const expiredQuery = await db.collection('temp_packets')
        .where('status', '==', 'building')
        .where('expiresAt', '<', now)
        .limit(100)
        .get();

      let deletedCount = 0;
      const batch = db.batch();
      expiredQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      console.log(`[TempPacket] Cleanup: deleted ${deletedCount} expired packets`);
      res.json({ success: true, deletedCount });
    } catch (error: any) {
      console.error("[TempPacket] Cleanup error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/public/checkout", async (req: any, res) => {
    try {
      const { tempPacketId } = req.body;
      if (!tempPacketId) {
        return res.status(400).json({ error: "Missing tempPacketId" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Temp packet not found" });
      }

      const packet = packetDoc.data()!;
      if (packet.status === 'completed') {
        return res.status(400).json({ error: "This packet has already been purchased" });
      }

      const pricingDoc = await db.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;

      const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
      const sizeUpcharges = pricingSettings?.sizeUpcharges || defaultSizeUpcharges;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;

      const basePrice = parseFloat(packet.retailPrice) || pricingSettings?.baseRetailPrice || 29.99;

      const selectedSize = packet.selectedShirtSize || packet.selectedSize || 'M';
      const sizeUpcharge = sizeUpcharges[selectedSize] || 0;

      const placements = packet.selectedPlacements || ['front'];
      const placementCost = Math.max(0, placements.length - 1) * additionalPlacementCost;

      const textLayout = packet.textLayoutChoice || '';
      let textLines = 0;
      if (textLayout === 'both') textLines = 2;
      else if (textLayout === 'header' || textLayout === 'footer') textLines = 1;
      const textCost = textLines * textLineUpcharge;

      const serverTotal = Math.round((basePrice + sizeUpcharge + placementCost + textCost) * 100) / 100;

      console.log(`[PublicCheckout] Price validation — base: $${basePrice}, size: +$${sizeUpcharge}, placement: +$${placementCost}, text: +$${textCost}, total: $${serverTotal}`);

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();

      const productTitle = packet.productTitle || 'QR Gear Custom Product';
      const colorName = packet.selectedColor || packet.colorHex || '';
      const qrType = packet.qrType || 'qr-basic';

      const description = [
        `${qrType.replace('qr-', 'QR ').replace(/^\w/, (c: string) => c.toUpperCase())}`,
        colorName ? `Color: ${colorName}` : '',
        `Size: ${selectedSize}`,
      ].filter(Boolean).join(' | ');

      const baseUrl = process.env.FIREBASE_HOSTING_URL || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: productTitle,
              description,
              images: packet.mockupUrl ? [
                packet.mockupUrl.startsWith('http') 
                  ? packet.mockupUrl 
                  : `${baseUrl}${packet.mockupUrl}`
              ] : [],
            },
            unit_amount: Math.round(serverTotal * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/build/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/build`,
        metadata: {
          tempPacketId,
          source: 'public_wizard',
          serverTotal: serverTotal.toString(),
        },
        customer_creation: 'if_required',
      });

      await packetDoc.ref.update({
        stripeSessionId: session.id,
        serverCalculatedTotal: serverTotal,
        checkoutCreatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`[PublicCheckout] Session created: ${session.id} for packet ${tempPacketId}, total: $${serverTotal}`);
      res.json({ url: session.url, sessionId: session.id, total: serverTotal });
    } catch (error: any) {
      console.error('[PublicCheckout] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/public/checkout/verify/:sessionId", async (req: any, res) => {
    try {
      const { sessionId } = req.params;

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const tempPacketId = session.metadata?.tempPacketId;
      if (!tempPacketId) {
        return res.status(400).json({ error: "No packet linked to this session" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const db = getFirestoreDb();

      const existingOrderQuery = await db.collection('orders_public')
        .where('stripeSessionId', '==', sessionId)
        .limit(1)
        .get();

      if (!existingOrderQuery.empty) {
        const existingOrder = existingOrderQuery.docs[0].data();
        return res.json({
          success: true,
          alreadyProcessed: true,
          order: { id: existingOrderQuery.docs[0].id, ...existingOrder },
        });
      }

      const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Temp packet not found" });
      }
      const packet = packetDoc.data()!;

      const { generateUniqueClaimCode } = await import('../lib/claimCodeGenerator');
      const claimCode = await generateUniqueClaimCode(db);

      const buyerEmail = (session.customer_details as any)?.email || '';
      const buyerName = (session.customer_details as any)?.name || '';
      const now = new Date();

      const realPacketData = {
        ...packet,
        status: 'purchased',
        source: 'public_wizard',
        buyerEmail,
        buyerName,
        stripeSessionId: sessionId,
        stripePaymentIntentId: session.payment_intent as string,
        purchasedAt: now.toISOString(),
        createdAt: packet.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      } as any;
      delete realPacketData.expiresAt;
      delete realPacketData.checkoutCreatedAt;
      delete realPacketData.serverCalculatedTotal;

      const realPacketRef = await db.collection('product_packets').add(realPacketData);
      console.log(`[PublicCheckout] Real packet created: ${realPacketRef.id} from temp ${tempPacketId}`);

      const serverTotal = parseFloat(packet.serverCalculatedTotal || session.amount_total! / 100);
      const orderData = {
        tempPacketId,
        realPacketId: realPacketRef.id,
        stripeSessionId: sessionId,
        stripePaymentIntentId: session.payment_intent as string,
        buyerEmail,
        buyerName,
        claimCode,
        productTitle: packet.productTitle || 'QR Gear Product',
        qrType: packet.qrType || 'qr-basic',
        selectedColor: packet.selectedColor || '',
        selectedSize: packet.selectedShirtSize || packet.selectedSize || 'M',
        totalAmount: serverTotal,
        mockupUrl: packet.mockupUrl || null,
        lifestyleMockupUrl: packet.lifestyleMockupUrl || null,
        status: 'paid',
        graphicRetainedUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const orderRef = await db.collection('orders_public').add(orderData);
      console.log(`[PublicCheckout] Order created: ${orderRef.id}, claim code: ${claimCode}`);

      await packetDoc.ref.update({
        status: 'completed',
        completedAt: now.toISOString(),
        realPacketId: realPacketRef.id,
        orderId: orderRef.id,
        updatedAt: now.toISOString(),
      });

      try {
        await storage.createOrderUnified({
          sourceChannel: "public_wizard",
          externalOrderId: orderRef.id,
          customerEmail: buyerEmail,
          customerName: buyerName || null,
          shippingAddress: null,
          items: [{
            masterProductId: packet.blueprintId?.toString() || null,
            variantSku: `public-${packet.qrType || 'basic'}`,
            quantity: 1,
            price: serverTotal,
            productTitle: packet.productTitle || 'QR Gear Product',
            size: packet.selectedShirtSize || packet.selectedSize || null,
            color: packet.selectedColor || null,
            actualPrintifyCost: null,
            memberEarningsActual: null,
            adminMarginActual: null,
          }],
          subtotal: serverTotal.toFixed(2),
          total: serverTotal.toFixed(2),
          status: "pending",
          statusHistory: [
            { status: "paid", timestamp: now.toISOString(), note: "Payment received via Stripe (public wizard)" },
            { status: "pending", timestamp: now.toISOString(), note: "Awaiting fulfillment routing" },
          ],
        });
      } catch (unifiedErr) {
        console.error("[PublicCheckout] Failed to create unified order (non-fatal):", unifiedErr);
      }

      try {
        const { sendOrderConfirmationEmail } = await import('../lib/email');
        if (buyerEmail) {
          await sendOrderConfirmationEmail({
            orderId: orderRef.id,
            customerEmail: buyerEmail,
            customerName: buyerName || 'Customer',
            items: [{
              productId: realPacketRef.id,
              quantity: 1,
              price: serverTotal,
            }],
            totalAmount: serverTotal,
            orderDate: now,
          });
          console.log(`[PublicCheckout] Confirmation email sent to ${buyerEmail}`);
        }
      } catch (emailErr) {
        console.error("[PublicCheckout] Failed to send confirmation email (non-fatal):", emailErr);
      }

      // Send activation-code-specific email so the buyer has it prominently
      try {
        const { sendActivationEmail } = await import('../lib/email');
        if (buyerEmail) {
          await sendActivationEmail({
            customerEmail: buyerEmail,
            customerName: buyerName || 'Customer',
            activationCode: claimCode,
            productName: packet.productTitle || 'QR Gear Product',
            previewImageUrl: packet.mockupUrl || packet.lifestyleMockupUrl || null,
            orderId: orderRef.id,
          });
          console.log(`[PublicCheckout] Activation email sent to ${buyerEmail} with code ${claimCode}`);
        }
      } catch (activationEmailErr) {
        console.error("[PublicCheckout] Failed to send activation email (non-fatal):", activationEmailErr);
      }

      res.json({
        success: true,
        order: {
          id: orderRef.id,
          ...orderData,
        },
        realPacketId: realPacketRef.id,
        claimCode,
      });
    } catch (error: any) {
      console.error('[PublicCheckout] Verify error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/public/generate-mockup", async (req: any, res) => {
    try {
      const {
        tempPacketId,
        blueprintId,
        printProviderId,
        colorName,
        colorHex,
        placement = 'front',
        qrSize = 'medium',
        fulfillmentProvider = 'printify',
        qrUrl,
        headerStyle,
        footerStyle,
        textLayoutChoice,
        qrColor = 'black',
      } = req.body;

      if (!blueprintId || !colorName) {
        return res.status(400).json({ error: "Missing required fields: blueprintId, colorName" });
      }

      console.log(`[PublicMockup] Starting for packet: ${tempPacketId || 'none'}, color: ${colorName}`);

      let artworkUrl: string;

      const hasHeaderContent = headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl);
      const hasFooterContent = footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl);
      if (textLayoutChoice && textLayoutChoice !== '' && (hasHeaderContent || hasFooterContent)) {
        console.log(`[PublicMockup] Generating composite artwork with text layout: ${textLayoutChoice}`);
        const { generatePrintifyComposite } = await import("../lib/composite-image-generator");

        const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
        const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';

        const topText = showHeader && hasHeaderContent ? {
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

        const bottomText = showFooter && hasFooterContent ? {
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

        const compositeDataUrl = await generatePrintifyComposite(
          qrUrl || 'https://example.com',
          topText,
          bottomText,
          1200,
          1800,
          qrColor as 'black' | 'white'
        );

        const { uploadToFirebasePublic } = await import("../lib/firebase-storage-service");
        const match = compositeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          throw new Error("Invalid data URL format from composite generator");
        }

        const buffer = Buffer.from(match[2], 'base64');
        const uploadResult = await uploadToFirebasePublic(buffer, match[1], 'public-graphics');
        artworkUrl = uploadResult.publicUrl;
        console.log(`[PublicMockup] Composite uploaded: ${artworkUrl}`);
      } else {
        const qrContent = qrUrl || 'https://example.com';
        artworkUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrContent)}&format=png&qzone=2&ecc=H&color=000000&bgcolor=ffffff`;
        console.log(`[PublicMockup] Using raw QR artwork: ${artworkUrl}`);
      }

      const { getMockupWithFallback } = await import("../lib/mockup-service");
      const storageModule = (await import("../storage")).storage;

      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex: colorHex || '#000000',
        canonicalPlacementId: placement,
        artworkUrl,
        artworkVariant: qrColor === 'white' ? 'white' : 'black',
        qrSize: qrSize as 'small' | 'medium' | 'large',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      }, storageModule);

      console.log(`[PublicMockup] Mockup generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      if (tempPacketId) {
        try {
          const { getFirestoreDb } = await import("../lib/firebase-admin");
          const db = getFirestoreDb();
          await db.collection('temp_packets').doc(tempPacketId).update({
            mockupUrl: result.mockupUrl,
            lifestyleMockupUrl: result.lifestyleMockupUrl,
            artworkUrl,
            updatedAt: new Date().toISOString(),
          });
          console.log(`[PublicMockup] Packet ${tempPacketId} updated with mockup`);
        } catch (pktErr: any) {
          console.warn(`[PublicMockup] Failed to update packet: ${pktErr.message}`);
        }
      }

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        artworkUrl,
        fromCache: result.fromCache,
      });
    } catch (error: any) {
      console.error("[PublicMockup] Error:", error);
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  // ── Public creator surface ─────────────────────────────────────────────────
  // GET /api/public/creator/:slug — no auth required
  // Accepts creatorSlug (human handle) or memberId (UID) as fallback
  app.get("/api/public/creator/:slug", async (req: any, res) => {
    try {
      const { slug } = req.params;
      if (!slug) return res.status(400).json({ error: "slug is required" });

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { MEMBER_PACKETS_COLLECTION } = await import("../lib/constants");
      const firestoreDb = getFirestoreDb();

      let profileSnap: any = null;
      let userId: string | null = null;

      // Primary: lookup by creatorSlug field
      const bySlug = await firestoreDb.collection("member_profiles").where("creatorSlug", "==", slug).limit(1).get();
      if (!bySlug.empty) {
        profileSnap = bySlug.docs[0];
        userId = bySlug.docs[0].id;
      } else {
        // Fallback: treat slug as Firebase UID (doc ID)
        const byId = await firestoreDb.collection("member_profiles").doc(slug).get();
        if (byId.exists) { profileSnap = byId; userId = byId.id; }
      }

      if (!profileSnap || !userId) return res.status(404).json({ error: "Creator not found" });

      const profileData = profileSnap.data()!;

      // Published packets for this member, newest first
      const packetsSnap = await firestoreDb.collection(MEMBER_PACKETS_COLLECTION)
        .where("memberId", "==", userId)
        .where("status", "==", "published")
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();

      const items = packetsSnap.docs.map((doc: any) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || "QR Gear Product",
          description: d.description || "",
          itemImage: d.qrCanvasMockup || d.qrBasicMockup || d.qrPlusMockup || d.qrPlayMockup || d.composeMockup || d.productGraphic || null,
          retailPrice: d.pricingSnapshot?.retailPriceBase ?? d.pricingSnapshot?.customerPrice ?? null,
          qrType: d.qrType || d.packetType || null,
          status: d.status || "published",
          channelId: d.channelId || null,
          updatedAt: d.updatedAt || "",
        };
      });

      // Resolve channel display name from first packet with a channelId
      let channelName: string | null = null;
      const firstChannelId = items.find((p: any) => p.channelId)?.channelId;
      if (firstChannelId) {
        try {
          const channelDoc = await firestoreDb.collection("channels").doc(firstChannelId).get();
          if (channelDoc.exists) channelName = (channelDoc.data() as any)?.name || null;
        } catch (_) {}
      }

      return res.json({
        success: true,
        profile: {
          storeName: profileData.storeName || "",
          fullName: profileData.fullName || "",
          creatorSlug: profileData.creatorSlug || slug,
          memberId: userId,
        },
        items,
        channelName,
      });
    } catch (error: any) {
      console.error("[PublicCreator] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
