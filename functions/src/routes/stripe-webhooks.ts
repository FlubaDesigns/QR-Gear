import { Request, Response } from 'express';
  import express from 'express';
  import { db } from '../core';
  import { finalizeCartPayment, confirmEmbedOrderPayout } from '../services/order-service';
import Stripe from 'stripe';
import { sendOrderConfirmation } from '../services/email';
import { fulfillOrder } from '../services/order-fulfillment';

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
        (req as any).rawBody || req.body,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }
    
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const source = session.metadata?.source;
        console.log(`Checkout session completed: ${session.id}, source=${source || 'direct_cart'}`);
        
        if (session.payment_status !== 'paid') break;
        // Member packet orders retain their existing verification flow; separate from admin catalog checkout.
        if (source === 'packet_share') break;
        if (source === 'external_embed') {
          try {
            await confirmEmbedOrderPayout(session.id);
          } catch (embedErr: any) {
            console.error('[Webhook] Error confirming embed payout:', embedErr.message);
          }
          break;
        }

        const { orderId, order, items } = await finalizeCartPayment(session);
        if (order.customerEmail) {
          await sendOrderConfirmation(db, orderId, order.customerEmail, order.customerName,
            items.map(item => ({ productName: item.productTitle, quantity: item.quantity, price: item.price })),
            order.totalAmount, order.shippingAddress || undefined);
        }
        // Retry fulfillment even when the payment/order was already recorded.
        // Failures remain on the order and return 500 so Stripe can retry.
        await fulfillOrder(orderId);
        break;
      }
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const accountId = account.id;
        const payoutsEnabled = account.payouts_enabled === true;
        const chargesEnabled = account.charges_enabled === true;
        const onboardingComplete = payoutsEnabled && chargesEnabled;
        console.log(`[Connect Webhook] account.updated: ${accountId} payouts=${payoutsEnabled} charges=${chargesEnabled}`);
        try {
          const profileQuery = await db.collection('member_profiles')
            .where('stripeConnectAccountId', '==', accountId).limit(1).get();
          if (!profileQuery.empty) {
            const profileRef = profileQuery.docs[0].ref;
            await profileRef.set({
              stripePayoutsEnabled: payoutsEnabled,
              stripeChargesEnabled: chargesEnabled,
              stripeOnboardingComplete: onboardingComplete,
              stripeStatusSyncedAt: new Date().toISOString(),
            }, { merge: true });
            console.log(`[Connect Webhook] Synced Connect status for profile ${profileQuery.docs[0].id}`);
          } else {
            console.warn(`[Connect Webhook] No member profile found for Stripe account ${accountId}`);
          }
        } catch (syncErr: any) {
          console.error('[Connect Webhook] Non-fatal status sync error:', syncErr.message);
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
  