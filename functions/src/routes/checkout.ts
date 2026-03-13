import { Request, Response } from 'express';
  import express from 'express';
  import { db } from '../core';
  import { freezePacketPricing, createCanonicalOrder, writePayoutAttribution } from '../services/order-service';
import Stripe from 'stripe';

  export function register(app: express.Express): void {

app.post('/public/packet-checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId, selectedShirtSize, referrerId } = req.body;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }

    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Product not found" }); return; }
    const packet = packetDoc.data()!;
    if (packet.status !== 'published' && packet.status !== 'active') {
      res.status(400).json({ error: "Product is no longer available" }); return;
    }

    const size = selectedShirtSize || packet.selectedShirtSize || 'M';
    const { totalPrice: serverTotal } = await freezePacketPricing({ packet, selectedSize: size });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

    const productTitle = packet.title || 'QR Gear Custom Product';
    const productImage = packet.itemImage || packet.socialPacket?.itemImage || null;
    const packetBaseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: productTitle,
            description: `Size: ${size}`,
            images: productImage ? [productImage.startsWith('http') ? productImage : `${packetBaseUrl}${productImage}`] : [],
          },
          unit_amount: Math.round(serverTotal * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
      },
      success_url: `${packetBaseUrl}/p/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${packetBaseUrl}/p/${packetId}`,
      metadata: {
        packetId,
        selectedShirtSize: size,
        referrerId: referrerId || '',
        source: 'packet_share',
        memberId: packet.memberId || '',
        serverTotal: serverTotal.toString(),
      },
      customer_creation: 'if_required',
    });

    console.log(`[PacketCheckout] Created session ${session.id} for packet ${packetId}, total: $${serverTotal}`);
    res.json({ url: session.url, sessionId: session.id, total: serverTotal });
  } catch (error: any) {
    console.error('[PacketCheckout] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/public/packet-checkout/verify/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      res.status(400).json({ error: "Payment not completed", status: session.payment_status }); return;
    }

    const packetId = session.metadata?.packetId;
    const referrerId = session.metadata?.referrerId;
    const selectedSize = session.metadata?.selectedShirtSize || 'M';
    const creatorMemberId = session.metadata?.memberId || '';
    const serverTotal = parseFloat(session.metadata?.serverTotal || '0');

    if (!packetId) { res.status(400).json({ error: "No packet linked to this session" }); return; }

    const existingOrderQuery = await db.collection('orders_public')
      .where('stripeSessionId', '==', sessionId).limit(1).get();
    if (!existingOrderQuery.empty) {
      const existingOrder = existingOrderQuery.docs[0].data();
      res.json({ success: true, alreadyProcessed: true, order: { id: existingOrderQuery.docs[0].id, ...existingOrder } });
      return;
    }

    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    const packet = packetDoc.exists ? packetDoc.data()! : {};

    const buyerEmail = (session.customer_details as any)?.email || '';
    const buyerName = (session.customer_details as any)?.name || '';
    const shippingAddress = (session as any).shipping_details?.address || null;

    const totalAmount = serverTotal || ((session as any).amount_total! / 100);

    const { orderId, claimCode, alreadyExisted, orderData } = await createCanonicalOrder({
      source: 'packet_share',
      stripeSessionId: sessionId,
      stripePaymentIntentId: session.payment_intent as string,
      buyerEmail,
      buyerName,
      shippingAddress,
      totalAmount,
      packetId,
      packet,
      selectedSize,
      referrerId: referrerId || '',
      creatorMemberId,
    });

    if (!alreadyExisted) {
      const productCost = packet.pricingSnapshot?.printifyCostBase || packet.pricingSnapshot?.totalCostBase || 0;

      await writePayoutAttribution({
        source: 'packet_share',
        orderId,
        orderTotal: totalAmount,
        productCost,
        creatorMemberId,
        referrerId: referrerId || undefined,
        buyerEmail: buyerEmail || undefined,
        packetId,
      });
    }

    res.json({
      success: true,
      alreadyProcessed: alreadyExisted,
      order: { id: orderId, ...orderData },
      claimCode,
    });
  } catch (error: any) {
    console.error('[PacketCheckout Verify] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


  }
  