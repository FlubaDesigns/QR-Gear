import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { uploadToFirebaseStorage } from "../lib/firebase-storage-service";
import { lookupPrintifyCosts } from "../lib/printify-cost-lookup";
import { normalizePlacement } from '../../shared/placements';

async function verifyMemberAuth(req: any, memberId: string): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { authorized: false, error: "Authorization required" };
  }
  
  const idToken = authHeader.slice(7);
  try {
    const decodedToken = await verifyFirebaseToken(idToken);
    if (!decodedToken) {
      return { authorized: false, error: "Invalid token" };
    }
    const isOwnData = decodedToken.uid === memberId;
    const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
    const isAdmin = adminIds.includes(decodedToken.uid);
    
    if (!isOwnData && !isAdmin) {
      return { authorized: false, error: "Access denied" };
    }
    
    return { authorized: true, userId: decodedToken.uid };
  } catch (error: any) {
    return { authorized: false, error: "Invalid token" };
  }
}

export function registerMemberRoutes(app: Express): void {
  // ============== MEMBER SANDBOX API ==============

  // Save member profile on onboarding completion
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

  // Get member profile
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

  // Check if user is a member (used by checkout for discount)
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

  // Get member's uploaded graphics organized by sets
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

  // Get member's channels
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

  // Generate priority mockup for member (same pattern as /api/test/mockup/priority)
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

  // Generate composite productGraphic (header + QR + footer) for QR Plus
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
      
      const topText = showHeader && headerStyle?.text ? {
        text: headerStyle.text,
        fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48',
        color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0,
        warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor,
        strokeWidth: headerStyle.strokeWidth,
      } : null;
      
      const bottomText = showFooter && footerStyle?.text ? {
        text: footerStyle.text,
        fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48',
        color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0,
        warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor,
        strokeWidth: footerStyle.strokeWidth,
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
      
      const topText = showHeader && headerStyle?.text ? {
        text: headerStyle.text,
        fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48',
        color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0,
        warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor,
        strokeWidth: headerStyle.strokeWidth,
      } : null;
      
      const bottomText = showFooter && footerStyle?.text ? {
        text: footerStyle.text,
        fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48',
        color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0,
        warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor,
        strokeWidth: footerStyle.strokeWidth,
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

  // ===== CLAIM TEMP PACKET FOR MEMBER =====
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

  // ===== TEMP PACKET SYSTEM (Public Wizard) =====
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

  // ============ PUBLIC WIZARD STRIPE CHECKOUT ============

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

  // Generate real Printful mockup for public wizard
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

      if (textLayoutChoice && textLayoutChoice !== '' && (headerStyle?.text || footerStyle?.text)) {
        console.log(`[PublicMockup] Generating composite artwork with text layout: ${textLayoutChoice}`);
        const { generatePrintifyComposite } = await import("../lib/composite-image-generator");

        const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
        const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';

        const topText = showHeader && headerStyle?.text ? {
          text: headerStyle.text,
          fontFamily: headerStyle.fontFamily || 'Arial',
          fontSize: headerStyle.fontSize || '48',
          color: headerStyle.color || '#000000',
          letterSpacing: headerStyle.letterSpacing || 0,
          warpPreset: headerStyle.warpPreset || 'straight',
          strokeColor: headerStyle.strokeColor,
          strokeWidth: headerStyle.strokeWidth,
        } : null;

        const bottomText = showFooter && footerStyle?.text ? {
          text: footerStyle.text,
          fontFamily: footerStyle.fontFamily || 'Arial',
          fontSize: footerStyle.fontSize || '48',
          color: footerStyle.color || '#000000',
          letterSpacing: footerStyle.letterSpacing || 0,
          warpPreset: footerStyle.warpPreset || 'straight',
          strokeColor: footerStyle.strokeColor,
          strokeWidth: footerStyle.strokeWidth,
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
      const storage = (await import("../storage")).storage;

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
      }, storage);

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

  // Create a new channel for member
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

  // Get member's products (published to their channels)
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

  // Create a new member product (supports both Printful products and QR Canvas packets)
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

      // === UNIFIED PACKET FLOW (all 5 QR types) ===
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
              const existingSnapshot = await firestoreDb.collection('memberPackets')
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

        await firestoreDb.collection("memberPackets").doc(packetId).set(packetData);
        console.log(`[UnifiedPublish] Saved complete ${packetType} packet ${packetId} for member ${memberId}`);

        // QR Compose: auto-create dynamics instance
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
            const instanceRef = await firestoreDb.collection("qr_dynamics_instances").add(instanceData);
            await firestoreDb.collection("memberPackets").doc(packetId).update({
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
      
      // Original Printful product flow (advanced wizard)
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

  // Get member's published Canvas/Play items (for QR Compose selection)
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

      const snapshot = await firestoreDb.collection('memberPackets')
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

  // Get member's earnings
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

  // Get allowed products for members (single global library)
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
      
      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      
      let needsUpdate = false;
      
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
        
        return {
          ...p,
          imageUrl,
          printProviderId,
          baseCost,
          retailPrice,
          profit,
          memberEarnings,
          placements,
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

  // Save allowed products for members (single global library)
  app.post("/api/members/allowed-products", async (req: any, res) => {
    try {
      const { products } = req.body;
      
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: "products must be an array" });
      }
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      await firestoreDb.collection("config").doc("memberProductLibrary").set({
        products,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`[Member Product Library] Saved ${products.length} products`);
      
      res.json({ success: true, count: products.length });
    } catch (error: any) {
      console.error("[Member Product Library] Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== MEMBER LIBRARY SYSTEM (Firestore-based) ==============
  
  // Get Common Library (admin-curated assets available to all members) - from Firestore
  // Reads from BOTH 'commonLibrary' and 'libraryAssets' (where admin uploads actually go)
  app.get("/api/members/common-library", async (req: any, res) => {
    try {
      const { assetType = 'background' } = req.query;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Query commonLibrary collection
      let commonQuery = firestoreDb.collection('commonLibrary')
        .where('isActive', '==', true);
      if (assetType) {
        commonQuery = commonQuery.where('assetType', '==', assetType);
      }
      
      // Query libraryAssets collection (where admin uploads go via admin/library/upload)
      // Simple query to avoid composite index requirements - filter in memory
      let adminQuery = firestoreDb.collection('libraryAssets')
        .where('ownerType', '==', 'admin');
      
      const [commonSnapshot, adminSnapshot] = await Promise.all([
        commonQuery.orderBy('createdAt', 'desc').get(),
        adminQuery.get(),
      ]);
      
      const mapAsset = (doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          assetType: data.assetType,
          mediaType: data.mediaType || 'image',
          thumbnailUrl: data.thumbnailUrl || data.publicUrl || data.storageUrl,
          publicUrl: data.publicUrl || data.storageUrl,
          width: data.width,
          height: data.height,
          category: data.category,
        };
      };
      
      const commonAssets = commonSnapshot.docs.map(mapAsset);
      const adminAssets = adminSnapshot.docs.map(mapAsset).filter((a: any) => a.assetType === assetType);
      
      // Merge and deduplicate by id
      const seenIds = new Set<string>();
      const assets = [...commonAssets, ...adminAssets].filter(a => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });
      
      console.log(`[Member Common Library] Found ${assets.length} ${assetType} assets (${commonAssets.length} common + ${adminAssets.length} admin)`);
      res.json({ assets });
    } catch (error: any) {
      console.error("[Member Common Library] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Member's Personal Library - from Firestore
  app.get("/api/members/:memberId/library", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { assetType } = req.query;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      let query = firestoreDb.collection('memberLibrary')
        .where('memberId', '==', memberId)
        .where('isActive', '==', true);
      
      if (assetType) {
        query = query.where('assetType', '==', assetType);
      }
      
      const snapshot = await query.orderBy('createdAt', 'desc').get();
      
      const assets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          assetType: data.assetType,
          mediaType: data.mediaType || 'image',
          thumbnailUrl: data.thumbnailUrl || data.publicUrl,
          publicUrl: data.publicUrl,
          width: data.width,
          height: data.height,
          sourceAssetId: data.sourceAssetId,
          isCropped: data.isCropped || false,
          originalAssetId: data.originalAssetId,
        };
      });
      
      console.log(`[Member Personal Library] Found ${assets.length} assets for member ${memberId}`);
      res.json({ assets });
    } catch (error: any) {
      console.error("[Member Personal Library] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload to Member's Personal Library - saves to Firestore
  app.post("/api/members/:memberId/library/upload", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { 
        assetType = 'background', 
        name, 
        imageData, 
        mimeType: inputMimeType, 
        originalName: inputOriginalName,
        isCropped = false,
        originalAssetId
      } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: "No imageData provided" });
      }
      
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = inputMimeType || 'image/png';
      const originalName = inputOriginalName || `upload-${Date.now()}.png`;
      const displayName = name || originalName;
      
      const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
      
      const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const folder = isCropped 
        ? `members/${memberId}/library/cropped` 
        : mediaType === 'video'
          ? `members/${memberId}/library/videos`
          : `members/${memberId}/library/backgrounds`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType,
        folder
      );
      
      const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const assetData: any = {
        memberId,
        assetType,
        mediaType,
        name: displayName,
        fileName: sanitizedName,
        originalName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType,
        sizeBytes: buffer.length,
        isActive: true,
        isCropped: isCropped,
        createdAt: new Date().toISOString(),
      };
      
      if (originalAssetId) {
        assetData.originalAssetId = originalAssetId;
      }
      
      const assetDoc = await firestoreDb.collection('memberLibrary').add(assetData);
      
      console.log(`[Member Upload] Created ${assetType} asset ${assetDoc.id} for member ${memberId}`);
      
      res.json({ 
        success: true, 
        asset: {
          id: assetDoc.id,
          name: displayName,
          publicUrl: proxyUrl,
          assetType,
          mediaType,
          isCropped: isCropped,
        }
      });
    } catch (error: any) {
      console.error("[Member Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save cropped version from Common Library to Personal Library - saves to Firestore
  app.post("/api/members/:memberId/library/crop", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { sourceAssetId, name, cropData, imageData } = req.body;
      
      if (!imageData) {
        return res.status(400).json({ error: "No imageData provided" });
      }
      
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = 'image/png';
      
      const sanitizedName = `${Date.now()}-cropped-${sourceAssetId}.png`;
      const folder = `members/${memberId}/library/cropped`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType,
        folder
      );
      
      const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const assetDoc = await firestoreDb.collection('memberLibrary').add({
        memberId,
        assetType: 'cropped',
        mediaType: 'image',
        name: name || 'Cropped Image',
        fileName: sanitizedName,
        originalName: `cropped-${sourceAssetId}`,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType,
        sizeBytes: buffer.length,
        sourceAssetId,
        cropData: cropData ? JSON.parse(cropData) : null,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`[Member Crop] Created cropped asset ${assetDoc.id} from ${sourceAssetId} for member ${memberId}`);
      
      res.json({ 
        success: true, 
        asset: {
          id: assetDoc.id,
          name: name || 'Cropped Image',
          publicUrl: proxyUrl,
          sourceAssetId,
        }
      });
    } catch (error: any) {
      console.error("[Member Crop] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload video for QR Play - stores in member-scoped folder
  app.post("/api/members/:memberId/videos/upload", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { videoData, mimeType: inputMimeType, fileName: inputFileName } = req.body;
      
      if (!videoData) {
        return res.status(400).json({ error: "No videoData provided" });
      }
      
      const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      const mimeType = inputMimeType || 'video/mp4';
      if (!allowedVideoTypes.includes(mimeType)) {
        return res.status(400).json({ error: "Invalid video type. Allowed: MP4, WebM, MOV" });
      }
      
      const base64Data = videoData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const maxSize = 100 * 1024 * 1024;
      if (buffer.length > maxSize) {
        return res.status(400).json({ error: "Video exceeds 100MB limit" });
      }
      
      const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
      const originalName = inputFileName || `video-${Date.now()}.${ext}`;
      const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const folder = `members/${memberId}/library/videos`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType,
        folder
      );
      
      const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const assetDoc = await firestoreDb.collection('memberLibrary').add({
        memberId,
        assetType: 'video',
        mediaType: 'video',
        name: originalName,
        fileName: sanitizedName,
        originalName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType,
        sizeBytes: buffer.length,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`[Member Video Upload] Created video asset ${assetDoc.id} for member ${memberId}, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
      
      res.json({ 
        success: true, 
        videoUrl: proxyUrl,
        assetId: assetDoc.id,
        fileName: sanitizedName,
      });
    } catch (error: any) {
      console.error("[Member Video Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create QR Play packet (video-based)
  app.post("/api/member/play-packets", async (req: any, res) => {
    try {
      const { memberId, videoSource, textLayers, textBackdrop, playSettings, metadata, source, status } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      if (!videoSource?.type) {
        return res.status(400).json({ error: "videoSource is required" });
      }
      if (videoSource.type === 'upload' && !videoSource.videoUrl) {
        return res.status(400).json({ error: "videoUrl is required for uploaded videos" });
      }
      if (videoSource.type === 'external' && !videoSource.externalUrl) {
        return res.status(400).json({ error: "externalUrl is required for external videos" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetId = `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetData = {
        packetId,
        memberId,
        kind: 'qr_play',
        videoSource: {
          type: videoSource.type,
          videoUrl: videoSource.videoUrl || null,
          externalUrl: videoSource.externalUrl || null,
          posterUrl: videoSource.posterUrl || null,
          duration: videoSource.duration || null,
          platform: videoSource.platform || null,
          mimeType: videoSource.mimeType || null,
          fileName: videoSource.fileName || null,
        },
        textLayers: textLayers || [],
        textBackdrop: textBackdrop || 'off',
        playSettings: {
          muted: playSettings?.muted ?? true,
          loop: playSettings?.loop ?? true,
          controls: playSettings?.controls ?? 'minimal',
        },
        metadata: metadata || null,
        source: source || { entryPoint: 'wizard' },
        status: status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberPackets').doc(packetId).set(packetData);
      
      console.log(`[QR Play] Created play packet ${packetId} for member ${memberId}`);
      res.json({ packetId, success: true });
    } catch (error: any) {
      console.error('[QR Play] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate share card for QR Play (poster + text overlay image)
  app.post("/api/member/play-packets/:packetId/share-card", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberId } = req.body;
      
      if (!packetId || !memberId) {
        return res.status(400).json({ error: "packetId and memberId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (packet?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const shareCardUrl = packet?.videoSource?.posterUrl || null;
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        shareCardUrl,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[QR Play] Generated share card for ${packetId}`);
      res.json({ shareCardUrl, success: true });
    } catch (error: any) {
      console.error('[QR Play Share Card] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Publish QR Play packet to library
  app.post("/api/member/play-packets/:packetId/publish", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberId, channelId, metadata } = req.body;
      
      if (!packetId || !memberId) {
        return res.status(400).json({ error: "packetId and memberId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (packet?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      const libraryLinkId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const titleLayer = packet?.textLayers?.find((l: any) => l.id === 'title' || l.label?.toLowerCase() === 'title');
      
      const linkData = {
        libraryLinkId,
        packetId,
        channelId: channelId || null,
        storeId: memberId,
        memberId,
        kind: 'qr_play',
        videoSource: packet?.videoSource || null,
        shareCardUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
        titleText: titleLayer?.text || 'Untitled Video',
        textLayers: packet?.textLayers || [],
        textBackdrop: packet?.textBackdrop || 'off',
        playSettings: packet?.playSettings || {},
        metadata: metadata || packet?.metadata || null,
        status: 'active',
        shareUrl: `/play/${packetId}`,
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        status: 'published',
        libraryLinkId,
        updatedAt: new Date().toISOString(),
      });
      
      if (channelId) {
        const { upsertChannelItem } = await import("../lib/channelItemsService");
        await upsertChannelItem({
          channelId,
          packetId,
          title: titleLayer?.text || 'Untitled Video',
          description: metadata?.description,
          previewImageUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl,
          price: metadata?.price,
        });
        console.log(`[QR Play] Also wrote to channel_items for channel ${channelId}`);
      }
      
      console.log(`[QR Play] Published packet ${packetId} as ${libraryLinkId}`);
      res.json({ libraryLinkId, shareUrl: `/play/${packetId}`, success: true });
    } catch (error: any) {
      console.error('[QR Play Publish] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve member files - lookup storageUrl from Firestore
  app.get("/api/member-files/:memberId/:filename", async (req: any, res) => {
    try {
      const { memberId, filename } = req.params;
      const decodedFilename = decodeURIComponent(filename);
      
      const { getStorageBucket, getFirestoreDb } = await import("../lib/firebase-admin");
      const bucket = getStorageBucket();
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('memberLibrary')
        .where('memberId', '==', memberId)
        .where('fileName', '==', decodedFilename)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.storageUrl) {
          let storagePath = data.storageUrl;
          if (storagePath.startsWith('gs://')) {
            storagePath = storagePath.replace(/^gs:\/\/[^\/]+\//, '');
          }
          
          const file = bucket.file(storagePath);
          const [exists] = await file.exists();
          
          if (exists) {
            const [metadata] = await file.getMetadata();
            res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            
            const stream = file.createReadStream();
            stream.pipe(res);
            return;
          }
        }
      }
      
      const possiblePaths = [
        `members/${memberId}/library/backgrounds/${decodedFilename}`,
        `members/${memberId}/library/cropped/${decodedFilename}`,
        `members/${memberId}/library/videos/${decodedFilename}`,
        `members/${memberId}/backgrounds/${decodedFilename}`,
        `members/${memberId}/videos/${decodedFilename}`,
        `members/${memberId}/cropped/${decodedFilename}`,
      ];
      
      for (const path of possiblePaths) {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        
        if (exists) {
          const [metadata] = await file.getMetadata();
          res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          
          const stream = file.createReadStream();
          stream.pipe(res);
          return;
        }
      }
      
      console.log(`[Member Files] File not found: ${memberId}/${decodedFilename}`);
      res.status(404).json({ error: "File not found" });
    } catch (error: any) {
      console.error("[Member Files] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== MEMBER CANVAS PACKET SYSTEM ==============

  // Create member packet (proper /api/members/:memberId/packets pattern)
  app.post("/api/members/:memberId/packets", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      if (!background?.url) {
        return res.status(400).json({ error: "background.url is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetData = {
        packetId,
        memberId,
        kind: kind || 'qr_canvas',
        urlContent: urlContent || null,
        background: {
          url: background.url,
          crop: background.crop || null,
          assetId: background.assetId || null,
        },
        textLayers: textLayers || [],
        boundProduct: boundProduct || null,
        metadata: metadata || null,
        source: source || { entryPoint: 'wizard' },
        status: status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberPackets').doc(packetId).set(packetData);
      
      console.log(`[MemberPackets] Created packet ${packetId} for member ${memberId}`);
      res.json({ packetId, success: true });
    } catch (error: any) {
      console.error('[MemberPackets] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Member media upload (proper /api/members/:memberId/media pattern)
  app.post("/api/members/:memberId/media", async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const idToken = authHeader.substring(7);
      const decodedToken = await verifyFirebaseToken(idToken);
      if (!decodedToken) {
        return res.status(401).json({ error: "Invalid authentication token" });
      }
      
      const userId = decodedToken.uid;
      console.log(`[MemberMedia] Starting media upload for member: ${userId}`);
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      
      if (!boundaryMatch) {
        return res.status(400).json({ error: "Invalid content type - expected multipart/form-data" });
      }
      
      const boundary = boundaryMatch[1];
      
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      console.log(`[MemberMedia] Received ${rawBody.length} bytes`);
      
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
      let fileName = `media-${Date.now()}`;
      let mimeType = "video/mp4";
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
      if (!allowedTypes.includes(mimeType) && !mimeType.startsWith("video/")) {
        return res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: most video formats, GIF, WebP, PNG, JPEG` });
      }
      
      const mediaType = mimeType.startsWith("video/") ? "video" : "image";
      const uniqueFilename = `${Date.now()}-${fileName}`;
      const storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
      const mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
      
      console.log(`[MemberMedia] Uploading ${fileName} (${mimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
      
      const bucket = (await import("../lib/firebase-admin")).getStorageBucket();
      const file = bucket.file(storagePath);
      
      await file.save(fileBuffer, {
        metadata: { contentType: mimeType },
      });
      
      console.log(`[MemberMedia] Upload complete: ${mediaUrl}`);
      
      res.json({
        url: mediaUrl,
        mimeType: mimeType,
        fileName: fileName,
        size: fileBuffer.length,
        storagePath: storagePath
      });
      
    } catch (error: any) {
      console.error("[MemberMedia] Error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // Legacy: Create member packet (old singular path - kept for test products)
  app.post("/api/member/packets", async (req: any, res) => {
    try {
      const { memberId, kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      if (!background?.url) {
        return res.status(400).json({ error: "background.url is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetData = {
        packetId,
        memberId,
        kind: kind || 'qr_canvas',
        urlContent: urlContent || null,
        background: {
          url: background.url,
          crop: background.crop || null,
          assetId: background.assetId || null,
        },
        textLayers: textLayers || [],
        boundProduct: boundProduct || null,
        metadata: metadata || null,
        source: source || { entryPoint: 'wizard' },
        status: status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberPackets').doc(packetId).set(packetData);
      
      console.log(`[MemberPackets] Created packet ${packetId} for member ${memberId}`);
      res.json({ packetId, success: true });
    } catch (error: any) {
      console.error('[MemberPackets] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get member packets
  app.get("/api/member/packets", async (req: any, res) => {
    try {
      const { memberId } = req.query;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('memberPackets')
        .where('memberId', '==', memberId)
        .limit(100)
        .get();
      
      const packets = snapshot.docs.map((doc: any) => doc.data());
      res.json({ packets });
    } catch (error: any) {
      console.error('[MemberPackets] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete member packet (for rollback)
  app.delete("/api/member/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const { memberId } = req.body;
      
      if (!packetId || !memberId) {
        return res.status(400).json({ error: "packetId and memberId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      if (doc.data()?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized to delete this packet" });
      }

      await firestoreDb.collection('memberPackets').doc(packetId).delete();
      
      console.log(`[MemberPackets] Deleted packet ${packetId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[MemberPackets] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update member packet (save graphics/assets)
  app.patch("/api/members/:memberId/packets/:packetId", async (req: any, res) => {
    try {
      const { memberId, packetId } = req.params;
      const updates = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      if (doc.data()?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized to update this packet" });
      }

      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberPackets').doc(packetId).update(updateData);
      
      console.log(`[MemberPackets] Updated packet ${packetId} for member ${memberId}`, Object.keys(updates));
      res.json({ success: true, packetId });
    } catch (error: any) {
      console.error('[MemberPackets] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create graphics from packet (composite render)
  app.post("/api/member/graphics/create", async (req: any, res) => {
    try {
      const { memberId, packetId } = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb, getStorageBucket } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (!packet || packet.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const graphicsId = `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const compositeUrl = packet.background?.url || null;
      
      const graphicsData = {
        graphicsId,
        packetId,
        memberId,
        compositeUrl,
        qrOnlyUrl: null,
        status: 'generated',
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberGraphics').doc(graphicsId).set(graphicsData);
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        status: 'graphics_ready',
        graphicsId,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[MemberGraphics] Created graphics ${graphicsId} for packet ${packetId}`);
      res.json({ graphicsId, compositeUrl, qrOnlyUrl: null });
    } catch (error: any) {
      console.error('[MemberGraphics] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save template snapshot
  app.post("/api/member/templates/save", async (req: any, res) => {
    try {
      const { memberId, packetId, compositeUrl, titleText, descriptionText, kind, metadata } = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      const packetData = packetDoc.data() || {};
      
      const templateData = {
        templateId,
        packetId,
        memberId,
        kind: kind || packetData.kind || 'qr_canvas',
        compositeUrl: compositeUrl || null,
        titleText: titleText || '',
        descriptionText: descriptionText || '',
        background: packetData.background || null,
        textLayers: packetData.textLayers || [],
        metadata: metadata || null,
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberTemplates').doc(templateId).set(templateData);
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        templateId,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[MemberTemplates] Created template ${templateId} for packet ${packetId}`);
      res.json({ templateId });
    } catch (error: any) {
      console.error('[MemberTemplates] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create library link (register in member catalog)
  app.post("/api/member/library-links", async (req: any, res) => {
    try {
      const { memberId, packetId, channelId, templateId, compositeUrl, qrOnlyUrl, boundProduct, metadata, status } = req.body;
      
      if (!memberId || !packetId) {
        return res.status(400).json({ error: "memberId and packetId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const libraryLinkId = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const linkData = {
        libraryLinkId,
        packetId,
        channelId: channelId || null,
        storeId: memberId,
        templateId: templateId || null,
        memberId,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        boundProduct: boundProduct || null,
        metadata: metadata || null,
        status: status || 'active',
        shareUrl: `/share/${packetId}`,
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
      
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        status: 'published',
        libraryLinkId,
        updatedAt: new Date().toISOString(),
      });
      
      if (channelId) {
        const { upsertChannelItem } = await import("../lib/channelItemsService");
        await upsertChannelItem({
          channelId,
          packetId,
          title: metadata?.title || 'Untitled Item',
          description: metadata?.description,
          previewImageUrl: compositeUrl || metadata?.previewUrl,
          price: metadata?.price,
        });
        console.log(`[MemberLibrary] Also wrote to channel_items for channel ${channelId}`);
      }
      
      console.log(`[MemberLibrary] Created link ${libraryLinkId} for packet ${packetId}`);
      res.json({ libraryLinkId, shareUrl: `/share/${packetId}` });
    } catch (error: any) {
      console.error('[MemberLibrary] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get member library links
  app.get("/api/member/library-links", async (req: any, res) => {
    try {
      const { memberId } = req.query;
      
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('memberLibraryLinks')
        .where('memberId', '==', memberId)
        .limit(100)
        .get();
      
      const items = snapshot.docs.map((doc: any) => doc.data());
      res.json({ items });
    } catch (error: any) {
      console.error('[MemberLibrary] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
