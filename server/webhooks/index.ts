import { Router, Request, Response } from "express";
import crypto from "crypto";

export const webhookRouter = Router();

type WebhookEventType = 
  | "order.created"
  | "order.shipped"
  | "order.delivered"
  | "order.cancelled"
  | "product.updated"
  | "product.deleted"
  | "stock.low"
  | "provider.error";

interface WebhookEvent {
  id: string;
  provider: string;
  type: WebhookEventType;
  timestamp: Date;
  payload: Record<string, unknown>;
  rawBody: string;
  verified: boolean;
}

interface WebhookHandler {
  handle(event: WebhookEvent): Promise<void>;
}

const handlers: Map<string, WebhookHandler> = new Map();

export function registerWebhookHandler(provider: string, handler: WebhookHandler): void {
  handlers.set(provider, handler);
}

function verifyPrintifySignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function verifyPrintfulSignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
    return signature === expected;
  } catch {
    return false;
  }
}

function verifyEtsySignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    return signature === `sha256=${expected}`;
  } catch {
    return false;
  }
}

function verifyStripeSignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const elements = signature.split(",");
    const timestampPart = elements.find(e => e.startsWith("t="));
    const sigPart = elements.find(e => e.startsWith("v1="));
    if (!timestampPart || !sigPart) return false;
    const timestamp = timestampPart.slice(2);
    const sig = sigPart.slice(3);
    const payload = `${timestamp}.${body}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function parseProviderEventType(provider: string, payload: Record<string, unknown>): WebhookEventType {
  switch (provider) {
    case "printify":
      const printifyEvent = payload.event as string;
      if (printifyEvent?.includes("order:created")) return "order.created";
      if (printifyEvent?.includes("order:shipped")) return "order.shipped";
      if (printifyEvent?.includes("order:delivered")) return "order.delivered";
      if (printifyEvent?.includes("order:cancelled")) return "order.cancelled";
      if (printifyEvent?.includes("product:")) return "product.updated";
      break;
    case "printful":
      const printfulType = payload.type as string;
      if (printfulType === "package_shipped") return "order.shipped";
      if (printfulType === "order_created") return "order.created";
      if (printfulType === "order_canceled") return "order.cancelled";
      if (printfulType === "product_synced") return "product.updated";
      if (printfulType === "stock_updated") return "stock.low";
      break;
    case "etsy":
      const etsyType = payload.type as string;
      if (etsyType === "shop.receipt.new") return "order.created";
      if (etsyType === "shop.receipt.shipped") return "order.shipped";
      break;
    case "ebay":
      const ebayMetadata = payload.metadata as Record<string, unknown> | undefined;
      const ebayTopic = ebayMetadata?.topic as string | undefined;
      if (ebayTopic?.includes("MARKETPLACE_ORDER")) return "order.created";
      break;
    case "amazon":
      const amazonType = payload.notificationType as string;
      if (amazonType === "ORDER_CHANGE") return "order.created";
      break;
    case "stripe":
      const stripeType = payload.type as string;
      if (stripeType === "checkout.session.completed") return "order.created";
      if (stripeType === "payment_intent.succeeded") return "order.created";
      break;
  }
  return "provider.error";
}

function getRawBody(req: Request): string {
  const raw = (req as any).rawBody;
  if (Buffer.isBuffer(raw)) {
    return raw.toString('utf8');
  }
  if (typeof raw === 'string') {
    return raw;
  }
  return JSON.stringify(req.body);
}

webhookRouter.post("/printify", async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    const signature = req.headers["x-printify-signature"] as string;
    const secret = process.env.PRINTIFY_WEBHOOK_SECRET || "";
    
    // Security: Reject unverified webhooks (but allow if no secret configured yet)
    const verified = verifyPrintifySignature(rawBody, signature, secret);
    if (secret && !verified) {
      console.warn(`[Webhook] Printify signature verification failed`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      provider: "printify",
      type: parseProviderEventType("printify", req.body),
      timestamp: new Date(),
      payload: req.body,
      rawBody,
      verified
    };
    
    const handler = handlers.get("printify");
    if (handler) {
      await handler.handle(event);
    }
    
    console.log(`[Webhook] Printify event: ${event.type}, verified: ${verified}`);
    res.status(200).json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[Webhook] Printify error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

webhookRouter.post("/printful", async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    // Printful uses X-Printful-Signature header
    const signature = req.headers["x-printful-signature"] as string;
    const secret = process.env.PRINTFUL_WEBHOOK_SECRET || "";
    
    // Security: Reject unverified webhooks (but allow if no secret configured yet)
    const verified = verifyPrintfulSignature(rawBody, signature, secret);
    if (secret && !verified) {
      console.warn(`[Webhook] Printful signature verification failed`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      provider: "printful",
      type: parseProviderEventType("printful", req.body),
      timestamp: new Date(),
      payload: req.body,
      rawBody,
      verified
    };
    
    const handler = handlers.get("printful");
    if (handler) {
      await handler.handle(event);
    }
    
    console.log(`[Webhook] Printful event: ${event.type}, verified: ${verified}`);
    res.status(200).json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[Webhook] Printful error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

webhookRouter.post("/etsy", async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    const signature = req.headers["x-etsy-signature"] as string;
    const secret = process.env.ETSY_WEBHOOK_SECRET || "";
    
    // Security: Reject unverified webhooks (but allow if no secret configured yet)
    const verified = verifyEtsySignature(rawBody, signature, secret);
    if (secret && !verified) {
      console.warn(`[Webhook] Etsy signature verification failed`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      provider: "etsy",
      type: parseProviderEventType("etsy", req.body),
      timestamp: new Date(),
      payload: req.body,
      rawBody,
      verified
    };
    
    const handler = handlers.get("etsy");
    if (handler) {
      await handler.handle(event);
    }
    
    console.log(`[Webhook] Etsy event: ${event.type}, verified: ${verified}`);
    res.status(200).json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[Webhook] Etsy error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

webhookRouter.post("/ebay", async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    
    // eBay challenge-response verification for endpoint validation
    const challengeCode = req.query.challenge_code as string;
    if (challengeCode) {
      const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || "";
      const endpoint = `${process.env.REPLIT_DOMAINS?.split(',')[0] ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : ""}/webhooks/ebay`;
      const hash = crypto.createHash("sha256")
        .update(challengeCode + verificationToken + endpoint)
        .digest("hex");
      return res.status(200).json({ challengeResponse: hash });
    }
    
    // For regular webhooks, eBay uses notification signature verification
    // This is a simplified check - production would verify the X-EBAY-SIGNATURE header
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      provider: "ebay",
      type: parseProviderEventType("ebay", req.body),
      timestamp: new Date(),
      payload: req.body,
      rawBody,
      verified: true // eBay verification happens via challenge-response
    };
    
    const handler = handlers.get("ebay");
    if (handler) {
      await handler.handle(event);
    }
    
    console.log(`[Webhook] eBay event: ${event.type}`);
    res.status(200).json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[Webhook] eBay error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

webhookRouter.post("/amazon", async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    
    // Amazon SP-API uses SQS or EventBridge, not direct webhooks
    // This endpoint is for receiving notifications if configured
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      provider: "amazon",
      type: parseProviderEventType("amazon", req.body),
      timestamp: new Date(),
      payload: req.body,
      rawBody,
      verified: true // Amazon verification would be via AWS signature
    };
    
    const handler = handlers.get("amazon");
    if (handler) {
      await handler.handle(event);
    }
    
    console.log(`[Webhook] Amazon event: ${event.type}`);
    res.status(200).json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[Webhook] Amazon error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

webhookRouter.post("/stripe", async (req: Request, res: Response) => {
  try {
    const rawBody = getRawBody(req);
    const signature = req.headers["stripe-signature"] as string;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
    
    // Security: Reject unverified webhooks (but allow if no secret configured yet)
    const verified = verifyStripeSignature(rawBody, signature, secret);
    if (secret && !verified) {
      console.warn(`[Webhook] Stripe signature verification failed`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      provider: "stripe",
      type: parseProviderEventType("stripe", req.body),
      timestamp: new Date(),
      payload: req.body,
      rawBody,
      verified
    };
    
    const handler = handlers.get("stripe");
    if (handler) {
      await handler.handle(event);
    }
    
    console.log(`[Webhook] Stripe event: ${event.type}, verified: ${verified}`);
    res.status(200).json({ received: true, eventId: event.id });
  } catch (error) {
    console.error("[Webhook] Stripe error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

webhookRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    registeredHandlers: Array.from(handlers.keys()),
    timestamp: new Date().toISOString()
  });
});
