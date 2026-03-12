import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";

export function registerBuyerInstancesRoutes(app: Express): void {

  app.get("/api/buyer/instances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getBuyerInstancesByUserId } = await import('../lib/buyerInstanceService');
      const instances = await getBuyerInstancesByUserId(userId);
      res.json({ instances });
    } catch (error: any) {
      console.error('[BuyerInstances] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/buyer/instances/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance, isInstanceActive } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);

      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      res.json({
        instance,
        isActive: isInstanceActive(instance)
      });
    } catch (error: any) {
      console.error('[BuyerInstances] GET single error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/buyer/instances/:instanceId", isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { destinationUrl } = req.body;
      const userId = req.user.claims.sub;

      const { getBuyerInstance, updateInstanceDestination } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);

      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      if (instance.buyerUserId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this instance" });
      }

      await updateInstanceDestination(instanceId, destinationUrl);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[BuyerInstances] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/buyer/instances/:instanceId/renew", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);

      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'QR Hosting Renewal - 3 Years',
              description: 'Extend your QR hosting for another 3 years',
            },
            unit_amount: 499,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/renew/${instanceId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/renew/${instanceId}`,
        metadata: {
          instanceId,
          type: 'hosting_renewal',
        },
        customer_email: instance.buyerEmail,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('[BuyerInstances] Renew checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/buyer/instances/:instanceId/verify-renewal", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { sessionId } = req.body;

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      if (session.metadata?.instanceId !== instanceId) {
        return res.status(400).json({ error: "Session does not match instance" });
      }

      const { extendInstanceHosting } = await import('../lib/buyerInstanceService');
      const updatedInstance = await extendInstanceHosting(instanceId, 3);

      if (!updatedInstance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      res.json({
        success: true,
        instance: updatedInstance,
        newExpirationDate: updatedInstance.hostingExpiresAt
      });
    } catch (error: any) {
      console.error('[BuyerInstances] Verify renewal error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/resolve/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance, isInstanceActive } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);

      if (!instance) {
        return res.status(404).json({ error: "Instance not found", redirect: "/not-found" });
      }

      if (!isInstanceActive(instance)) {
        return res.json({
          expired: true,
          redirect: `/renew/${instanceId}`,
          message: "Your QR hosting has expired. Please renew to continue."
        });
      }

      res.json({
        expired: false,
        destinationUrl: instance.destinationUrl,
        packetId: instance.packetId,
        instanceId: instance.instanceId
      });
    } catch (error: any) {
      console.error('[Resolve] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
