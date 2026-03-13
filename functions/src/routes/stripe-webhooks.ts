import { Request, Response } from 'express';
  import express from 'express';
  import { db } from '../core';
  import { createCanonicalOrder, writePayoutAttribution, confirmEmbedOrderPayout } from '../services/order-service';
import Stripe from 'stripe';
import { sendOrderConfirmation as nexusOrderConfirmation } from '../nexusmail';

  export function register(app: express.Express): void {

app.post('/webhooks/stripe', async (req: Request, res: Response): Promise<void> => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!sig || !webhookSecret) {
      res.status(400).json({ error: 'Missing signature or webhook secret' });
      return;
    }
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }
    
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const source = session.metadata?.source;
        console.log(`Checkout session completed: ${session.id}, source=${source || 'direct_cart'}`);
        
        if (source === 'external_embed') {
          try {
            await confirmEmbedOrderPayout(session.id);
          } catch (embedErr: any) {
            console.error('[Webhook] Error confirming embed payout:', embedErr.message);
          }
          break;
        }

        try {
          const userId = session.metadata?.userId;
          const cartItemIds = session.metadata?.cartItemIds ? JSON.parse(session.metadata.cartItemIds) : [];
          
          if (!userId) {
            console.error('No userId in checkout session metadata');
            break;
          }

          let cartItems: any[] = [];
          if (cartItemIds.length > 0) {
            for (const itemId of cartItemIds) {
              const itemDoc = await db.collection('cartItems').doc(itemId).get();
              if (itemDoc.exists) {
                cartItems.push({ id: itemDoc.id, ...itemDoc.data() });
              }
            }
          } else {
            const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
            cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          }

          if (cartItems.length === 0) {
            console.warn('No cart items found for order creation');
            break;
          }

          const shippingDetails = session.shipping_details;
          const customerDetails = session.customer_details;
          const shippingAddress = shippingDetails ? {
            firstName: shippingDetails.name?.split(' ')[0] || '',
            lastName: shippingDetails.name?.split(' ').slice(1).join(' ') || '',
            email: customerDetails?.email || '',
            phone: shippingDetails.phone || customerDetails?.phone || '',
            address1: shippingDetails.address?.line1 || '',
            address2: shippingDetails.address?.line2 || '',
            city: shippingDetails.address?.city || '',
            region: shippingDetails.address?.state || '',
            zip: shippingDetails.address?.postal_code || '',
            country: shippingDetails.address?.country || 'US',
          } : null;

          const totalAmount = cartItems.reduce((sum: number, item: any) => {
            return sum + parseFloat(item.price || '0') * (item.quantity || 1);
          }, 0);

          const { orderId, alreadyExisted } = await createCanonicalOrder({
            source: 'direct_cart',
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent as string,
            buyerEmail: customerDetails?.email || '',
            buyerName: customerDetails?.name || '',
            shippingAddress,
            totalAmount,
            userId,
            cartItems,
          });

          if (alreadyExisted) {
            console.log(`[Webhook] Order already exists for session ${session.id}, skipping side effects`);
            break;
          }

          const referrerId = session.metadata?.referrerId;
          if (referrerId) {
            await writePayoutAttribution({
              source: 'direct_cart',
              orderId,
              orderTotal: totalAmount,
              productCost: 0,
              referrerId,
              buyerEmail: customerDetails?.email || undefined,
            });
          }

          const customerEmail = customerDetails?.email;
          if (customerEmail) {
            const orderItemsSnapshot = await db.collection('orderItems')
              .where('orderId', '==', orderId)
              .get();
            
            const emailItems = await Promise.all(orderItemsSnapshot.docs.map(async (doc) => {
              const item = doc.data();
              let productName = 'Product';
              if (item.productId) {
                const productDoc = await db.collection('products').doc(item.productId).get();
                if (productDoc.exists) {
                  productName = productDoc.data()?.name || 'Product';
                }
              }
              return {
                productName,
                quantity: item.quantity || 1,
                price: item.price || '0',
              };
            }));

            const customerName = shippingAddress 
              ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
              : customerDetails?.name || 'Customer';

            await nexusOrderConfirmation(
              db,
              orderId,
              customerEmail,
              customerName,
              emailItems,
              totalAmount.toFixed(2),
              shippingAddress ? {
                address1: shippingAddress.address1,
                address2: shippingAddress.address2,
                city: shippingAddress.city,
                region: shippingAddress.region,
                zip: shippingAddress.zip,
                country: shippingAddress.country,
              } : undefined
            );
          }

          const batch = db.batch();
          for (const item of cartItems) {
            batch.delete(db.collection('cartItems').doc(item.id));
          }
          await batch.commit();
          console.log(`[OrderService] Cleared ${cartItems.length} cart items for user ${userId}`);

        } catch (orderError: any) {
          console.error('Error creating order from checkout:', orderError);
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});


  }
  