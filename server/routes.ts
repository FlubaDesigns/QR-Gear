import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, or, isNull, lte, gte, desc } from "drizzle-orm";
import { generateProxyUrl, extractObjectPath, addProxyUrlToAsset, addProxyUrlToAssets } from "./lib/storage-path-normalizer";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "./lib/qr-generator";
import { insertQrDesignSchema, insertCartItemSchema, insertOrderSchema, insertOrderItemSchema, insertPricingRuleSchema, insertAdminSettingsSchema, insertProductSchema, insertPartnerStoreSchema, insertPartnerStoreProductSchema, productBundles, bundleItems, masterProducts, products, insertEmailTemplateSchema, mockupCache } from "@shared/schema";
import { verifyWidgetToken, signWidgetToken, widgetTokenSchema } from "./lib/widget-auth";
import { printify, getUSAPrintProviders, syncProductPlacements, syncProductVariants, detectCategory } from "./lib/printify";
import { startCostSync, getCostSyncStatus, cancelCostSync, isCostSyncRunning } from "./lib/printify-cost-sync";
import { lookupPrintifyCosts } from "./lib/printify-cost-lookup";
import { generatePrintifyComposite } from "./lib/composite-image-generator";
import { uploadImage, uploadImageFromBuffer, getImageBuffer, deleteImage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./lib/image-upload";
import { downloadAndStreamFile, getFileFromFirebaseStorage, useFirebaseStorage, uploadToFirebaseStorage, listFilesInFolder } from "./lib/firebase-storage-service";
import { verifyFirebaseToken } from "./lib/firebase-admin";
import { insertHostedImageSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./firebaseAuth";
import { sendOrderConfirmationEmail } from "./lib/email";
import { submitOrderToPrintify, checkPrintifyOrderStatus } from "./lib/printify-orders";
import { startCronJobs } from "./lib/cron-jobs";
import { generateSitemap } from "./lib/sitemap";
import { z } from "zod";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import JSZip from "jszip";

// ============ WIDGET CORS MIDDLEWARE ============
// Allows widget endpoints to be accessed from partner domains
// SECURITY: Uses exact origin matching to prevent subdomain attacks
const widgetCorsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  // Get allowed origins from environment (for backward compatibility)
  const envAllowedOrigins = (process.env.ALLOWED_WIDGET_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  
  // Also check partner store allowed origins from database
  let partnerAllowedOrigins: string[] = [];
  try {
    const stores = await storage.getPartnerStores();
    for (const store of stores) {
      if (store.allowedOrigins && Array.isArray(store.allowedOrigins)) {
        partnerAllowedOrigins.push(...store.allowedOrigins);
      }
    }
  } catch (e) {
    // Ignore errors - fall back to env origins
  }
  
  const allAllowedOrigins = Array.from(new Set([...envAllowedOrigins, ...partnerAllowedOrigins]));
  
  // SECURITY: Use exact match only - no prefix matching to prevent subdomain attacks
  if (origin && allAllowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

// ============ HEALTH CHECK HELPER ============
// Returns health status for configured providers only
// POD providers are checked based on which API keys are configured
type ProviderStatus = "healthy" | "degraded" | "down" | "not_configured";

interface ProviderHealthResult {
  providers: {
    name: string;
    status: ProviderStatus;
    configured: boolean;
  }[];
  stripe: ProviderStatus;
  lastCheck: string;
  printify?: ProviderStatus;
}

async function checkProviderHealth(): Promise<ProviderHealthResult> {
  const providers: { name: string; status: ProviderStatus; configured: boolean }[] = [];
  
  // Check Printify (only if API key is configured)
  const printifyKey = process.env.PRINTIFY_API_KEY;
  if (printifyKey) {
    try {
      const response = await fetch("https://api.printify.com/v1/shops.json", {
        headers: { Authorization: `Bearer ${printifyKey}` },
        signal: AbortSignal.timeout(5000),
      });
      providers.push({
        name: "Printify",
        status: response.ok ? "healthy" : "degraded",
        configured: true,
      });
    } catch (e) {
      providers.push({ name: "Printify", status: "down", configured: true });
    }
  }

  // Check Printful (only if API key is configured)
  const printfulKey = process.env.PRINTFUL_API_KEY;
  if (printfulKey) {
    try {
      const response = await fetch("https://api.printful.com/stores", {
        headers: { Authorization: `Bearer ${printfulKey}` },
        signal: AbortSignal.timeout(5000),
      });
      providers.push({
        name: "Printful",
        status: response.ok ? "healthy" : "degraded",
        configured: true,
      });
    } catch (e) {
      providers.push({ name: "Printful", status: "down", configured: true });
    }
  }

  // Check Apliiq (only if API key is configured)
  const apliiqKey = process.env.APLIIQ_API_KEY;
  if (apliiqKey) {
    // Apliiq doesn't have a simple health endpoint, so just check if configured
    providers.push({ name: "Apliiq", status: "healthy", configured: true });
  }

  // If no POD providers configured, show helpful message
  if (providers.length === 0) {
    providers.push({ name: "No POD providers", status: "not_configured", configured: false });
  }

  // Check Stripe
  let stripeStatus: ProviderStatus = "not_configured";
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey);
      await stripe.balance.retrieve();
      stripeStatus = "healthy";
    } catch (e) {
      stripeStatus = "down";
    }
  }

  // Return both new format and legacy format for backward compatibility
  const primaryProvider = providers.find(p => p.configured) || providers[0];
  return {
    // New format: array of all configured providers
    providers,
    stripe: stripeStatus,
    lastCheck: new Date().toISOString(),
    // Legacy format for backward compatibility
    printify: primaryProvider?.name === "Printify" ? primaryProvider.status : 
              (printifyKey ? "down" : "not_configured"),
  };
}

// ============ AUTO-SYNC HELPER: Seeds variants from local catalog ============
// Uses locally synced data from Printify (weekly cron job) - NO API calls needed
// Extensible for future POD providers (Printful, etc.)
// Note: Variant IDs are generated as placeholders since local catalog only stores sizes/colors
async function autoSyncVariantsFromLocalCatalog(
  productId: string,
  blueprintId: number | null,
  printProviderId: number | null,
  basePrice: string,
  existingMetadata?: Record<string, any>
): Promise<{ variantsSeeded: number; syncWarning: string | null; colors?: any[]; sizes?: string[] }> {
  let variantsSeeded = 0;
  let syncWarning: string | null = null;
  
  if (!blueprintId || !printProviderId) {
    return { variantsSeeded: 0, syncWarning: "Missing blueprintId or printProviderId" };
  }
  
  try {
    // Look up local catalog data (already synced from Printify weekly)
    const localProvider = await storage.getPrintifyPrintProvider(blueprintId, printProviderId);
    
    if (localProvider && localProvider.availableColors && localProvider.availableSizes) {
      const colors = localProvider.availableColors as Array<{ name: string; hex?: string }>;
      const sizes = localProvider.availableSizes as string[];
      
      // Create variant for each color/size combination
      // Note: Using generated IDs since local catalog doesn't store real Printify variant IDs
      // Real variant IDs are fetched during fulfillment or can be synced via manual sync button
      let variantIdCounter = 1;
      for (const color of colors) {
        for (const size of sizes) {
          await storage.upsertProductVariant({
            productId,
            printifyVariantId: variantIdCounter++,
            title: `${size} / ${color.name}`,
            size: size,
            color: color.name,
            colorHex: color.hex || null,
            price: basePrice,
            isEnabled: true,
            isInStock: true,
          });
          variantsSeeded++;
        }
      }
      
      // MERGE metadata instead of overwriting - preserve existing metadata
      const mergedMetadata = {
        ...(existingMetadata || {}),
        autoSyncedFromLocalCatalog: true,
        syncedAt: new Date().toISOString(),
        variantIdsArePlaceholders: true, // Flag that real IDs need to be fetched for fulfillment
      };
      
      // Update product with synced data from local catalog
      await storage.updateProduct(productId, {
        availableColors: colors,
        availableSizes: sizes,
        metadata: mergedMetadata,
      });
      
      console.log(`[Auto-Sync] Seeded ${variantsSeeded} variants for ${productId} from local catalog`);
      return { variantsSeeded, syncWarning, colors, sizes };
    } else {
      syncWarning = "Local catalog data not available. Run catalog sync first.";
      console.log(`[Auto-Sync] No local data for blueprint ${blueprintId}/provider ${printProviderId}`);
    }
  } catch (syncError: any) {
    syncWarning = `Auto-sync failed: ${syncError.message}`;
    console.error(`[Auto-Sync] Error:`, syncError);
  }
  
  return { variantsSeeded, syncWarning };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // Dynamic sitemap for SEO
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const xml = await generateSitemap();
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(xml);
    } catch (error) {
      console.error('[Sitemap] Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ============ SERVER-RENDERED SHARE PAGE FOR SOCIAL SCRAPERS ============
  // Facebook, Twitter, Discord, LinkedIn, etc. do NOT run JavaScript
  // This route returns HTML with OG + Twitter meta tags, then redirects humans to SPA
  app.get('/p/:packetId', async (req, res, next) => {
    try {
      const { packetId } = req.params;
      
      // Check if request is from a social crawler (user agent sniffing)
      const userAgent = req.headers['user-agent'] || '';
      const isCrawler = /facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|TelegramBot|WhatsApp/i.test(userAgent);
      
      // If not a crawler, let SPA handle it
      if (!isCrawler) {
        return next();
      }
      
      // Fetch packet from Firestore
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      
      // Default OG values
      let title = 'QR Gear - Dynamic QR Experience';
      let description = 'Scan to discover personalized content';
      let ogImage = 'https://qrgear-c1ffd.web.app/og-default.png';
      const canonicalUrl = `https://qrgear-c1ffd.web.app/p/${packetId}`;
      
      if (packetDoc.exists) {
        const packet = packetDoc.data();
        
        if (packet) {
          // Extract title from textLayers or use packet type
          if (packet.textLayers?.length > 0) {
            const titleLayer = packet.textLayers.find((l: any) => l.id === 'title' || l.id === 'header');
            if (titleLayer?.text) {
              title = titleLayer.text;
            }
          }
          
          // Extract description
          if (packet.textLayers?.length > 0) {
            const descLayer = packet.textLayers.find((l: any) => l.id === 'description' || l.id === 'footer');
            if (descLayer?.text) {
              description = descLayer.text;
            }
          }
          
          // Choose best OG image (priority: shareCardUrl > compositeUrl > posterUrl > preview)
          ogImage = packet.shareCardUrl 
            || packet.compositeUrl 
            || packet.videoSource?.posterUrl 
            || packet.previewUrl
            || ogImage;
        }
      }
      
      // Return server-rendered HTML with OG + Twitter meta tags
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  
  <!-- Open Graph Tags (Facebook, LinkedIn, Discord, etc.) -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="QR Gear" />
  
  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />
  
  <!-- Redirect humans to SPA after a brief moment -->
  <meta http-equiv="refresh" content="0;url=/app/p/${packetId}" />
  
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; }
    .loading { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Loading your QR experience...</p>
  </div>
</body>
</html>`;
      
      res.set('Content-Type', 'text/html');
      res.set('Cache-Control', 'public, max-age=300'); // 5 min cache for crawlers
      res.send(html);
    } catch (error) {
      console.error('[SharePage] Error:', error);
      next(); // Fall through to SPA on error
    }
  });

  // Helper function for HTML escaping
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============ UNIVERSAL CLAIM PAGE API ============
  // Validates a claim code and returns claim data for the UI
  app.get('/api/claim/validate/:claimCode', async (req, res) => {
    try {
      const { claimCode } = req.params;
      const { validateClaimCode } = await import('./lib/claimService');
      const result = await validateClaimCode(claimCode);
      res.json(result);
    } catch (error: any) {
      console.error('[Claim] Validation error:', error);
      res.status(500).json({ valid: false, reason: error.message });
    }
  });

  // Claims an item and creates an instance (requires auth)
  app.post('/api/claim/:claimCode', isAuthenticated, async (req: any, res) => {
    try {
      const { claimCode } = req.params;
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email || '';
      
      const { claimItem } = await import('./lib/claimService');
      const result = await claimItem(claimCode, userId, userEmail);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, instanceId: result.instanceId });
    } catch (error: any) {
      console.error('[Claim] Claim error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's claimed instances
  app.get('/api/claimed-instances', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getClaimedInstancesByUser } = await import('./lib/claimService');
      const instances = await getClaimedInstancesByUser(userId);
      res.json({ instances });
    } catch (error: any) {
      console.error('[Claim] Get instances error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single claimed instance
  app.get('/api/claimed-instances/:instanceId', async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { getClaimedInstance, isClaimedInstanceActive } = await import('./lib/claimService');
      const instance = await getClaimedInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      res.json({ instance, isActive: isClaimedInstanceActive(instance) });
    } catch (error: any) {
      console.error('[Claim] Get instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update claimed instance destination
  app.patch('/api/claimed-instances/:instanceId', isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { destinationUrl } = req.body;
      const userId = req.user.claims.sub;
      
      const { getClaimedInstance, updateClaimedInstanceDestination } = await import('./lib/claimService');
      const instance = await getClaimedInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      
      if (instance.ownerUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      await updateClaimedInstanceDestination(instanceId, destinationUrl);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Claim] Update instance error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Generate claim codes
  app.post('/api/admin/claim-codes', isAdmin, async (req: any, res) => {
    try {
      const { templateId, packetType, productName, productDescription, previewImageUrl, count } = req.body;
      
      if (!templateId || !packetType || !productName) {
        return res.status(400).json({ error: 'templateId, packetType, and productName are required' });
      }
      
      const { generateClaimCode, generateBulkClaimCodes } = await import('./lib/claimService');
      
      if (count && count > 1) {
        const codes = await generateBulkClaimCodes(
          { templateId, packetType, productName, productDescription, previewImageUrl },
          Math.min(count, 100)
        );
        res.json({ codes: codes.map(c => c.claimCode), count: codes.length });
      } else {
        const code = await generateClaimCode({ templateId, packetType, productName, productDescription, previewImageUrl });
        res.json({ claimCode: code.claimCode });
      }
    } catch (error: any) {
      console.error('[Claim] Generate codes error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Auth routes - returns null if not authenticated (no 401)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Helper to check admin status
      const checkIsAdmin = (userId: string) => {
        const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
        return adminIds.length === 0 || adminIds.includes(userId);
      };

      // Check for Firebase ID token in Authorization header first
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const idToken = authHeader.substring(7);
        const decodedToken = await verifyFirebaseToken(idToken);
        if (decodedToken) {
          const firebaseUserId = decodedToken.uid;
          // Try to find existing user by Firebase UID
          let user = await storage.getUser(firebaseUserId);
          if (!user) {
            // Create user from Firebase token data
            user = await storage.createUser({
              id: firebaseUserId,
              email: decodedToken.email || null,
              firstName: decodedToken.name?.split(' ')[0] || null,
              lastName: decodedToken.name?.split(' ').slice(1).join(' ') || null,
              profileImageUrl: decodedToken.picture || null,
            });
          }
          const { passwordHash, ...safeUser } = user;
          return res.json({ ...safeUser, isAdmin: checkIsAdmin(firebaseUserId) });
        }
      }

      // Check for email/password session
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const { passwordHash, ...safeUser } = user;
          return res.json({ ...safeUser, isAdmin: checkIsAdmin(user.id) });
        }
      }

      // Fall back to Replit OAuth (legacy)
      if (req.isAuthenticated?.() && req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        if (user) {
          return res.json({ ...user, isAdmin: checkIsAdmin(userId) });
        }
      }

      res.json(null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.json(null);
    }
  });

  // Auth validation schemas
  const registerSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  });

  // Email/Password Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const parseResult = registerSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors[0]?.message || "Invalid input";
        return res.status(400).json({ error: errorMsg });
      }
      
      const { email, password, firstName, lastName } = parseResult.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await storage.createUser({
        email,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      });
      
      // Regenerate session for security
      req.session.regenerate?.(() => {});
      (req.session as any).userId = user.id;
      
      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser, message: "Account created successfully" });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Email/Password Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        const errorMsg = parseResult.error.errors[0]?.message || "Invalid input";
        return res.status(400).json({ error: errorMsg });
      }
      
      const { email, password } = parseResult.data;
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Regenerate session for security
      req.session.regenerate?.(() => {});
      (req.session as any).userId = user.id;
      
      const { passwordHash: _, ...safeUser } = user;
      res.json({ user: safeUser, message: "Logged in successfully" });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  // Email/Password Logout
  app.post('/api/auth/email-logout', async (req: any, res) => {
    try {
      req.session.userId = null;
      res.json({ message: "Logged out successfully" });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to log out" });
    }
  });

  // Browsing history routes
  app.get('/api/browsing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getBrowsingHistory(userId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/browsing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId } = req.body;
      const entry = await storage.addBrowsingHistory({ userId, productId });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Widget API - Apply CORS middleware for cross-origin embedding
  app.get("/api/widget/session", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ ok: false, error: "Token required" });
      }

      const { normalizeWidgetPayload } = await import("./lib/widget-auth");
      const payload = verifyWidgetToken(token);
      
      if (!payload) {
        return res.status(401).json({ ok: false, error: "Invalid or expired token" });
      }

      const normalized = normalizeWidgetPayload(payload);
      const { storeId, channelId, entityType, entityId, entityName, entityLogoUrl, mode, capabilities, viewType, storeOwner, programId } = normalized;
      
      if (!channelId && viewType !== 'program_series') {
        return res.status(400).json({ ok: false, error: "Token missing channelId" });
      }

      if (storeOwner) {
        const { resolveOrCreateStore } = await import("./lib/siteWidgetService");
        await resolveOrCreateStore(storeOwner.ownerType, storeOwner.ownerId, {
          name: entityName,
          logoUrl: entityLogoUrl || undefined,
          theme: payload.theme,
        });
      }

      let items: any[] = [];
      let moments: any[] = [];
      let programData: any = null;

      if (viewType === 'channel_products' || viewType === 'create_product') {
        const { getChannelItems } = await import("./lib/channelItemsService");
        const channelItems = await getChannelItems({ storeId, channelId, limit: 50 });
        items = channelItems.map(item => ({
          itemId: item.itemId,
          packetId: item.packetId,
          title: item.title,
          description: item.description,
          previewImageUrl: item.previewImageUrl,
          shareUrl: item.shareUrl,
          price: item.price,
          collectionTag: item.collectionTag,
          shareImageSquareUrl: item.shareImageSquareUrl,
          shareCaption: item.shareCaption,
        }));
      }

      if (viewType === 'program_series' && programId) {
        const { getProgramMoments } = await import("./lib/programService");
        const result = await getProgramMoments(programId);
        if (result) {
          programData = {
            programId: result.program.programId,
            title: result.program.title,
            description: result.program.description,
            coverImageUrl: result.program.coverImageUrl,
            scheduleType: result.program.scheduleType,
            totalDays: result.program.totalDays,
            status: result.program.status,
          };
          moments = result.moments;
        }
      }
      
      res.set('Cache-Control', 'public, max-age=60');
      
      res.json({
        ok: true,
        mode: viewType === 'create_product' ? 'create' : 'display',
        viewType,
        storeId,
        channelId,
        entityType,
        entityId,
        storeOwner: storeOwner || undefined,
        programId: programId || undefined,
        program: programData || undefined,
        items,
        moments,
        display: {
          entityName,
          entityLogoUrl,
          placement: payload.placement,
          mode,
          returnUrl: payload.returnUrl,
          theme: payload.theme,
        },
        capabilities,
      });
    } catch (error: any) {
      console.error("Widget session error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Widget Token Minting (KC service auth required)
  // KC calls this endpoint to get short-lived widget tokens
  // KC NEVER signs tokens locally - all signing happens here
  app.post("/api/widget/token", async (req, res) => {
    try {
      const { verifyKCServiceAuth, mintWidgetToken, mintTokenInputSchema } = await import("./lib/widget-auth");
      
      // Verify KC service authentication (API key or Firebase Admin token)
      const authHeader = req.headers['x-api-key'] as string || req.headers['authorization'];
      const authResult = await verifyKCServiceAuth(authHeader);
      
      if (!authResult.valid) {
        return res.status(401).json({ ok: false, error: authResult.error || "Unauthorized" });
      }
      
      // Validate input
      const parsed = mintTokenInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          ok: false, 
          error: "Invalid token request", 
          details: parsed.error.errors 
        });
      }
      
      // Mint token (10 min expiry, proper kid header)
      const { token, expiresIn } = mintWidgetToken(parsed.data);
      
      const channelId = parsed.data.target?.channelId || `${parsed.data.entityType}_${parsed.data.entityId}`;
      const storeId = parsed.data.storeOwner
        ? `${parsed.data.storeOwner.ownerType}:${parsed.data.storeOwner.ownerId}`
        : `${parsed.data.entityType}_${parsed.data.entityId}`;
      
      console.log(`[WidgetToken] Minted token for ${storeId} viewType=${parsed.data.viewType}`);
      
      res.json({ 
        ok: true,
        token,
        expiresIn,
        channelId,
        storeId,
        viewType: parsed.data.viewType || 'channel_products',
        widgetUrl: `${process.env.VITE_BASE_URL || 'https://qrgear-c1ffd.web.app'}/widget?token=${encodeURIComponent(token)}`,
      });
    } catch (error: any) {
      console.error("[WidgetToken] Mint error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============ KC WIDGET CANONICAL CONTRACT ENDPOINTS ============
  // Verify widget token and return normalized context
  app.get("/api/widget/verify", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.json({ valid: false, error: "No token provided" });
      }
      
      const { normalizeWidgetPayload } = await import("./lib/widget-auth");
      const payload = verifyWidgetToken(token);
      
      if (!payload) {
        return res.json({ valid: false, error: "Invalid or expired token" });
      }
      
      const normalized = normalizeWidgetPayload(payload);
      
      res.json({
        valid: true,
        payload: {
          ...normalized,
          returnUrl: payload.returnUrl,
          theme: payload.theme,
        }
      });
    } catch (error: any) {
      console.error("[Widget] Verify error:", error);
      res.json({ valid: false, error: error.message });
    }
  });

  // Get channel items for widget storefront
  app.get("/api/widget/items", widgetCorsMiddleware, async (req, res) => {
    try {
      const { channelId, storeId } = req.query;
      
      if (!channelId || typeof channelId !== 'string') {
        return res.status(400).json({ error: "channelId is required" });
      }
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Query catalog item links for this channel
      const snapshot = await firestoreDb.collection('catalogItemLinks')
        .where('channelId', '==', channelId)
        .where('status', '==', 'published')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      // Also check memberLibraryLinks collection
      const memberSnapshot = await firestoreDb.collection('memberLibraryLinks')
        .where('channelId', '==', channelId)
        .where('status', '==', 'published')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      const items = [
        ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...memberSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];
      
      // Sort by createdAt descending
      items.sort((a: any, b: any) => {
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bDate.getTime() - aDate.getTime();
      });
      
      res.json({ items: items.slice(0, 50) });
    } catch (error: any) {
      console.error("[Widget] Items error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/widget/events", widgetCorsMiddleware, (req, res) => {
    res.json({
      events: [
        { type: "qrgear:ready", description: "Widget has loaded and is ready", data: { viewType: "string" } },
        { type: "qrgear:height", description: "Widget height changed", data: { height: "number" } },
        { type: "qrgear:navigate", description: "User clicked return/back", data: { returnUrl: "string" } },
        { type: "qrgear:item_click", description: "User clicked on an item", data: { itemId: "string", packetId: "string" } },
        { type: "qrgear:item_share", description: "User shared an item", data: { itemId: "string", packetId: "string" } },
        { type: "qrgear:share_copied", description: "Share URL copied to clipboard", data: { url: "string" } },
        { type: "qrgear:create_start", description: "Admin started create flow", data: { channelId: "string" } },
        { type: "qrgear:publish_success", description: "Product published successfully", data: { productId: "string", channelId: "string" } },
        { type: "qrgear:program_started", description: "User started a program/series", data: { programId: "string" } },
        { type: "qrgear:checkout_start", description: "User started checkout" },
        { type: "qrgear:checkout_complete", description: "User completed checkout" },
      ]
    });
  });

  // ============ PROGRAM / SERIES API ============
  app.post("/api/widget/programs", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.headers['x-widget-token'] as string;
      if (!token) return res.status(401).json({ ok: false, error: "Widget token required" });

      const payload = verifyWidgetToken(token);
      if (!payload) return res.status(401).json({ ok: false, error: "Invalid token" });

      const { normalizeWidgetPayload } = await import("./lib/widget-auth");
      const normalized = normalizeWidgetPayload(payload);

      if (!normalized.capabilities.canCreate && !normalized.capabilities.canManage) {
        return res.status(403).json({ ok: false, error: "No create/manage permission" });
      }

      const { createProgram } = await import("./lib/programService");
      const program = await createProgram({
        storeId: normalized.storeId,
        channelId: req.body.channelId || normalized.channelId,
        title: req.body.title,
        description: req.body.description,
        coverImageUrl: req.body.coverImageUrl,
        scheduleType: req.body.scheduleType,
        entries: req.body.entries,
      });

      res.json({ ok: true, program });
    } catch (error: any) {
      console.error("[Widget] Create program error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/programs/:programId", widgetCorsMiddleware, async (req, res) => {
    try {
      const { getProgram } = await import("./lib/programService");
      const program = await getProgram(req.params.programId);
      if (!program) return res.status(404).json({ ok: false, error: "Program not found" });
      res.json({ ok: true, program });
    } catch (error: any) {
      console.error("[Widget] Get program error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/programs/:programId/moments", widgetCorsMiddleware, async (req, res) => {
    try {
      const { getProgramMoments } = await import("./lib/programService");
      const result = await getProgramMoments(req.params.programId);
      if (!result) return res.status(404).json({ ok: false, error: "Program not found" });
      res.json({ ok: true, program: result.program, moments: result.moments });
    } catch (error: any) {
      console.error("[Widget] Get program moments error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.patch("/api/widget/programs/:programId", widgetCorsMiddleware, async (req, res) => {
    try {
      const token = req.headers['x-widget-token'] as string;
      if (!token) return res.status(401).json({ ok: false, error: "Widget token required" });

      const payload = verifyWidgetToken(token);
      if (!payload) return res.status(401).json({ ok: false, error: "Invalid token" });

      const { normalizeWidgetPayload } = await import("./lib/widget-auth");
      const normalized = normalizeWidgetPayload(payload);

      if (!normalized.capabilities.canManage) {
        return res.status(403).json({ ok: false, error: "No manage permission" });
      }

      const { updateProgram } = await import("./lib/programService");
      const success = await updateProgram(req.params.programId, req.body);
      if (!success) return res.status(500).json({ ok: false, error: "Update failed" });
      res.json({ ok: true });
    } catch (error: any) {
      console.error("[Widget] Update program error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/widget/stores/:storeId/programs", widgetCorsMiddleware, async (req, res) => {
    try {
      const { getProgramsByStore } = await import("./lib/programService");
      const programs = await getProgramsByStore(req.params.storeId);
      res.json({ ok: true, programs });
    } catch (error: any) {
      console.error("[Widget] List programs error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // Partner API - Simple endpoint for partners to fetch their products
  // Requires X-API-Key header with WIDGET_API_KEY value
  app.get("/api/partner/products", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const expectedKey = process.env.WIDGET_API_KEY;
      
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid or missing API key" });
      }
      
      const { partnerId, context, slug } = req.query;
      
      if (!partnerId || typeof partnerId !== 'string') {
        return res.status(400).json({ error: "partnerId query parameter required" });
      }
      
      // Find partner store by slug (partnerId is their slug)
      const store = await storage.getPartnerStoreBySlug(partnerId);
      if (!store || !store.isActive) {
        return res.status(404).json({ error: "Partner not found or inactive" });
      }
      
      // Get partner's products
      const storeProducts = await storage.getPartnerStoreProducts(store.id);
      const enabledProducts = storeProducts.filter(sp => sp.isEnabled);
      
      // Fetch actual product details
      const productDetails = await Promise.all(
        enabledProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          if (!product || !product.isEnabled) return null;
          
          return {
            id: product.id,
            blueprintId: product.blueprintId,
            name: sp.customName || product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            basePrice: sp.customPrice || product.basePrice,
            category: product.category,
            kcBusinessSlug: sp.kcBusinessSlug,
            sortOrder: sp.sortOrder,
          };
        })
      );
      
      let filteredProducts = productDetails.filter(Boolean);
      
      // Filter by context
      if (context === 'listing' && slug && typeof slug === 'string') {
        // Show only products linked to this specific business
        filteredProducts = filteredProducts.filter((p: any) => p.kcBusinessSlug === slug);
      } else if (context === 'homepage') {
        // Show only products NOT linked to a specific business (standalone store products)
        filteredProducts = filteredProducts.filter((p: any) => !p.kcBusinessSlug);
      }
      // 'dashboard' context shows all products (no filtering)
      
      res.json({
        partner: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          primaryColor: store.primaryColor,
          accentColor: store.accentColor,
        },
        products: filteredProducts.sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      });
    } catch (error: any) {
      console.error("Partner API error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Generation (POST - returns JSON with data URL)
  app.post("/api/qr/generate", async (req, res) => {
    try {
      const { content, type, style } = req.body;

      if (!validateQRContent(content, type)) {
        return res.status(400).json({ error: "Invalid QR code content" });
      }

      const qrCodeDataUrl =
        type === "text"
          ? await generateTextQRCode(content, style)
          : await generateImageQRCode(content, style);

      res.json({ qrCode: qrCodeDataUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Image (GET - returns actual PNG image for canvas/img loading)
  app.get("/api/qr/image", async (req, res) => {
    try {
      const { text, color = "black" } = req.query;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing 'text' query parameter" });
      }

      const qrColor = color === "white" ? "#FFFFFF" : "#000000";
      const qrCodeDataUrl = await generateTextQRCode(text, { color: qrColor, backgroundColor: "transparent" });
      
      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Note: QR Designs endpoints moved to authenticated section (see SAVED DESIGNS ENDPOINTS)

  // Products - Public endpoint returns only enabled products
  app.get("/api/products", async (req, res) => {
    try {
      const { store, segment, featured } = req.query;
      
      // If store is provided, use the proper store filtering via partner_store_products
      if (store && typeof store === "string") {
        const products = await storage.getProductsForStore(
          store,
          segment && typeof segment === "string" ? segment : undefined
        );
        return res.json(products);
      }
      
      // Get all enabled products
      const products = await storage.getAllProducts();
      let enabledProducts = products.filter(p => p.isEnabled);
      
      // Filter by featured if requested
      if (featured === "true") {
        enabledProducts = enabledProducts.filter(p => p.isFeatured);
        
        // Fetch admin settings for pricing calculations
        const settings = await storage.getAdminSettings();
        const globalMarkupPercent = parseFloat(settings?.globalMarkupPercent || "25");
        const globalMarkupFixed = parseFloat(settings?.globalMarkupFixed || "0");
        const globalQrCost = parseFloat(settings?.globalQrProductionCost || "2");
        const additionalPlacementCost = parseFloat(settings?.additionalPlacementCost || "4");
        
        // For featured products, enrich with mockups and QR artwork from custom_designs
        const designs = await storage.getCustomDesigns();
        
        const enrichedProducts = enabledProducts.map((product) => {
          // IMPORTANT: Use customerPrice set by admin in Admin Products section
          // Only fall back to calculation if customerPrice is not set
          let retailPrice: number;
          if (product.customerPrice) {
            retailPrice = parseFloat(product.customerPrice);
          } else {
            // Fallback calculation only if admin hasn't set customerPrice
            const baseCost = parseFloat(product.basePrice) || 0;
            const qrCost = parseFloat(product.qrProductionCost || "0") || globalQrCost;
            const markupFixed = parseFloat(product.markupFixed || "0") || globalMarkupFixed;
            const markupPercent = parseFloat(product.markupPercent || "0") || globalMarkupPercent;
            const placements = product.availablePlacements || [];
            const extraPlacementCount = Math.max(0, placements.length - 1);
            const placementUpcharge = extraPlacementCount * additionalPlacementCost;
            const totalCost = baseCost + qrCost + placementUpcharge;
            retailPrice = Math.ceil((totalCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
          }
          
          // Try to find the matching custom design by the product ID pattern
          // Custom design IDs are like "qr-gear-main-home-tee-dec2025" 
          // Product IDs are like "custom_qr-gear-main-home-tee-dec2025-1"
          const customDesignId = product.id.replace(/^custom_/, '').replace(/-\d+$/, '');
          const matchingDesign = designs.find(d => d.id === customDesignId || d.productId?.toString() === product.blueprintId?.toString());
          
          // Get all placement images (includes black and white variants for each placement)
          let placementImages: Record<string, string> | null = null;
          let frontChestImage: string | null = null;
          let frontChestImageWhite: string | null = null;
          if (matchingDesign?.placementImages) {
            const placements = typeof matchingDesign.placementImages === 'string' 
              ? JSON.parse(matchingDesign.placementImages) 
              : matchingDesign.placementImages;
            placementImages = placements;
            frontChestImage = placements?.["front-chest"] || null;
            frontChestImageWhite = placements?.["front-chest-white"] || null;
          }
          
          // Get Printify mockups if available (realistic product images)
          // First check product.mockupsByColor, then fall back to custom_design.mockupsByColor
          // Normalize mockupsByColor - handle string (older rows), null, or object
          let mockupsByColor: Record<string, any> | null = null;
          // First try the product's own mockupsByColor (populated by star button mockup generation)
          const productMockups = (product as any)?.mockupsByColor;
          const rawMockups = productMockups || (matchingDesign as any)?.mockupsByColor;
          if (rawMockups) {
            if (typeof rawMockups === 'string') {
              try {
                mockupsByColor = JSON.parse(rawMockups);
              } catch {
                mockupsByColor = null;
              }
            } else if (typeof rawMockups === 'object') {
              mockupsByColor = rawMockups;
            }
          }
          
          // Normalize selectedColors - handle string (older rows), null, or array
          let selectedColors: string[] | null = null;
          const rawSelectedColors = (matchingDesign as any)?.selectedColors;
          if (rawSelectedColors) {
            if (typeof rawSelectedColors === 'string') {
              try {
                const parsed = JSON.parse(rawSelectedColors);
                selectedColors = Array.isArray(parsed) ? parsed : null;
              } catch {
                selectedColors = null;
              }
            } else if (Array.isArray(rawSelectedColors)) {
              selectedColors = rawSelectedColors;
            }
          }
          // Fallback to mockupsByColor keys if no selectedColors
          if (!selectedColors && mockupsByColor) {
            selectedColors = Object.keys(mockupsByColor);
          }
          
          // Normalize defaultColor
          const rawDefaultColor = (matchingDesign as any)?.defaultColor;
          let defaultColor: string | null = typeof rawDefaultColor === 'string' ? rawDefaultColor : null;
          
          // Validate defaultColor is in selectedColors or mockupsByColor
          const validDefaultColor = 
            (defaultColor && selectedColors?.includes(defaultColor)) ? defaultColor :
            (defaultColor && mockupsByColor && mockupsByColor[defaultColor]) ? defaultColor :
            (mockupsByColor ? Object.keys(mockupsByColor)[0] : null);
          
          // Get the default mockup image (from validated color or first available)
          let defaultMockupImage: string | null = null;
          if (mockupsByColor && validDefaultColor && mockupsByColor[validDefaultColor]?.front) {
            defaultMockupImage = mockupsByColor[validDefaultColor].front;
          } else if (mockupsByColor) {
            // Fallback to first available color
            const firstColor = Object.keys(mockupsByColor)[0];
            if (firstColor) {
              defaultMockupImage = mockupsByColor[firstColor]?.front || null;
            }
          }
          
          // Get availableColors with hex values from product data
          let availableColorsWithHex: Array<{name: string, hex?: string}> = [];
          const rawAvailableColors = product.availableColors;
          if (rawAvailableColors) {
            if (Array.isArray(rawAvailableColors)) {
              availableColorsWithHex = rawAvailableColors as Array<{name: string, hex?: string}>;
            }
          }
          
          // Determine if this is a customizable product or store template
          // Store templates (pre-made designs) are not customizable
          const metadata = typeof product.metadata === 'object' ? product.metadata as Record<string, any> : {};
          const isCustomizable = metadata?.allowCustomization !== false && 
            !product.id.startsWith('custom_') && 
            !product.id.includes('-template-');
          
          return {
            ...product,
            retailPrice, // Calculated final price with markup and QR cost
            qrCodeUrl: matchingDesign?.qrCodeUrl || null,
            frontChestImage,
            frontChestImageWhite,
            placementImages, // All placements including white variants (e.g., back, back-white, left-sleeve, left-sleeve-white)
            // New mockup fields (normalized and validated)
            mockupsByColor,
            defaultColor: validDefaultColor, // Use validated color that exists in mockups
            selectedColors,
            defaultMockupImage, // Pre-computed default image for quick display
            availableColorsWithHex, // Colors with hex values for color swatches
            isCustomizable, // Whether user can customize the design
          };
        });
        
        return res.json(enrichedProducts);
      }
      
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Printify Catalog API
  app.get("/api/printify/status", async (req, res) => {
    res.json({ 
      configured: printify.isConfigured,
      message: printify.isConfigured 
        ? "Printify API is connected" 
        : "Printify API key or Shop ID not configured"
    });
  });

  app.get("/api/printify/catalog", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprints = await printify.getCatalogBlueprints();
      res.json(blueprints);
    } catch (error: any) {
      console.error("Printify catalog error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/catalog/:blueprintId", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      const [blueprint, providers] = await Promise.all([
        printify.getBlueprintDetails(blueprintId),
        getUSAPrintProviders(blueprintId),
      ]);
      res.json({ blueprint, providers });
    } catch (error: any) {
      console.error("Printify blueprint error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/catalog/:blueprintId/variants", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      const printProviderId = parseInt(req.query.providerId as string);
      
      if (!printProviderId) {
        return res.status(400).json({ error: "providerId query param required" });
      }
      
      const variants = await printify.getVariants(blueprintId, printProviderId);
      res.json(variants);
    } catch (error: any) {
      console.error("Printify variants error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/products", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const products = await printify.getShopProducts();
      res.json(products);
    } catch (error: any) {
      console.error("Printify products error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // File upload API for multipart form data (custom designs, etc.)
  app.post("/api/upload", async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      let fileName = "upload";
      let mimeType = "image/png";
      let boundary = "";
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        boundary = boundaryMatch[1];
      }
      
      // Collect raw body data
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      // Parse multipart form data manually
      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;
      
      while (true) {
        const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
        if (boundaryIndex === -1) break;
        
        if (start > 0) {
          parts.push(rawBody.slice(start, boundaryIndex - 2)); // -2 for CRLF
        }
        start = boundaryIndex + boundaryBuffer.length + 2; // +2 for CRLF
      }
      
      let fileBuffer: Buffer | null = null;
      
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
      
      const uploadResult = await uploadImageFromBuffer(fileBuffer, fileName, mimeType);
      
      res.json({ url: uploadResult.publicUrl });
    } catch (error: any) {
      console.error("File upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Media upload API for Play content (videos/animated images)
  // Uploads directly to Firebase Storage with progress support
  // Part of test API umbrella - requires Firebase authentication
  app.post("/api/test/upload-media", async (req, res) => {
    try {
      // Verify Firebase authentication
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
      console.log(`[MediaUpload] Starting media upload for user: ${userId}`);
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      
      if (!boundaryMatch) {
        return res.status(400).json({ error: "Invalid content type - expected multipart/form-data" });
      }
      
      const boundary = boundaryMatch[1];
      
      // Collect raw body data
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
      console.log(`[MediaUpload] Received ${rawBody.length} bytes`);
      
      // Parse multipart form data manually
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
      let storeType = "internal";
      let clientUserId = "";
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        // Check if this is the storeType field
        if (headers.includes('name="storeType"')) {
          storeType = body.toString().trim();
          continue;
        }
        
        // Check if this is the userId field
        if (headers.includes('name="userId"')) {
          clientUserId = body.toString().trim();
          continue;
        }
        
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
      
      // Validate store type
      const validStoreTypes = ["internal", "external", "member"];
      if (!validStoreTypes.includes(storeType)) {
        storeType = "internal";
      }
      
      // Validate mime type for media
      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
      if (!allowedTypes.includes(mimeType) && !mimeType.startsWith("video/")) {
        return res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: most video formats, GIF, WebP, PNG, JPEG` });
      }
      
      // Determine media type from mime
      const mediaType = mimeType.startsWith("video/") ? "video" : "image";
      
      // Build storage path based on store type
      // - internal/external: library/{storeType}/{mediaType}/{filename}
      // - member: library/member/{userId}/{mediaType}/{filename}
      const uniqueFilename = `${Date.now()}-${fileName}`;
      let storagePath: string;
      let mediaUrl: string;
      
      if (storeType === "member") {
        // For member uploads, use the authenticated userId (not client-provided for security)
        storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
        mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
      } else {
        storagePath = `library/${storeType}/${mediaType}/${uniqueFilename}`;
        mediaUrl = `/api/library-files/${storeType}/${mediaType}/${uniqueFilename}`;
      }
      
      console.log(`[MediaUpload] Uploading ${fileName} (${mimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
      
      // Upload directly to Firebase Storage with custom path
      const bucket = (await import("./lib/firebase-admin")).getStorageBucket();
      const file = bucket.file(storagePath);
      
      await file.save(fileBuffer, {
        metadata: { contentType: mimeType },
      });
      
      console.log(`[MediaUpload] Upload complete: ${mediaUrl}`);
      
      res.json({
        url: mediaUrl,
        mimeType: mimeType,
        fileName: fileName,
        size: fileBuffer.length,
        storagePath: storagePath
      });
      
    } catch (error: any) {
      console.error("[MediaUpload] Error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // Serve uploaded files from Firebase Storage
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      const served = await downloadAndStreamFile(filename, res, 'custom-designs', 31536000);
      if (served) {
        return;
      }
      
      return res.status(404).json({ error: "File not found" });
    } catch (error: any) {
      console.error("File serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve library files from Firebase Storage (simple filename)
  app.get("/api/library-files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      const served = await downloadAndStreamFile(filename, res, 'library', 31536000);
      if (served) {
        return;
      }
      
      return res.status(404).json({ error: "Library file not found" });
    } catch (error: any) {
      console.error("Library file serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Helper: Stream file from Firebase Storage with HTTP Range support (required for mobile video)
  async function streamFirebaseFileWithRange(req: any, res: any, storagePath: string) {
    const bucket = (await import("./lib/firebase-admin")).getStorageBucket();
    const file = bucket.file(storagePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/octet-stream";
    const fileSize = parseInt(metadata.size as string, 10);
    
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    
    const rangeHeader = req.headers.range;
    if (rangeHeader && fileSize) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", chunkSize);
      res.setHeader("Content-Type", contentType);
      
      file.createReadStream({ start, end }).pipe(res);
    } else {
      res.setHeader("Content-Type", contentType);
      if (fileSize) {
        res.setHeader("Content-Length", fileSize);
      }
      file.createReadStream().pipe(res);
    }
  }

  // Serve library files for internal/external: /api/library-files/{storeType}/{mediaType}/{filename}
  app.get("/api/library-files/:storeType/:mediaType/:filename", async (req, res) => {
    try {
      const { storeType, mediaType, filename } = req.params;
      
      if (storeType === "member") {
        return res.status(400).json({ error: "Use /api/library-files/member/:userId/:mediaType/:filename for member files" });
      }
      
      const storagePath = `library/${storeType}/${mediaType}/${filename}`;
      await streamFirebaseFileWithRange(req, res, storagePath);
    } catch (error: any) {
      console.error("Library file serve error:", error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  // Serve member library files: /api/library-files/member/{userId}/{mediaType}/{filename}
  app.get("/api/library-files/member/:userId/:mediaType/:filename", async (req, res) => {
    try {
      const { userId, mediaType, filename } = req.params;
      const storagePath = `library/member/${userId}/${mediaType}/${filename}`;
      await streamFirebaseFileWithRange(req, res, storagePath);
    } catch (error: any) {
      console.error("Library file serve error:", error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
  });

  // Serve media files from uploads folder in Firebase Storage
  app.get("/api/media-files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      const served = await downloadAndStreamFile(filename, res, 'uploads', 31536000);
      if (served) {
        return;
      }
      
      return res.status(404).json({ error: "Media file not found" });
    } catch (error: any) {
      console.error("Media file serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC test endpoint for upload (no auth - for testing only)
  app.post("/api/test-upload", async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType } = req.body;
      
      console.log("[TestUpload] Received request:", { name, assetType, mimeType, dataLength: imageData?.length });
      
      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }
      
      if (assetType !== 'source' && assetType !== 'cropped') {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }
      
      const buffer = Buffer.from(imageData, 'base64');
      const isZip = mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed';
      const { libraryAssets } = await import("@shared/schema");
      
      // Handle ZIP file
      if (isZip) {
        console.log(`[TestUpload] Processing ZIP file: ${name}`);
        
        // 1. Save original zip to library/backgrounds/zip/
        const zipFileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const zipUploadResult = await uploadToFirebaseStorage(
          buffer,
          zipFileName,
          mimeType,
          'library/backgrounds/zip'
        );
        console.log(`[TestUpload] Saved ZIP to: ${zipUploadResult.storageUrl}`);
        
        // 2. Extract and upload each image to library/backgrounds/raw/
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(buffer);
        
        const uploadedAssets: any[] = [];
        let imageCount = 0;
        
        for (const [filename, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          
          const ext = filename.toLowerCase().split('.').pop();
          if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext || '')) continue;
          
          imageCount++;
          const imageBuffer = await entry.async('nodebuffer');
          const imageName = filename.split('/').pop() || filename;
          const sanitizedName = `${Date.now()}-${imageName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const imageMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          
          console.log(`[TestUpload] Extracting image ${imageCount}: ${imageName}`);
          
          const uploadResult = await uploadToFirebaseStorage(
            imageBuffer,
            sanitizedName,
            imageMime,
            'library/backgrounds/raw'
          );
          
          const displayName = imageName.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(sanitizedName)}`;
          
          const [asset] = await db.insert(libraryAssets).values({
            ownerType: 'admin',
            assetType: assetType,
            mediaType: 'image',
            name: displayName,
            fileName: sanitizedName,
            originalName: imageName,
            storageUrl: uploadResult.storageUrl,
            publicUrl: proxyUrl,
            mimeType: imageMime,
            sizeBytes: imageBuffer.length,
            isActive: true,
          }).returning();
          
          uploadedAssets.push({ ...asset, proxyUrl });
        }
        
        console.log(`[TestUpload] ZIP complete: ${uploadedAssets.length} images extracted`);
        return res.json({ 
          success: true, 
          type: 'zip',
          zipStorageUrl: zipUploadResult.storageUrl,
          extractedCount: uploadedAssets.length,
          assets: uploadedAssets 
        });
      }
      
      // Handle single image
      console.log(`[TestUpload] Processing single image: ${name}`);
      
      const sanitizedName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${mimeType?.split('/')[1] || 'png'}`;
      const folder = assetType === 'source' ? 'library/backgrounds/raw' : 'library/backgrounds/cropped';
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType || 'image/png',
        folder
      );
      
      console.log(`[TestUpload] Uploaded to: ${uploadResult.storageUrl}`);
      
      const proxyUrl = `/api/library-files/${encodeURIComponent(sanitizedName)}`;
      
      const [asset] = await db.insert(libraryAssets).values({
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name: name,
        fileName: sanitizedName,
        originalName: name,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        isActive: true,
      }).returning();
      
      console.log(`[TestUpload] Created asset: ${asset.id}`);
      
      return res.json({ 
        success: true, 
        type: 'single',
        asset: { ...asset, proxyUrl }
      });
      
    } catch (error: any) {
      console.error('[TestUpload] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC test endpoint to list images (no auth required)
  app.get("/api/test-images", async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      const assets = await db.select({
        id: libraryAssets.id,
        name: libraryAssets.name,
        storageUrl: libraryAssets.storageUrl,
      }).from(libraryAssets)
        .where(eq(libraryAssets.isActive, true))
        .limit(20);
      
      const assetsWithProxy = assets.map(a => {
        const filename = (a.storageUrl || '').split('/').pop() || '';
        const proxyUrl = `/api/library-files/${encodeURIComponent(filename)}`;
        return {
          ...a,
          publicUrl: proxyUrl,
          proxyUrl
        };
      });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Image proxy endpoint for CORS-blocked images (used by AR demo)
  app.get("/api/proxy-image", async (req: any, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }
      
      // Only allow certain domains for security
      const allowedDomains = [
        "images.printify.com",
        "images-api.printify.com",
        "printful.com",
        "files.cdn.printful.com",
      ];
      
      const url = new URL(imageUrl);
      if (!allowedDomains.some(d => url.hostname.includes(d))) {
        return res.status(403).json({ error: "Domain not allowed" });
      }
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to fetch image" });
      }
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      
      res.set("Content-Type", contentType);
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (error: any) {
      console.error("[ProxyImage] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC test endpoint for background-assets (mirrors /api/admin/background-assets but no auth)
  app.get("/api/test/background-assets", async (req: any, res) => {
    try {
      const typeFilter = (req.query.type as string) || 'source';
      const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
      
      if (!validTypes.includes(typeFilter)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
      
      // Use storage adapter for Firestore consistency between dev/prod
      const assets = await storage.getAdminLibraryAssets({ assetType: typeFilter });
      
      // Filter only active assets and add proxy URLs
      const assetsWithProxy = assets
        .filter(asset => asset.isActive !== false)
        .map(asset => {
          const filename = (asset.storageUrl || '').split('/').pop() || '';
          return {
            ...asset,
            proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
            publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
          };
        });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      console.error('[TestBackgroundAssets] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC test endpoint to upload background assets (no auth)
  // Handles both single images and ZIP files
  app.post("/api/test/background-assets", async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType, sourceAssetId, tags } = req.body;
      
      console.log("[TestBackgroundAssets] POST request:", { name, assetType, mimeType, dataLength: imageData?.length });
      
      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }
      
      if (assetType !== 'source' && assetType !== 'cropped') {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }
      
      const buffer = Buffer.from(imageData, 'base64');
      const { libraryAssets } = await import("@shared/schema");
      const isZip = mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed';
      
      // Handle ZIP file: save original to zip/, extract contents to raw/
      if (isZip) {
        console.log(`[TestBackgroundAssets] Processing ZIP file: ${name}`);
        
        // 1. Save original zip to library/backgrounds/zip/
        const zipFileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const zipUploadResult = await uploadToFirebaseStorage(
          buffer,
          zipFileName,
          mimeType,
          'library/backgrounds/zip'
        );
        console.log(`[TestBackgroundAssets] Saved ZIP to: ${zipUploadResult.storageUrl}`);
        
        // 2. Extract and upload each image to library/backgrounds/raw/
        const JSZipModule = await import('jszip');
        const zip = await JSZipModule.default.loadAsync(buffer);
        
        const uploadedAssets: any[] = [];
        
        for (const [filename, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          
          const ext = filename.toLowerCase().split('.').pop();
          if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext || '')) continue;
          
          const imageBuffer = await entry.async('nodebuffer');
          const imageName = filename.split('/').pop() || filename;
          const sanitizedName = `${Date.now()}-${imageName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
          const imageMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          
          console.log(`[TestBackgroundAssets] Extracting: ${imageName}`);
          
          const uploadResult = await uploadToFirebaseStorage(
            imageBuffer,
            sanitizedName,
            imageMime,
            'library/backgrounds/raw'
          );
          
          const displayName = imageName.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(sanitizedName)}`;
          
          const [asset] = await db.insert(libraryAssets).values({
            ownerType: 'admin',
            assetType: assetType,
            mediaType: 'image',
            name: displayName,
            fileName: sanitizedName,
            originalName: imageName,
            storageUrl: uploadResult.storageUrl,
            publicUrl: proxyUrl,
            mimeType: imageMime,
            sizeBytes: imageBuffer.length,
            isActive: true,
          }).returning();
          
          uploadedAssets.push({ ...asset, proxyUrl });
        }
        
        console.log(`[TestBackgroundAssets] ZIP complete: ${uploadedAssets.length} images extracted`);
        return res.json({ 
          success: true, 
          type: 'zip',
          zipStorageUrl: zipUploadResult.storageUrl,
          extractedCount: uploadedAssets.length,
          assets: uploadedAssets 
        });
      }
      
      // Handle single image
      const folder = assetType === 'cropped' ? 'library/backgrounds/cropped' : 'library/backgrounds/raw';
      const sanitizedName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        sanitizedName,
        mimeType || 'image/png',
        folder
      );
      
      console.log(`[TestBackgroundAssets] Uploaded to: ${uploadResult.storageUrl}`);
      
      const proxyUrl = `/api/library-files/${encodeURIComponent(sanitizedName)}`;
      
      const [asset] = await db.insert(libraryAssets).values({
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name: name,
        fileName: sanitizedName,
        originalName: name,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        isActive: true,
        tags: tags || null,
        sourceAssetId: sourceAssetId || null,
      }).returning();
      
      console.log(`[TestBackgroundAssets] Created asset: ${asset.id}`);
      
      // If this is a cropped image with a source, handle the source image workflow
      if (assetType === 'cropped' && sourceAssetId) {
        console.log(`[TestBackgroundAssets] Processing source image workflow for: ${sourceAssetId}`);
        
        // Get the source asset
        const [sourceAsset] = await db.select().from(libraryAssets)
          .where(eq(libraryAssets.id, sourceAssetId));
        
        if (sourceAsset && sourceAsset.storageUrl) {
          try {
            // Download the source image from Firebase Storage
            const { getStorage } = await import("firebase-admin/storage");
            const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'qrgear-c1ffd.firebasestorage.app';
            const bucket = getStorage().bucket(bucketName);
            const sourceFile = bucket.file(sourceAsset.storageUrl);
            const [sourceBuffer] = await sourceFile.download();
            
            // Copy to backgrounds archive folder
            const archiveFileName = `${Date.now()}-${sourceAsset.fileName || sourceAsset.name}`;
            const archiveResult = await uploadToFirebaseStorage(
              sourceBuffer,
              archiveFileName,
              sourceAsset.mimeType || 'image/png',
              'library/backgrounds/archive'
            );
            console.log(`[TestBackgroundAssets] Archived source to: ${archiveResult.storageUrl}`);
            
            // Create archive record
            const archiveProxyUrl = `/api/library-files/${encodeURIComponent(archiveFileName)}`;
            await db.insert(libraryAssets).values({
              ownerType: 'admin',
              assetType: 'background',
              mediaType: 'image',
              name: sourceAsset.name,
              fileName: archiveFileName,
              originalName: sourceAsset.originalName,
              storageUrl: archiveResult.storageUrl,
              publicUrl: archiveProxyUrl,
              mimeType: sourceAsset.mimeType,
              sizeBytes: sourceBuffer.length,
              isActive: true,
              sourceAssetId: sourceAssetId,
            });
            
            // Mark original source as inactive (remove from raw)
            await db.update(libraryAssets)
              .set({ isActive: false })
              .where(eq(libraryAssets.id, sourceAssetId));
            console.log(`[TestBackgroundAssets] Marked source ${sourceAssetId} as inactive`);
            
          } catch (archiveErr: any) {
            console.error(`[TestBackgroundAssets] Archive failed (non-fatal):`, archiveErr.message);
          }
        }
      }
      
      return res.json({ 
        success: true, 
        asset: { ...asset, proxyUrl }
      });
      
    } catch (error: any) {
      console.error('[TestBackgroundAssets] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // PUBLIC test endpoint to delete background assets (no auth)
  app.delete("/api/test/background-assets/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { libraryAssets } = await import("@shared/schema");
      
      console.log(`[TestBackgroundAssets] DELETE request for id: ${id}`);
      
      // Soft delete - set isActive to false
      await db.update(libraryAssets)
        .set({ isActive: false })
        .where(eq(libraryAssets.id, id));
      
      res.json({ success: true, message: "Asset deleted" });
    } catch (error: any) {
      console.error('[TestBackgroundAssets] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===========================================
  // TEST PRODUCTS ENDPOINTS (no auth required)
  // ===========================================
  
  // Get fulfillment provider status (which providers are configured)
  app.get("/api/test/fulfillment-providers", async (req: any, res) => {
    try {
      const printifyKey = process.env.PRINTIFY_API_KEY;
      const printfulKey = process.env.PRINTFUL_API_KEY;
      const apliiqKey = process.env.APLIIQ_API_KEY;
      
      const providers = [
        { 
          id: "printify", 
          name: "Printify", 
          configured: !!printifyKey && printifyKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printify network"
        },
        { 
          id: "printful", 
          name: "Printful", 
          configured: !!printfulKey && printfulKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printful"
        },
        { 
          id: "apliiq", 
          name: "Apliiq", 
          configured: !!apliiqKey && apliiqKey.length > 10,
          role: "fulfillment",
          description: "Custom apparel via Apliiq"
        },
      ];
      
      console.log(`[FulfillmentProviders] Returning ${providers.filter(p => p.configured).length} configured providers`);
      res.json(providers);
    } catch (error: any) {
      console.error('[FulfillmentProviders] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all products (test endpoint) - supports provider filter
  app.get("/api/test/products", async (req: any, res) => {
    try {
      const provider = req.query.provider as string | undefined;
      const { products, printfulProducts } = await import("@shared/schema");
      
      if (provider === "printful") {
        // Fetch from Printful catalog
        const allProducts = await db.select().from(printfulProducts);
        console.log(`[TestProducts] GET returned ${allProducts.length} Printful products`);
        
        // Transform to common format
        const transformed = allProducts.map(p => ({
          id: `printful-${p.id}`,
          name: p.title || `Printful Product ${p.id}`,
          printfulId: p.id,
          blueprintId: p.id,
          isEnabled: true,
          fulfillmentProvider: "printful",
          image: p.image,
          variantCount: p.variantCount || 0,
          brand: p.brand,
          model: p.model,
          description: p.type,
        }));
        
        return res.json(transformed);
      }
      
      // Default: Printify products
      const allProducts = await db.select().from(products).where(eq(products.isEnabled, true));
      console.log(`[TestProducts] GET returned ${allProducts.length} Printify products`);
      res.json(allProducts);
    } catch (error: any) {
      console.error('[TestProducts] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync products from Printify (test endpoint with auth)
  app.post("/api/test/products/sync", async (req: any, res) => {
    try {
      console.log('[TestProducts] Sync requested');
      
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      // Check if sync is already running
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        return res.status(409).json({ error: "Sync already in progress" });
      }
      
      // Create sync record
      const syncRecord = await storage.createCatalogSync({
        syncType: 'full',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });
      
      // Return immediately, sync runs in background
      res.json({ syncId: syncRecord.id, status: 'started', message: "Catalog sync started in background" });
      
      // Run sync in background
      (async () => {
        try {
          console.log('[TestProducts] Starting full catalog sync...');
          
          const blueprints = await printify.getCatalogBlueprints();
          console.log(`[TestProducts] Found ${blueprints.length} blueprints`);
          
          let blueprintsCount = 0;
          let providersCount = 0;
          
          for (const bp of blueprints) {
            try {
              await storage.upsertPrintifyBlueprint({
                id: bp.id,
                title: bp.title,
                description: bp.description || null,
                brand: bp.brand || null,
                model: bp.model || null,
                images: bp.images || null,
                primaryImageUrl: bp.images?.[0] || null,
                category: detectCategory(bp.title, bp.brand || ''),
              });
              blueprintsCount++;
              
              const providers = await printify.getPrintProviders(bp.id);
              
              for (const provider of providers) {
                const isUSA = provider.location?.country === 'US' || 
                              provider.location?.country === 'USA';
                
                await storage.upsertPrintifyPrintProvider({
                  blueprintId: bp.id,
                  providerId: provider.id,
                  title: provider.title,
                  country: provider.location?.country || null,
                  isUSA,
                });
                providersCount++;
              }
              
              await new Promise(r => setTimeout(r, 100));
              
            } catch (bpError: any) {
              console.error(`[TestProducts] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }
          
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount,
            providersCount,
            completedAt: new Date(),
          });
          
          console.log(`[TestProducts] Sync completed. ${blueprintsCount} blueprints, ${providersCount} providers`);
          
        } catch (bgError: any) {
          console.error('[TestProducts] Background sync error:', bgError.message);
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'failed',
            errorMessage: bgError.message,
            completedAt: new Date(),
          });
        }
      })();
      
    } catch (error: any) {
      console.error('[TestProducts] Sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update product (test endpoint - no auth required)
  app.put("/api/test/products/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const { products } = await import("@shared/schema");
      
      // Build update object, filtering out undefined values
      const cleanUpdate: Record<string, any> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          cleanUpdate[key] = value;
        }
      }
      cleanUpdate.updatedAt = new Date();
      
      const [updated] = await db
        .update(products)
        .set(cleanUpdate)
        .where(eq(products.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      console.log(`[TestProducts] PUT ${id} updated:`, Object.keys(cleanUpdate));
      res.json(updated);
    } catch (error: any) {
      console.error('[TestProducts] PUT error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get stores by role type (test endpoint) - uses Firestore
  app.get("/api/test/stores", async (req: any, res) => {
    try {
      const roleType = req.query.roleType as string;
      console.log(`[TestStores] GET stores for roleType: ${roleType}`);
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      
      let query = db.collection('stores');
      if (roleType) {
        query = query.where('roleType', '==', roleType) as any;
      }
      
      const snapshot = await query.get();
      const stores = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Sort by name
      stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      
      console.log(`[TestStores] Found ${stores.length} stores for roleType: ${roleType || 'all'}`);
      res.json(stores);
    } catch (error: any) {
      console.error('[TestStores] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get store by ID (test endpoint) - uses Firestore, checks both stores and partnerStores
  app.get("/api/test/stores/by-id/:storeId", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      console.log(`[TestStores] GET store by ID: ${storeId}`);
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      
      // First check the regular stores collection
      let doc = await db.collection('stores').doc(storeId).get();
      
      if (doc.exists) {
        const data = doc.data();
        const store = {
          id: doc.id,
          name: data?.name || storeId,
          type: data?.roleType || 'internal',
          roleType: data?.roleType || 'internal',
          isActive: data?.isActive ?? true,
        };
        console.log(`[TestStores] Found store in stores: ${storeId}`);
        return res.json(store);
      }
      
      // Check partnerStores collection as fallback
      doc = await db.collection('partnerStores').doc(storeId).get();
      
      if (doc.exists) {
        const data = doc.data();
        const store = {
          id: doc.id,
          name: data?.name || storeId,
          type: data?.isInternal ? 'internal' : 'external',
          roleType: data?.isInternal ? 'internal' : 'external',
          isActive: data?.isActive ?? true,
          isPartnerStore: true,
        };
        console.log(`[TestStores] Found store in partnerStores: ${storeId}`);
        return res.json(store);
      }
      
      return res.status(404).json({ error: 'Store not found' });
    } catch (error: any) {
      console.error('[TestStores] GET by-id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new store (test endpoint) - uses Firestore
  app.post("/api/test/stores", async (req: any, res) => {
    try {
      const { name, roleType } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Store name is required' });
      }
      if (!roleType || !['internal', 'external', 'member'].includes(roleType)) {
        return res.status(400).json({ error: 'Valid roleType is required (internal, external, member)' });
      }
      
      const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const storeData = {
        name: name.trim(),
        roleType,
        isActive: true,
        channelCount: 0,
        createdAt: new Date().toISOString(),
      };
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      await db.collection('stores').doc(storeId).set(storeData);
      
      console.log(`[TestStores] Created store: ${storeId} (${roleType})`);
      res.json({ id: storeId, ...storeData });
    } catch (error: any) {
      console.error('[TestStores] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a store (test endpoint) - uses Firestore
  app.delete("/api/test/stores/:storeId", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      
      // First delete all channels for this store
      const channelsSnapshot = await db.collection('storeChannels')
        .where('storeId', '==', storeId)
        .get();
      
      const batch = db.batch();
      channelsSnapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      
      // Delete the store
      batch.delete(db.collection('stores').doc(storeId));
      await batch.commit();
      
      console.log(`[TestStores] Deleted store: ${storeId} (and ${channelsSnapshot.size} channels)`);
      res.json({ success: true, deletedChannels: channelsSnapshot.size });
    } catch (error: any) {
      console.error('[TestStores] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get channels for a store (test endpoint) - uses Firestore
  app.get("/api/test/stores/:storeId/channels", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      console.log(`[TestChannels] GET channels for store: ${storeId}`);
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      // No orderBy to avoid needing composite index
      const snapshot = await db.collection('storeChannels')
        .where('storeId', '==', storeId)
        .get();
      
      const channels = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Sort by createdAt in memory
      channels.sort((a: any, b: any) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      
      console.log(`[TestChannels] Found ${channels.length} channels for ${storeId}`);
      res.json(channels);
    } catch (error: any) {
      console.error('[TestChannels] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new channel for a store
  app.post("/api/test/stores/:storeId/channels", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Channel name is required' });
      }
      
      const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const channelData = {
        name: name.trim(),
        storeId,
        isActive: true,
        productCount: 0,
        createdAt: new Date().toISOString(),
      };
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      await db.collection('storeChannels').doc(channelId).set(channelData);
      console.log(`[TestChannels] Created channel: ${channelId} for store ${storeId}`);
      
      res.json({ id: channelId, ...channelData });
    } catch (error: any) {
      console.error('[TestChannels] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a channel
  app.delete("/api/test/stores/:storeId/channels/:channelId", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      await db.collection('storeChannels').doc(channelId).delete();
      console.log(`[TestChannels] Deleted channel: ${channelId} from store ${storeId}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[TestChannels] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get allowed blank products for a store
  app.get("/api/test/stores/:storeId/allowed-products", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      console.log(`[AllowedProducts] GET allowed products for store: ${storeId}`);
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      
      const doc = await db.collection('storeAllowedProducts').doc(storeId).get();
      
      if (!doc.exists) {
        return res.json({ storeId, products: [] });
      }
      
      const data = doc.data();
      res.json({ 
        storeId, 
        products: data?.products || [],
        updatedAt: data?.updatedAt 
      });
    } catch (error: any) {
      console.error('[AllowedProducts] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set allowed blank products for a store - creates "common packets" with pricing from test-pricing settings
  app.post("/api/test/stores/:storeId/allowed-products", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { products } = req.body;
      
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'products must be an array' });
      }
      
      console.log(`[AllowedProducts] POST ${products.length} products for store: ${storeId}`);
      
      // Fetch pricing settings from test-pricing config
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      
      const pricingDoc = await db.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      
      // Dynamic pricing from settings (with defaults)
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25; // 25% default
      
      console.log(`[AllowedProducts] Using pricing: ${markupPercent}% markup, ${memberProfitShare * 100}% member share`);
      
      // Build common packets with pricing info at save time
      const { downloadAndStoreFromUrl } = await import("./lib/firebase-storage-service");
      const { syncProductVariants } = await import("./lib/printify");
      
      const enrichedProducts = await Promise.all(
        products.map(async (p: { blueprintId: number; title: string; addedAt?: string }) => {
          try {
            const blueprint = await storage.getPrintifyBlueprint(p.blueprintId);
            const providers = await storage.getPrintifyPrintProviders(p.blueprintId);
            
            // Get USA provider or first available
            const usaProviders = providers.filter((prov: any) => prov.isUSA);
            const selectedProvider = usaProviders[0] || providers[0];
            
            // Get colors with hex codes from provider or sync from Printify
            let availableColors: Array<{name: string; hex: string}> = [];
            let availableSizes: string[] = [];
            
            if (selectedProvider?.availableColors && Array.isArray(selectedProvider.availableColors)) {
              availableColors = selectedProvider.availableColors as Array<{name: string; hex: string}>;
              availableSizes = (selectedProvider.availableSizes as string[]) || [];
            } else if (selectedProvider?.id) {
              // Sync from Printify to get colors/sizes with hex codes
              try {
                const variantData = await syncProductVariants(p.blueprintId, Number(selectedProvider.id));
                availableColors = variantData.colors;
                availableSizes = variantData.sizes;
                console.log(`[AllowedProducts] Synced ${availableColors.length} colors for blueprint ${p.blueprintId}`);
              } catch (syncErr) {
                console.error(`[AllowedProducts] Failed to sync variants for ${p.blueprintId}:`, syncErr);
              }
            }
            
            // Base cost is the manufacturing cost (minCost from provider, in cents)
            const baseCostCents = selectedProvider?.minCost || 0;
            const baseCost = baseCostCents / 100;
            
            // Calculate retail price using dynamic settings
            const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
            const profit = retailPrice - baseCost;
            const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
            
            // Download primary Printify image to Firebase Storage
            let imageUrl: string | null = null;
            if (blueprint?.primaryImageUrl) {
              imageUrl = await downloadAndStoreFromUrl(
                blueprint.primaryImageUrl, 
                `product-blueprint-${p.blueprintId}`
              );
              console.log(`[AllowedProducts] Stored primary image for blueprint ${p.blueprintId}: ${imageUrl}`);
            }
            
            // Initialize mockupsByColor with primary image as default
            const mockupsByColor: Record<string, { front: string | null }> = {};
            if (availableColors.length > 0 && imageUrl) {
              // Set primary image as the first color's mockup (typically the catalog default)
              const firstColor = availableColors[0].name;
              mockupsByColor[firstColor] = { front: imageUrl };
              console.log(`[AllowedProducts] Set default mockup for ${firstColor}: ${imageUrl}`);
            }
            
            // Queue background jobs to generate mockups for remaining colors
            // This happens asynchronously - mockups will be added as they complete
            if (availableColors.length > 1 && selectedProvider?.id) {
              console.log(`[AllowedProducts] Queuing mockup generation for ${availableColors.length - 1} additional colors...`);
              // Note: Mockup generation jobs would be created here using the job queue
              // For now, we store the color data and can generate mockups on-demand or via cron
            }
            
            return {
              blueprintId: p.blueprintId,
              title: p.title,
              addedAt: p.addedAt || new Date().toISOString(),
              // Common packet data - now uses Firebase Storage URL
              imageUrl,
              brand: blueprint?.brand || null,
              // Colors with hex codes for UI swatches
              availableColors,
              availableSizes,
              // Mockups by color (populated as they're generated)
              mockupsByColor,
              printProviderId: selectedProvider?.id || null,
              baseCost,
              retailPrice,
              profit,
              memberEarnings,
              hasUSAProvider: usaProviders.length > 0,
              // Store pricing settings used for this packet
              pricingUsed: {
                markupPercent,
                markupFixed,
                additionalPlacementCost,
                textLineUpcharge,
                memberProfitShare,
              },
              packetCreatedAt: new Date().toISOString(),
            };
          } catch (err) {
            console.error(`[AllowedProducts] Error enriching blueprint ${p.blueprintId}:`, err);
            return {
              ...p,
              addedAt: p.addedAt || new Date().toISOString(),
              imageUrl: null,
              brand: null,
              baseCost: 0,
              retailPrice: 0,
              profit: 0,
              memberEarnings: 0,
              hasUSAProvider: false,
              pricingUsed: null,
              packetCreatedAt: new Date().toISOString(),
            };
          }
        })
      );
      
      await db.collection('storeAllowedProducts').doc(storeId).set({
        storeId,
        products: enrichedProducts,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[AllowedProducts] Saved ${enrichedProducts.length} enriched packets for store: ${storeId}`);
      
      res.json({ 
        success: true, 
        storeId, 
        productCount: enrichedProducts.length,
        message: `Created ${enrichedProducts.length} common packets with pricing (${markupPercent}% markup, ${memberProfitShare * 100}% member share)`
      });
    } catch (error: any) {
      console.error('[AllowedProducts] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: partner-stores (no auth required) - fetches from Firestore
  app.get("/api/test/partner-stores", async (req: any, res) => {
    try {
      console.log('[TestPartnerStores] GET partner-stores from Firestore');
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('partnerStores').get();
      const stores = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          slug: data.slug,
          isInternal: data.isInternal ?? true,
          isActive: data.isActive ?? true,
          availableSegments: data.availableSegments || [],
          apiKey: data.apiKey || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        };
      });
      
      console.log(`[TestPartnerStores] Found ${stores.length} stores`);
      res.json(stores);
    } catch (error: any) {
      console.error('[TestPartnerStores] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Get products for a partner store (no auth required)
  app.get("/api/test/partner-stores/:id/products", async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log(`[TestPartnerStores] GET products for store ${id}`);
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('partnerStoreProducts')
        .where('storeId', '==', id)
        .get();
      
      const products = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      console.log(`[TestPartnerStores] Found ${products.length} products for store ${id}`);
      res.json(products);
    } catch (error: any) {
      console.error('[TestPartnerStores] GET products error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Sync products to a partner store (no auth required)
  app.post("/api/test/partner-stores/:id/products", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { productIds } = req.body;
      
      console.log(`[TestPartnerStores] POST sync products for store ${id}:`, productIds);
      
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: 'productIds must be an array' });
      }
      
      const { getFirestoreDb, getFirebaseAdmin } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = firestoreDb.batch();
      
      // Remove existing products for this store
      const existingSnapshot = await firestoreDb.collection('partnerStoreProducts')
        .where('storeId', '==', id)
        .get();
      existingSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
      
      // Add new products
      for (const productId of productIds) {
        const docRef = firestoreDb.collection('partnerStoreProducts').doc();
        batch.set(docRef, {
          storeId: id,
          productId,
          createdAt: now,
        });
      }
      
      await batch.commit();
      
      console.log(`[TestPartnerStores] Synced ${productIds.length} products to store ${id}`);
      res.json({ success: true, synced: productIds.length });
    } catch (error: any) {
      console.error('[TestPartnerStores] POST products error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Brands known to manufacture garments in the USA
  const TEST_USA_MADE_BRANDS = [
    'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
    'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
    'shaka wear', 'backpacks usa', 'american giant', 'next level',
  ];

  // Test endpoint: Printify catalog (no auth required)
  app.get("/api/test/printify/catalog", async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET Printify catalog');
      const localBlueprints = await storage.getPrintifyBlueprints();
      
      if (localBlueprints.length === 0) {
        return res.json([]);
      }
      
      // Import mockup mapping checker
      const { hasKnownMockupMapping } = await import("./lib/mockup-service");
      
      // Fetch provider data for price/color info
      const { printifyPrintProviders } = await import("@shared/schema");
      const allProviders = await db.select().from(printifyPrintProviders);
      
      // Group providers by blueprint_id, pick best one (lowest price with colors)
      const providersByBlueprint: Record<number, typeof allProviders[0]> = {};
      for (const p of allProviders) {
        const existing = providersByBlueprint[p.blueprintId];
        if (!existing || (p.minCost && (!existing.minCost || p.minCost < existing.minCost))) {
          providersByBlueprint[p.blueprintId] = p;
        }
      }
      
      const categories: Record<string, any[]> = {
        "T-Shirts": [],
        "Sweatshirts & Hoodies": [],
        "Hats & Caps": [],
        "Drinkware": [],
        "Bags": [],
        "Other": [],
      };
      
      for (const bp of localBlueprints) {
        const title = bp.title.toLowerCase();
        const brandLower = (bp.brand || '').toLowerCase();
        const isUSABrand = TEST_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        
        // Get provider data for this blueprint
        const provider = providersByBlueprint[bp.id];
        const colors = provider?.availableColors as Array<{name: string; hex: string}> | null;
        const colorCount = colors?.length || 0;
        const minPrice = provider?.minCost ? (provider.minCost / 100).toFixed(2) : null;
        const maxPrice = provider?.maxCost ? (provider.maxCost / 100).toFixed(2) : null;
        
        const sizes = provider?.availableSizes as string[] || ["S", "M", "L", "XL", "2XL"];
        
        const item = {
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          imageUrl: bp.images?.[0] || null,
          madeInUSA: isUSABrand || provider?.isUSA || false,
          minPrice,
          maxPrice,
          colorCount,
          availableColors: colors || [],
          availableSizes: sizes,
          blueprintId: bp.id,
          printProviderId: provider?.providerId || null,
          hasMockupMapping: hasKnownMockupMapping(bp.id),
        };
        
        if (title.includes('t-shirt') || title.includes('tee') || title.includes('tank')) {
          categories["T-Shirts"].push(item);
        } else if (title.includes('hoodie') || title.includes('sweatshirt') || title.includes('crew') || title.includes('pullover')) {
          categories["Sweatshirts & Hoodies"].push(item);
        } else if (title.includes('hat') || title.includes('cap') || title.includes('beanie') || title.includes('visor')) {
          categories["Hats & Caps"].push(item);
        } else if (title.includes('mug') || title.includes('tumbler') || title.includes('bottle') || title.includes('cup') || title.includes('glass')) {
          categories["Drinkware"].push(item);
        } else if (title.includes('bag') || title.includes('tote') || title.includes('backpack') || title.includes('pouch')) {
          categories["Bags"].push(item);
        } else {
          categories["Other"].push(item);
        }
      }
      
      const result = Object.entries(categories)
        .filter(([_, items]) => items.length > 0)
        .map(([name, items]) => ({ name, items, count: items.length }));
      
      console.log(`[TestCatalog] Returning ${result.length} categories`);
      res.json(result);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Get blueprint details (colors/sizes) for configuration
  app.get("/api/test/printify/catalog/:blueprintId", async (req: any, res) => {
    try {
      const { blueprintId } = req.params;
      console.log(`[TestCatalog] GET blueprint details for ${blueprintId}`);
      
      const { printifyPrintProviders } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Find provider for this blueprint
      const providers = await db.select().from(printifyPrintProviders)
        .where(eq(printifyPrintProviders.blueprintId, parseInt(blueprintId)));
      
      if (providers.length === 0) {
        // Return fallback data for demo
        return res.json({
          id: blueprintId,
          colors: [
            { name: "Black", hex: "#000000" },
            { name: "White", hex: "#FFFFFF" },
            { name: "Navy", hex: "#000080" },
            { name: "Red", hex: "#FF0000" },
            { name: "Heather Gray", hex: "#9CA3AF" },
            { name: "Forest Green", hex: "#228B22" },
          ],
          sizes: ["S", "M", "L", "XL", "2XL"],
        });
      }
      
      const provider = providers[0];
      const colors = (provider.availableColors as Array<{name: string; hex?: string}>) || [];
      const sizes = (provider.availableSizes as string[]) || ["S", "M", "L", "XL", "2XL"];
      
      res.json({
        id: blueprintId,
        providerId: provider.providerId,
        colors,
        sizes,
        minPrice: provider.minCost ? (provider.minCost / 100).toFixed(2) : null,
        maxPrice: provider.maxCost ? (provider.maxCost / 100).toFixed(2) : null,
      });
    } catch (error: any) {
      console.error('[TestCatalog] GET blueprint error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Assign configured products to store channel
  app.post("/api/test/stores/:storeId/channels/:channelId/products", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { products } = req.body;
      
      console.log(`[TestAssignment] POST ${products?.length || 0} products to ${storeId}/${channelId}`);
      
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "products array required" });
      }
      
      // For now, just log and return success (would save to Firestore in production)
      const assignedProducts = products.map((p: any) => ({
        id: p.id,
        baseProductId: p.baseProductId,
        baseProductName: p.baseProductName,
        storeId,
        channelId,
        enabledColors: p.enabledColors,
        enabledSizes: p.enabledSizes,
        defaultColor: p.defaultColor,
        isBlankCanvas: p.isBlankCanvas,
        assignedAt: new Date().toISOString(),
      }));
      
      console.log(`[TestAssignment] Assigned:`, assignedProducts);
      
      res.json({
        success: true,
        assigned: assignedProducts.length,
        products: assignedProducts,
      });
    } catch (error: any) {
      console.error('[TestAssignment] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Get provider product counts from database
  app.get("/api/test/provider-counts", async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET provider counts');
      const { printfulProducts, printifyPrintProviders } = await import("@shared/schema");
      const { count } = await import("drizzle-orm");
      
      const [printifyResult] = await db.select({ count: count() }).from(printifyPrintProviders);
      const [printfulResult] = await db.select({ count: count() }).from(printfulProducts);
      
      const counts = {
        printify: printifyResult?.count || 0,
        printful: printfulResult?.count || 0,
      };
      
      console.log(`[TestCatalog] Provider counts:`, counts);
      res.json(counts);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // One-time sync: Push all blueprint data from PostgreSQL to Firestore
  app.post("/api/test/sync-blueprints-to-firestore", async (req: any, res) => {
    try {
      console.log('[Sync] Starting blueprint sync to Firestore...');
      const { printifyBlueprints } = await import("@shared/schema");
      const FirestoreAdapter = (await import("./lib/firestore-adapter")).FirestoreAdapter;
      
      const allBlueprints = await db.select().from(printifyBlueprints);
      console.log(`[Sync] Found ${allBlueprints.length} blueprints to sync`);
      
      const firestoreAdapter = new FirestoreAdapter();
      let synced = 0;
      let errors = 0;
      
      for (const blueprint of allBlueprints) {
        try {
          await firestoreAdapter.upsertPrintifyBlueprint({
            id: blueprint.id,
            title: blueprint.title,
            description: blueprint.description,
            brand: blueprint.brand,
            model: blueprint.model,
            images: blueprint.images,
            primaryImageUrl: blueprint.primaryImageUrl,
            category: blueprint.category,
          });
          synced++;
        } catch (e: any) {
          console.error(`[Sync] Error syncing blueprint ${blueprint.id}:`, e.message);
          errors++;
        }
      }
      
      console.log(`[Sync] Complete: ${synced} blueprints synced, ${errors} errors`);
      res.json({ success: true, synced, errors, total: allBlueprints.length });
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // One-time sync: Push all provider data from PostgreSQL to Firestore
  app.post("/api/test/sync-providers-to-firestore", async (req: any, res) => {
    try {
      console.log('[Sync] Starting provider sync to Firestore...');
      const { printifyPrintProviders } = await import("@shared/schema");
      const FirestoreAdapter = (await import("./lib/firestore-adapter")).FirestoreAdapter;
      
      const allProviders = await db.select().from(printifyPrintProviders);
      console.log(`[Sync] Found ${allProviders.length} providers to sync`);
      
      const firestoreAdapter = new FirestoreAdapter();
      let synced = 0;
      let errors = 0;
      
      for (const provider of allProviders) {
        try {
          await firestoreAdapter.upsertPrintifyPrintProvider({
            ...provider,
            availableColors: provider.availableColors as any,
          });
          synced++;
        } catch (e: any) {
          console.error(`[Sync] Error syncing ${provider.blueprintId}/${provider.providerId}:`, e.message);
          errors++;
        }
      }
      
      console.log(`[Sync] Complete: ${synced} synced, ${errors} errors`);
      res.json({ success: true, synced, errors, total: allProviders.length });
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Trigger Printful catalog sync (no auth for dev testing)
  app.post("/api/test/catalog/sync-printful", async (req: any, res) => {
    try {
      console.log('[TEST SYNC] ========================================');
      console.log('[TEST SYNC] STARTING PRINTFUL CATALOG SYNC');
      console.log('[TEST SYNC] ========================================');
      
      const { syncPrintfulCatalog, printfulClient } = await import("./lib/printful");
      
      if (!printfulClient.isConfigured) {
        console.error('[TEST SYNC] ERROR: Printful API key not configured!');
        return res.status(500).json({ error: 'Printful API key not configured' });
      }
      
      // Start sync in background
      res.json({ message: 'Printful catalog sync started - check logs for progress' });
      
      const result = await syncPrintfulCatalog(db);
      
      console.log('[TEST SYNC] ========================================');
      console.log('[TEST SYNC] PRINTFUL SYNC COMPLETE');
      console.log(`[TEST SYNC] Products: ${result.productsAdded} added, ${result.productsUpdated} updated`);
      console.log(`[TEST SYNC] Variants: ${result.variantsAdded} added, ${result.variantsUpdated} updated`);
      if (result.errors.length > 0) {
        console.error('[TEST SYNC] ERRORS:', result.errors.length);
        result.errors.forEach(e => console.error('[TEST SYNC]   -', e));
      }
      console.log('[TEST SYNC] ========================================');
      
    } catch (error: any) {
      console.error('[TEST SYNC] ========================================');
      console.error('[TEST SYNC] FATAL ERROR:', error.message);
      console.error('[TEST SYNC] ========================================');
    }
  });

  // Test endpoint: Printful catalog (grouped by category)
  app.get("/api/test/catalog/printful-products", async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET Printful products');
      const { printfulProducts } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const products = await db.select().from(printfulProducts).orderBy(desc(printfulProducts.lastSyncedAt));
      
      // Transform products to include placements in expected format
      const transformedProducts = products.map(product => {
        // Convert availablePlacements array of strings to placements array of objects
        const placements = (product.availablePlacements || []).map((placementId: string) => ({
          id: placementId,
          type: placementId,
          title: placementId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          additionalPrice: 0,
        }));
        
        return {
          ...product,
          placements: placements.length > 0 ? placements : null,
        };
      });
      
      // Group products by type (category) to match frontend expectations
      const categoryMap = new Map<string, any[]>();
      for (const product of transformedProducts) {
        const category = product.type || "Other";
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(product);
      }
      
      const grouped = Array.from(categoryMap.entries()).map(([name, items]) => ({
        name,
        items,
        count: items.length,
      }));
      
      console.log(`[TestCatalog] Returning ${products.length} Printful products in ${grouped.length} categories`);
      res.json(grouped);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Real product config data with admin enrichment (no auth)
  app.get("/api/test/product-configs", async (req: any, res) => {
    try {
      console.log('[TestProductConfigs] GET real product configs');
      
      const products = await storage.getAllProducts();
      
      // Enrich products with their assigned category IDs, cached costs, and full config
      const enrichedProducts = await Promise.all(
        products.filter(p => p.isEnabled).map(async (product) => {
          const assignments = await storage.getProductCategoryAssignments(product.id);
          
          // Look up cached costs and colors from printifyPrintProviders
          let cachedMinCost: number | null = null;
          let cachedMaxCost: number | null = null;
          let providerColors: Array<{name: string; hex: string}> | null = null;
          let providerSizes: string[] | null = null;
          if (product.blueprintId && product.printProviderId) {
            const provider = await storage.getPrintifyPrintProvider(
              product.blueprintId,
              product.printProviderId
            );
            if (provider?.minCost) {
              cachedMinCost = Number(provider.minCost) / 100;
              cachedMaxCost = provider.maxCost ? Number(provider.maxCost) / 100 : cachedMinCost;
            }
            if (provider?.availableColors && Array.isArray(provider.availableColors)) {
              providerColors = provider.availableColors as Array<{name: string; hex: string}>;
            }
            if (provider?.availableSizes && Array.isArray(provider.availableSizes)) {
              providerSizes = provider.availableSizes as string[];
            }
          }
          
          // Get metadata for enabled sizes/colors
          const meta = product.metadata as Record<string, unknown> | null;
          const savedEnabledSizes = meta?.enabledSizes as string[] | undefined;
          const savedEnabledColors = meta?.enabledColors as string[] | undefined;
          const defaultColor = meta?.defaultColor as string | undefined;
          
          // Use provider colors/sizes as primary source, fall back to product's cached values
          const finalColors = providerColors || (product.availableColors as Array<{name: string; hex: string}>) || [];
          const finalSizes = providerSizes || (product.availableSizes as string[]) || [];
          
          // Get mockupsByColor from product
          const mockupsByColor = (product as any).mockupsByColor as Record<string, { front?: string; lifestyle?: string }> | undefined;
          
          return {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            sizes: finalSizes,
            colors: finalColors,
            enabledSizes: savedEnabledSizes || finalSizes,
            enabledColors: savedEnabledColors || finalColors.map(c => c.name),
            defaultColor: defaultColor || (finalColors.length > 0 ? finalColors[0].name : null),
            mockupsByColor: mockupsByColor || {},
            categoryIds: assignments.map((a) => a.categoryId),
            cachedMinCost,
            cachedMaxCost,
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId,
          };
        })
      );
      
      console.log(`[TestProductConfigs] Returning ${enrichedProducts.length} enriched products`);
      res.json(enrichedProducts);
    } catch (error: any) {
      console.error('[TestProductConfigs] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Update product size/color options (no auth - mirrors admin)
  app.patch("/api/test/products/:id/options", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabledSizes, enabledColors, defaultColor } = req.body;
      
      console.log(`[TestProductOptions] PATCH ${id}:`, { enabledSizes, enabledColors, defaultColor });
      
      // Get current product to preserve other metadata
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Merge with existing metadata
      const existingMetadata = (currentProduct.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        enabledSizes,
        enabledColors,
        defaultColor,
      };
      
      const product = await storage.updateProduct(id, { metadata: newMetadata });
      res.json(product);
    } catch (error: any) {
      console.error('[TestProductOptions] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Sync product from Printify (no auth - mirrors admin)
  app.post("/api/test/products/:id/sync-printify", async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing Printify blueprint or provider IDs" });
      }
      
      console.log(`[TestProductSync] Syncing product ${product.id}`);
      
      // Fetch placements and mockup image from Printify
      const { placements, mockupImageUrl } = await syncProductPlacements(
        product.blueprintId,
        product.printProviderId
      );
      
      // Fetch colors and sizes
      const { colors, sizes, variants } = await syncProductVariants(
        product.blueprintId,
        product.printProviderId
      );
      
      // Save each variant to the database
      for (const variant of variants) {
        await storage.upsertProductVariant({
          productId: product.id,
          printifyVariantId: variant.id,
          title: variant.title,
          size: variant.options?.size || null,
          color: variant.options?.color || null,
          colorHex: variant.options?.color ? colors.find(c => c.name === variant.options?.color)?.hex || null : null,
          price: String((variant.price || 0) / 100),
          isEnabled: true,
          isInStock: variant.is_available ?? true,
        });
      }
      
      // Update product with synced data
      const updatedProduct = await storage.updateProduct(product.id, {
        availablePlacements: placements.map(p => p.position),
        availableColors: colors,
        availableSizes: sizes,
        imageUrl: mockupImageUrl || product.imageUrl,
        metadata: {
          ...(product.metadata as object || {}),
          placementDetails: placements,
          lastSyncedAt: new Date().toISOString(),
        },
      });
      
      res.json({
        success: true,
        product: updatedProduct,
        syncedData: { placements, colors, sizes, mockupImageUrl, variantsCount: variants.length },
      });
    } catch (error: any) {
      console.error('[TestProductSync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Hosted Images API
  app.post("/api/images/upload", async (req, res) => {
    try {
      const { imageData, originalName, mimeType, title, description, businessName, businessLogo, userId } = req.body;

      if (!imageData || !originalName || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: imageData, originalName, mimeType" });
      }

      const uploadResult = await uploadImage(imageData, originalName, mimeType);

      const hostedImage = await storage.createHostedImage({
        userId: userId || null,
        fileName: uploadResult.fileName,
        originalName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        title: title || null,
        description: description || null,
        businessName: businessName || null,
        businessLogo: businessLogo || null,
        isActive: true,
        expiresAt: null,
      });

      res.json({
        id: hostedImage.id,
        publicUrl: `/view/${hostedImage.id}`,
        directUrl: uploadResult.publicUrl,
        landingUrl: `/view/${hostedImage.id}`,
      });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      
      const images = await storage.getHostedImagesByUser("");
      const allImages = images.length > 0 ? images : [];
      
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage) {
        const fileName = `hosted-images/${imageId}.jpeg`;
        const imageBuffer = await getImageBuffer(fileName);
        
        if (!imageBuffer) {
          const pngFileName = `hosted-images/${imageId}.png`;
          const pngBuffer = await getImageBuffer(pngFileName);
          
          if (!pngBuffer) {
            return res.status(404).json({ error: "Image not found" });
          }
          
          res.setHeader("Content-Type", pngBuffer.mimeType);
          res.setHeader("Cache-Control", "public, max-age=31536000");
          return res.send(pngBuffer.buffer);
        }
        
        res.setHeader("Content-Type", imageBuffer.mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        return res.send(imageBuffer.buffer);
      }

      const imageBuffer = await getImageBuffer(hostedImage.storageUrl);
      
      if (!imageBuffer) {
        return res.status(404).json({ error: "Image file not found" });
      }

      await storage.incrementImageViews(imageId);

      res.setHeader("Content-Type", imageBuffer.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(imageBuffer.buffer);
    } catch (error: any) {
      console.error("Image serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/info/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage || !hostedImage.isActive) {
        return res.status(404).json({ error: "Image not found" });
      }

      res.json({
        id: hostedImage.id,
        title: hostedImage.title,
        description: hostedImage.description,
        businessName: hostedImage.businessName,
        businessLogo: hostedImage.businessLogo,
        views: hostedImage.views,
        createdAt: hostedImage.createdAt,
      });
    } catch (error: any) {
      console.error("Image info error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const images = await storage.getHostedImagesByUser(userId);
      res.json(images);
    } catch (error: any) {
      console.error("User images error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      await deleteImage(hostedImage.storageUrl);
      await storage.deleteHostedImage(imageId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Image delete error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cart - protected routes using session user
  app.get("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getCartItemsByUser(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCartItemSchema.parse({
        ...req.body,
        userId,
      });
      const item = await storage.addCartItem(validatedData);
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/cart/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const item = await storage.updateCartItem(id, quantity);
      
      if (!item) {
        return res.status(404).json({ error: "Cart item not found" });
      }
      
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/cart/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCartItem(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ STRIPE CHECKOUT ============
  
  // Get Stripe publishable key for frontend
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import('./stripeClient');
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  // Create Stripe checkout session from cart
  app.post("/api/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cartItems = await storage.getCartItemsByUser(userId);
      
      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const { DEFAULT_MEMBER_PROFIT_SHARE, formatProfitSharePercent } = await import("@shared/constants");

      let isMember = false;
      let memberDiscount = DEFAULT_MEMBER_PROFIT_SHARE;
      try {
        const { getFirestoreDb } = await import("./lib/firebase-admin");
        const fsDb = getFirestoreDb();
        const memberDoc = await fsDb.collection('member_profiles').doc(userId).get();
        isMember = memberDoc.exists && memberDoc.data()?.isMember === true;

        const pricingDoc = await fsDb.collection('testSettings').doc('pricing').get();
        if (pricingDoc.exists) {
          memberDiscount = pricingDoc.data()?.memberProfitShare ?? DEFAULT_MEMBER_PROFIT_SHARE;
        }
      } catch (e) {
        console.error('[Checkout] Member/pricing check failed, proceeding with defaults:', e);
      }

      const discountLabel = formatProfitSharePercent(memberDiscount);

      const lineItems = cartItems.map((item) => {
        const customization = item.customization as any || {};
        const originalPrice = parseFloat(item.price || '0');
        const finalPrice = isMember ? originalPrice * (1 - memberDiscount) : originalPrice;
        const description = isMember
          ? `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'} (${discountLabel} Creator Discount applied)`
          : `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'}`;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: customization.productName || 'QR Gear Product',
              description,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: item.quantity || 1,
        };
      });

      if (isMember) {
        console.log(`[Checkout] Creator discount applied for user ${userId} — ${discountLabel} off all items`);
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cart`,
        metadata: {
          userId,
          memberDiscount: isMember ? 'true' : 'false',
        },
      });

      res.json({ url: session.url, sessionId: session.id, memberDiscount: isMember });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify checkout session and create order
  app.get("/api/checkout/verify/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      // Check if order already exists for this session
      const existingOrder = await storage.getOrderByStripeSession(sessionId);
      if (existingOrder) {
        const items = await storage.getOrderItems(existingOrder.id);
        return res.json({ order: existingOrder, items, alreadyProcessed: true });
      }

      // Create order from cart
      const cartItems = await storage.getCartItemsByUser(userId);
      const totalAmount = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.price || '0') * (item.quantity || 1);
      }, 0);

      const order = await storage.createOrder({
        userId,
        status: 'paid',
        totalAmount: totalAmount.toFixed(2),
        stripeSessionId: sessionId,
        stripePaymentIntentId: session.payment_intent as string,
      });

      // Create order items from cart - customization contains all product details
      const orderItemsList: Array<{ productId: string; quantity: number; price: string; customization?: any }> = [];
      for (const item of cartItems) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity || 1,
          price: item.price,
          customization: item.customization as Record<string, unknown>,
        });
        orderItemsList.push({
          productId: item.productId,
          quantity: item.quantity || 1,
          price: item.price,
          customization: item.customization,
        });
      }

      // Get user for email and unified order
      const user = await storage.getUser(userId);

      // Create unified order for admin tracking
      // Extract product details from cart items' customization data
      try {
        const unifiedItems = await Promise.all(orderItemsList.map(async (item) => {
          // Get product info for better tracking
          const product = await storage.getProduct(item.productId.toString());
          const customization = item.customization as Record<string, any> || {};
          
          const selectedSize = customization.selectedSize || customization.size || null;
          
          let actualPrintifyCost: number | null = null;
          let memberEarningsActual: number | null = null;
          let adminMarginActual: number | null = null;
          if (customization.packetId && selectedSize) {
            try {
              const { getFirestoreDb: getDb } = await import("./lib/firebase-admin");
              const packetDoc = await getDb().collection("memberPackets").doc(customization.packetId).get();
              if (packetDoc.exists) {
                const snap = packetDoc.data()?.pricingSnapshot;
                if (snap?.printifyCostVariants?.[selectedSize]) {
                  actualPrintifyCost = snap.printifyCostVariants[selectedSize];
                  const retailPrice = parseFloat(item.price);
                  const actualProfit = retailPrice - actualPrintifyCost;
                  const memberShare = snap.memberProfitShare ?? 0.25;
                  memberEarningsActual = Math.round(Math.max(0, actualProfit * memberShare) * 100) / 100;
                  adminMarginActual = Math.round(Math.max(0, actualProfit - memberEarningsActual) * 100) / 100;
                }
              }
            } catch (costErr) {
              console.warn('[OrderCost] Failed to look up actual cost (non-fatal):', costErr);
            }
          }
          
          return {
            masterProductId: customization.masterProductId || null,
            variantSku: customization.variantSku || customization.sku || `product-${item.productId}`,
            quantity: item.quantity,
            price: parseFloat(item.price),
            productTitle: product?.name || customization.productName || `Product #${item.productId}`,
            size: selectedSize,
            color: customization.selectedColor || customization.color || null,
            actualPrintifyCost,
            memberEarningsActual,
            adminMarginActual,
          };
        }));

        await storage.createOrderUnified({
          sourceChannel: "direct",
          externalOrderId: order.id,
          customerEmail: user?.email || null,
          customerName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null,
          shippingAddress: null, // Will be collected during fulfillment
          items: unifiedItems,
          subtotal: totalAmount.toFixed(2),
          total: totalAmount.toFixed(2),
          status: "pending", // Pending fulfillment, payment is complete
          statusHistory: [
            { status: "paid", timestamp: new Date().toISOString(), note: "Payment received via Stripe" },
            { status: "pending", timestamp: new Date().toISOString(), note: "Awaiting fulfillment routing" },
          ],
        });
      } catch (unifiedErr) {
        console.error("Failed to create unified order:", unifiedErr);
      }

      // Clear the cart
      for (const item of cartItems) {
        await storage.deleteCartItem(item.id);
      }

      const orderItems = await storage.getOrderItems(order.id);

      // Send order confirmation email
      if (user?.email) {
        sendOrderConfirmationEmail({
          orderId: order.id,
          customerEmail: user.email,
          customerName: user.firstName || 'Customer',
          items: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: parseFloat(item.price),
          })),
          totalAmount,
          orderDate: new Date(),
        }).catch(err => console.error('Failed to send order confirmation:', err));
      }

      // Create buyer instances for QR Dynamics products
      try {
        const { createBuyerInstance } = await import('./lib/buyerInstanceService');
        const buyerEmail = user?.email || (session.customer_details as any)?.email;
        
        if (buyerEmail) {
          for (const item of orderItems) {
            const customization = item.customization as Record<string, any> || {};
            const packetId = customization.packetId;
            
            if (packetId) {
              await createBuyerInstance({
                buyerEmail,
                buyerUserId: userId,
                orderId: order.id.toString(),
                packetId,
                templateId: customization.templateId || null,
                destinationUrl: customization.destinationUrl || customization.qrUrl || '',
              });
            }
          }
        }
      } catch (instanceErr) {
        console.error('Failed to create buyer instances:', instanceErr);
      }

      res.json({ order, items: orderItems });
    } catch (error: any) {
      console.error('Verify checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Orders - protected routes using session user
  app.get("/api/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getOrdersByUser(userId);
      
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return { ...order, items };
        })
      );
      
      res.json(ordersWithItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const items = await storage.getOrderItems(id);
      res.json({ ...order, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedOrder = insertOrderSchema.parse({
        ...req.body.order,
        userId,
      });
      const order = await storage.createOrder(validatedOrder);

      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const validatedItem = insertOrderItemSchema.parse({
            ...item,
            orderId: order.id,
          });
          await storage.createOrderItem(validatedItem);
        }
      }

      res.json(order);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Submit order to Printify for fulfillment
  app.post("/api/orders/:id/submit-printify", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { shippingAddress } = req.body;
      if (!shippingAddress) {
        return res.status(400).json({ error: "Shipping address required" });
      }

      const result = await submitOrderToPrintify(id, shippingAddress);
      if (result.success) {
        res.json({ success: true, printifyOrderId: result.printifyOrderId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check order status from Printify
  app.get("/api/orders/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const status = await checkPrintifyOrderStatus(id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ADMIN ROUTES ============

  // Admin: Get fulfillment provider status (which providers are configured)
  app.get("/api/admin/fulfillment-providers", isAdmin, async (req: any, res) => {
    try {
      const printifyKey = process.env.PRINTIFY_API_KEY;
      const printfulKey = process.env.PRINTFUL_API_KEY;
      const apliiqKey = process.env.APLIIQ_API_KEY;
      
      const providers = [
        { 
          id: "printify", 
          name: "Printify", 
          configured: !!printifyKey && printifyKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printify network"
        },
        { 
          id: "printful", 
          name: "Printful", 
          configured: !!printfulKey && printfulKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printful"
        },
        { 
          id: "apliiq", 
          name: "Apliiq", 
          configured: !!apliiqKey && apliiqKey.length > 10,
          role: "fulfillment",
          description: "Custom apparel via Apliiq"
        },
      ];
      
      console.log(`[FulfillmentProviders] Admin returning ${providers.filter(p => p.configured).length} configured providers`);
      res.json(providers);
    } catch (error: any) {
      console.error('[FulfillmentProviders] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Settings
  app.get("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      let settings = await storage.getAdminSettings();
      if (!settings) {
        settings = await storage.upsertAdminSettings({});
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/settings", isAdmin, async (req: any, res) => {
    try {
      const validated = insertAdminSettingsSchema.partial().parse(req.body);
      const settings = await storage.upsertAdminSettings(validated);
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Pricing Rules
  app.get("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const validated = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(validated);
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertPricingRuleSchema.partial().parse(req.body);
      const rule = await storage.updatePricingRule(id, validated);
      if (!rule) {
        return res.status(404).json({ error: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePricingRule(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Products - Get all products with admin fields and cached costs
  app.get("/api/admin/products", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllProducts();
      // Enrich products with their assigned category IDs, cached costs, and QR product type
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          const assignments = await storage.getProductCategoryAssignments(product.id);
          
          // Look up cached costs and colors from printifyPrintProviders
          let cachedMinCost: number | null = null;
          let cachedMaxCost: number | null = null;
          let providerColors: Array<{name: string; hex: string}> | null = null;
          let providerSizes: string[] | null = null;
          if (product.blueprintId && product.printProviderId) {
            const provider = await storage.getPrintifyPrintProvider(
              product.blueprintId,
              product.printProviderId
            );
            if (provider?.minCost) {
              cachedMinCost = Number(provider.minCost) / 100; // Convert from cents
              cachedMaxCost = provider.maxCost ? Number(provider.maxCost) / 100 : cachedMinCost;
            }
            if (provider?.availableColors && Array.isArray(provider.availableColors)) {
              providerColors = provider.availableColors as Array<{name: string; hex: string}>;
            }
            if (provider?.availableSizes && Array.isArray(provider.availableSizes)) {
              providerSizes = provider.availableSizes as string[];
            }
          }
          
          // Determine QR product type from linked custom design
          let qrProductType: string | null = null;
          const meta = product.metadata as Record<string, unknown> | null;
          if (meta?.customDesignId) {
            const design = await storage.getCustomDesign(meta.customDesignId as string);
            if (design) {
              const hasTopText = design.topText && typeof design.topText === 'object' && (design.topText as any).text;
              const hasBottomText = design.bottomText && typeof design.bottomText === 'object' && (design.bottomText as any).text;
              const hasBackground = !!design.backgroundImageUrl;
              const hasVideo = !!(design as any).videoUrl;
              const overlay = design.landingOverlay as any;
              const hasLandingOverlay = overlay?.enabled;
              
              if (design.templateVariant === "plain-text") {
                qrProductType = "qr-basics";
              } else if (design.templateVariant === "dynamics") {
                qrProductType = "qr-dynamics";
              } else if (design.templateVariant === "external-url") {
                qrProductType = "qr-basics";
              } else if (design.templateVariant === "url") {
                if (hasVideo) {
                  qrProductType = "qr-play";
                } else if (hasBackground || hasLandingOverlay) {
                  qrProductType = "qr-canvas";
                } else if (hasTopText || hasBottomText) {
                  qrProductType = "qr-plus";
                } else {
                  qrProductType = "qr-canvas";
                }
              }
            }
          }
          
          // Use provider colors/sizes as primary source, fall back to product's cached values
          const finalColors = providerColors || (product.availableColors as Array<{name: string; hex: string}>) || [];
          const finalSizes = providerSizes || (product.availableSizes as string[]) || [];
          
          return {
            ...product,
            availableColors: finalColors,
            availableSizes: finalSizes,
            categoryIds: assignments.map((a) => a.categoryId),
            cachedMinCost,
            cachedMaxCost,
            qrProductType,
          };
        })
      );
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle product enabled/disabled
  app.patch("/api/admin/products/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const product = await storage.toggleProductEnabled(id, enabled);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update product size/color options (stored in metadata)
  app.patch("/api/admin/products/:id/options", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabledSizes, enabledColors } = req.body;
      
      // Get current product to preserve other metadata
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Merge with existing metadata
      const existingMetadata = (currentProduct.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        enabledSizes,
        enabledColors,
      };
      
      const product = await storage.updateProduct(id, { metadata: newMetadata });
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update product admin settings (markup, production cost, etc.)
  app.patch("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validated);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete product from catalog
  app.delete("/api/admin/products/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate mockups for a product using local generator
  app.post("/api/admin/products/:id/regenerate-mockups", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or provider info" });
      }
      
      // Get custom design artwork
      const metadata = product.metadata as { customDesignId?: string } | null;
      const designId = metadata?.customDesignId;
      if (!designId) {
        return res.status(400).json({ error: "Product has no custom design associated" });
      }
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      const placementImages = design.placementImages as Record<string, string>;
      const artworkBlackUrl = placementImages?.["front-center"] || placementImages?.["front-chest"];
      const artworkWhiteUrl = placementImages?.["front-center-white"] || placementImages?.["front-chest-white"];
      
      if (!artworkBlackUrl) {
        return res.status(400).json({ error: "No artwork found for this design" });
      }
      
      // Use local mockup generator for all colors
      const { generateAllColorMockups } = await import("./lib/local-mockup-generator");
      
      const colors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
      
      console.log(`[Admin] Regenerating mockups for ${product.name} with ${colors.length} colors`);
      
      const mockupsByColor = await generateAllColorMockups(
        product.blueprintId,
        product.printProviderId,
        colors,
        artworkBlackUrl,
        artworkWhiteUrl || artworkBlackUrl
      );
      
      // Update product with new mockups
      await storage.updateProduct(id, { mockupsByColor });
      
      // Clear mockup cache for this product to force refresh
      await db.delete(mockupCache).where(
        and(
          eq(mockupCache.blueprintId, product.blueprintId),
          eq(mockupCache.printProviderId, product.printProviderId)
        )
      );
      
      res.json({
        success: true,
        message: `Regenerated mockups for ${Object.keys(mockupsByColor).length} colors`,
        mockupsByColor
      });
    } catch (error: any) {
      console.error("[Admin] Failed to regenerate mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate ALL color mockups for a product using Printful (admin-created products)
  // This generates mockups for every available color, not just enabled ones
  app.post("/api/admin/products/:id/generate-all-mockups", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId) {
        return res.status(400).json({ error: "Product missing blueprint info" });
      }
      
      // Get custom design artwork
      const metadata = product.metadata as { customDesignId?: string } | null;
      const designId = metadata?.customDesignId || id.replace('custom_', '');
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      // Get ALL available colors from the product
      const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
      
      if (allColors.length === 0) {
        return res.status(400).json({ error: "No colors available for this product" });
      }
      
      console.log(`[Admin] Generating Printful mockups for ${product.name} - ${allColors.length} colors`);
      
      // Parse placement images
      let designPlacements: Record<string, string> = {};
      try {
        if (typeof design.placementImages === 'string') {
          designPlacements = JSON.parse(design.placementImages);
        } else if (design.placementImages && typeof design.placementImages === 'object') {
          designPlacements = design.placementImages as Record<string, string>;
        }
      } catch (e) {
        console.error('[Admin] Failed to parse placementImages:', e);
      }
      
      const blackArtwork = designPlacements["front-chest"] || 
                           designPlacements["front-center"] ||
                           designPlacements["front"];
      const whiteArtwork = designPlacements["front-chest-white"] || 
                           designPlacements["front-center-white"];
      
      if (!blackArtwork) {
        return res.status(400).json({ error: "No artwork found for this design" });
      }
      
      // Import mockup service
      const { getMockupWithFallback, isColorDark } = await import('./lib/mockup-service.js');
      
      const results: { color: string; success: boolean; mockupUrl?: string; lifestyleUrl?: string; error?: string }[] = [];
      const mockupsByColor: Record<string, { front?: string; lifestyle?: string }> = {};
      
      // Generate mockups for each color with rate limiting (1 per 2 seconds to avoid 429)
      for (const colorInfo of allColors) {
        const color = colorInfo.name;
        const colorHex = colorInfo.hex;
        
        try {
          // Determine artwork variant based on shirt color
          const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
          const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
          const artworkVariant = (needsWhiteQR && whiteArtwork) ? "white" as const : "black" as const;
          
          console.log(`[Admin] Generating mockup for ${color} (${artworkVariant} QR)...`);
          
          const result = await getMockupWithFallback({
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId || 0,
            colorName: color,
            colorHex,
            canonicalPlacementId: "FRONT_CHEST",
            artworkUrl,
            artworkVariant,
          }, storage);
          
          mockupsByColor[color] = {
            front: result.mockupUrl,
            lifestyle: result.lifestyleMockupUrl || undefined,
          };
          
          results.push({
            color,
            success: true,
            mockupUrl: result.mockupUrl,
            lifestyleUrl: result.lifestyleMockupUrl || undefined,
          });
          
          console.log(`[Admin] ✓ ${color} mockup generated (lifestyle: ${!!result.lifestyleMockupUrl})`);
          
          // Rate limit: wait 2 seconds between Printful API calls to avoid 429
          if (allColors.indexOf(colorInfo) < allColors.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error: any) {
          console.error(`[Admin] ✗ ${color} mockup failed:`, error.message);
          results.push({
            color,
            success: false,
            error: error.message,
          });
        }
      }
      
      // Update product with all mockups
      await storage.updateProduct(id, { mockupsByColor });
      
      const successCount = results.filter(r => r.success).length;
      
      res.json({
        success: true,
        message: `Generated ${successCount}/${allColors.length} mockups`,
        results,
        mockupsByColor,
      });
    } catch (error: any) {
      console.error("[Admin] Failed to generate all mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Apply synced costs to product prices - uses costs from printify_print_providers
  app.post("/api/admin/products/apply-costs", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllProducts();
      const settings = await storage.getAdminSettings();
      
      // Default markup settings
      const markupPercent = settings?.globalMarkupPercent ? parseFloat(settings.globalMarkupPercent) : 25;
      const markupFixed = settings?.globalMarkupFixed ? parseFloat(settings.globalMarkupFixed) : 0;
      const qrCost = settings?.globalQrProductionCost ? parseFloat(settings.globalQrProductionCost) : 2;
      
      let updated = 0;
      let skipped = 0;
      const results: { productId: string; name: string; cost: number; price: number }[] = [];
      
      for (const product of products) {
        // Skip products without Printify blueprint/provider info
        if (!product.blueprintId || !product.printProviderId) {
          skipped++;
          continue;
        }
        
        // Get the cached cost from printify_print_providers
        const provider = await storage.getPrintifyPrintProvider(
          product.blueprintId,
          product.printProviderId
        );
        
        if (!provider?.minCost) {
          skipped++;
          continue;
        }
        
        // Convert cents to dollars
        const productionCost = Number(provider.minCost) / 100;
        
        // Calculate retail price: (production cost + QR cost + fixed markup) * (1 + markup %)
        const totalCost = productionCost + qrCost + markupFixed;
        const retailPrice = Math.ceil((totalCost * (1 + markupPercent / 100)) * 100) / 100;
        
        // Update the product's base price
        await storage.updateProduct(product.id, { 
          basePrice: retailPrice.toFixed(2),
          qrProductionCost: qrCost.toFixed(2)
        });
        
        updated++;
        results.push({
          productId: product.id,
          name: product.name,
          cost: productionCost,
          price: retailPrice
        });
      }
      
      res.json({ 
        success: true, 
        updated, 
        skipped,
        markupPercent,
        markupFixed,
        qrCost,
        results: results.slice(0, 20) // Return first 20 for preview
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get product variants
  app.get("/api/admin/products/:id/variants", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const variants = await storage.getProductVariants(id);
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle variant enabled/disabled
  app.patch("/api/admin/variants/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const variant = await storage.toggleVariantEnabled(id, enabled);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Printify Catalog Browsing - Get blueprints
  app.get("/api/admin/printify/blueprints", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const blueprints = await printify.getCatalogBlueprints();
      res.json(blueprints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Brands known to manufacture garments in the USA
  // This list should be updated periodically by checking Printify's catalog
  const USA_MADE_BRANDS = [
    'american apparel',
    'royal apparel',
    'bayside',
    'los angeles apparel',
    'bella+canvas',
    'bella canvas',
    'lane seven',
    'cotton heritage',
    'shaka wear',
    'backpacks usa',
    'american giant',
    'next level',  // Some Next Level products made in USA
  ];

  // Get full catalog grouped by category with images and provider info
  // Loads from local DB for speed, prices come from Printify on-demand
  app.get("/api/admin/printify/catalog", isAdmin, async (req: any, res) => {
    try {
      // First try to load from local database (fast!)
      const localBlueprints = await storage.getPrintifyBlueprints();
      
      let blueprints: any[];
      
      if (localBlueprints.length > 0) {
        // Use local cache - much faster!
        blueprints = localBlueprints.map(bp => ({
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          images: bp.images || [],
        }));
      } else {
        // Fall back to Printify API if no local data
        if (!printify) {
          return res.status(503).json({ error: "Printify API not configured. Please sync catalog first." });
        }
        blueprints = await printify.getCatalogBlueprints();
      }
      
      // Categorize blueprints by product type
      const categories: Record<string, any[]> = {
        "T-Shirts": [],
        "Sweatshirts & Hoodies": [],
        "Hats & Caps": [],
        "Drinkware": [],
        "Bags": [],
        "Other": [],
      };
      
      for (const bp of blueprints) {
        const title = bp.title.toLowerCase();
        const brandLower = (bp.brand || '').toLowerCase();
        
        // Check if brand is a known USA manufacturer
        const isUSABrand = USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        
        const item = {
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          imageUrl: bp.images?.[0] || null,
          madeInUSA: isUSABrand,
          usaProviderCount: isUSABrand ? 1 : 0,
          otherCountries: isUSABrand ? [] : ['Imported'],
        };
        
        if (title.includes('t-shirt') || title.includes('tee') || title.includes('tank')) {
          categories["T-Shirts"].push(item);
        } else if (title.includes('hoodie') || title.includes('sweatshirt') || title.includes('crew') || title.includes('pullover')) {
          categories["Sweatshirts & Hoodies"].push(item);
        } else if (title.includes('hat') || title.includes('cap') || title.includes('beanie') || title.includes('visor')) {
          categories["Hats & Caps"].push(item);
        } else if (title.includes('mug') || title.includes('tumbler') || title.includes('bottle') || title.includes('cup') || title.includes('glass')) {
          categories["Drinkware"].push(item);
        } else if (title.includes('bag') || title.includes('tote') || title.includes('backpack') || title.includes('pouch')) {
          categories["Bags"].push(item);
        } else {
          categories["Other"].push(item);
        }
      }
      
      // Convert to array format, filter empty categories
      const result = Object.entries(categories)
        .filter(([_, items]) => items.length > 0)
        .map(([name, items]) => ({ 
          name, 
          items, 
          count: items.length,
          usaCount: items.filter(i => i.madeInUSA).length,
          otherCount: items.filter(i => !i.madeInUSA).length,
        }));
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get full catalog item details with USA providers and pricing
  // Database is the source of truth for costs - no in-memory cache

  app.get("/api/admin/printify/catalog/:blueprintId", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      
      // Fetch blueprint details, providers, and find USA providers
      const [blueprint, providers] = await Promise.all([
        printify.getBlueprintDetails(blueprintId),
        printify.getPrintProviders(blueprintId),
      ]);
      
      // Filter for USA providers
      const usaProviders = providers.filter(p => 
        p.location?.country === 'US' || p.location?.country === 'USA'
      );
      
      // Get variants for first USA provider (for pricing/colors/sizes)
      let variants: any[] = [];
      let selectedProvider = usaProviders[0] || providers[0];
      
      if (selectedProvider) {
        const variantData = await printify.getVariants(blueprintId, selectedProvider.id);
        variants = variantData.variants || [];
      }
      
      // Extract unique colors and sizes
      const colors = Array.from(new Set(variants.map(v => v.options?.color).filter(Boolean)));
      const sizes = Array.from(new Set(variants.map(v => v.options?.size).filter(Boolean)));
      
      // First try to get costs and colors/sizes from local database (cached from cost sync)
      let basePrice = 0;
      let maxPrice = 0;
      let costsFromDatabase = false;
      let cachedColors: any[] | null = null;
      let cachedSizes: string[] | null = null;
      
      if (selectedProvider) {
        const storedProvider = await storage.getPrintifyPrintProvider(blueprintId, selectedProvider.id);
        if (storedProvider?.minCost && storedProvider.minCost > 0) {
          basePrice = storedProvider.minCost / 100;
          maxPrice = (storedProvider.maxCost || storedProvider.minCost) / 100;
          costsFromDatabase = true;
        }
        // Use cached colors/sizes if available
        if (storedProvider?.availableColors && Array.isArray(storedProvider.availableColors)) {
          cachedColors = storedProvider.availableColors as any[];
        }
        if (storedProvider?.availableSizes && Array.isArray(storedProvider.availableSizes)) {
          cachedSizes = storedProvider.availableSizes as string[];
        }
      }
      
      // Fallback: try variant costs from Printify API (usually returns 0 for catalog items)
      if (basePrice === 0) {
        const costs = variants.map(v => v.cost || v.price || 0).filter((c: number) => c > 0);
        basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
        maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
      }
      
      // Use cached colors/sizes if available, otherwise use live extracted ones
      const finalColors = cachedColors || colors;
      const finalSizes = cachedSizes || sizes;
      
      const responseData = {
        blueprint,
        providers: usaProviders.length > 0 ? usaProviders : providers,
        selectedProvider,
        madeInUSA: usaProviders.length > 0,
        variants,
        colors: finalColors,
        sizes: finalSizes,
        basePrice,
        maxPrice,
        costsFromDatabase,
        colorsFromDatabase: cachedColors !== null,
        sizesFromDatabase: cachedSizes !== null,
        costsAvailable: basePrice > 0,
        imageUrl: blueprint.images?.[0] || null,
      };
      
      res.json(responseData);
    } catch (error: any) {
      console.error(`Printify API error for blueprint ${req.params.blueprintId}:`, error.message);
      res.status(500).json({ error: `Printify API error: ${error.message}` });
    }
  });

  // Batch fetch blueprint details (for efficient loading)
  // Database is the source of truth for costs - no in-memory cache
  app.post("/api/admin/printify/catalog/batch-details", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const { blueprintIds } = req.body;
      if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) {
        return res.status(400).json({ error: "blueprintIds array required" });
      }
      
      // Limit batch size
      const limitedIds = blueprintIds.slice(0, 20);
      const results: Record<number, any> = {};
      
      for (const blueprintId of limitedIds) {
        try {
          // Fetch blueprint details and providers
          const [blueprint, providers] = await Promise.all([
            printify.getBlueprintDetails(blueprintId),
            printify.getPrintProviders(blueprintId),
          ]);
          
          // Filter for USA providers
          const usaProviders = providers.filter((p: any) => 
            p.location?.country === 'US' || p.location?.country === 'USA'
          );
          
          // Get variants from first USA provider (or first available)
          let variants: any[] = [];
          const selectedProvider = usaProviders[0] || providers[0];
          
          if (selectedProvider) {
            try {
              const variantData = await printify.getVariants(blueprintId, selectedProvider.id);
              variants = variantData.variants || [];
            } catch {
              // Provider may not have variants - continue with empty
            }
          }
          
          // Extract colors and sizes from live API
          const liveColors = Array.from(new Set(variants.map((v: any) => v.options?.color).filter(Boolean)));
          const liveSizes = Array.from(new Set(variants.map((v: any) => v.options?.size).filter(Boolean)));
          
          // First try to get costs and colors/sizes from local database (cached from cost sync)
          let basePrice = 0;
          let maxPrice = 0;
          let costsFromDatabase = false;
          let cachedColors: any[] | null = null;
          let cachedSizes: string[] | null = null;
          
          if (selectedProvider) {
            const storedProvider = await storage.getPrintifyPrintProvider(blueprintId, selectedProvider.id);
            if (storedProvider?.minCost && storedProvider.minCost > 0) {
              basePrice = storedProvider.minCost / 100;
              maxPrice = (storedProvider.maxCost || storedProvider.minCost) / 100;
              costsFromDatabase = true;
            }
            // Use cached colors/sizes if available
            if (storedProvider?.availableColors && Array.isArray(storedProvider.availableColors)) {
              cachedColors = storedProvider.availableColors as any[];
            }
            if (storedProvider?.availableSizes && Array.isArray(storedProvider.availableSizes)) {
              cachedSizes = storedProvider.availableSizes as string[];
            }
          }
          
          // Fallback: try Printify API (usually returns 0 for catalog items)
          if (basePrice === 0) {
            const costs = variants.map((v: any) => v.cost || 0).filter((c: number) => c > 0);
            basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
            maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
          }
          
          // Use cached colors/sizes if available, otherwise use live extracted ones
          const finalColors = cachedColors || liveColors;
          const finalSizes = cachedSizes || liveSizes;
          
          const data = {
            blueprintId,
            basePrice,
            maxPrice,
            costsAvailable: basePrice > 0,
            costsFromDatabase,
            colors: finalColors,
            sizes: finalSizes,
            colorsFromDatabase: cachedColors !== null,
            sizesFromDatabase: cachedSizes !== null,
            madeInUSA: usaProviders.length > 0,
            providerId: selectedProvider?.id,
            providerName: selectedProvider?.title,
          };
          
          results[blueprintId] = data;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          // Mark this item as having an error but continue
          results[blueprintId] = { 
            blueprintId, 
            error: true, 
            message: err.message || "Failed to fetch details" 
          };
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get print providers for a blueprint
  app.get("/api/admin/printify/blueprints/:id/providers", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const { id } = req.params;
      const providers = await printify.getPrintProviders(parseInt(id));
      res.json(providers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get variants for a blueprint + provider combination
  app.get("/api/admin/printify/blueprints/:blueprintId/providers/:providerId/variants", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const { blueprintId, providerId } = req.params;
      const variants = await printify.getVariants(parseInt(blueprintId), parseInt(providerId));
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // LOCAL CATALOG SYNC ENDPOINTS
  // ========================================

  // Get local catalog blueprints (fast, from database)
  app.get("/api/admin/catalog/blueprints", isAdmin, async (req: any, res) => {
    try {
      const blueprints = await storage.getPrintifyBlueprints();
      const usaFilter = req.query.usaOnly === 'true';
      const category = req.query.category as string | undefined;
      
      // Get providers for filtering
      let filteredBlueprints = blueprints;
      
      if (category) {
        filteredBlueprints = filteredBlueprints.filter(bp => bp.category === category);
      }
      
      if (usaFilter) {
        // Get all providers and filter blueprints that have USA providers
        const blueprintIds = new Set<number>();
        for (const bp of filteredBlueprints) {
          const providers = await storage.getPrintifyPrintProviders(bp.id);
          if (providers.some(p => p.isUSA)) {
            blueprintIds.add(bp.id);
          }
        }
        filteredBlueprints = filteredBlueprints.filter(bp => blueprintIds.has(bp.id));
      }
      
      res.json({
        blueprints: filteredBlueprints,
        total: filteredBlueprints.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get local catalog blueprint details
  app.get("/api/admin/catalog/blueprints/:id", isAdmin, async (req: any, res) => {
    try {
      const blueprintId = parseInt(req.params.id);
      const blueprint = await storage.getPrintifyBlueprint(blueprintId);
      
      if (!blueprint) {
        return res.status(404).json({ error: "Blueprint not found in local catalog" });
      }
      
      const providers = await storage.getPrintifyPrintProviders(blueprintId);
      const usaProviders = providers.filter(p => p.isUSA);
      
      // Get first USA provider's cached data for colors/sizes/costs
      const selectedProvider = usaProviders[0] || providers[0];
      let colors: any[] = [];
      let sizes: string[] = [];
      let basePrice = 0;
      let maxPrice = 0;
      
      if (selectedProvider) {
        if (selectedProvider.availableColors && Array.isArray(selectedProvider.availableColors)) {
          colors = selectedProvider.availableColors as any[];
        }
        if (selectedProvider.availableSizes && Array.isArray(selectedProvider.availableSizes)) {
          sizes = selectedProvider.availableSizes as string[];
        }
        if (selectedProvider.minCost) {
          basePrice = selectedProvider.minCost / 100;
          maxPrice = (selectedProvider.maxCost || selectedProvider.minCost) / 100;
        }
      }
      
      res.json({
        ...blueprint,
        providers,
        usaProviders,
        selectedProvider,
        colors,
        sizes,
        basePrice,
        maxPrice,
        costsAvailable: basePrice > 0,
        colorsFromDatabase: colors.length > 0,
        sizesFromDatabase: sizes.length > 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get provider details with colors/sizes from local cache
  app.get("/api/admin/catalog/providers/:blueprintId/:providerId", isAdmin, async (req: any, res) => {
    try {
      const blueprintId = parseInt(req.params.blueprintId);
      const providerId = parseInt(req.params.providerId);
      
      const provider = await storage.getPrintifyPrintProvider(blueprintId, providerId);
      
      if (!provider) {
        return res.status(404).json({ error: "Provider not found in local catalog" });
      }
      
      // Parse colors and sizes from provider record
      const colors = provider.availableColors && Array.isArray(provider.availableColors) 
        ? provider.availableColors as any[] 
        : [];
      const sizes = provider.availableSizes && Array.isArray(provider.availableSizes) 
        ? provider.availableSizes as string[] 
        : [];
      
      res.json({
        ...provider,
        colors,
        sizes,
        basePrice: provider.minCost ? provider.minCost / 100 : 0,
        maxPrice: provider.maxCost ? provider.maxCost / 100 : (provider.minCost ? provider.minCost / 100 : 0),
        costsAvailable: provider.minCost !== null && provider.minCost > 0,
        colorsFromDatabase: colors.length > 0,
        sizesFromDatabase: sizes.length > 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get catalog sync status
  app.get("/api/admin/catalog/sync-status", isAdmin, async (req: any, res) => {
    try {
      const latestSync = await storage.getLatestCatalogSync();
      const totalBlueprints = (await storage.getPrintifyBlueprints()).length;
      
      res.json({
        latestSync,
        totalBlueprints,
        isConfigured: printify?.isConfigured || false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get catalog sync history
  app.get("/api/admin/catalog/sync-history", isAdmin, async (req: any, res) => {
    try {
      const history = await storage.getCatalogSyncHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start catalog sync from Printify
  app.post("/api/admin/catalog/sync", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      // Check if sync is already running
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        return res.status(409).json({ error: "Sync already in progress" });
      }
      
      // Create sync record
      const syncRecord = await storage.createCatalogSync({
        syncType: 'full',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });
      
      // Return immediately, sync runs in background
      res.json({ syncId: syncRecord.id, status: 'started' });
      
      // Run sync in background
      (async () => {
        try {
          console.log('[Catalog Sync] Starting full catalog sync...');
          
          // Fetch all blueprints from Printify
          const blueprints = await printify.getCatalogBlueprints();
          console.log(`[Catalog Sync] Found ${blueprints.length} blueprints`);
          
          let blueprintsCount = 0;
          let providersCount = 0;
          
          for (const bp of blueprints) {
            try {
              // Upsert blueprint
              await storage.upsertPrintifyBlueprint({
                id: bp.id,
                title: bp.title,
                description: bp.description || null,
                brand: bp.brand || null,
                model: bp.model || null,
                images: bp.images || null,
                primaryImageUrl: bp.images?.[0] || null,
                category: detectCategory(bp.title, bp.brand || ''),
              });
              blueprintsCount++;
              
              // Fetch and store providers for this blueprint
              const providers = await printify.getPrintProviders(bp.id);
              
              for (const provider of providers) {
                const isUSA = provider.location?.country === 'US' || 
                              provider.location?.country === 'USA';
                
                await storage.upsertPrintifyPrintProvider({
                  blueprintId: bp.id,
                  providerId: provider.id,
                  title: provider.title,
                  country: provider.location?.country || null,
                  isUSA,
                });
                providersCount++;
              }
              
              // Rate limiting - small delay between blueprints
              await new Promise(r => setTimeout(r, 100));
              
            } catch (bpError: any) {
              console.error(`[Catalog Sync] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }
          
          // Update sync record with completion
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount,
            providersCount,
            completedAt: new Date(),
          });
          
          console.log(`[Catalog Sync] Completed. ${blueprintsCount} blueprints, ${providersCount} providers`);
          
        } catch (error: any) {
          console.error('[Catalog Sync] Error:', error.message);
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date(),
          });
        }
      })();
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear local catalog (for testing/reset)
  app.delete("/api/admin/catalog/clear", isAdmin, async (req: any, res) => {
    try {
      await storage.clearPrintifyPrintProviders();
      await storage.clearPrintifyBlueprints();
      res.json({ success: true, message: "Local catalog cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch production costs for a specific blueprint/provider combo
  // Creates a placeholder product in Printify to extract costs, then stores them locally
  app.post("/api/admin/catalog/fetch-costs", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, providerId, deleteAfter = true } = req.body;
      
      if (!blueprintId || !providerId) {
        return res.status(400).json({ error: "blueprintId and providerId are required" });
      }
      
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      console.log(`[Cost Fetch] Fetching costs for blueprint ${blueprintId}, provider ${providerId}...`);
      
      // First, get the variants for this blueprint/provider
      const variantsResult = await printify.getVariants(blueprintId, providerId);
      const variantIds = variantsResult.variants.map(v => v.id);
      
      if (variantIds.length === 0) {
        return res.status(404).json({ error: "No variants found for this blueprint/provider combo" });
      }
      
      // Get a placement that works for these variants (finds common placement)
      const { placement, variantIds: compatibleVariantIds } = await printify.getCommonPlacement(blueprintId, providerId);
      console.log(`[Cost Fetch] Using placement '${placement}' with ${compatibleVariantIds.length} compatible variants`);
      
      // Upload a placeholder image to Printify (cached after first upload)
      const imageId = await printify.getOrCreatePlaceholderImage();
      console.log(`[Cost Fetch] Using placeholder image: ${imageId}`);
      
      // Create a placeholder product WITH the image to get real costs (item + one print)
      const placeholderProduct = await printify.createPlaceholderProduct(
        blueprintId,
        providerId,
        compatibleVariantIds,
        imageId,
        placement
      );
      
      console.log(`[Cost Fetch] Created placeholder product ${placeholderProduct.id}, extracting costs...`);
      
      // Extract costs from the product
      const costs = printify.extractCostsFromProduct(placeholderProduct);
      
      console.log(`[Cost Fetch] Extracted costs: min=$${(costs.minCost / 100).toFixed(2)}, max=$${(costs.maxCost / 100).toFixed(2)}`);
      
      // Store costs in the local database
      const updatedProvider = await storage.updatePrintifyProviderCosts(
        blueprintId,
        providerId,
        {
          minCost: costs.minCost,
          maxCost: costs.maxCost,
          placeholderProductId: deleteAfter ? undefined : placeholderProduct.id,
        }
      );
      
      // Optionally delete the placeholder product
      if (deleteAfter) {
        try {
          await printify.deleteProduct(placeholderProduct.id);
          console.log(`[Cost Fetch] Deleted placeholder product ${placeholderProduct.id}`);
        } catch (deleteError: any) {
          console.warn(`[Cost Fetch] Could not delete placeholder product: ${deleteError.message}`);
        }
      }
      
      res.json({
        success: true,
        blueprintId,
        providerId,
        placement,
        minCost: costs.minCost,
        maxCost: costs.maxCost,
        minCostFormatted: `$${(costs.minCost / 100).toFixed(2)}`,
        maxCostFormatted: `$${(costs.maxCost / 100).toFixed(2)}`,
        variantsChecked: compatibleVariantIds.length,
        placeholderDeleted: deleteAfter,
        note: `Cost includes: blank item + one print on '${placement}' position`,
      });
      
    } catch (error: any) {
      console.error('[Cost Fetch] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync ALL costs in background - runs through all cached providers
  app.post("/api/admin/catalog/sync-all-costs", isAdmin, async (req: any, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify API not configured" });
      }

      if (isCostSyncRunning()) {
        return res.status(409).json({ error: "Cost sync already in progress" });
      }

      const forceRefresh = req.body?.forceRefresh === true;
      const costSync = await startCostSync({ forceRefresh });

      if (!costSync) {
        return res.status(400).json({ error: "Failed to start cost sync. Check that catalog is synced first." });
      }

      res.json({ 
        success: true, 
        message: "Cost sync started in background",
        syncId: costSync.id,
        totalProviders: costSync.totalProviders,
      });
      
    } catch (error: any) {
      console.error('[Cost Sync] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get cost sync status
  app.get("/api/admin/catalog/cost-sync-status", isAdmin, async (req: any, res) => {
    try {
      const status = await getCostSyncStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel running cost sync
  app.post("/api/admin/catalog/cancel-cost-sync", isAdmin, async (req: any, res) => {
    try {
      cancelCostSync();
      res.json({ success: true, message: "Cost sync cancellation requested" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Refresh color hex values for all providers using the catalog API
  // This updates existing providers with proper hex codes without creating placeholder products
  app.post("/api/admin/catalog/refresh-color-hex", isAdmin, async (req: any, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify API not configured" });
      }

      // Get all providers that have colors but missing hex values
      const allProviders = await storage.getAllPrintifyProviders();
      const providersNeedingHex = allProviders.filter(p => {
        if (!p.availableColors || !Array.isArray(p.availableColors)) return false;
        // Check if any color is missing hex
        return (p.availableColors as any[]).some(c => !c.hex);
      });

      console.log(`[Color Hex Refresh] Found ${providersNeedingHex.length} providers needing hex values`);

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process in batches to avoid rate limiting
      for (const provider of providersNeedingHex) {
        try {
          const catalogData = await syncProductVariants(provider.blueprintId, provider.providerId);
          
          await storage.updatePrintifyProviderCosts(provider.blueprintId, provider.providerId, {
            minCost: 0, // Preserve existing costs when just updating colors
            maxCost: 0,
            availableColors: catalogData.colors,
            availableSizes: catalogData.sizes,
          });

          successCount++;
          console.log(`[Color Hex Refresh] Updated ${provider.blueprintId}/${provider.providerId} with ${catalogData.colors.length} colors`);
          
          // Rate limiting - 1 request per second
          await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) {
          failedCount++;
          errors.push(`${provider.blueprintId}/${provider.providerId}: ${err.message}`);
        }
      }

      res.json({
        success: true,
        message: `Color hex refresh complete`,
        totalProcessed: providersNeedingHex.length,
        successCount,
        failedCount,
        errors: errors.slice(0, 10), // First 10 errors only
      });

    } catch (error: any) {
      console.error('[Color Hex Refresh] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // PRINTFUL CATALOG SYNC ENDPOINTS
  // ========================================

  // Sync Printful catalog to local database
  app.post("/api/admin/catalog/sync-printful", isAdmin, async (req: any, res) => {
    try {
      const { syncPrintfulCatalog, printfulClient } = await import("./lib/printful");
      
      if (!printfulClient.isConfigured) {
        return res.status(503).json({ error: "Printful API key not configured" });
      }

      const productIds = req.body?.productIds; // Optional: sync specific products only
      
      // Start sync in background and return immediately
      res.json({ 
        success: true, 
        message: "Printful catalog sync started in background",
        productIds: productIds || "all",
      });

      // Run sync asynchronously
      try {
        const result = await syncPrintfulCatalog(db, productIds ? { productIds } : undefined);
        console.log('[Printful Sync] Background sync complete:', result);
      } catch (syncError: any) {
        console.error('[Printful Sync] Background sync error:', syncError.message);
      }
      
    } catch (error: any) {
      console.error('[Printful Sync] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Printful catalog status
  app.get("/api/admin/catalog/printful-status", isAdmin, async (req: any, res) => {
    try {
      const { printfulClient } = await import("./lib/printful");
      const { printfulProducts, printfulVariants } = await import("@shared/schema");
      const { count } = await import("drizzle-orm");
      
      const [productCount] = await db.select({ count: count() }).from(printfulProducts);
      const [variantCount] = await db.select({ count: count() }).from(printfulVariants);
      
      const isConfigured = printfulClient.isConfigured;
      console.log('[Printful Status] isConfigured:', isConfigured);
      
      res.json({
        isConfigured,
        productCount: productCount?.count || 0,
        variantCount: variantCount?.count || 0,
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get Printful products list
  app.get("/api/admin/catalog/printful-products", isAdmin, async (req: any, res) => {
    try {
      const { printfulProducts } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const products = await db.select().from(printfulProducts).orderBy(desc(printfulProducts.lastSyncedAt));
      res.json(products);
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // END LOCAL CATALOG SYNC ENDPOINTS
  // ========================================

  // Add product from Printify catalog
  app.post("/api/admin/products/from-printify", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, printProviderId, name, description, category, basePrice, imageUrl, manufacturer, madeInUSA, availablePlacements, availableColors, metadata } = req.body;
      
      const productId = `printify_${blueprintId}_${printProviderId}_${Date.now()}`;
      
      const product = await storage.createProduct({
        id: productId,
        printifyId: null,
        blueprintId,
        printProviderId,
        name,
        description,
        category,
        basePrice: basePrice.toString(),
        imageUrl,
        manufacturer,
        madeInUSA: madeInUSA || false,
        availablePlacements,
        availableColors,
        metadata,
        isEnabled: false,
        markupPercent: "0",
        markupFixed: "0",
        qrProductionCost: "0",
        sortOrder: 0,
      });
      
      // AUTO-SYNC: Seed variants from local catalog (already synced from Printify weekly)
      const { variantsSeeded, syncWarning } = await autoSyncVariantsFromLocalCatalog(
        product.id,
        blueprintId,
        printProviderId,
        basePrice.toString(),
        metadata || {} // Pass existing metadata to be merged, not overwritten
      );
      
      // If this is a Kingdom Connects product, also create the partner store product entry
      if (category === "Kingdom Connects" && metadata?.kcPlacements?.length > 0) {
        // Find the Kingdom Connects partner store
        const partnerStores = await storage.getPartnerStores();
        const kcStore = partnerStores.find(p => p.slug === "kingdom-connects");
        
        if (kcStore) {
          await storage.addPartnerStoreProduct({
            partnerStoreId: kcStore.id,
            productId: product.id,
            kcPlacements: metadata.kcPlacements,
            kcBusinessSlug: metadata.kcBusinessSlug || null,
            sortOrder: 0,
            isEnabled: true,
          });
        }
      }
      
      res.json({ 
        ...product, 
        variantsSeeded,
        syncWarning 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync product placements and data from Printify
  app.post("/api/admin/products/:id/sync-printify", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing Printify blueprint or provider IDs" });
      }
      
      // Fetch placements and mockup image from Printify
      const { placements, mockupImageUrl } = await syncProductPlacements(
        product.blueprintId,
        product.printProviderId
      );
      
      // Fetch colors and sizes
      const { colors, sizes, variants } = await syncProductVariants(
        product.blueprintId,
        product.printProviderId
      );
      
      // Save each variant to the database (defaults to isEnabled=true)
      for (const variant of variants) {
        await storage.upsertProductVariant({
          productId: product.id,
          printifyVariantId: variant.id,
          title: variant.title,
          size: variant.options?.size || null,
          color: variant.options?.color || null,
          colorHex: variant.options?.color ? colors.find(c => c.name === variant.options?.color)?.hex || null : null,
          price: String((variant.price || 0) / 100), // Printify prices are in cents
          isEnabled: true, // Default all new variants to enabled
          isInStock: variant.is_available ?? true,
        });
      }
      
      // Update product with synced data
      const updatedProduct = await storage.updateProduct(product.id, {
        availablePlacements: placements.map(p => p.position),
        availableColors: colors,
        availableSizes: sizes,
        imageUrl: mockupImageUrl || product.imageUrl,
        metadata: {
          ...(product.metadata as object || {}),
          placementDetails: placements,
          lastSyncedAt: new Date().toISOString(),
        },
      });
      
      res.json({
        success: true,
        product: updatedProduct,
        syncedData: { placements, colors, sizes, mockupImageUrl, variantsCount: variants.length },
      });
    } catch (error: any) {
      console.error("Product sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC GALLERY API ============
  
  // Get public gallery designs (opt-in shared designs)
  app.get("/api/gallery", async (req, res) => {
    try {
      const designs = await storage.getPublicGalleryDesigns();
      
      // Enrich with product data
      const enrichedDesigns = await Promise.all(
        designs.map(async (design) => {
          const product = design.productId 
            ? await storage.getProduct(design.productId)
            : null;
          return { ...design, product };
        })
      );
      
      res.json(enrichedDesigns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SITEMAP FOR SEO ============
  
  // Generate XML sitemap
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const products = await storage.getAllProducts();
      const enabledProducts = products.filter(p => p.isEnabled);
      
      type SitemapPage = { loc: string; priority: string; changefreq: string; lastmod?: string };
      
      const staticPages: SitemapPage[] = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/store', priority: '0.9', changefreq: 'daily' },
        { loc: '/creator', priority: '0.9', changefreq: 'weekly' },
        { loc: '/gallery', priority: '0.8', changefreq: 'daily' },
        { loc: '/cart', priority: '0.5', changefreq: 'weekly' },
      ];
      
      const productPages: SitemapPage[] = enabledProducts.map(p => ({
        loc: `/store?product=${p.id}`,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod: p.updatedAt?.toISOString().split('T')[0],
      }));
      
      const allPages: SitemapPage[] = [...staticPages, ...productPages];
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <priority>${page.priority}</priority>
    <changefreq>${page.changefreq}</changefreq>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;
      
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error: any) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // ============ SAVED DESIGNS ENDPOINTS ============
  
  // Get all saved designs for current user
  app.get("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const designs = await storage.getQrDesignsByUser(userId);
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single design by ID
  app.get("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      // Ensure user owns this design
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new saved design
  app.post("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertQrDesignSchema.parse({
        ...req.body,
        userId,
      });
      const design = await storage.createQrDesign(validatedData);
      res.status(201).json(design);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update a saved design
  app.put("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateQrDesign(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a saved design
  app.delete("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteQrDesign(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRODUCT CATEGORIES ENDPOINTS ============

  // Get all product categories (public)
  // Admin: Get ALL product categories (including inactive)
  app.get("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/product-categories", async (req, res) => {
    try {
      const taxonomyType = req.query.taxonomy as string | undefined;
      let categories;
      if (taxonomyType) {
        categories = await storage.getProductCategoriesByTaxonomy(taxonomyType);
      } else {
        categories = await storage.getActiveProductCategories();
      }
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get products by category (public)
  app.get("/api/product-categories/:id/products", async (req, res) => {
    try {
      const products = await storage.getProductsByCategory(req.params.id);
      // Only return enabled products
      const enabledProducts = products.filter(p => p.isEnabled);
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get category assignments for a product
  app.get("/api/products/:id/categories", async (req, res) => {
    try {
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create a category
  app.post("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const { name, slug, description, taxonomyType, icon, parentId, sortOrder, isActive } = req.body;
      const category = await storage.createProductCategory({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        taxonomyType,
        icon,
        parentId,
        sortOrder,
        isActive,
      });
      res.status(201).json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update a category
  app.put("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateProductCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete a category
  app.delete("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteProductCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Assign categories to a product
  app.post("/api/admin/products/:id/categories", isAdmin, async (req: any, res) => {
    try {
      const { categoryIds } = req.body;
      await storage.syncProductCategories(req.params.id, categoryIds || []);
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Seed default categories
  app.post("/api/admin/product-categories/seed", isAdmin, async (req: any, res) => {
    try {
      const defaultCategories = [
        // Seasons
        { name: "Spring", slug: "spring", taxonomyType: "season", icon: "Flower2", sortOrder: 1 },
        { name: "Summer", slug: "summer", taxonomyType: "season", icon: "Sun", sortOrder: 2 },
        { name: "Fall", slug: "fall", taxonomyType: "season", icon: "Leaf", sortOrder: 3 },
        { name: "Winter", slug: "winter", taxonomyType: "season", icon: "Snowflake", sortOrder: 4 },
        // Holidays
        { name: "Christmas", slug: "christmas", taxonomyType: "holiday", icon: "Gift", sortOrder: 1 },
        { name: "Easter", slug: "easter", taxonomyType: "holiday", icon: "Egg", sortOrder: 2 },
        { name: "Valentine's Day", slug: "valentines", taxonomyType: "holiday", icon: "Heart", sortOrder: 3 },
        { name: "Halloween", slug: "halloween", taxonomyType: "holiday", icon: "Ghost", sortOrder: 4 },
        { name: "Thanksgiving", slug: "thanksgiving", taxonomyType: "holiday", icon: "Utensils", sortOrder: 5 },
        { name: "Fourth of July", slug: "july-4th", taxonomyType: "holiday", icon: "Flag", sortOrder: 6 },
        { name: "Mother's Day", slug: "mothers-day", taxonomyType: "holiday", icon: "Heart", sortOrder: 7 },
        { name: "Father's Day", slug: "fathers-day", taxonomyType: "holiday", icon: "Trophy", sortOrder: 8 },
        // Occasions
        { name: "Birthday", slug: "birthday", taxonomyType: "occasion", icon: "Cake", sortOrder: 1 },
        { name: "Anniversary", slug: "anniversary", taxonomyType: "occasion", icon: "HeartHandshake", sortOrder: 2 },
        { name: "Graduation", slug: "graduation", taxonomyType: "occasion", icon: "GraduationCap", sortOrder: 3 },
        { name: "Wedding", slug: "wedding", taxonomyType: "occasion", icon: "Gem", sortOrder: 4 },
        { name: "Baby Shower", slug: "baby-shower", taxonomyType: "occasion", icon: "Baby", sortOrder: 5 },
        // Other
        { name: "Religious", slug: "religious", taxonomyType: "other", icon: "Church", sortOrder: 1 },
        { name: "Sports", slug: "sports", taxonomyType: "other", icon: "Trophy", sortOrder: 2 },
        { name: "Business", slug: "business", taxonomyType: "other", icon: "Briefcase", sortOrder: 3 },
        { name: "Patriotic", slug: "patriotic", taxonomyType: "other", icon: "Flag", sortOrder: 4 },
      ];

      const created = [];
      for (const cat of defaultCategories) {
        try {
          const category = await storage.createProductCategory({
            ...cat,
            isActive: true,
          });
          created.push(category);
        } catch (e) {
          // Skip if already exists (unique constraint on slug)
        }
      }
      res.json({ created: created.length, categories: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // NOTE: Partner store CRUD endpoints moved to ADMIN PARTNER STORE ENDPOINTS section below

  // Admin: Get partner store products with product details (sizes/colors)
  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      
      // Fetch full product details for each store product
      const enrichedProducts = await Promise.all(
        storeProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          return {
            ...sp,
            availableSizes: product?.availableSizes || [],
            availableColors: product?.availableColors || [],
          };
        })
      );
      
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Sync partner store products
  app.post("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const { productIds } = req.body;
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: "productIds must be an array" });
      }
      await storage.syncPartnerStoreProducts(req.params.id, productIds);
      const products = await storage.getPartnerStoreProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update partner store product options (sizes, colors, placements)
  app.patch("/api/admin/partner-stores/:storeId/products/:productId", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { enabledSizes, enabledColors, defaultColor, kcPlacements, kcBusinessSlug, customPrice, customName, isEnabled } = req.body;
      
      const updated = await storage.updatePartnerStoreProductByIds(storeId, productId, {
        enabledSizes,
        enabledColors,
        defaultColor,
        kcPlacements,
        kcBusinessSlug,
        customPrice,
        customName,
        isEnabled,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Partner store product not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Generate mockups for a store product color
  // Sends product + QR artwork to Printify and retrieves mockup images
  app.post("/api/admin/partner-stores/:storeId/products/:productId/generate-mockup", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { color } = req.body;
      
      if (!color) {
        return res.status(400).json({ error: "color is required" });
      }
      
      // Get the product to get blueprint/provider IDs
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const blueprintId = product.blueprintId;
      const printProviderId = product.printProviderId;
      
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      // Get artwork URL - check if this is a custom design product
      let artworkUrl: string | null = null;
      
      // Check if product ID starts with 'custom_' and has a linked design
      if (productId.startsWith('custom_')) {
        const designId = productId.replace('custom_', '');
        const design = await storage.getCustomDesign(designId);
        if (design) {
          // Parse placement images safely
          let designPlacements: Record<string, string> = {};
          try {
            if (typeof design.placementImages === 'string') {
              designPlacements = JSON.parse(design.placementImages);
            } else if (design.placementImages && typeof design.placementImages === 'object') {
              designPlacements = design.placementImages as Record<string, string>;
            }
          } catch (e) {
            console.error('[Mockup] Failed to parse placementImages:', e);
          }
          
          // Get the color's hex value using fallback chain
          const { getProviderColorsWithFallback } = await import("./lib/printify");
          const colors = await getProviderColorsWithFallback(blueprintId, printProviderId, storage);
          const colorInfo = colors.find(
            (c: any) => c.name?.toLowerCase() === color.toLowerCase()
          );
          const colorHex = colorInfo?.hex || null;
          
          // Import the luminance helper
          const { isColorDark } = await import('./lib/composite-image-generator.js');
          
          // Determine which artwork to use based on shirt color
          // Dark shirts need white QR, light shirts need black QR
          const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
          
          // Check if we have both versions in placements
          const blackArtwork = designPlacements["front-chest"] || designPlacements["front-chest-black"];
          const whiteArtwork = designPlacements["front-chest-white"];
          
          // Pick the right artwork, with fallback
          if (needsWhiteQR && whiteArtwork) {
            artworkUrl = whiteArtwork;
            console.log(`[Mockup] Using WHITE artwork for dark shirt color: ${color} (${colorHex})`);
          } else if (blackArtwork) {
            artworkUrl = blackArtwork;
            console.log(`[Mockup] Using BLACK artwork for light shirt color: ${color} (${colorHex})`);
          } else {
            // Ultimate fallback
            artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
          }
        }
      }
      
      if (!artworkUrl) {
        return res.status(400).json({ error: "No artwork found for this product" });
      }
      
      // Make artwork URL absolute
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000';
      const absoluteArtworkUrl = artworkUrl.startsWith('http') ? artworkUrl : `${baseUrl}${artworkUrl}`;
      
      console.log(`[Mockup] Generating for product ${productId}, color ${color}`);
      console.log(`[Mockup] Blueprint: ${blueprintId}, Provider: ${printProviderId}`);
      console.log(`[Mockup] Artwork: ${absoluteArtworkUrl}`);
      
      // Import Printify client
      const { printify, syncProductVariants, syncProductPlacements } = await import("./lib/printify");
      
      // Get variants for this color
      const { variants } = await syncProductVariants(blueprintId, printProviderId);
      const colorVariants = variants.filter(v => 
        v.options?.color && v.options.color.toLowerCase() === color.toLowerCase()
      );
      
      if (colorVariants.length === 0) {
        return res.status(400).json({ error: `No variants found for color: ${color}` });
      }
      
      const variantIds = colorVariants.slice(0, 1).map(v => v.id); // Just need one variant per color
      console.log(`[Mockup] Found ${colorVariants.length} variants for ${color}, using: ${variantIds[0]}`);
      
      // Upload artwork to Printify
      const imageUpload = await printify.uploadImage(absoluteArtworkUrl, `mockup-${productId}-${color}.png`);
      console.log(`[Mockup] Uploaded image ID: ${imageUpload.id}`);
      
      // Get placement info
      const { placements: providerPlacements } = await syncProductPlacements(blueprintId, printProviderId);
      const placement = providerPlacements[0]?.position || "front";
      
      // Create Printify product to generate mockups
      const productData = {
        title: `Mockup - ${product.name} - ${color}`,
        description: `Mockup generation for ${color}`,
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantIds.map(vid => ({
          id: vid,
          price: 2500,
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{
            position: placement,
            images: [{
              id: imageUpload.id,
              x: 0.5,
              y: 0.5,
              scale: 1.0,
              angle: 0,
            }],
          }],
        }],
      };
      
      const printifyProduct = await printify.createProduct(productData);
      console.log(`[Mockup] Created Printify product: ${printifyProduct.id}`);
      
      // Poll for mockups
      let attempts = 0;
      const maxAttempts = 10;
      let mockupUrl: string | null = null;
      
      while (attempts < maxAttempts && !mockupUrl) {
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempts++;
        
        const productDetails = await printify.getProduct(printifyProduct.id);
        if (productDetails.images && productDetails.images.length > 0) {
          mockupUrl = productDetails.images[0].src;
          console.log(`[Mockup] Got mockup URL: ${mockupUrl}`);
        }
      }
      
      if (!mockupUrl) {
        // Delete the temp product
        await printify.deleteProduct(printifyProduct.id).catch(() => {});
        return res.status(500).json({ error: "Mockup generation timed out" });
      }
      
      // Get current mockups and add this one
      const storeProduct = await storage.getPartnerStoreProduct(storeId, productId);
      const existingMockups = (storeProduct?.mockupsByColor as Record<string, any>) || {};
      existingMockups[color] = { front: mockupUrl };
      
      // Save mockups to store product
      await storage.updatePartnerStoreProductByIds(storeId, productId, {
        mockupsByColor: existingMockups,
      });
      
      // Delete the temp Printify product
      await printify.deleteProduct(printifyProduct.id).catch(() => {});
      
      console.log(`[Mockup] Saved mockup for ${color}`);
      res.json({ success: true, color, mockupUrl, mockupsByColor: existingMockups });
    } catch (error: any) {
      console.error("[Mockup] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ MOCKUP & PLACEMENT API (Database-first with Printify fallback) ============

  // Get all canonical placements (for UI rendering)
  app.get("/api/placements", async (req, res) => {
    try {
      const { category } = req.query;
      const { getCanonicalPlacements } = await import("./lib/mockup-service");
      const placements = await getCanonicalPlacements(category as string | undefined);
      res.json(placements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get mockup with database-first lookup, Printify fallback
  // Used by frontend to get mockup for a specific product/color/placement
  app.post("/api/mockups/get-or-generate", async (req, res) => {
    try {
      const { 
        blueprintId, 
        printProviderId, 
        colorName, 
        colorHex,
        canonicalPlacementId = "FRONT_CHEST",
        artworkUrl,
        artworkVariant = "black"
      } = req.body;

      if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, printProviderId, colorName, artworkUrl" 
        });
      }

      const { getMockupWithFallback } = await import("./lib/mockup-service");
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId),
        colorName,
        colorHex,
        canonicalPlacementId,
        artworkUrl,
        artworkVariant,
      }, storage);

      res.json(result);
    } catch (error: any) {
      console.error("[MockupAPI] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all cached mockups for a product (for instant color switching)
  app.get("/api/mockups/cached/:blueprintId/:printProviderId", async (req, res) => {
    try {
      const { blueprintId, printProviderId } = req.params;
      const { getCachedMockupsForProduct } = await import("./lib/mockup-service");
      
      const mockups = await getCachedMockupsForProduct(
        parseInt(blueprintId),
        parseInt(printProviderId)
      );

      res.json({ mockups, count: Object.keys(mockups).length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get lifestyle mockup for a specific color (with AI composite fallback)
  // Used by frontend when customer clicks a color swatch
  app.post("/api/mockups/lifestyle", async (req, res) => {
    try {
      const { 
        blueprintId, 
        printProviderId, 
        colorName, 
        colorHex,
        qrContent = "https://qrgear.shop",
        productType = 'shirt'
      } = req.body;

      if (!blueprintId || !printProviderId || !colorName) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, printProviderId, colorName" 
        });
      }

      const { getLifestyleMockupForColor } = await import("./lib/mockup-service");
      
      const result = await getLifestyleMockupForColor({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId),
        colorName,
        colorHex,
        qrContent,
        productType,
      }, storage);

      res.json(result);
    } catch (error: any) {
      console.error("[LifestyleMockupAPI] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Pre-generate mockups for all colors of a product
  app.post("/api/admin/mockups/pre-generate", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, printProviderId, artworkBlackUrl, artworkWhiteUrl } = req.body;

      if (!blueprintId || !printProviderId || !artworkBlackUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, printProviderId, artworkBlackUrl" 
        });
      }

      // Get colors from provider
      const { getProviderColorsWithFallback } = await import("./lib/printify");
      const colors = await getProviderColorsWithFallback(
        parseInt(blueprintId), 
        parseInt(printProviderId), 
        storage
      );

      if (!colors.length) {
        return res.status(400).json({ error: "No colors found for this provider" });
      }

      const { preGenerateMockupsForProduct } = await import("./lib/mockup-service");
      
      // This runs async - respond immediately
      res.json({ 
        message: `Pre-generating mockups for ${colors.length} colors...`,
        colors: colors.map((c: any) => c.name)
      });

      // Generate in background
      preGenerateMockupsForProduct(
        parseInt(blueprintId),
        parseInt(printProviderId),
        artworkBlackUrl,
        artworkWhiteUrl || null,
        storage,
        colors
      ).then(result => {
        console.log(`[MockupAPI] Pre-generation complete: ${result.generated} generated, ${result.failed} failed`);
      }).catch(err => {
        console.error("[MockupAPI] Pre-generation error:", err);
      });

    } catch (error: any) {
      console.error("[MockupAPI] Pre-generate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ LIBRARY ASSET ENDPOINTS ============

  // Admin: Get all library assets with optional filters
  app.get("/api/admin/library", isAdmin, async (req: any, res) => {
    try {
      const { ownerType, assetType, mediaType, category, season, event } = req.query;
      const assets = await storage.getLibraryAssets({ 
        ownerType, assetType, mediaType, category, season, event 
      });
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get admin-owned library assets
  app.get("/api/admin/library/admin", isAdmin, async (req: any, res) => {
    try {
      const { assetType, mediaType, category, season, event } = req.query;
      const assets = await storage.getAdminLibraryAssets({ 
        assetType, mediaType, category, season, event 
      });
      
      // Add proxyUrl to each asset for authenticated frontend display
      const assetsWithProxy = assets.map(asset => {
        const filename = (asset.storageUrl || '').split('/').pop() || '';
        return {
          ...asset,
          proxyUrl: asset.storageUrl ? `/api/library-files/${encodeURIComponent(filename)}` : null,
        };
      });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get library templates (custom designs saved to library)
  app.get("/api/admin/library/templates", isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getCustomDesignsForLibrary();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEMPLATE CATEGORY ENDPOINTS ============

  // Admin: Get all template categories (hierarchical)
  app.get("/api/admin/template-categories", isAdmin, async (req: any, res) => {
    try {
      const categories = await storage.getTemplateCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get template categories by parent (null for top-level)
  app.get("/api/admin/template-categories/by-parent", isAdmin, async (req: any, res) => {
    try {
      const { parentId } = req.query;
      const categories = await storage.getTemplateCategoriesByParent(parentId || null);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create template category
  app.post("/api/admin/template-categories", isAdmin, async (req: any, res) => {
    try {
      const category = await storage.createTemplateCategory(req.body);
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update template category
  app.put("/api/admin/template-categories/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateTemplateCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Template category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete template category (soft delete)
  app.delete("/api/admin/template-categories/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteTemplateCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // GRAPHIC SETS ROUTES
  // ============================================

  // Admin: Get all graphic sets
  app.get("/api/admin/graphic-sets", isAdmin, async (req: any, res) => {
    try {
      const graphicSets = await storage.getGraphicSets();
      res.json(graphicSets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get graphic set by ID
  app.get("/api/admin/graphic-sets/:id", isAdmin, async (req: any, res) => {
    try {
      const graphicSet = await storage.getGraphicSet(req.params.id);
      if (!graphicSet) {
        return res.status(404).json({ error: "Graphic set not found" });
      }
      res.json(graphicSet);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get graphic sets by category
  app.get("/api/admin/graphic-sets/category/:categoryId", isAdmin, async (req: any, res) => {
    try {
      const graphicSets = await storage.getGraphicSetsByCategory(req.params.categoryId);
      res.json(graphicSets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create graphic set with generated artwork
  app.post("/api/admin/graphic-sets", isAdmin, async (req: any, res) => {
    try {
      const { name, categoryId, subcategoryId, destinationUrl, description, topText, bottomText, qrContentType } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      const graphicSetId = `gs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let fullGraphicUrl: string | null = null;
      let qrOnlyUrl: string | null = null;
      
      // Generate QR code image (standalone QR)
      const qrDestination = destinationUrl || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/dynamic/${graphicSetId}`;
      const qrBuffer = await QRCode.toBuffer(qrDestination, {
        width: 1000,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      
      // Upload QR-only image to Firebase Storage
      const qrFileName = `qr-only-${graphicSetId}.png`;
      const qrUploadResult = await uploadImageFromBuffer(qrBuffer, qrFileName, 'image/png', `graphic-sets/${graphicSetId}`);
      qrOnlyUrl = qrUploadResult.publicUrl;
      
      // Generate full graphic (header + QR + footer) using composite generator
      if (topText || bottomText) {
        // generatePrintifyComposite returns a data URL string
        const compositeDataUrl = await generatePrintifyComposite(
          qrDestination,
          topText,
          bottomText,
          1200, // width
          1800, // height
          'black' // qrColor
        );
        
        // Convert data URL to buffer
        const base64Data = compositeDataUrl.replace(/^data:image\/png;base64,/, '');
        const compositeBuffer = Buffer.from(base64Data, 'base64');
        
        const fullFileName = `full-graphic-${graphicSetId}.png`;
        const fullUploadResult = await uploadImageFromBuffer(compositeBuffer, fullFileName, 'image/png', `graphic-sets/${graphicSetId}`);
        fullGraphicUrl = fullUploadResult.publicUrl;
      } else {
        // No text elements, use QR as full graphic
        fullGraphicUrl = qrOnlyUrl;
      }
      
      // Create the graphic set record
      const graphicSet = await storage.createGraphicSet({
        name,
        description: description || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        fullGraphicUrl,
        qrOnlyUrl,
        destinationUrl: destinationUrl || null,
        storagePath: `graphic-sets/${graphicSetId}`,
        isActive: true,
        isFeatured: false,
      });
      
      res.json(graphicSet);
    } catch (error: any) {
      console.error('[GraphicSet] Create error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update graphic set
  app.put("/api/admin/graphic-sets/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateGraphicSet(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Graphic set not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete graphic set (soft delete)
  app.delete("/api/admin/graphic-sets/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteGraphicSet(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Increment graphic set usage count
  app.post("/api/admin/graphic-sets/:id/use", isAdmin, async (req: any, res) => {
    try {
      await storage.incrementGraphicSetUsage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create library asset
  app.post("/api/admin/library", isAdmin, async (req: any, res) => {
    try {
      const asset = await storage.createLibraryAsset(req.body);
      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update library asset
  app.put("/api/admin/library/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateLibraryAsset(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Library asset not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete library asset
  app.delete("/api/admin/library/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteLibraryAsset(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Upload library asset to organized folder structure
  app.post("/api/admin/library/upload", isAdmin, async (req: any, res) => {
    try {
      const chunks: Buffer[] = [];
      let fileName = "upload";
      let mimeType = "image/png";
      let boundary = "";
      let assetType = "background";
      let mediaType = "image";
      let category = "";
      let season = "";
      let event = "";
      let name = "";
      let description = "";
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        boundary = boundaryMatch[1];
      }
      
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
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
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        } else if (nameMatch) {
          const fieldName = nameMatch[1];
          const fieldValue = body.toString().trim();
          if (fieldName === "assetType") assetType = fieldValue;
          else if (fieldName === "mediaType") mediaType = fieldValue;
          else if (fieldName === "category") category = fieldValue;
          else if (fieldName === "season") season = fieldValue;
          else if (fieldName === "event") event = fieldValue;
          else if (fieldName === "name") name = fieldValue;
          else if (fieldName === "description") description = fieldValue;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Determine folder path - CANONICAL PATH ONLY for backgrounds
      // ALL background assets go to library/backgrounds/raw/ - no subdirectories
      let folderPath = "libraries";
      if (assetType === "background") {
        folderPath = "library/backgrounds/raw"; // CANONICAL - no subdirectories
      } else if (assetType === "design") {
        folderPath = "libraries/designs";
      } else if (assetType === "video") {
        folderPath = "libraries/videos";
      }
      
      // Upload to object storage
      const uploadResult = await uploadImageFromBuffer(fileBuffer, fileName, mimeType, folderPath);
      
      // Create library asset record
      const asset = await storage.createLibraryAsset({
        ownerType: "admin",
        userId: null,
        assetType,
        mediaType: mimeType.startsWith("video") ? "video" : "image",
        name: name || fileName,
        originalName: fileName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        description: description || null,
        fileName: uploadResult.fileName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        category: category || null,
        season: season || null,
        event: event || null,
        tags: null,
        sortOrder: 0,
        isActive: true,
      });
      
      res.json(asset);
    } catch (error: any) {
      console.error("Library upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User: Get own library assets
  app.get("/api/library/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { assetType, mediaType } = req.query;
      const assets = await storage.getUserLibraryAssets(userId, { assetType, mediaType });
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User: Upload own library asset
  app.post("/api/library/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const chunks: Buffer[] = [];
      let fileName = "upload";
      let mimeType = "image/png";
      let boundary = "";
      let assetType = "background";
      let name = "";
      
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      if (boundaryMatch) {
        boundary = boundaryMatch[1];
      }
      
      const rawBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
      });
      
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
      
      for (const part of parts) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;
        
        const headers = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);
        
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        
        if (filenameMatch) {
          fileName = filenameMatch[1];
          if (contentTypeMatch) {
            mimeType = contentTypeMatch[1].trim();
          }
          fileBuffer = body;
        } else if (nameMatch) {
          const fieldName = nameMatch[1];
          const fieldValue = body.toString().trim();
          if (fieldName === "assetType") assetType = fieldValue;
          else if (fieldName === "name") name = fieldValue;
        }
      }
      
      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // User folder structure
      const folderPath = `library/users/${userId}/${assetType}s`;
      
      const uploadResult = await uploadImageFromBuffer(fileBuffer, fileName, mimeType, folderPath);
      
      const asset = await storage.createLibraryAsset({
        ownerType: "user",
        userId,
        assetType,
        mediaType: mimeType.startsWith("video") ? "video" : "image",
        name: name || fileName,
        originalName: fileName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        description: null,
        fileName: uploadResult.fileName,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        category: null,
        season: null,
        event: null,
        tags: null,
        sortOrder: 0,
        isActive: true,
      });
      
      res.json(asset);
    } catch (error: any) {
      console.error("User library upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Get partner store by slug (for widget embedding)
  // Optional query param: ?placement=homepage|dashboard|static_page to filter by kcPlacements
  app.get("/api/widget/stores/:slug", async (req, res) => {
    try {
      const store = await storage.getPartnerStoreBySlug(req.params.slug);
      if (!store || !store.isActive) {
        return res.status(404).json({ error: "Partner store not found" });
      }
      const storeProducts = await storage.getPartnerStoreProducts(store.id);
      
      // Filter by placement if provided
      const placement = req.query.placement as string | undefined;
      let filteredProducts = storeProducts.filter(sp => sp.isEnabled);
      if (placement) {
        filteredProducts = filteredProducts.filter(sp => 
          sp.kcPlacements && sp.kcPlacements.includes(placement)
        );
      }
      
      // Fetch actual product details including color options
      const productDetails = await Promise.all(
        filteredProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          if (!product || !product.isEnabled) return null;
          
          // Get available colors from the store product config or fall back to product's colors
          // Guard against null/malformed availableColors data
          let availableColors: string[] = [];
          if (sp.enabledColors && Array.isArray(sp.enabledColors)) {
            availableColors = sp.enabledColors;
          } else if (product.availableColors) {
            try {
              const parsed = typeof product.availableColors === 'string' 
                ? JSON.parse(product.availableColors) 
                : product.availableColors;
              if (Array.isArray(parsed)) {
                availableColors = parsed.map((c: any) => typeof c === 'string' ? c : (c?.name || ''));
              }
            } catch {
              availableColors = [];
            }
          }
          
          return {
            id: product.id,
            name: sp.customName || product.name,
            imageUrl: product.imageUrl,
            customPrice: sp.customPrice,
            sortOrder: sp.sortOrder,
            kcPlacements: sp.kcPlacements,
            selectedColors: availableColors,
            defaultColor: sp.defaultColor || availableColors[0] || null,
          };
        })
      );
      
      res.json({
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
        primaryColor: store.primaryColor,
        accentColor: store.accentColor,
        availableSegments: store.availableSegments,
        products: productDetails.filter(Boolean).sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Get store products by store type/name/segment (for internal store pages)
  // Used by pages like /shop/internal/qr-gear/featured or /shop/external/kingdom-connects/homepage
  app.get("/api/store/:storeType/:storeName", async (req, res) => {
    try {
      const { storeType: rawStoreType, storeName } = req.params;
      const segment = req.query.segment as string | undefined;
      
      // Normalize store type to title case (accept internal/Internal/INTERNAL)
      const normalizedType = rawStoreType.toLowerCase();
      if (!["internal", "external"].includes(normalizedType)) {
        return res.status(400).json({ error: "Invalid store type. Use 'Internal' or 'External'" });
      }
      const storeType = normalizedType === "internal" ? "Internal" : "External";
      
      // Get custom designs saved to this store/segment
      const designs = await storage.getCustomDesignsByStoreSegment(storeType, storeName, segment);
      
      // Get partner store for this store type/name to lookup product configurations
      const allStores = await storage.getPartnerStores();
      const matchingStore = allStores.find(s => 
        s.name.toLowerCase() === storeName.toLowerCase() &&
        (storeType === "Internal" ? s.isInternal === true : s.isInternal !== true)
      );
      
      // Get partner store products to get color/mockup configurations
      let storeProducts: any[] = [];
      if (matchingStore) {
        storeProducts = await storage.getPartnerStoreProducts(matchingStore.id);
      }
      
      // Create lookup map for partner store product configs by product ID
      const storeProductMap = new Map<string, any>();
      for (const sp of storeProducts) {
        storeProductMap.set(sp.productId, sp);
      }
      
      // Transform to product display format with QR product type detection
      // Five product types: QR Basics, QR Plus, QR Canvas, QR Play, QR Dynamics
      const products = designs.map(d => {
        let qrProductType = "qr-basics"; // Default fallback
        const hasTopText = d.topText && typeof d.topText === 'object' && (d.topText as any).text;
        const hasBottomText = d.bottomText && typeof d.bottomText === 'object' && (d.bottomText as any).text;
        const hasBackground = !!d.backgroundImageUrl;
        const hasVideo = !!(d as any).videoUrl; // Check for video content
        const overlay = d.landingOverlay as any;
        const hasLandingOverlay = overlay?.enabled;
        
        if (d.templateVariant === "plain-text") {
          qrProductType = "qr-basics"; // Text encoded directly in QR
        } else if (d.templateVariant === "dynamics") {
          qrProductType = "qr-dynamics"; // Updateable destination
        } else if (d.templateVariant === "external-url") {
          qrProductType = "qr-basics"; // External URL redirects, similar to basics
        } else if (d.templateVariant === "url") {
          // Hosted landing page - determine subtype
          if (hasVideo) {
            qrProductType = "qr-play"; // Video playback
          } else if (hasBackground || hasLandingOverlay) {
            qrProductType = "qr-canvas"; // Custom background/landing page
          } else if (hasTopText || hasBottomText) {
            qrProductType = "qr-plus"; // Printed text, no background
          } else {
            qrProductType = "qr-canvas"; // Default hosted type
          }
        }
        
        // Get QR code URL for overlay display
        const qrCodeUrl = d.qrCodeUrl || null;
        
        // Get color/mockup data from partner_store_products (primary) or design (fallback)
        // Product ID for custom designs is the design ID prefixed with 'custom_'
        const productId = d.id.startsWith('custom_') ? d.id : `custom_${d.id}`;
        const storeProduct = storeProductMap.get(productId) || storeProductMap.get(d.id);
        
        const selectedColors = storeProduct?.enabledColors || (d as any).selectedColors || null;
        const defaultColor = storeProduct?.defaultColor || (d as any).defaultColor || null;
        const mockupsByColor = storeProduct?.mockupsByColor || (d as any).mockupsByColor || null;
        
        return {
          id: d.id,
          name: d.productName,
          imageUrl: d.productImage || d.printifyCompositeUrl,
          segment: d.segment,
          isFeatured: d.isFeatured,
          isSeasonalPromo: d.isSeasonalPromo,
          templateVariant: d.templateVariant,
          qrProductType,
          qrCodeUrl,
          selectedColors,
          defaultColor,
          mockupsByColor,
          createdAt: d.createdAt,
        };
      });
      
      res.json({
        storeType,
        storeName,
        segment: segment || null,
        products,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC STOREFRONT MOCKUP GENERATION ============
  
  // Public: Generate mockup for a store product color (no admin required)
  // Database-first: checks mockup_cache before generating via Printify
  app.post("/api/storefront/generate-mockup", async (req, res) => {
    try {
      const { productId, color, storeId, qrSize, qrSizePercent } = req.body;
      
      if (!productId || !color) {
        return res.status(400).json({ error: "productId and color are required" });
      }
      
      // Convert qrSizePercent to qrSize name, or use provided qrSize
      let resolvedQrSize: 'small' | 'medium' | 'large' = 'medium';
      if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
        resolvedQrSize = qrSize;
      } else if (qrSizePercent) {
        if (qrSizePercent <= 30) resolvedQrSize = 'small';
        else if (qrSizePercent <= 50) resolvedQrSize = 'medium';
        else resolvedQrSize = 'large';
      }
      
      console.log(`[StorefrontMockup] QR size: ${resolvedQrSize} (from percent: ${qrSizePercent || 'default'})`);
      
      // For custom designs, productId comes as either "hello-world" or "custom_hello-world"
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
      
      // Get the product from products table
      const product = await storage.getProduct(canonicalProductId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const blueprintId = product.blueprintId;
      const printProviderId = product.printProviderId;
      
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      // Check if mockup already exists in product's mockupsByColor
      // New format: mockupsByColor["Black_medium"] or legacy format mockupsByColor["Black"]
      // Normalize color names for comparison (case-insensitive, trim whitespace)
      const existingMockups = (product.mockupsByColor as Record<string, any>) || {};
      const normalizeColor = (c: string) => c.toLowerCase().trim();
      const requestColorNorm = normalizeColor(color);
      
      // Build keys for lookup: color_size_placement (full), color_size, color (legacy)
      const placement = 'front-chest'; // default placement for storefront
      const fullKey = `${color}_${resolvedQrSize}_${placement}`;
      const colorSizeKey = `${color}_${resolvedQrSize}`;
      const fullKeyNorm = `${requestColorNorm}_${resolvedQrSize}_${placement}`;
      const colorSizeKeyNorm = `${requestColorNorm}_${resolvedQrSize}`;
      
      console.log(`[StorefrontMockup] Looking for mockup: full="${fullKey}", size="${colorSizeKey}", color="${color}"`);
      
      // Priority 1: Exact match for color + size + placement
      let existingMockup: any = null;
      let matchedColorKey: string = fullKey;
      let usedFallback = false;
      
      for (const [storedKey, mockup] of Object.entries(existingMockups)) {
        const storedKeyNorm = storedKey.toLowerCase().trim();
        if (storedKeyNorm === fullKeyNorm && mockup && (mockup as any).front) {
          existingMockup = mockup;
          matchedColorKey = storedKey;
          console.log(`[StorefrontMockup] Found EXACT match: "${storedKey}"`);
          break;
        }
      }
      
      // Priority 2: Match color + size (any placement)
      if (!existingMockup) {
        for (const [storedKey, mockup] of Object.entries(existingMockups)) {
          const storedKeyNorm = storedKey.toLowerCase().trim();
          if (storedKeyNorm === colorSizeKeyNorm && mockup && (mockup as any).front) {
            existingMockup = mockup;
            matchedColorKey = storedKey;
            usedFallback = true;
            console.log(`[StorefrontMockup] Found SIZE match: "${storedKey}" (requested: ${fullKey})`);
            break;
          }
        }
      }
      
      // Priority 3: Fallback to any mockup for this color
      if (!existingMockup) {
        for (const [storedKey, mockup] of Object.entries(existingMockups)) {
          const storedKeyNorm = storedKey.toLowerCase().trim();
          const matchesColor = storedKeyNorm === requestColorNorm || 
                               storedKeyNorm.startsWith(`${requestColorNorm}_`);
          if (matchesColor && mockup && (mockup as any).front) {
            existingMockup = mockup;
            matchedColorKey = storedKey;
            usedFallback = true;
            console.log(`[StorefrontMockup] Using COLOR fallback: "${storedKey}" (requested: ${fullKey})`);
            break;
          }
        }
      }
      
      if (existingMockup && existingMockup.front) {
        console.log(`[StorefrontMockup] Using ${usedFallback ? 'fallback' : 'cached'} mockup for "${matchedColorKey}"`);
        
        // Update product's default image and color to show this mockup
        const defaultImage = existingMockup.lifestyle || existingMockup.front;
        await storage.updateProduct(canonicalProductId, {
          defaultColor: color,
          imageUrl: defaultImage,
        });
        console.log(`[StorefrontMockup] Updated product defaultColor=${color}, imageUrl=${defaultImage}`);
        
        return res.json({ 
          success: true, 
          color, 
          graphicSize: resolvedQrSize,
          mockupUrl: existingMockup.front,
          lifestyleMockupUrl: existingMockup.lifestyle || null,
          fromCache: true,
          usedFallback,
          matchedKey: matchedColorKey,
          mockupsByColor: existingMockups 
        });
      }
      
      // Get artwork URL from custom design
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Parse placement images safely
      let designPlacements: Record<string, string> = {};
      try {
        if (typeof design.placementImages === 'string') {
          designPlacements = JSON.parse(design.placementImages);
        } else if (design.placementImages && typeof design.placementImages === 'object') {
          designPlacements = design.placementImages as Record<string, string>;
        }
      } catch (e) {
        console.error('[StorefrontMockup] Failed to parse placementImages:', e);
      }
      
      // Get color hex with fallback chain
      let colorHex: string | null = null;
      
      if (product.availableColors && Array.isArray(product.availableColors)) {
        const colorInfo = (product.availableColors as any[]).find(
          (c: any) => c.name?.toLowerCase() === color.toLowerCase()
        );
        colorHex = colorInfo?.hex || null;
      }
      
      if (!colorHex) {
        const { getProviderColorsWithFallback } = await import('./lib/printify.js');
        const colors = await getProviderColorsWithFallback(blueprintId, printProviderId, storage);
        const colorInfo = colors.find(
          (c: any) => c.name?.toLowerCase() === color.toLowerCase()
        );
        colorHex = colorInfo?.hex || null;
      }
      
      // Determine which artwork to use based on shirt color
      const { isColorDark } = await import('./lib/mockup-service.js');
      const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
      
      // Support multiple naming conventions: front-chest, front-center, or just "front"
      const blackArtwork = designPlacements["front-chest"] || 
                           designPlacements["front-chest-black"] || 
                           designPlacements["front-center"] ||
                           designPlacements["front-center-black"] ||
                           designPlacements["front"];
      const whiteArtwork = designPlacements["front-chest-white"] || 
                           designPlacements["front-center-white"] ||
                           designPlacements["front-white"];
      
      let artworkUrl: string;
      let artworkVariant: "black" | "white" = "black";
      
      console.log(`[StorefrontMockup] Color ${color} hex=${colorHex}, needsWhiteQR=${needsWhiteQR}`);
      console.log(`[StorefrontMockup] Available placements: ${Object.keys(designPlacements).join(', ')}`);
      console.log(`[StorefrontMockup] Black artwork: ${blackArtwork}, White artwork: ${whiteArtwork}`);
      
      if (needsWhiteQR && whiteArtwork) {
        artworkUrl = whiteArtwork;
        artworkVariant = "white";
        console.log(`[StorefrontMockup] Using WHITE artwork for dark shirt: ${color}`);
      } else if (blackArtwork) {
        artworkUrl = blackArtwork;
        artworkVariant = "black";
        console.log(`[StorefrontMockup] Using BLACK artwork for light shirt: ${color}`);
      } else {
        artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
        console.log(`[StorefrontMockup] Using fallback artwork: ${artworkUrl}`);
      }
      
      // Mockup not found in database - check if it's pending in the job queue
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const pendingJobs = await mockupJobQueue.getJobsByProduct(canonicalProductId);
      const colorJobs = pendingJobs.filter(j => 
        j.colorName.toLowerCase() === color.toLowerCase() && 
        ['pending', 'processing', 'delayed'].includes(j.status)
      );
      
      if (colorJobs.length > 0) {
        // Mockup is being generated, return pending status
        console.log(`[StorefrontMockup] Mockup for ${color} is pending (${colorJobs.length} jobs in queue)`);
        return res.json({ 
          success: false, 
          pending: true,
          color, 
          message: `Mockup for ${color} is being generated. Please wait.`,
          jobCount: colorJobs.length
        });
      }
      
      // No mockup exists and none pending - this color wasn't queued
      console.log(`[StorefrontMockup] No mockup found for ${color} and none pending`);
      return res.status(404).json({ 
        error: `No mockup available for ${color}. Mockups are generated when the product is saved.`,
        color 
      });
    } catch (error: any) {
      console.error("[StorefrontMockup] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint: Generate mockups at all 3 sizes for comparison
  // Temporarily public for testing - TODO: add isAdmin back
  app.post("/api/admin/test-mockup-sizes", async (req: any, res) => {
    try {
      const { productId, color } = req.body;
      
      if (!productId || !color) {
        return res.status(400).json({ error: "productId and color are required" });
      }
      
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
      
      const product = await storage.getProduct(canonicalProductId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const { blueprintId, printProviderId } = product;
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Get artwork
      let designPlacements: Record<string, string> = {};
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
      
      // Get color hex
      let colorHex: string | null = null;
      if (product.availableColors && Array.isArray(product.availableColors)) {
        const colorInfo = (product.availableColors as any[]).find(
          (c: any) => c.name?.toLowerCase() === color.toLowerCase()
        );
        colorHex = colorInfo?.hex || null;
      }
      
      const { isColorDark } = await import('./lib/mockup-service.js');
      const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
      
      const blackArtwork = designPlacements["front-chest"] || designPlacements["front-center"] || designPlacements["front"];
      const whiteArtwork = designPlacements["front-chest-white"] || designPlacements["front-center-white"];
      
      const artworkUrl = needsWhiteQR && whiteArtwork ? whiteArtwork : blackArtwork;
      
      if (!artworkUrl) {
        return res.status(400).json({ error: "No artwork found" });
      }
      
      // Generate mockups at all 3 sizes with delays to avoid rate limits
      const { printfulClient } = await import('./lib/printful.js');
      const { printifyPrintfulMapping } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Get Printful mapping
      const mapping = await db.select().from(printifyPrintfulMapping)
        .where(and(
          eq(printifyPrintfulMapping.printifyBlueprintId, blueprintId),
          eq(printifyPrintfulMapping.isActive, true)
        )).limit(1);
      
      if (mapping.length === 0) {
        return res.status(400).json({ error: "No Printful mapping for this blueprint" });
      }
      
      const printfulProductId = mapping[0].printfulProductId;
      const variants = await printfulClient.getVariantsByColor(printfulProductId, color);
      
      if (variants.length === 0) {
        return res.status(400).json({ error: `No Printful variants for color: ${color}` });
      }
      
      const targetVariant = variants.find(v => v.size === 'M') || variants[0];
      const printfiles = await printfulClient.getPrintfiles(printfulProductId);
      const frontPrintfile = printfiles.printfiles?.find((p: any) => p.printfile_id === 1) || printfiles.printfiles?.[0];
      
      const areaWidth = frontPrintfile?.width || 4500;
      const areaHeight = frontPrintfile?.height || 5400;
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "http://localhost:5000";
      const absoluteArtworkUrl = artworkUrl.startsWith("http") ? artworkUrl : `${baseUrl}${artworkUrl}`;
      
      const sizes = [
        { name: 'small', percent: 0.25 },
        { name: 'medium', percent: 0.45 },
        { name: 'large', percent: 0.65 },
      ];
      
      const results: { size: string; qrPixels: number; mockupUrl?: string; lifestyleUrl?: string; error?: string }[] = [];
      
      for (const sizeConfig of sizes) {
        try {
          console.log(`[TestMockupSizes] Generating ${sizeConfig.name} (${Math.round(sizeConfig.percent * 100)}%)...`);
          
          const qrSize = Math.round(areaWidth * sizeConfig.percent);
          
          const position = {
            area_width: areaWidth,
            area_height: areaHeight,
            width: qrSize,
            height: qrSize,
            top: Math.round(areaHeight * 0.15),
            left: Math.round((areaWidth - qrSize) / 2),
          };
          
          const task = await printfulClient.createMockupTask(
            printfulProductId,
            [targetVariant.id],
            [{
              placement: 'front',
              image_url: absoluteArtworkUrl,
              position,
            }],
            'jpg',
            ["Men's Lifestyle"]
          );
          
          if (!task.task_key) {
            results.push({ size: sizeConfig.name, qrPixels: qrSize, error: 'Task creation failed' });
            continue;
          }
          
          const result = await printfulClient.waitForMockupTask(task.task_key, 60000);
          
          if (!result.mockups || result.mockups.length === 0) {
            results.push({ size: sizeConfig.name, qrPixels: qrSize, error: 'No mockups returned' });
            continue;
          }
          
          const mainMockup = result.mockups[0];
          let lifestyleUrl = mainMockup.extra?.find((e: any) => 
            e.option_group?.toLowerCase().includes('lifestyle')
          )?.url;
          
          results.push({
            size: sizeConfig.name,
            qrPixels: qrSize,
            mockupUrl: mainMockup.mockup_url,
            lifestyleUrl: lifestyleUrl || mainMockup.mockup_url,
          });
          
          // Rate limit delay between sizes
          if (sizeConfig !== sizes[sizes.length - 1]) {
            console.log(`[TestMockupSizes] Waiting 3 seconds for rate limit...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (err: any) {
          results.push({ size: sizeConfig.name, qrPixels: 0, error: err.message });
        }
      }
      
      res.json({
        success: true,
        color,
        areaWidth,
        areaHeight,
        results,
      });
    } catch (error: any) {
      console.error("[TestMockupSizes] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ MOCKUP JOB QUEUE ENDPOINTS ============
  // Portable job queue for rate-limited mockup generation

  // Create batch mockup jobs for a product
  // Public - anyone can create a shirt without login
  // Options:
  //   fullGeneration: true = all placements × all QR sizes (for admin catalog products)
  //   placements: ["front-chest", "back"] = specific placements to generate
  //   qrSizes: ["small", "medium", "large"] = specific QR sizes to generate
  app.post("/api/mockup-jobs/batch", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const { productId, fullGeneration = false, placements, qrSizes } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }
      
      // Validate qrSizes if provided
      const validQrSizes = ["small", "medium", "large"];
      if (qrSizes && !qrSizes.every((s: string) => validQrSizes.includes(s))) {
        return res.status(400).json({ error: "qrSizes must be array of 'small', 'medium', or 'large'" });
      }
      
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
      
      const product = await storage.getProduct(canonicalProductId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const { blueprintId, printProviderId, availableColors } = product;
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      const colors = Array.isArray(availableColors) ? availableColors : [];
      if (colors.length === 0) {
        return res.status(400).json({ error: "Product has no colors defined" });
      }
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Get artwork
      let designPlacements: Record<string, string> = {};
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
      
      const blackArtwork = designPlacements["front-chest"] || designPlacements["front-center"] || designPlacements["front"];
      const whiteArtwork = designPlacements["front-chest-white"] || designPlacements["front-center-white"];
      
      if (!blackArtwork) {
        return res.status(400).json({ error: "No artwork found for product" });
      }
      
      // Determine which placements and QR sizes to generate
      const ALL_PLACEMENTS = ["front-chest", "back", "left-shoulder", "right-shoulder"];
      const ALL_QR_SIZES: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
      
      let targetPlacements: string[];
      let targetQrSizes: Array<"small" | "medium" | "large">;
      
      if (fullGeneration) {
        // Admin catalog: generate ALL combinations
        targetPlacements = placements || ALL_PLACEMENTS;
        targetQrSizes = qrSizes || ALL_QR_SIZES;
      } else {
        // Custom order: generate specified or default
        targetPlacements = placements || ["front-chest"];
        targetQrSizes = qrSizes || ALL_QR_SIZES;
      }
      
      // Create jobs for all combinations
      const jobs = await mockupJobQueue.createBatchJobs({
        productId: canonicalProductId,
        colors: colors as Array<{ name: string; hex: string }>,
        qrSizes: targetQrSizes,
        placements: targetPlacements,
        blueprintId,
        printProviderId,
        artworkUrl: blackArtwork,
        artworkVariant: "black",
      });
      
      const totalCombos = `${colors.length} colors × ${targetQrSizes.length} QR sizes × ${targetPlacements.length} placements`;
      
      res.json({
        success: true,
        message: `Created ${jobs.length} mockup jobs (${totalCombos})`,
        jobCount: jobs.length,
        placements: targetPlacements,
        qrSizes: targetQrSizes,
        colorCount: colors.length,
        jobIds: jobs.map(j => j.id),
      });
    } catch (error: any) {
      console.error("[MockupJobQueue] Batch create error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get queue stats - public
  app.get("/api/mockup-jobs/stats", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const stats = await mockupJobQueue.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get jobs for a product - public
  app.get("/api/mockup-jobs/product/:productId", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const { productId } = req.params;
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const jobs = await mockupJobQueue.getJobsByProduct(canonicalProductId);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single job status - public
  app.get("/api/mockup-jobs/:jobId", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const job = await mockupJobQueue.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Priority bump for a specific color + QR size + placement combo (public - for customer UX)
  app.post("/api/mockup-jobs/prioritize", async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const { productId, colorName, qrSize, placement, viewerId } = req.body;
      
      if (!productId || !colorName || !qrSize || !placement || !viewerId) {
        return res.status(400).json({ error: "Missing required fields: productId, colorName, qrSize, placement, viewerId" });
      }
      
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const job = await mockupJobQueue.bumpPriority({
        productId: canonicalProductId,
        colorName,
        qrSize,
        placement,
        viewerId,
      });
      
      if (!job) {
        return res.status(404).json({ error: "Job not found for this color/size combination" });
      }
      
      res.json({ 
        success: true, 
        jobId: job.id, 
        status: job.status,
        priority: job.priority,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel pending jobs for a product - admin only (prevent abuse)
  app.delete("/api/mockup-jobs/product/:productId", isAdmin, async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const { productId } = req.params;
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const cancelled = await mockupJobQueue.cancelJobsByProduct(canonicalProductId);
      res.json({ success: true, cancelledCount: cancelled });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start/stop worker (admin control)
  app.post("/api/admin/mockup-jobs/worker/:action", isAdmin, async (req: any, res) => {
    try {
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      const { action } = req.params;
      
      if (action === "start") {
        mockupJobQueue.startWorker();
        res.json({ success: true, message: "Worker started" });
      } else if (action === "stop") {
        mockupJobQueue.stopWorker();
        res.json({ success: true, message: "Worker stopped" });
      } else {
        res.status(400).json({ error: "Action must be 'start' or 'stop'" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ DYNAMIC PAGES ENDPOINTS ============
  
  // Get user's dynamic pages with active image info
  app.get("/api/dynamic-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pages = await storage.getDynamicPagesByUser(userId);
      
      // Enrich pages with active image data
      const enrichedPages = await Promise.all(pages.map(async (page) => {
        let activeImage = null;
        if (page.activeAssetId) {
          const assets = await storage.getDynamicPageAssets(page.id);
          const activeAsset = assets.find(a => a.id === page.activeAssetId);
          if (activeAsset && activeAsset.hostedImageId) {
            const image = await storage.getHostedImage(activeAsset.hostedImageId);
            if (image) {
              activeImage = {
                url: `/api/images/${image.id}`,
                title: activeAsset.title || image.title,
              };
            }
          }
        }
        return { ...page, activeImage };
      }));
      
      res.json(enrichedPages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single dynamic page by ID (auth required)
  app.get("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assets = await storage.getDynamicPageAssets(page.id);
      res.json({ ...page, assets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new dynamic page
  app.post("/api/dynamic-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, hostingTierId } = req.body;
      
      // Generate unique slug
      const slug = crypto.randomUUID();
      
      // Calculate expiration based on hosting tier
      let expiresAt: Date | null = null;
      if (hostingTierId) {
        const tier = await storage.getHostingTier(hostingTierId);
        if (tier && tier.code !== "permanent") {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + tier.durationDays);
        }
      }
      
      const page = await storage.createDynamicPage({
        userId,
        slug,
        title,
        description,
        hostingTierId,
        expiresAt,
        status: "active",
      });
      
      res.status(201).json(page);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create dynamic page from builder (with content config)
  app.post("/api/dynamic-pages/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        title, 
        description, 
        backgroundUrl, 
        backgroundType, 
        overlayPosition, 
        overlayColor, 
        overlayFontFamily,
        productId,
        qrState 
      } = req.body;
      
      // Generate unique slug
      const slug = crypto.randomUUID();
      
      // Store content config in description as JSON for now
      const contentConfig = JSON.stringify({
        backgroundUrl,
        backgroundType: backgroundType || "image",
        overlayPosition: overlayPosition || "bottom",
        overlayColor: overlayColor || "#ffffff",
        overlayFontFamily: overlayFontFamily || "Arial",
        productId,
        qrState,
      });
      
      const page = await storage.createDynamicPage({
        userId,
        slug,
        title: title || "Untitled",
        description: contentConfig,
        status: "active",
      });
      
      // Build the public URL
      const baseUrl = process.env.NODE_ENV === "production" 
        ? "https://qrgear-c1ffd.web.app"
        : `http://localhost:${process.env.PORT || 5000}`;
      
      res.status(201).json({
        id: page.id,
        slug: page.slug,
        url: `${baseUrl}/p/${page.slug}`,
        createdAt: page.createdAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a dynamic page
  app.put("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateDynamicPage(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a dynamic page
  app.delete("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteDynamicPage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get assets for a dynamic page
  app.get("/api/dynamic-pages/:id/assets", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assets = await storage.getDynamicPageAssets(page.id);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add a new asset to a dynamic page (upload new image)
  app.post("/api/dynamic-pages/:id/assets", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { hostedImageId, title, setAsActive } = req.body;
      
      const asset = await storage.createDynamicPageAsset({
        pageId: page.id,
        hostedImageId,
        title,
        isActive: false,
      });
      
      // Optionally set this as the active asset
      if (setAsActive) {
        await storage.setActiveAsset(page.id, asset.id);
      }
      
      res.status(201).json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Set active asset for a dynamic page (swap image)
  app.post("/api/dynamic-pages/:id/set-active", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { assetId } = req.body;
      await storage.setActiveAsset(page.id, assetId);
      
      const updatedPage = await storage.getDynamicPage(page.id);
      res.json(updatedPage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public dynamic page viewer
  app.get("/api/dynamic/:slug", async (req, res) => {
    try {
      const page = await storage.getDynamicPageBySlug(req.params.slug);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      if (page.status !== "active") {
        return res.status(410).json({ error: "This page is no longer available" });
      }
      if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This page has expired" });
      }
      
      // Increment views
      await storage.incrementDynamicPageViews(page.id);
      
      // Get active asset with hosted image details
      let activeImage = null;
      if (page.activeAssetId) {
        const asset = await storage.getDynamicPageAsset(page.activeAssetId);
        if (asset) {
          activeImage = await storage.getHostedImage(asset.hostedImageId);
        }
      }
      
      res.json({
        title: page.title,
        description: page.description,
        image: activeImage ? {
          url: activeImage.publicUrl,
          title: activeImage.title,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HOSTING TIERS ENDPOINTS ============
  
  // Get all hosting tiers
  app.get("/api/hosting-tiers", async (req, res) => {
    try {
      const tiers = await storage.getHostingTiers();
      res.json(tiers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default hosting tiers (admin only)
  app.post("/api/admin/hosting-tiers/seed", isAdmin, async (req, res) => {
    try {
      const existingTiers = await storage.getHostingTiers();
      if (existingTiers.length > 0) {
        return res.json({ message: "Hosting tiers already exist", tiers: existingTiers });
      }

      const defaultTiers = [
        { code: "1_year", name: "1 Year", description: "Standard hosting", durationDays: 365, isIncluded: false, priceUpcharge: "5", sortOrder: 1 },
        { code: "2_year", name: "2 Years", description: "Save with 2-year commitment", durationDays: 730, isIncluded: false, priceUpcharge: "8", sortOrder: 2 },
        { code: "3_year", name: "3 Years", description: "Best value - 3-year hosting", durationDays: 1095, isIncluded: false, priceUpcharge: "10", sortOrder: 3 },
      ];

      const createdTiers = [];
      for (const tier of defaultTiers) {
        const created = await storage.createHostingTier(tier);
        createdTiers.push(created);
      }

      res.json({ message: "Default hosting tiers created", tiers: createdTiers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed channel items for testing (admin only)
  app.post("/api/admin/channel-items/seed", isAdmin, async (req: any, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }
      
      const { upsertChannelItem } = await import("./lib/channelItemsService");
      
      const testItems = [
        {
          channelId,
          packetId: `test-packet-1-${Date.now()}`,
          title: "Welcome QR Card",
          description: "Custom welcome card with your brand",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fwelcome-card.png?alt=media",
          collectionTag: "Official",
        },
        {
          channelId,
          packetId: `test-packet-2-${Date.now()}`,
          title: "Event Promo",
          description: "Promote your upcoming events",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fevent-promo.png?alt=media",
          collectionTag: "Events",
        },
        {
          channelId,
          packetId: `test-packet-3-${Date.now()}`,
          title: "Contact Card",
          description: "Digital contact card with QR code",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fcontact-card.png?alt=media",
        },
      ];
      
      const created = [];
      for (const item of testItems) {
        const result = await upsertChannelItem(item);
        created.push(result);
      }
      
      console.log(`[ChannelItems] Seeded ${created.length} items for channel ${channelId}`);
      res.json({ ok: true, message: `Seeded ${created.length} items`, items: created });
    } catch (error: any) {
      console.error("[ChannelItems] Seed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate social images for a channel item (admin only)
  app.post("/api/admin/channel-items/:itemId/regenerate-assets", isAdmin, async (req: any, res) => {
    try {
      const { itemId } = req.params;
      
      const { getChannelItem } = await import("./lib/channelItemsService");
      const { generateAndUploadSocialImages } = await import("./lib/social-image-generator");
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const { generateShareCaption } = await import("./lib/channelItemsService");
      
      const item = await getChannelItem(itemId);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const baseUrl = process.env.VITE_BASE_URL || 'https://qrgear-c1ffd.web.app';
      const fullShareUrl = item.shareUrl.startsWith('http') ? item.shareUrl : `${baseUrl}${item.shareUrl}`;
      
      const socialImages = await generateAndUploadSocialImages({
        title: item.title,
        description: item.description,
        previewImageUrl: item.previewImageUrl,
        packetId: item.packetId,
        shareUrl: fullShareUrl,
      });
      
      const shareCaption = generateShareCaption(item.title, item.description, fullShareUrl);
      
      const db = getFirestoreDb();
      await db.collection('channel_items').doc(itemId).update({
        shareImageSquareUrl: socialImages.squareUrl || null,
        shareImageLinkUrl: socialImages.linkPreviewUrl || null,
        shareCaption,
        updatedAt: new Date(),
      });
      
      console.log(`[ChannelItems] Regenerated social assets for item ${itemId}`);
      res.json({ 
        ok: true, 
        shareImageSquareUrl: socialImages.squareUrl,
        shareImageLinkUrl: socialImages.linkPreviewUrl,
        shareCaption,
      });
    } catch (error: any) {
      console.error("[ChannelItems] Regenerate assets error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update hosting tier (admin only)
  app.put("/api/admin/hosting-tiers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        durationDays: z.number().optional(),
        priceUpcharge: z.string().optional(),
        isIncluded: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateHostingTier(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Hosting tier not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Get all hosting tiers (admin - includes inactive)
  app.get("/api/admin/hosting-tiers", isAdmin, async (req, res) => {
    try {
      const tiers = await storage.getHostingTiers();
      res.json(tiers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create new hosting tier (admin only)
  app.post("/api/admin/hosting-tiers", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        durationDays: z.number().min(1),
        priceUpcharge: z.string().optional().default("0"),
        isIncluded: z.boolean().optional().default(false),
        isActive: z.boolean().optional().default(true),
        sortOrder: z.number().optional().default(0),
      });
      const validated = createSchema.parse(req.body);
      const tier = await storage.createHostingTier(validated);
      res.json(tier);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete hosting tier (admin only)
  app.delete("/api/admin/hosting-tiers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHostingTier(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ DASHBOARD & ANALYTICS ENDPOINTS ============

  // Get dashboard metrics (admin only)
  app.get("/api/admin/dashboard/metrics", isAdmin, async (req, res) => {
    try {
      // Get order statistics
      const orders = await storage.getOrders();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;
      let pendingOrders = 0;
      let inProductionOrders = 0;
      let shippedOrders = 0;

      for (const order of orders) {
        const orderDate = order.createdAt ? new Date(order.createdAt) : null;
        const amount = parseFloat(order.total || "0");
        
        if (orderDate && orderDate >= today) todayRevenue += amount;
        if (orderDate && orderDate >= weekAgo) weekRevenue += amount;
        if (orderDate && orderDate >= monthAgo) monthRevenue += amount;
        
        if (order.status === "pending") pendingOrders++;
        if (order.status === "in_production") inProductionOrders++;
        if (order.status === "shipped") shippedOrders++;
      }

      // Get customer count
      const users = await storage.getUsers();
      const newUsersThisWeek = users.filter(u => {
        const created = u.createdAt ? new Date(u.createdAt) : null;
        return created && created >= weekAgo;
      }).length;

      // Get product count
      const products = await storage.getProducts();
      const activeProducts = products.filter(p => p.isEnabled !== false).length;

      res.json({
        revenue: {
          today: todayRevenue,
          week: weekRevenue,
          month: monthRevenue,
          trend: 0, // Would calculate vs previous period
        },
        orders: {
          total: orders.length,
          pending: pendingOrders,
          inProduction: inProductionOrders,
          shipped: shippedOrders,
          trend: 0,
        },
        customers: {
          total: users.length,
          newThisWeek: newUsersThisWeek,
          returning: users.length - newUsersThisWeek,
        },
        products: {
          active: activeProducts,
          lowStock: 0,
          syncErrors: 0,
        },
        health: await checkProviderHealth(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ UNIFIED ORDERS ENDPOINTS ============

  // Get all unified orders (admin only)
  app.get("/api/admin/orders-unified", isAdmin, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single unified order (admin only)
  app.get("/api/admin/orders-unified/:id", isAdmin, async (req, res) => {
    try {
      const order = await storage.getOrderUnified(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update unified order status (admin only)
  app.patch("/api/admin/orders-unified/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, trackingNumber, trackingUrl, routedProvider, providerOrderId, productionCost, profit, notes } = req.body;
      
      // Get current order for status history
      const currentOrder = await storage.getOrderUnified(id);
      if (!currentOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Build status history entry
      let statusHistory = (currentOrder.statusHistory as Array<{status: string; timestamp: string; note?: string}>) || [];
      if (status && status !== currentOrder.status) {
        statusHistory = [
          ...statusHistory,
          { status, timestamp: new Date().toISOString(), note: notes || undefined }
        ];
      }

      const updates: Record<string, any> = {};
      if (status) updates.status = status;
      if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
      if (trackingUrl !== undefined) updates.trackingUrl = trackingUrl;
      if (routedProvider !== undefined) updates.routedProvider = routedProvider;
      if (providerOrderId !== undefined) updates.providerOrderId = providerOrderId;
      if (productionCost !== undefined) updates.productionCost = productionCost;
      if (profit !== undefined) updates.profit = profit;
      if (statusHistory.length > 0) updates.statusHistory = statusHistory;

      // Update timestamps for special statuses
      if (status === "shipped" && !currentOrder.shippedAt) {
        updates.shippedAt = new Date();
      }
      if (status === "delivered" && !currentOrder.deliveredAt) {
        updates.deliveredAt = new Date();
      }

      const updated = await storage.updateOrderUnified(id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync order status from Printify (admin only)
  app.post("/api/admin/orders-unified/:id/sync-printify", isAdmin, async (req, res) => {
    try {
      const order = await storage.getOrderUnified(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (!order.providerOrderId || order.routedProvider !== "printify") {
        return res.status(400).json({ error: "Order is not routed to Printify" });
      }

      // Call Printify to get order status
      const printifyStatus = await checkPrintifyOrderStatus(order.providerOrderId);
      
      if (printifyStatus) {
        const updates: Record<string, any> = {};
        
        // Map Printify status to our status
        const statusMap: Record<string, string> = {
          "pending": "pending",
          "on-hold": "pending",
          "payment-not-received": "pending",
          "in-production": "in_production",
          "fulfilled": "shipped",
          "canceled": "cancelled",
        };
        
        if (printifyStatus.status) {
          updates.status = statusMap[printifyStatus.status] || printifyStatus.status;
        }
        if (printifyStatus.trackingNumber) {
          updates.trackingNumber = printifyStatus.trackingNumber;
        }
        if (printifyStatus.trackingUrl) {
          updates.trackingUrl = printifyStatus.trackingUrl;
        }

        const updated = await storage.updateOrderUnified(req.params.id, updates);
        res.json({ synced: true, order: updated });
      } else {
        res.json({ synced: false, message: "Could not fetch status from Printify" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CUSTOMERS ENDPOINTS ============

  // Get all customers with stats (admin only)
  app.get("/api/admin/customers", isAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      const orders = await storage.getOrders();

      // Calculate stats per user
      const customerStats = users.map(user => {
        const userOrders = orders.filter(o => o.customerEmail === user.email);
        const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
        const lastOrder = userOrders.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })[0];

        return {
          ...user,
          orderCount: userOrders.length,
          totalSpent,
          lastOrderDate: lastOrder?.createdAt?.toISOString() || null,
        };
      });

      // Sort by total spent descending
      customerStats.sort((a, b) => b.totalSpent - a.totalSpent);

      res.json(customerStats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single customer with orders (admin only)
  app.get("/api/admin/customers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const orders = await storage.getOrders();
      const userOrders = orders.filter(o => o.customerEmail === user.email);
      const totalSpent = userOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const lastOrder = userOrders[0];

      res.json({
        customer: {
          ...user,
          orderCount: userOrders.length,
          totalSpent,
          lastOrderDate: lastOrder?.createdAt?.toISOString() || null,
        },
        recentOrders: userOrders.slice(0, 10),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SYSTEM HEALTH ENDPOINTS ============

  // Get system health overview (admin only)
  app.get("/api/admin/health", isAdmin, async (req, res) => {
    try {
      // Get recent health logs from storage
      const healthLogs = await storage.getProviderHealthLogs(50);

      // Calculate provider status from recent logs
      const providerStatus: Record<string, { healthy: number; total: number; lastCheck: Date | null; avgResponse: number }> = {};
      
      for (const log of healthLogs) {
        const provider = log.providerType;
        if (!providerStatus[provider]) {
          providerStatus[provider] = { healthy: 0, total: 0, lastCheck: null, avgResponse: 0 };
        }
        providerStatus[provider].total++;
        if (log.isHealthy) providerStatus[provider].healthy++;
        if (!providerStatus[provider].lastCheck || log.checkTime > providerStatus[provider].lastCheck) {
          providerStatus[provider].lastCheck = log.checkTime;
        }
        if (log.responseTimeMs) {
          providerStatus[provider].avgResponse += log.responseTimeMs;
        }
      }

      const providers = Object.entries(providerStatus).map(([provider, stats]) => {
        const successRate = stats.total > 0 ? (stats.healthy / stats.total) * 100 : 100;
        let status: "healthy" | "degraded" | "down" = "healthy";
        if (successRate < 50) status = "down";
        else if (successRate < 90) status = "degraded";

        return {
          provider,
          status,
          lastCheck: stats.lastCheck?.toISOString() || new Date().toISOString(),
          responseMs: stats.total > 0 ? Math.round(stats.avgResponse / stats.total) : 0,
          successRate: Math.round(successRate * 10) / 10,
          recentErrors: stats.total - stats.healthy,
        };
      });

      // Default providers if no logs
      if (providers.length === 0) {
        providers.push(
          { provider: "printify", status: "healthy", lastCheck: new Date().toISOString(), responseMs: 200, successRate: 100, recentErrors: 0 },
          { provider: "stripe", status: "healthy", lastCheck: new Date().toISOString(), responseMs: 100, successRate: 100, recentErrors: 0 }
        );
      }

      res.json({
        providers,
        recentLogs: healthLogs.slice(0, 20),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ COUPONS ENDPOINTS ============

  // Get all coupons (admin only)
  app.get("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const coupons = await storage.getCoupons();
      res.json(coupons);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create coupon (admin only) - syncs with Stripe
  app.post("/api/admin/coupons", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        code: z.string().min(1).max(50),
        name: z.string().min(1),
        discountType: z.enum(["percent", "fixed"]),
        discountValue: z.string().refine(val => parseFloat(val) > 0, "Must be greater than 0"),
        currency: z.string().optional().default("usd"),
        minOrderAmount: z.string().nullable().optional(),
        maxRedemptions: z.number().nullable().optional(),
        validFrom: z.string().nullable().optional(),
        validUntil: z.string().nullable().optional(),
        isActive: z.boolean().optional().default(true),
      });

      const validated = createSchema.parse(req.body);

      // Check for duplicate code
      const existing = await storage.getCouponByCode(validated.code);
      if (existing) {
        return res.status(409).json({ error: "A coupon with this code already exists" });
      }

      // Try to create in Stripe
      let stripeCouponId: string | null = null;
      let stripePromotionCodeId: string | null = null;

      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();

        // Create Stripe coupon
        const stripeCoupon = await stripe.coupons.create({
          ...(validated.discountType === "percent"
            ? { percent_off: parseFloat(validated.discountValue) }
            : { amount_off: Math.round(parseFloat(validated.discountValue) * 100), currency: validated.currency }),
          name: validated.name,
          ...(validated.validUntil && { redeem_by: Math.floor(new Date(validated.validUntil).getTime() / 1000) }),
          ...(validated.maxRedemptions && { max_redemptions: validated.maxRedemptions }),
        });
        stripeCouponId = stripeCoupon.id;

        // Create promotion code (customer-facing code)
        const promoCode = await stripe.promotionCodes.create({
          promotion: {
            type: 'coupon',
            coupon: stripeCoupon.id,
          },
          code: validated.code.toUpperCase(),
          active: validated.isActive,
        });
        stripePromotionCodeId = promoCode.id;
      } catch (stripeError: any) {
        console.error("Stripe coupon creation failed:", stripeError.message);
        // Continue without Stripe sync - coupon will work locally
      }

      const coupon = await storage.createCoupon({
        code: validated.code,
        name: validated.name,
        discountType: validated.discountType,
        discountValue: validated.discountValue,
        currency: validated.currency,
        minOrderAmount: validated.minOrderAmount ?? null,
        maxRedemptions: validated.maxRedemptions ?? null,
        validFrom: validated.validFrom ? new Date(validated.validFrom) : null,
        validUntil: validated.validUntil ? new Date(validated.validUntil) : null,
        stripeCouponId,
        stripePromotionCodeId,
        isActive: validated.isActive,
      });

      res.json(coupon);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update coupon (admin only)
  app.put("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        maxRedemptions: z.number().nullable().optional(),
        validUntil: z.string().nullable().optional(),
      });

      const validated = updateSchema.parse(req.body);
      
      // Update Stripe promotion code if we have one
      const existingCoupon = await storage.getCoupon(id);
      if (existingCoupon?.stripePromotionCodeId && validated.isActive !== undefined) {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();
          await stripe.promotionCodes.update(existingCoupon.stripePromotionCodeId, {
            active: validated.isActive,
          });
        } catch (stripeError: any) {
          console.error("Stripe promo code update failed:", stripeError.message);
        }
      }

      const updated = await storage.updateCoupon(id, {
        ...(validated.name && { name: validated.name }),
        ...(validated.isActive !== undefined && { isActive: validated.isActive }),
        ...(validated.maxRedemptions !== undefined && { maxRedemptions: validated.maxRedemptions }),
        ...(validated.validUntil !== undefined && { validUntil: validated.validUntil ? new Date(validated.validUntil) : null }),
      });

      if (!updated) {
        return res.status(404).json({ error: "Coupon not found" });
      }

      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Delete coupon (admin only)
  app.delete("/api/admin/coupons/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Deactivate in Stripe if we have a promo code
      const existingCoupon = await storage.getCoupon(id);
      if (existingCoupon?.stripePromotionCodeId) {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();
          await stripe.promotionCodes.update(existingCoupon.stripePromotionCodeId, {
            active: false,
          });
        } catch (stripeError: any) {
          console.error("Stripe promo code deactivation failed:", stripeError.message);
        }
      }

      await storage.deleteCoupon(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate coupon code (public - for cart/checkout)
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const validateSchema = z.object({
        code: z.string().min(1),
        orderTotal: z.number().optional(),
      });

      const { code, orderTotal } = validateSchema.parse(req.body);
      const coupon = await storage.getCouponByCode(code);

      if (!coupon) {
        return res.status(404).json({ valid: false, error: "Invalid coupon code" });
      }

      if (!coupon.isActive) {
        return res.status(400).json({ valid: false, error: "This coupon is no longer active" });
      }

      const now = new Date();
      if (coupon.validFrom && now < new Date(coupon.validFrom)) {
        return res.status(400).json({ valid: false, error: "This coupon is not yet active" });
      }

      if (coupon.validUntil && now > new Date(coupon.validUntil)) {
        return res.status(400).json({ valid: false, error: "This coupon has expired" });
      }

      if (coupon.maxRedemptions && (coupon.redemptionCount || 0) >= coupon.maxRedemptions) {
        return res.status(400).json({ valid: false, error: "This coupon has reached its usage limit" });
      }

      if (coupon.minOrderAmount && orderTotal && orderTotal < parseFloat(coupon.minOrderAmount)) {
        return res.status(400).json({ 
          valid: false, 
          error: `Minimum order of $${coupon.minOrderAmount} required for this coupon` 
        });
      }

      // Calculate discount
      let discountAmount = 0;
      if (orderTotal) {
        if (coupon.discountType === "percent") {
          discountAmount = orderTotal * (parseFloat(coupon.discountValue) / 100);
        } else {
          discountAmount = Math.min(parseFloat(coupon.discountValue), orderTotal);
        }
      }

      res.json({
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          stripePromotionCodeId: coupon.stripePromotionCodeId,
        },
        discountAmount: discountAmount.toFixed(2),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ valid: false, error: error.errors });
      }
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // ============ QR TEMPLATES ENDPOINTS ============
  
  // Get active templates for customers
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getActiveQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all templates
  app.get("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const templates = await storage.getQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create template
  app.post("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url(),
        fullImageUrl: z.string().url(),
        storageUrl: z.string().url(),
        priceUpcharge: z.string().optional().default("0"),
        isActive: z.boolean().optional().default(true),
        isFeatured: z.boolean().optional().default(false),
      });
      
      const validatedData = createSchema.parse(req.body);
      const template = await storage.createQrTemplate(validatedData);
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update template
  app.put("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url().optional(),
        fullImageUrl: z.string().url().optional(),
        storageUrl: z.string().url().optional(),
        priceUpcharge: z.string().optional(),
        isActive: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const template = await storage.updateQrTemplate(id, validatedData);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete template
  app.delete("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQrTemplate(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create template with full mockup generation
  // This is for admin-only batch generation of all color/placement/size combinations
  app.post("/api/admin/templates/full-save", isAdmin, async (req, res) => {
    try {
      const templatePricingSchema = z.object({
        baseProductCost: z.number(),
        placementCost: z.number(),
        textUpcharge: z.number(),
        hostingCost: z.number(),
        subtotal: z.number(),
        markupAmount: z.number(),
        customerPrice: z.number(),
        hostingTierCode: z.string(),
      }).nullable().optional();

      const fullSaveSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        productId: z.string(),
        blueprintId: z.number(),
        printProviderId: z.number(),
        colors: z.array(z.object({
          name: z.string(),
          hex: z.string(),
        })),
        placements: z.array(z.string()).default(["front"]),
        qrSizes: z.array(z.enum(["small", "medium", "large"])).default(["small", "medium", "large"]),
        artworkUrl: z.string().optional().default(""),
        artworkVariant: z.enum(["black", "white"]).default("black"),
        thumbnailUrl: z.string().optional(),
        storeId: z.string().optional(),
        channelId: z.string().optional(),
        qrContent: z.string().optional(),
        pricing: templatePricingSchema,
      });

      const data = fullSaveSchema.parse(req.body);

      // 1. Create the template record with pricing in priceUpcharge
      const customerPrice = data.pricing?.customerPrice?.toFixed(2) || "0";
      const template = await storage.createQrTemplate({
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        thumbnailUrl: data.thumbnailUrl || data.artworkUrl,
        fullImageUrl: data.artworkUrl,
        storageUrl: data.artworkUrl,
        priceUpcharge: customerPrice,
        textStyle: data.pricing ? {
          pricing: data.pricing,
          hostingTierCode: data.pricing.hostingTierCode,
        } : null,
        isActive: true,
        isFeatured: false,
      });

      // 2. Queue batch mockup jobs for all color/placement/size combinations
      const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
      
      // For front and back placements, use all QR sizes
      // For other placements (sleeves, chest), use only large
      const frontBackPlacements = data.placements.filter(p => p === "front" || p === "back");
      const otherPlacements = data.placements.filter(p => p !== "front" && p !== "back");

      const allJobs: any[] = [];

      // Queue jobs for front/back with all QR sizes
      if (frontBackPlacements.length > 0) {
        const jobs = await mockupJobQueue.createBatchJobs({
          productId: data.productId,
          colors: data.colors,
          qrSizes: data.qrSizes,
          placements: frontBackPlacements,
          blueprintId: data.blueprintId,
          printProviderId: data.printProviderId,
          artworkUrl: data.artworkUrl,
          artworkVariant: data.artworkVariant,
        });
        allJobs.push(...jobs);
      }

      // Queue jobs for other placements with only large QR
      if (otherPlacements.length > 0) {
        const jobs = await mockupJobQueue.createBatchJobs({
          productId: data.productId,
          colors: data.colors,
          qrSizes: ["large"],
          placements: otherPlacements,
          blueprintId: data.blueprintId,
          printProviderId: data.printProviderId,
          artworkUrl: data.artworkUrl,
          artworkVariant: data.artworkVariant,
        });
        allJobs.push(...jobs);
      }

      console.log(`[Templates] Created template ${template.id} with ${allJobs.length} mockup jobs queued`);

      res.json({
        success: true,
        template,
        jobsQueued: allJobs.length,
        message: `Template created with ${allJobs.length} mockups queued for generation`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("[Templates] Full save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Save graphics (enlarged QR and composite graphic) - NO AUTH REQUIRED
  app.post("/api/test/graphics/save", async (req: any, res) => {
    try {
      const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId, qrContent, pricing } = req.body;

      // URLs are generated after packet creation, so no validation here

      // Build metadata object without undefined values
      const baseMetadata: Record<string, any> = {};
      if (storeId) baseMetadata.storeId = storeId;
      if (channelId) baseMetadata.channelId = channelId;
      if (qrContent) baseMetadata.qrContent = qrContent;
      if (pricing) baseMetadata.pricing = pricing;

      let qrAsset = null;
      let compositeAsset = null;

      // Save QR-only asset if provided
      if (qrOnlyUrl) {
        qrAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - QR Only`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: qrOnlyUrl,
          storageUrl: qrOnlyUrl,
          thumbnailUrl: qrOnlyUrl,
          fileName: `qr-only-${Date.now()}.png`,
          originalName: `qr-only.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "qr-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isQrOnly: true },
        } as any);
      }

      // Save composite asset if provided
      if (compositeUrl) {
        compositeAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - Composite`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: compositeUrl,
          storageUrl: compositeUrl,
          thumbnailUrl: compositeUrl,
          fileName: `composite-${Date.now()}.png`,
          originalName: `composite.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "composite-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isComposite: true },
        } as any);
      }

      const savedParts = [qrAsset ? 'QR' : null, compositeAsset ? 'Composite' : null].filter(Boolean).join(' + ');
      console.log(`[Graphics TEST] Saved: ${savedParts}`);

      res.json({
        success: true,
        qrAssetId: qrAsset?.id || null,
        compositeAssetId: compositeAsset?.id || null,
        message: `Graphics saved to library: ${savedParts}`,
      });
    } catch (error: any) {
      console.error("[Graphics TEST] Error saving graphics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Get mockup queue status - NO AUTH REQUIRED
  app.get("/api/test/queue/status", async (_req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const pendingSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "pending").get();
      const processingSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "processing").get();
      const completedSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "completed").limit(100).get();
      const failedSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "failed").limit(100).get();

      res.json({
        success: true,
        queue: {
          pending: pendingSnapshot.size,
          processing: processingSnapshot.size,
          completed: completedSnapshot.size,
          failed: failedSnapshot.size,
        },
        message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing`,
      });
    } catch (error: any) {
      console.error("[Queue] Error getting status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Get mockups for a template - NO AUTH REQUIRED
  app.get("/api/test/templates/:templateId/mockups", async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      // Get all mockup jobs for this template
      const jobsSnapshot = await firestoreDb.collection("mockupJobs")
        .where("templateId", "==", templateId)
        .get();

      const mockups = jobsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          status: data.status,
          color: data.color,
          size: data.size,
          placement: data.placement,
          mockupUrl: data.mockupUrl || null,
          error: data.error || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        };
      });

      const completed = mockups.filter(m => m.status === "completed");
      const pending = mockups.filter(m => m.status === "pending");
      const processing = mockups.filter(m => m.status === "processing");
      const failed = mockups.filter(m => m.status === "failed");

      res.json({
        success: true,
        templateId,
        summary: {
          total: mockups.length,
          completed: completed.length,
          pending: pending.length,
          processing: processing.length,
          failed: failed.length,
        },
        mockups,
      });
    } catch (error: any) {
      console.error("[Mockups] Error getting mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Get all templates - NO AUTH REQUIRED
  app.get("/api/test/templates", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("productTemplates")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      
      const templates = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        
        // Fetch linked packet data if packetId exists
        let packetData = null;
        if (data.packetId) {
          const packetDoc = await firestoreDb.collection("productPackets").doc(data.packetId).get();
          if (packetDoc.exists) {
            const pData = packetDoc.data();
            packetData = {
              productName: pData?.productName,
              compositeUrl: pData?.compositeUrl,
              qrOnlyUrl: pData?.qrOnlyUrl,
              qrContent: pData?.qrContent,
              qrProductState: pData?.qrProductState,
            };
          }
        }
        
        return {
          id: doc.id,
          ...data,
          packet: packetData,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        };
      }));
      
      console.log(`[Templates TEST] Retrieved ${templates.length} templates`);
      
      res.json({
        success: true,
        templates,
        count: templates.length,
      });
    } catch (error: any) {
      console.error("[Templates TEST] Error getting templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Create template linked to packet - NO AUTH REQUIRED
  app.post("/api/test/templates", async (req: any, res) => {
    try {
      const { 
        packetId, name, productId, blueprintId, printProviderId,
        artworkUrl, thumbnailUrl, qrContent, pricing,
        selectedSize, enabledColors, enabledSizes, defaultColor, isActive
      } = req.body;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("./lib/firebase-admin")).getFirebaseAdmin();
      const now = admin.firestore.FieldValue.serverTimestamp();

      const templateData = {
        packetId,
        name: name || `Template - ${new Date().toLocaleDateString()}`,
        productId: productId || null,
        blueprintId: blueprintId || null,
        printProviderId: printProviderId || null,
        artworkUrl: artworkUrl || null,
        thumbnailUrl: thumbnailUrl || artworkUrl || null,
        qrContent: qrContent || null,
        pricing: pricing || null,
        selectedSize: selectedSize || "medium",
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        defaultColor: defaultColor || null,
        isActive: isActive !== false,
        createdAt: now,
        updatedAt: now,
      };

      const templateRef = await firestoreDb.collection("productTemplates").add(templateData);
      
      console.log(`[Templates TEST] Created template ${templateRef.id} linked to packet ${packetId}`);

      res.json({
        success: true,
        templateId: templateRef.id,
        packetId,
        message: "Template created and linked to packet",
      });
    } catch (error: any) {
      console.error("[Templates TEST] Error creating template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Process pending mockup jobs - NO AUTH REQUIRED
  app.post("/api/test/queue/process", async (req: any, res) => {
    try {
      const { limit = 5 } = req.body;
      const processLimit = Math.min(limit, 20);

      const { getFirestoreDb, getFirebaseAdmin } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();

      // First, recover any stale "processing" jobs (stuck for > 5 minutes)
      // Fetch all processing jobs and filter in code to avoid composite index requirement
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const processingSnapshot = await firestoreDb.collection("mockupJobs")
        .where("status", "==", "processing")
        .limit(50)
        .get();
      
      let recoveredCount = 0;
      for (const doc of processingSnapshot.docs) {
        const data = doc.data();
        const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
        if (startedAt < fiveMinutesAgo) {
          await firestoreDb.collection("mockupJobs").doc(doc.id).update({
            status: "pending",
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[Queue] Recovered stale job ${doc.id}`);
          recoveredCount++;
        }
      }

      // Fetch pending jobs
      const pendingSnapshot = await firestoreDb.collection("mockupJobs")
        .where("status", "==", "pending")
        .limit(processLimit)
        .get();

      if (pendingSnapshot.empty) {
        return res.json({
          success: true,
          processed: 0,
          recovered: recoveredCount,
          message: "No pending jobs in queue",
        });
      }

      console.log(`[Queue] Processing ${pendingSnapshot.size} mockup jobs`);

      const results: Array<{ jobId: string; status: string; error?: string }> = [];

      for (const jobDoc of pendingSnapshot.docs) {
        const job = jobDoc.data();
        const jobId = jobDoc.id;

        try {
          // Atomic claim: Use transaction to ensure only one processor claims this job
          const claimed = await firestoreDb.runTransaction(async (transaction) => {
            const jobRef = firestoreDb.collection("mockupJobs").doc(jobId);
            const freshDoc = await transaction.get(jobRef);
            
            if (!freshDoc.exists || freshDoc.data()?.status !== "pending") {
              return false; // Already claimed by another processor
            }
            
            transaction.update(jobRef, {
              status: "processing",
              startedAt: admin.firestore.FieldValue.serverTimestamp(),
              processorId: `dev-${Date.now()}`,
            });
            return true;
          });

          if (!claimed) {
            console.log(`[Queue] Job ${jobId} already claimed, skipping`);
            continue;
          }

          // Rate limiting: Wait 2 seconds between API calls to avoid hitting Printful limits
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Get template to find artwork URL and blueprint
          const templateDoc = await firestoreDb.collection("productTemplates").doc(job.templateId).get();
          if (!templateDoc.exists) {
            throw new Error(`Template ${job.templateId} not found`);
          }
          const template = templateDoc.data()!;

          // Generate mockup via Printful (use the existing mockup service)
          const { generatePrintfulMockup } = await import("./lib/mockup-service");
          const mockupResult = await generatePrintfulMockup({
            productId: template.productId || job.templateId,
            blueprintId: template.blueprintId || 5,
            printProviderId: template.printProviderId || 39,
            colorName: job.colorName,
            artworkUrl: template.artworkUrl,
            artworkVariant: template.artworkVariant || "black",
            qrSize: job.qrSize || "large",
            fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
          });

          // Check for errors
          if (mockupResult.error) {
            throw new Error(mockupResult.error);
          }

          // Store mockup URL in template's mockupsByColor
          const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
          const placementKey = job.placement || "front";
          const sizeKey = job.qrSize || "large";
          
          const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
          await firestoreDb.collection("productTemplates").doc(job.templateId).update({
            [mockupPath]: mockupResult.mockupUrl || null,
            [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleUrl || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Mark job completed
          await firestoreDb.collection("mockupJobs").doc(jobId).update({
            status: "completed",
            mockupUrl: mockupResult.mockupUrl || null,
            lifestyleUrl: mockupResult.lifestyleUrl || null,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "completed" });
          console.log(`[Queue] Job ${jobId} completed: ${job.colorName} / ${job.placement} / ${job.qrSize}`);

        } catch (error: any) {
          console.error(`[Queue] Job ${jobId} failed:`, error.message);
          
          await firestoreDb.collection("mockupJobs").doc(jobId).update({
            status: "failed",
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "failed", error: error.message });
        }
      }

      const completed = results.filter(r => r.status === "completed").length;
      const failed = results.filter(r => r.status === "failed").length;

      res.json({
        success: true,
        processed: results.length,
        completed,
        failed,
        results,
        message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed`,
      });

    } catch (error: any) {
      console.error("[Queue] Error processing jobs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: List all store-product links - NO AUTH REQUIRED (for debugging)
  app.get("/api/test/store-product-links", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const links = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      console.log(`[Store Links TEST] Listed ${links.length} total links`);
      res.json({ success: true, links, count: links.length });
    } catch (error: any) {
      console.error("[Store Links TEST] Error listing links:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Create store-product link (package linking) - NO AUTH REQUIRED
  app.post("/api/test/store-product-links", async (req: any, res) => {
    try {
      const { 
        storeId, storeName, channel, collection, packetId, templateId, graphicsId, 
        qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
        enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
        qrProductState, landingPageUrl, mockupUrl
      } = req.body;

      console.log("[Store Links TEST] Creating link:", { storeId, channel, packetId, templateId, productName });

      if (!storeId || !channel) {
        return res.status(400).json({ error: "storeId and channel are required" });
      }
      
      if (!packetId && !templateId && !graphicsId) {
        return res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("./lib/firebase-admin")).getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const linkData = {
        storeId,
        storeName: storeName || "",
        channel,
        collection: collection || null,
        packetId: packetId || null,
        templateId: templateId || null,
        graphicsId: graphicsId || null,
        qrContent: qrContent || null,
        productName: productName || null,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        pricing: pricing || null,
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        selectedGraphicSize: selectedGraphicSize || null,
        defaultColor: defaultColor || null,
        qrProductState: qrProductState || null,
        landingPageUrl: landingPageUrl || null,
        mockupUrl: mockupUrl || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const linkRef = await firestoreDb.collection("storeProductLinks").add(linkData);
      
      console.log(`[Store Links TEST] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);

      res.json({
        success: true,
        linkId: linkRef.id,
        message: `Product linked to ${storeName || storeId} / ${channel}`,
      });
    } catch (error: any) {
      console.error("[Store Links TEST] Error creating link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Get products linked to a store/channel - NO AUTH REQUIRED
  app.get("/api/test/stores/:storeId/channels/:channelId/products", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .get();

      const products = linksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          linkId: doc.id,
          packetId: data.packetId || null,
          templateId: data.templateId || null,
          name: data.productName || "Untitled Product",
          imageUrl: data.compositeUrl || data.qrOnlyUrl || null,
          mockupUrl: data.mockupUrl || null,
          qrContent: data.qrContent || null,
          pricing: data.pricing || null,
          enabledColors: data.enabledColors || [],
          enabledSizes: data.enabledSizes || [],
          selectedGraphicSize: data.selectedGraphicSize || null,
          defaultColor: data.defaultColor || null,
          collection: data.collection || null,
          qrProductState: data.qrProductState || null,
          landingPageUrl: data.landingPageUrl || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      console.log(`[Store Links TEST] Found ${products.length} products for ${storeId}/${channelId}`);

      res.json(products);
    } catch (error: any) {
      console.error("[Store Links TEST] Error getting products:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Update a store product link - NO AUTH REQUIRED
  app.patch("/api/test/store-product-links/:linkId", async (req: any, res) => {
    try {
      const { linkId } = req.params;
      const updates = req.body;

      if (!linkId) {
        return res.status(400).json({ error: "linkId is required" });
      }

      const { getFirestoreDb, FieldValue } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("storeProductLinks").doc(linkId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Link not found" });
      }

      await docRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));

      res.json({
        success: true,
        linkId,
        message: "Link updated",
      });
    } catch (error: any) {
      console.error("[Store Links PATCH] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Delete a store product link - NO AUTH REQUIRED
  app.delete("/api/test/store-product-links/:linkId", async (req: any, res) => {
    try {
      const { linkId } = req.params;

      if (!linkId) {
        return res.status(400).json({ error: "linkId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("storeProductLinks").doc(linkId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Link not found" });
      }

      await docRef.delete();
      
      console.log(`[Store Links DELETE] Deleted link ${linkId}`);

      res.json({
        success: true,
        linkId,
        message: "Link deleted",
      });
    } catch (error: any) {
      console.error("[Store Links DELETE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== MEMBER SANDBOX API ==============

  // Save member profile on onboarding completion
  app.post("/api/members/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fullName, storeName, creatorSlug, country, useCase, productInterests, socialSurfaces, primarySocial, socialHandle, attributionSource } = req.body;

      if (!fullName || !storeName || !creatorSlug) {
        return res.status(400).json({ error: "fullName, storeName, and creatorSlug are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      const doc = await db.collection('member_profiles').doc(userId).get();
      res.json({ isMember: doc.exists && doc.data()?.isMember === true });
    } catch (error: any) {
      res.json({ isMember: false });
    }
  });

  // Helper: verify Firebase auth for member endpoints
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
      // Allow if user is accessing their own data OR is admin
      const isOwnData = decodedToken.uid === memberId;
      const isAdmin = decodedToken.email === "perceys@gmail.com"; // TODO: check proper admin list
      
      if (!isOwnData && !isAdmin) {
        return { authorized: false, error: "Access denied" };
      }
      
      return { authorized: true, userId: decodedToken.uid };
    } catch (error: any) {
      return { authorized: false, error: "Invalid token" };
    }
  }

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

      // Get member's uploaded images from hostedImages
      const images = await storage.getHostedImagesByUser(memberId);
      
      // Group images by date or folder (for now, return as single set)
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get channels owned by this member
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

      const { getMockupWithFallback } = await import("./lib/mockup-service");
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        canonicalPlacementId: placement || "FRONT_CHEST",
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

      const { generatePrintifyComposite } = await import("./lib/composite-image-generator");
      
      // Build text objects based on layout choice
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

      // Generate the composite productGraphic (returns data URL)
      const productGraphicDataUrl = await generatePrintifyComposite(
        qrUrl,
        topText,
        bottomText,
        1200,  // width
        1800,  // height
        qrColor as 'black' | 'white'
      );

      console.log(`[ProductGraphic] Generated composite, length: ${productGraphicDataUrl.length}`);

      // Upload to Firebase Storage with DIRECT public URL (no proxy needed)
      // This gives us a URL like: https://storage.googleapis.com/bucket/path.png
      // which Printful can fetch directly - just like qrserver.com URLs work for QR Basic
      const { uploadToFirebasePublic } = await import("./lib/firebase-storage-service");
      const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URL format from composite generator");
      }
      
      const mimeType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Upload to Firebase with public access - returns direct Firebase URL
      const uploadResult = await uploadToFirebasePublic(buffer, mimeType, 'member-graphics');
      
      console.log(`[ProductGraphic] Uploaded to Firebase: ${uploadResult.publicUrl}`);

      res.json({
        success: true,
        productGraphic: uploadResult.publicUrl,  // Direct Firebase URL - Printful can fetch this
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

      const { generatePrintifyComposite } = await import("./lib/composite-image-generator");
      
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

      const { uploadToFirebasePublic } = await import("./lib/firebase-storage-service");
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
  // When a user builds a product in the public wizard then signs up as a member,
  // this endpoint claims the temp packet and returns its config so the member wizard
  // can be pre-populated with the same product choices.
  app.post("/api/members/:memberId/claim-temp-packet", async (req: any, res) => {
    try {
      const { memberId } = req.params;
      const { tempPacketId } = req.body;
      if (!tempPacketId) {
        return res.status(400).json({ error: "tempPacketId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
  // Create a temporary packet for public/owner wizard builds
  app.post("/api/public/packets", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours TTL

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

  // Update a temporary packet as user progresses through wizard
  app.patch("/api/public/packets/:tempPacketId", async (req: any, res) => {
    try {
      const { tempPacketId } = req.params;
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

  // Get a temporary packet
  app.get("/api/public/packets/:tempPacketId", async (req: any, res) => {
    try {
      const { tempPacketId } = req.params;
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

  // Mark a temp packet as completed (after successful sale)
  app.post("/api/public/packets/:tempPacketId/complete", async (req: any, res) => {
    try {
      const { tempPacketId } = req.params;
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

  // Cleanup expired temp packets (can be called by cron or admin)
  app.delete("/api/public/packets/cleanup/expired", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

  // Create Stripe checkout session from a temp packet (no auth required)
  app.post("/api/public/checkout", async (req: any, res) => {
    try {
      const { tempPacketId } = req.body;
      if (!tempPacketId) {
        return res.status(400).json({ error: "Missing tempPacketId" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();

      const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Temp packet not found" });
      }

      const packet = packetDoc.data()!;
      if (packet.status === 'completed') {
        return res.status(400).json({ error: "This packet has already been purchased" });
      }

      // Server-side price re-calculation — never trust client-side price
      const pricingDoc = await db.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;

      const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
      const sizeUpcharges = pricingSettings?.sizeUpcharges || defaultSizeUpcharges;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;

      // Get base retail price from the product data stored on the packet
      const basePrice = parseFloat(packet.retailPrice) || pricingSettings?.baseRetailPrice || 29.99;

      // Calculate size upcharge
      const selectedSize = packet.selectedShirtSize || packet.selectedSize || 'M';
      const sizeUpcharge = sizeUpcharges[selectedSize] || 0;

      // Calculate placement cost (first placement is free)
      const placements = packet.selectedPlacements || ['front'];
      const placementCost = Math.max(0, placements.length - 1) * additionalPlacementCost;

      // Calculate text line cost
      const textLayout = packet.textLayoutChoice || '';
      let textLines = 0;
      if (textLayout === 'both') textLines = 2;
      else if (textLayout === 'header' || textLayout === 'footer') textLines = 1;
      const textCost = textLines * textLineUpcharge;

      // Total server-calculated price
      const serverTotal = Math.round((basePrice + sizeUpcharge + placementCost + textCost) * 100) / 100;

      console.log(`[PublicCheckout] Price validation — base: $${basePrice}, size: +$${sizeUpcharge}, placement: +$${placementCost}, text: +$${textCost}, total: $${serverTotal}`);

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const productTitle = packet.productTitle || 'QR Gear Custom Product';
      const colorName = packet.selectedColor || packet.colorHex || '';
      const qrType = packet.qrType || 'qr-basic';

      const description = [
        `${qrType.replace('qr-', 'QR ').replace(/^\w/, (c: string) => c.toUpperCase())}`,
        colorName ? `Color: ${colorName}` : '',
        `Size: ${selectedSize}`,
      ].filter(Boolean).join(' | ');

      // Use Firebase hosting URL or Replit domain for success/cancel URLs
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
        // Stripe will collect email on checkout page
        customer_creation: 'if_required',
      });

      // Update temp packet with checkout session info
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

  // Verify public checkout and create order (no auth required)
  app.get("/api/public/checkout/verify/:sessionId", async (req: any, res) => {
    try {
      const { sessionId } = req.params;

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const tempPacketId = session.metadata?.tempPacketId;
      if (!tempPacketId) {
        return res.status(400).json({ error: "No packet linked to this session" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const db = getFirestoreDb();

      // Check if order already exists for this session (idempotency)
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

      // Get the temp packet
      const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Temp packet not found" });
      }
      const packet = packetDoc.data()!;

      // Generate unique claim code
      const { generateUniqueClaimCode } = await import('./lib/claimCodeGenerator');
      const claimCode = await generateUniqueClaimCode(db);

      const buyerEmail = (session.customer_details as any)?.email || '';
      const buyerName = (session.customer_details as any)?.name || '';
      const now = new Date();

      // Convert temp packet to real product packet
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
      };
      // Remove temp-specific fields
      delete realPacketData.expiresAt;
      delete realPacketData.checkoutCreatedAt;
      delete realPacketData.serverCalculatedTotal;

      const realPacketRef = await db.collection('product_packets').add(realPacketData);
      console.log(`[PublicCheckout] Real packet created: ${realPacketRef.id} from temp ${tempPacketId}`);

      // Create public order record
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

      // Mark temp packet as completed
      await packetDoc.ref.update({
        status: 'completed',
        completedAt: now.toISOString(),
        realPacketId: realPacketRef.id,
        orderId: orderRef.id,
        updatedAt: now.toISOString(),
      });

      // Also create a unified order for admin tracking
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

      // Send confirmation email
      try {
        const { sendOrderConfirmationEmail } = await import('./lib/email');
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

  // Generate real Printful mockup for public wizard (combines graphic gen + mockup)
  app.post("/api/public/generate-mockup", async (req: any, res) => {
    try {
      const {
        tempPacketId,
        blueprintId,
        printProviderId,
        colorName,
        colorHex,
        placement = 'FRONT_CHEST',
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

      // Step 1: Generate composite artwork if there's text, otherwise use raw QR
      if (textLayoutChoice && textLayoutChoice !== '' && (headerStyle?.text || footerStyle?.text)) {
        console.log(`[PublicMockup] Generating composite artwork with text layout: ${textLayoutChoice}`);
        const { generatePrintifyComposite } = await import("./lib/composite-image-generator");

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

        const { uploadToFirebasePublic } = await import("./lib/firebase-storage-service");
        const match = compositeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          throw new Error("Invalid data URL format from composite generator");
        }

        const buffer = Buffer.from(match[2], 'base64');
        const uploadResult = await uploadToFirebasePublic(buffer, match[1], 'public-graphics');
        artworkUrl = uploadResult.publicUrl;
        console.log(`[PublicMockup] Composite uploaded: ${artworkUrl}`);
      } else {
        // QR Basic - just use a QR code image directly from qrserver.com
        const qrContent = qrUrl || 'https://example.com';
        artworkUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrContent)}&format=png&qzone=2&ecc=H&color=000000&bgcolor=ffffff`;
        console.log(`[PublicMockup] Using raw QR artwork: ${artworkUrl}`);
      }

      // Step 2: Generate Printful mockup
      const { getMockupWithFallback } = await import("./lib/mockup-service");
      const storage = (await import("./storage")).storage;

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

      // Step 3: Update temp packet with mockup data if we have a packet ID
      if (tempPacketId) {
        try {
          const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get products created by this member
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

      const { getFirestoreDb, getStorageBucket } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      // === UNIFIED PACKET FLOW (all 5 QR types) ===
      if (packetType === 'qr-canvas' || packetType === 'qr-play' || packetType === 'qr-basic' || packetType === 'qr-plus' || packetType === 'qr-compose') {

        // Use existing packet ID if provided (created at step 2 for mockup handshake)
        // Otherwise generate a new one, with dedup check as fallback
        const existingPacketId = body.existingPacketId;
        let packetId: string;
        
        if (existingPacketId) {
          packetId = existingPacketId;
          console.log(`[UnifiedPublish] Using existing packet ID from wizard: ${packetId}`);
        } else {
          packetId = `pkt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          // Dedup fallback: check for existing building packet with same member + blueprint + color + qrType
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

        // Create destination URL for QR Canvas/Play landing pages
        const baseUrl = process.env.PUBLIC_URL || 'https://qrgear-c1ffd.web.app';
        const destinationUrl = `${baseUrl}/view/${packetId}`;

        // Generate server-side QR graphic for Canvas/Play (they need landing page URLs)
        let serverQrGraphicUrl = clientQrGraphic || null;
        let serverProductGraphicUrl = clientProductGraphic || null;
        if (packetType === 'qr-canvas' || packetType === 'qr-play') {
          try {
            const { generateTextQRCode } = await import("./lib/qr-generator");
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
              const { generateCompositeImage } = await import("./lib/composite-image-generator");
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
          // Product info
          boundProduct: boundProduct || null,
          selectedColor: selectedColor || null,
          selectedShirtSize: selectedShirtSize || null,
          // Placement info
          selectedPlacements: selectedPlacements || null,
          perPlacementConfigs: perPlacementConfigs || null,
          perPlacementSizes: perPlacementSizes || null,
          graphicSize: graphicSize || null,
          // Text/layout
          textLayoutChoice: textLayoutChoice || null,
          headerStyle: headerStyle || null,
          footerStyle: footerStyle || null,
          // QR content
          qrType: qrType || packetType,
          qrDestination: qrDestination || null,
          qrGraphic: serverQrGraphicUrl || clientQrGraphic || null,
          productGraphic: serverProductGraphicUrl || clientProductGraphic || null,
          // Background/landing
          urlGraphic: background || null,
          originalUrlGraphic: originalUrlGraphic || null,
          // Video
          videoUrl: videoUrl || null,
          destinationUrl: (packetType === 'qr-canvas' || packetType === 'qr-play') ? destinationUrl : null,
          // QR Basic specific
          qrBasicInputType: qrBasicInputType || null,
          qrBasicContent: qrBasicContent || null,
          qrBasicMockup: qrBasicMockup || null,
          qrBasicSaveChoice: qrBasicSaveChoice || null,
          // QR Plus specific
          qrPlusMockup: qrPlusMockup || null,
          qrPlusSaveChoice: qrPlusSaveChoice || null,
          // QR Canvas mockup
          qrCanvasMockup: qrCanvasMockup || null,
          // QR Play mockup
          qrPlayMockup: qrPlayMockup || null,
          // QR Compose
          composeMockup: body.composeMockup || null,
          composeItems: body.composeItems || null,
          composeMode: body.composeMode || 'auto-rotate',
          composeHostingTerm: body.composeHostingTerm || null,
          composeInstanceId: null,
          // Pricing
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get earnings records for this member
      const snapshot = await firestoreDb.collection("memberEarnings")
        .where("memberId", "==", memberId)
        .orderBy("createdAt", "desc")
        .get();

      const earnings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate totals
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
          profitShare: 0.25 // 25%
        }
      });
    } catch (error: any) {
      console.error("[Member Earnings] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get allowed products for members (single global library)
  // Fetches baseCost from provider data if missing, then calculates earnings dynamically
  // Also migrates any Printify URLs to Firebase Storage on-the-fly
  app.get("/api/members/allowed-products", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const { downloadAndStoreFromUrl } = await import("./lib/firebase-storage-service");
      const firestoreDb = getFirestoreDb();
      
      // Read from the "member-products" store's allowed products collection
      const doc = await firestoreDb.collection("storeAllowedProducts").doc("member-products").get();
      
      if (!doc.exists) {
        return res.json({ products: [], message: "No products added to member-products store yet" });
      }
      
      const data = doc.data();
      const storedProducts = data?.products || [];
      
      // Get current pricing settings to calculate earnings dynamically
      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      
      let needsUpdate = false; // Track if we need to persist migrated URLs
      
      // Enrich products with current earnings calculation - fetch baseCost and printProviderId if missing
      const products = await Promise.all(storedProducts.map(async (p: any) => {
        let baseCost = p.baseCost || 0;
        let imageUrl = p.imageUrl;
        let printProviderId = p.printProviderId || null;
        
        // Migrate Printify URLs to Firebase Storage (one-time migration)
        if (imageUrl && imageUrl.includes('images.printify.com')) {
          console.log(`[Member Products] Migrating Printify URL for blueprint ${p.blueprintId}...`);
          const firebaseUrl = await downloadAndStoreFromUrl(imageUrl, `product-blueprint-${p.blueprintId}`);
          if (firebaseUrl) {
            imageUrl = firebaseUrl;
            p.imageUrl = firebaseUrl; // Update in-place for persistence
            needsUpdate = true;
            console.log(`[Member Products] Migrated to: ${firebaseUrl}`);
          }
        }
        
        // If baseCost is 0 or printProviderId is missing, look it up from provider data
        if ((baseCost === 0 || !printProviderId) && p.blueprintId) {
          try {
            const providers = await storage.getPrintifyPrintProviders(p.blueprintId);
            const usaProviders = providers.filter((prov: any) => prov.isUSA);
            const selectedProvider = usaProviders[0] || providers[0];
            if (selectedProvider?.minCost && baseCost === 0) {
              baseCost = selectedProvider.minCost / 100; // Convert cents to dollars
            }
            if (selectedProvider?.providerId && !printProviderId) {
              printProviderId = selectedProvider.providerId;
              p.printProviderId = printProviderId; // Update in-place for persistence
              needsUpdate = true;
            }
          } catch (e) {
            // Fallback: keep values as-is
          }
        }
        
        // Recalculate retail price and earnings based on current settings
        const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
        const profit = retailPrice - baseCost;
        const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
        
        // Always fetch ACTUAL placements from Printify API when possible (they have real dimensions)
        let placements: { id: string; title: string; widthPx?: number; heightPx?: number; widthInches?: string; heightInches?: string }[] = [];
        
        // Fetch ACTUAL placement dimensions from Printify if we have blueprintId + printProviderId
        if (p.blueprintId && printProviderId) {
          try {
            const { printify } = await import("./lib/printify");
            const variantsResult = await printify.getVariants(p.blueprintId, printProviderId);
            const variants = variantsResult.variants || [];
            
            // Extract unique placements with their pixel dimensions
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
            
            // Convert to array with human-readable titles and inch dimensions (300 DPI)
            placements = Array.from(placementMap.entries()).map(([position, dims]) => {
              const widthInches = (dims.widthPx / 300).toFixed(1);
              const heightInches = (dims.heightPx / 300).toFixed(1);
              return {
                id: position,
                title: position.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
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
        
        // If still no placements, use common defaults for apparel products
        // Match naming from adminProducts/builder/types.ts
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
          imageUrl, // Use migrated URL if available
          printProviderId, // Ensure printProviderId is included
          baseCost,
          retailPrice,
          profit,
          memberEarnings,
          placements,
        };
      }));
      
      console.log(`[Member Sandbox] Found ${products.length} products, earnings @ ${memberProfitShare * 100}% share`);
      
      // Persist migrated URLs back to Firestore (one-time migration)
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
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
  app.get("/api/members/common-library", async (req: any, res) => {
    try {
      const { assetType = 'background' } = req.query;
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      let query = firestoreDb.collection('commonLibrary')
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
          category: data.category,
        };
      });
      
      console.log(`[Member Common Library] Found ${assets.length} ${assetType} assets`);
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
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      
      // Parse base64 data
      const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const mimeType = inputMimeType || 'image/png';
      const originalName = inputOriginalName || `upload-${Date.now()}.png`;
      const displayName = name || originalName;
      
      // Determine media type from mime
      const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
      
      // Create member-scoped storage path: members/{memberId}/library/{type}
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
      
      // Save metadata to Firestore
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      
      // Link to original asset if this is a cropped version
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
      
      // Parse base64 data
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
      
      // Save metadata to Firestore
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      
      // Validate mime type
      const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      const mimeType = inputMimeType || 'video/mp4';
      if (!allowedVideoTypes.includes(mimeType)) {
        return res.status(400).json({ error: "Invalid video type. Allowed: MP4, WebM, MOV" });
      }
      
      // Parse base64 data
      const base64Data = videoData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Check size limit (100MB)
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
      
      // Save metadata to Firestore
      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get packet data
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (packet?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      // For now, use the poster URL directly as the share card
      // In the future, we could composite text overlays onto the poster
      const shareCardUrl = packet?.videoSource?.posterUrl || null;
      
      // Update packet with share card URL
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get packet data
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (packet?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      // Create library link
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
      
      // Update packet status
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        status: 'published',
        libraryLinkId,
        updatedAt: new Date().toISOString(),
      });
      
      // Also write to channel_items if channelId is provided (KC widget integration)
      if (channelId) {
        const { upsertChannelItem } = await import("./lib/channelItemsService");
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
      
      const { getStorageBucket, getFirestoreDb } = await import("./lib/firebase-admin");
      const bucket = getStorageBucket();
      const firestoreDb = getFirestoreDb();
      
      // First, look up the asset in Firestore by fileName to get storageUrl
      const snapshot = await firestoreDb.collection('memberLibrary')
        .where('memberId', '==', memberId)
        .where('fileName', '==', decodedFilename)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        if (data.storageUrl) {
          // Extract path from storageUrl (format: gs://bucket/path or just path)
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
      
      // Fallback: Try different possible paths
      const possiblePaths = [
        `members/${memberId}/library/backgrounds/${decodedFilename}`,
        `members/${memberId}/library/cropped/${decodedFilename}`,
        `members/${memberId}/library/videos/${decodedFilename}`,
        // Legacy paths for backwards compatibility
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
  // Packet-first lifecycle: create packet → graphics → template → library link

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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      
      const bucket = (await import("./lib/firebase-admin")).getStorageBucket();
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Verify ownership before delete
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Verify ownership before update
      const doc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      if (doc.data()?.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized to update this packet" });
      }

      // Merge updates with existing data
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

      const { getFirestoreDb, getStorageBucket } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get packet data
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      if (!packetDoc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const packet = packetDoc.data();
      if (!packet || packet.memberId !== memberId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Generate composite image (background + text layers)
      // For now, we'll store a reference - actual rendering would use canvas/sharp
      const graphicsId = `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // For MVP, use background URL as composite (full rendering comes later)
      const compositeUrl = packet.background?.url || null;
      
      const graphicsData = {
        graphicsId,
        packetId,
        memberId,
        compositeUrl,
        qrOnlyUrl: null, // Would be generated if urlContent exists
        status: 'generated',
        createdAt: new Date().toISOString(),
      };

      await firestoreDb.collection('memberGraphics').doc(graphicsId).set(graphicsData);
      
      // Update packet status
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Get full packet data to save as template
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
      
      // Update packet with template reference
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
      
      // Update packet to final status
      await firestoreDb.collection('memberPackets').doc(packetId).update({
        status: 'published',
        libraryLinkId,
        updatedAt: new Date().toISOString(),
      });
      
      // Also write to channel_items if channelId is provided (KC widget integration)
      if (channelId) {
        const { upsertChannelItem } = await import("./lib/channelItemsService");
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

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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

  // ============== BUYER INSTANCES API ==============

  // Get buyer instances for authenticated user
  app.get("/api/buyer/instances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getBuyerInstancesByUserId } = await import('./lib/buyerInstanceService');
      const instances = await getBuyerInstancesByUserId(userId);
      res.json({ instances });
    } catch (error: any) {
      console.error('[BuyerInstances] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single buyer instance
  app.get("/api/buyer/instances/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance, isInstanceActive } = await import('./lib/buyerInstanceService');
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

  // Update instance destination URL
  app.patch("/api/buyer/instances/:instanceId", isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { destinationUrl } = req.body;
      const userId = req.user.claims.sub;
      
      const { getBuyerInstance, updateInstanceDestination } = await import('./lib/buyerInstanceService');
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

  // Create renewal checkout session
  app.post("/api/buyer/instances/:instanceId/renew", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance } = await import('./lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
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
            unit_amount: 499, // $4.99 in cents
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

  // Verify renewal payment and extend hosting
  app.post("/api/buyer/instances/:instanceId/verify-renewal", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { sessionId } = req.body;

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }
      
      if (session.metadata?.instanceId !== instanceId) {
        return res.status(400).json({ error: "Session does not match instance" });
      }

      const { extendInstanceHosting } = await import('./lib/buyerInstanceService');
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

  // Resolve instance for QR scan - returns content or renewal page redirect
  app.get("/api/resolve/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance, isInstanceActive } = await import('./lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: "Instance not found", redirect: "/not-found" });
      }
      
      if (!isInstanceActive(instance)) {
        // Instance expired - redirect to renewal page
        return res.json({ 
          expired: true,
          redirect: `/renew/${instanceId}`,
          message: "Your QR hosting has expired. Please renew to continue."
        });
      }
      
      // Active instance - return content info
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

  // ============== QR DYNAMICS - Channel Content API ==============

  // Get all content (images, videos, documents) for a channel
  app.get("/api/test/stores/:storeId/channels/:channelId/content", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Query dynamicsChannelContent for this channel's explicit content
      const contentSnapshot = await firestoreDb.collection("dynamicsChannelContent")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();

      const explicitContent = contentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Also fetch packets for this store/channel as landing page content
      // Try both exact match and lowercase match for channel ID
      const channelIdLower = channelId.toLowerCase();
      let packetsSnapshot = await firestoreDb.collection("productPackets")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();
      
      // If no results, try lowercase version
      if (packetsSnapshot.empty && channelId !== channelIdLower) {
        packetsSnapshot = await firestoreDb.collection("productPackets")
          .where("storeId", "==", storeId)
          .where("channelId", "==", channelIdLower)
          .get();
      }

      const packetContent = packetsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          // Only include packets that have a landing page snapshot
          if (data.landingPageSnapshotUrl) {
            return {
              id: `packet-${doc.id}`,
              storeId,
              channelId,
              name: data.productName || data.landingPageTitle || 'Landing Page',
              contentType: 'image' as const,
              url: data.landingPageSnapshotUrl,
              thumbnailUrl: data.landingPageSnapshotUrl,
              sourceType: 'packet',
              packetId: doc.id,
              landingPageSlug: data.landingPageSlug,
            };
          }
          return null;
        })
        .filter(Boolean);

      const content = [...explicitContent, ...packetContent];

      console.log(`[ChannelContent] Found ${explicitContent.length} explicit + ${packetContent.length} packets = ${content.length} total for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        content,
        count: content.length 
      });
    } catch (error: any) {
      console.error("[ChannelContent] Error getting content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add content to a channel
  app.post("/api/test/stores/:storeId/channels/:channelId/content", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { name, contentType, url, thumbnailUrl, metadata } = req.body;

      if (!storeId || !channelId || !name || !contentType || !url) {
        return res.status(400).json({ error: "storeId, channelId, name, contentType, and url are required" });
      }

      if (!['image', 'video', 'document'].includes(contentType)) {
        return res.status(400).json({ error: "contentType must be 'image', 'video', or 'document'" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = await firestoreDb.collection("dynamicsChannelContent").add({
        storeId,
        channelId,
        name,
        contentType,
        url,
        thumbnailUrl: thumbnailUrl || url,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[ChannelContent] Created content "${name}" for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        contentId: docRef.id,
        name,
      });
    } catch (error: any) {
      console.error("[ChannelContent] Error creating content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete content from a channel
  app.delete("/api/test/stores/:storeId/channels/:channelId/content/:contentId", async (req: any, res) => {
    try {
      const { storeId, channelId, contentId } = req.params;

      if (!contentId) {
        return res.status(400).json({ error: "contentId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      await firestoreDb.collection("dynamicsChannelContent").doc(contentId).delete();

      console.log(`[ChannelContent] Deleted content ${contentId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[ChannelContent] Error deleting content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Collection Items API ==============

  // Add item to collection
  app.post("/api/test/collections/:collectionId/items", async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;

      if (!collectionId || !contentId || !contentType || !name || !url) {
        return res.status(400).json({ error: "collectionId, contentId, contentType, name, and url are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get current max order
      const existingItems = await firestoreDb.collection("dynamicsCollectionItems")
        .where("collectionId", "==", collectionId)
        .orderBy("order", "desc")
        .limit(1)
        .get();

      const maxOrder = existingItems.empty ? 0 : (existingItems.docs[0].data().order || 0);

      const docRef = await firestoreDb.collection("dynamicsCollectionItems").add({
        collectionId,
        contentId,
        contentType,
        name,
        url,
        thumbnailUrl: thumbnailUrl || url,
        order: maxOrder + 1,
        rotationInterval: rotationInterval || 'daily',
        addedAt: new Date(),
      });

      console.log(`[CollectionItems] Added item to collection ${collectionId}`);

      res.json({ 
        success: true, 
        itemId: docRef.id,
        order: maxOrder + 1,
      });
    } catch (error: any) {
      console.error("[CollectionItems] Error adding item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get items in a collection (by collection ID)
  app.get("/api/test/collections/:collectionId/items", async (req: any, res) => {
    try {
      const { collectionId } = req.params;

      if (!collectionId) {
        return res.status(400).json({ error: "collectionId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const itemsSnapshot = await firestoreDb.collection("dynamicsCollectionItems")
        .where("collectionId", "==", collectionId)
        .orderBy("order", "asc")
        .get();

      const items = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ 
        success: true, 
        items,
        count: items.length 
      });
    } catch (error: any) {
      console.error("[CollectionItems] Error getting items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update collection item (order or interval)
  app.patch("/api/test/collections/:collectionId/items/:itemId", async (req: any, res) => {
    try {
      const { collectionId, itemId } = req.params;
      const { order, rotationInterval } = req.body;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const updateData: any = { updatedAt: new Date() };
      if (order !== undefined) updateData.order = order;
      if (rotationInterval) updateData.rotationInterval = rotationInterval;

      await firestoreDb.collection("dynamicsCollectionItems").doc(itemId).update(updateData);

      console.log(`[CollectionItems] Updated item ${itemId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error updating item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove item from collection
  app.delete("/api/test/collections/:collectionId/items/:itemId", async (req: any, res) => {
    try {
      const { collectionId, itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      await firestoreDb.collection("dynamicsCollectionItems").doc(itemId).delete();

      console.log(`[CollectionItems] Removed item ${itemId} from collection ${collectionId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error removing item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder items in collection
  app.put("/api/test/collections/:collectionId/items/reorder", async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const { itemOrders } = req.body; // Array of { itemId, order }

      if (!collectionId || !itemOrders || !Array.isArray(itemOrders)) {
        return res.status(400).json({ error: "collectionId and itemOrders array are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const batch = firestoreDb.batch();
      
      for (const { itemId, order } of itemOrders) {
        const docRef = firestoreDb.collection("dynamicsCollectionItems").doc(itemId);
        batch.update(docRef, { order, updatedAt: new Date() });
      }

      await batch.commit();

      console.log(`[CollectionItems] Reordered ${itemOrders.length} items in collection ${collectionId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error reordering items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Collections API ==============

  // Get all unique collections for a store/channel
  app.get("/api/test/stores/:storeId/channels/:channelId/collections", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .get();

      const collectionsSet = new Set<string>();
      
      // Get collections from product links
      linksSnapshot.docs.forEach(doc => {
        const collection = doc.data().collection;
        if (collection) {
          collectionsSet.add(collection);
        }
      });

      // Also get explicit collections from dynamicsCollections
      const explicitSnapshot = await firestoreDb.collection("dynamicsCollections")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();

      explicitSnapshot.docs.forEach(doc => {
        const name = doc.data().name;
        if (name) {
          collectionsSet.add(name);
        }
      });

      const collections = Array.from(collectionsSet).sort();

      console.log(`[Collections] Found ${collections.length} collections for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        collections,
        count: collections.length 
      });
    } catch (error: any) {
      console.error("[Collections] Error getting collections:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new collection
  app.post("/api/test/stores/:storeId/channels/:channelId/collections", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { name } = req.body;

      if (!storeId || !channelId || !name) {
        return res.status(400).json({ error: "storeId, channelId, and name are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Check if collection already exists (either as explicit or from links)
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", name)
        .limit(1)
        .get();

      const explicitDoc = await firestoreDb.collection("dynamicsCollections")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .where("name", "==", name)
        .limit(1)
        .get();

      if (!linksSnapshot.empty || !explicitDoc.empty) {
        return res.status(400).json({ error: "Collection already exists" });
      }

      // Create explicit collection record
      const docRef = await firestoreDb.collection("dynamicsCollections").add({
        storeId,
        channelId,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[Collections] Created collection "${name}" for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        collectionId: docRef.id,
        name,
      });
    } catch (error: any) {
      console.error("[Collections] Error creating collection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get items in a specific collection
  app.get("/api/test/stores/:storeId/channels/:channelId/collections/:collectionName/items", async (req: any, res) => {
    try {
      const { storeId, channelId, collectionName } = req.params;

      if (!storeId || !channelId || !collectionName) {
        return res.status(400).json({ error: "storeId, channelId, and collectionName are required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", collectionName)
        .get();

      const items = linksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          linkId: doc.id,
          packetId: data.packetId || null,
          name: data.productName || "Untitled Product",
          imageUrl: data.compositeUrl || data.qrOnlyUrl || null,
          mockupUrl: data.mockupUrl || null,
          qrProductState: data.qrProductState || null,
          landingPageUrl: data.landingPageUrl || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      console.log(`[Collections] Found ${items.length} items in collection ${collectionName} for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        items,
        collection: collectionName,
        count: items.length 
      });
    } catch (error: any) {
      console.error("[Collections] Error getting collection items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Surfaces & Resolver API ==============

  // Create or update a Dynamics surface
  app.post("/api/test/dynamics/surfaces", async (req: any, res) => {
    try {
      const { 
        name, storeId, channelId, collectionName, 
        rotationInterval, timezone, isEnabled 
      } = req.body;

      if (!storeId || !channelId || !collectionName) {
        return res.status(400).json({ error: "storeId, channelId, and collectionName are required" });
      }

      const { getFirestoreDb, FieldValue } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const surfaceData = {
        name: name || `Dynamics - ${collectionName}`,
        storeId,
        channelId,
        collectionName,
        rotationInterval: rotationInterval || "daily",
        timezone: timezone || "America/New_York",
        isEnabled: isEnabled !== false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const surfaceRef = await firestoreDb.collection("qrDynamicsSurfaces").add(surfaceData);

      console.log(`[Dynamics] Created surface: ${surfaceRef.id} for collection ${collectionName}`);

      res.json({
        success: true,
        surfaceId: surfaceRef.id,
        message: `Dynamics surface created for ${collectionName}`,
      });
    } catch (error: any) {
      console.error("[Dynamics] Error creating surface:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all surfaces
  app.get("/api/test/dynamics/surfaces", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("qrDynamicsSurfaces")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const surfaces = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      res.json({ success: true, surfaces, count: surfaces.length });
    } catch (error: any) {
      console.error("[Dynamics] Error listing surfaces:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resolver: Get what should show NOW for a surface
  app.get("/api/test/dynamics/resolve/:surfaceId", async (req: any, res) => {
    try {
      const { surfaceId } = req.params;

      if (!surfaceId) {
        return res.status(400).json({ error: "surfaceId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const surfaceDoc = await firestoreDb.collection("qrDynamicsSurfaces").doc(surfaceId).get();
      
      if (!surfaceDoc.exists) {
        return res.status(404).json({ error: "Surface not found" });
      }

      const surface = surfaceDoc.data() as any;
      
      if (!surface.isEnabled) {
        return res.json({
          success: true,
          surfaceId,
          isEnabled: false,
          activeItem: null,
          message: "Surface is disabled",
        });
      }

      const { storeId, channelId, collectionName, rotationInterval, timezone } = surface;

      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", collectionName)
        .orderBy("createdAt", "asc")
        .get();

      if (linksSnapshot.empty) {
        return res.json({
          success: true,
          surfaceId,
          isEnabled: true,
          activeItem: null,
          message: "No items in collection",
        });
      }

      const items = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      const now = new Date();
      const tz = timezone || "America/New_York";
      
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        weekday: "short",
        hour12: false
      });
      const parts = fmt.formatToParts(now);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
      
      const year = Number(get("year"));
      const month = Number(get("month"));
      const day = Number(get("day"));
      const weekdayStr = get("weekday");

      let indexKey: number;
      
      if (rotationInterval === "daily") {
        indexKey = year * 10000 + month * 100 + day;
      } else if (rotationInterval === "weekly") {
        const startOfYear = new Date(year, 0, 1);
        const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        indexKey = year * 100 + Math.floor(dayOfYear / 7);
      } else {
        indexKey = year * 100 + month;
      }

      const activeIndex = indexKey % items.length;
      const activeItem = items[activeIndex];

      const nextSwitchInfo = rotationInterval === "daily" 
        ? "Midnight (local time)" 
        : rotationInterval === "weekly" 
          ? "Sunday midnight" 
          : "1st of next month";

      console.log(`[Dynamics Resolver] Surface ${surfaceId}: showing item ${activeIndex + 1}/${items.length} (${rotationInterval})`);

      res.json({
        success: true,
        serverNowIso: now.toISOString(),
        surfaceId,
        isEnabled: true,
        rotationInterval,
        timezone: tz,
        totalItems: items.length,
        activeIndex,
        activeItem: {
          id: activeItem.id,
          packetId: (activeItem as any).packetId,
          name: (activeItem as any).productName || "Untitled",
          imageUrl: (activeItem as any).compositeUrl || (activeItem as any).qrOnlyUrl,
          mockupUrl: (activeItem as any).mockupUrl,
          landingPageUrl: (activeItem as any).landingPageUrl,
          qrProductState: (activeItem as any).qrProductState,
        },
        nextSwitch: nextSwitchInfo,
      });
    } catch (error: any) {
      console.error("[Dynamics Resolver] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // QR DYNAMICS V2 - TIME-BASED URL STITCHER
  // ============================================================

  // Get packets filtered to qr-canvas/qr-play only (for QR Dynamics admin UI)
  app.get("/api/dynamics/packets", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.query;

      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      // Query productPackets for this store (optionally filtered by channel)
      // Try both exact match and lowercase for channelId
      const channelIdLower = channelId ? (channelId as string).toLowerCase() : null;
      
      let packetsSnapshot = await firestoreDb.collection("productPackets")
        .where("storeId", "==", storeId)
        .get();

      // Filter by channel if provided
      let docs = packetsSnapshot.docs;
      if (channelId) {
        docs = docs.filter(doc => {
          const data = doc.data();
          return data.channelId === channelId || data.channelId === channelIdLower;
        });
      }

      // Filter to packets with landing page snapshots and derive type from URL
      const packets = docs
        .map(doc => {
          const data = doc.data();
          
          // Only include packets that have a landing page snapshot URL
          if (!data.landingPageSnapshotUrl) return null;
          
          // Derive type from URL path: /canvas/ = qr-canvas, /play/ = qr-play
          const url = data.landingPageSnapshotUrl || '';
          let qrType: 'qr-canvas' | 'qr-play' = 'qr-canvas';
          if (url.includes('/play/')) {
            qrType = 'qr-play';
          } else if (url.includes('/canvas/')) {
            qrType = 'qr-canvas';
          }
          
          return {
            id: doc.id,
            packetId: doc.id,
            name: data.productName || data.landingPageTitle || 'Untitled',
            qrProductType: qrType,
            thumbnailUrl: data.landingPageSnapshotUrl,
            landingPageSlug: data.landingPageSlug,
            landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null,
            storeId: data.storeId,
            channelId: data.channelId,
          };
        })
        .filter(Boolean);

      console.log(`[Dynamics Packets] Found ${packets.length} eligible packets for ${storeId}/${channelId || 'all'}`);

      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Dynamics Packets] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create QR Dynamics instance (typically at sale/checkout)
  app.post("/api/dynamics/instances", async (req: any, res) => {
    try {
      const { orderId, collectionId, slots, fallbackUrl } = req.body;

      if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: "slots array is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const nowEpoch = Math.floor(Date.now() / 1000);
      
      const instanceData = {
        orderId: orderId || null,
        collectionId: collectionId || null,
        createdAt: nowEpoch,
        startTimestamp: nowEpoch,
        mode: 'loop',
        fallbackUrl: fallbackUrl || null,
        slots: slots.map((slot: any, index: number) => ({
          slotId: slot.slotId || `slot-${Date.now()}-${index}`,
          packetId: slot.packetId,
          durationSeconds: slot.durationSeconds || 86400,
          order: slot.order ?? index + 1,
        })),
      };

      const docRef = await firestoreDb.collection("qr_dynamics_instances").add(instanceData);

      console.log(`[Dynamics Instance] Created instance ${docRef.id} with ${slots.length} slots`);

      res.json({
        success: true,
        instanceId: docRef.id,
        resolverUrl: `/qr/d/${docRef.id}`,
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get instance details
  app.get("/api/dynamics/instances/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Instance not found" });
      }

      res.json({
        success: true,
        instance: {
          id: doc.id,
          ...doc.data(),
        },
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Preview current active slot using math
  app.get("/api/dynamics/instances/:instanceId/preview", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const instance = doc.data() as any;
      const slots = instance.slots || [];

      if (slots.length === 0) {
        return res.json({
          success: true,
          activeSlot: null,
          message: "No slots configured",
        });
      }

      // Sort by order
      const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);

      // Time math
      const nowEpoch = Math.floor(Date.now() / 1000);
      const elapsed = nowEpoch - instance.startTimestamp;

      let cycleLength = 0;
      for (const slot of sortedSlots) {
        cycleLength += slot.durationSeconds;
      }

      if (cycleLength <= 0) {
        return res.status(500).json({ error: "Invalid cycle length" });
      }

      const position = elapsed % cycleLength;

      // Resolve active slot
      let running = 0;
      let activeSlot = null;
      let activeIndex = 0;

      for (let i = 0; i < sortedSlots.length; i++) {
        running += sortedSlots[i].durationSeconds;
        if (position < running) {
          activeSlot = sortedSlots[i];
          activeIndex = i;
          break;
        }
      }

      // Fetch packet details for thumbnail
      let packetDetails = null;
      if (activeSlot) {
        const packetDoc = await firestoreDb.collection("productPackets").doc(activeSlot.packetId).get();
        if (packetDoc.exists) {
          const packetData = packetDoc.data() as any;
          packetDetails = {
            name: packetData.productName || packetData.landingPageTitle || 'Untitled',
            thumbnailUrl: packetData.landingPageSnapshotUrl,
            landingPageSlug: packetData.landingPageSlug,
            qrProductType: packetData.qrProductType,
          };
        }
      }

      // Calculate time remaining in current slot
      let timeRemainingSeconds = 0;
      if (activeSlot) {
        const slotStart = running - activeSlot.durationSeconds;
        timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart);
      }

      res.json({
        success: true,
        nowEpoch,
        elapsed,
        cycleLength,
        position,
        activeIndex,
        totalSlots: sortedSlots.length,
        activeSlot: activeSlot ? {
          ...activeSlot,
          packet: packetDetails,
        } : null,
        timeRemainingSeconds,
        nextSlotIndex: (activeIndex + 1) % sortedSlots.length,
      });
    } catch (error: any) {
      console.error("[Dynamics Preview] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update instance slots (resets startTimestamp)
  app.put("/api/dynamics/instances/:instanceId/slots", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { slots } = req.body;

      if (!slots || !Array.isArray(slots)) {
        return res.status(400).json({ error: "slots array is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const nowEpoch = Math.floor(Date.now() / 1000);

      await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).update({
        slots: slots.map((slot: any, index: number) => ({
          slotId: slot.slotId || `slot-${Date.now()}-${index}`,
          packetId: slot.packetId,
          durationSeconds: slot.durationSeconds || 86400,
          order: slot.order ?? index + 1,
        })),
        startTimestamp: nowEpoch, // Reset anchor on edit
      });

      console.log(`[Dynamics Instance] Updated slots for ${instanceId}, reset startTimestamp`);

      res.json({
        success: true,
        instanceId,
        newStartTimestamp: nowEpoch,
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error updating slots:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR RESOLVER: The actual redirect endpoint
  app.get("/qr/d/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).send("QR Dynamics instance not found");
      }

      const instance = doc.data() as any;
      const slots = instance.slots || [];

      if (slots.length === 0) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("No content configured");
      }

      // Sort by order
      const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);

      // SCAN-TO-REVEAL MODE: Serve a lightweight HTML page that tracks per-device progress via localStorage
      if (instance.composeMode === 'scan-to-reveal') {
        const slotPacketIds = sortedSlots.map((s: any) => s.packetId);
        const packetSlugs: string[] = [];
        
        for (const pid of slotPacketIds) {
          let pDoc = await firestoreDb.collection("productPackets").doc(pid).get();
          if (!pDoc.exists) {
            pDoc = await firestoreDb.collection("memberPackets").doc(pid).get();
          }
          const pData = pDoc.exists ? (pDoc.data() as any) : null;
          packetSlugs.push(pData?.landingPageSlug || '');
        }

        const validSlugs = packetSlugs.filter(s => s !== '');
        if (validSlugs.length === 0) {
          if (instance.fallbackUrl) {
            return res.redirect(302, instance.fallbackUrl);
          }
          return res.status(404).send("No content configured");
        }

        console.log(`[QR Dynamics] Scan-to-Reveal instance ${instanceId} with ${validSlugs.length} items`);

        const slugsJson = JSON.stringify(validSlugs);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading...</title></head><body><script>
(function(){
  var k='qr_str_'+${JSON.stringify(instanceId)};
  var slugs=${slugsJson};
  var idx=parseInt(localStorage.getItem(k)||'0',10);
  if(isNaN(idx)||idx<0)idx=0;
  var current=idx%slugs.length;
  localStorage.setItem(k,String(idx+1));
  window.location.replace('/p/'+slugs[current]);
})();
</script><noscript><p>JavaScript is required.</p></noscript></body></html>`;

        return res.status(200).type('html').send(html);
      }

      // AUTO-ROTATE MODE: Time-based rotation (existing behavior)
      const nowEpoch = Math.floor(Date.now() / 1000);
      const elapsed = nowEpoch - instance.startTimestamp;

      let cycleLength = 0;
      for (const slot of sortedSlots) {
        cycleLength += slot.durationSeconds;
      }

      if (cycleLength <= 0) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(500).send("Invalid QR Dynamics configuration");
      }

      const position = elapsed % cycleLength;

      // Resolve active slot
      let running = 0;
      let activeSlot = null;

      for (const slot of sortedSlots) {
        running += slot.durationSeconds;
        if (position < running) {
          activeSlot = slot;
          break;
        }
      }

      if (!activeSlot) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(500).send("Unable to resolve slot");
      }

      // Fetch packet for redirect URL (check both productPackets and memberPackets)
      let packetDoc = await firestoreDb.collection("productPackets").doc(activeSlot.packetId).get();
      if (!packetDoc.exists) {
        packetDoc = await firestoreDb.collection("memberPackets").doc(activeSlot.packetId).get();
      }

      if (!packetDoc.exists) {
        // Slot's packet missing - skip to next slot
        console.log(`[QR Dynamics] Packet ${activeSlot.packetId} not found, trying next slot`);
        
        const nextSlotIndex = (sortedSlots.indexOf(activeSlot) + 1) % sortedSlots.length;
        const nextSlot = sortedSlots[nextSlotIndex];
        
        if (nextSlot && nextSlot.packetId !== activeSlot.packetId) {
          const nextPacketDoc = await firestoreDb.collection("productPackets").doc(nextSlot.packetId).get();
          if (nextPacketDoc.exists) {
            const nextPacketData = nextPacketDoc.data() as any;
            if (nextPacketData.landingPageSlug) {
              return res.redirect(302, `/p/${nextPacketData.landingPageSlug}`);
            }
          }
        }

        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("Content not available");
      }

      const packetData = packetDoc.data() as any;

      if (!packetData.landingPageSlug) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("Landing page not configured");
      }

      console.log(`[QR Dynamics] Instance ${instanceId} → Slot ${activeSlot.order} → /p/${packetData.landingPageSlug}`);

      res.redirect(302, `/p/${packetData.landingPageSlug}`);
    } catch (error: any) {
      console.error("[QR Dynamics Resolver] Error:", error);
      res.status(500).send("QR Dynamics error");
    }
  });

  // ============================================================
  // END QR DYNAMICS V2
  // ============================================================

  // Test: Full template save with batch mockup generation - NO AUTH REQUIRED
  app.post("/api/test/templates/full-save", async (req: any, res) => {
    try {
      // Accept both formats: nested { template, colors, placements } or flat object
      let template: any;
      let colors: any[] = [];
      let placements: string[] = ["front", "back"];
      
      if (req.body.template) {
        // Old nested format
        template = req.body.template;
        colors = req.body.colors || [];
        placements = req.body.placements || ["front", "back"];
      } else if (req.body.name || req.body.productId) {
        // New flat format from useSaveProduct
        const { name, description, category, productId, blueprintId, printProviderId, 
                artworkUrl, artworkVariant, thumbnailUrl, qrContent, pricing, 
                colors: bodyColors, placements: bodyPlacements, qrSizes } = req.body;
        
        template = {
          name: name || `Template - ${new Date().toLocaleDateString()}`,
          description: description || "",
          category: category || "General",
          productId: productId || "",
          blueprintId: blueprintId || 0,
          printProviderId: printProviderId || 0,
          artworkUrl: artworkUrl || "",
          artworkVariant: artworkVariant || "black",
          thumbnailUrl: thumbnailUrl || artworkUrl || "",
          qrContent: qrContent || "",
          pricing: pricing || null,
          isActive: true,
        };
        colors = bodyColors || [];
        placements = bodyPlacements || ["front"];
      } else {
        return res.status(400).json({ error: "Template data is required" });
      }

      // For test endpoint, just save the template without actual Printful job queue
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("./lib/firebase-admin")).getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const templateData = {
        ...template,
        createdAt: now,
        updatedAt: now,
      };
      const templateRef = await firestoreDb.collection("productTemplates").add(templateData);
      const templateId = templateRef.id;

      // Queue mockup generation jobs
      const qrSizes = ["small", "medium", "large"];
      let jobsQueued = 0;

      for (const color of colors) {
        for (const placement of placements) {
          const sizesToGenerate = (placement === "front" || placement === "back") ? qrSizes : ["large"];
          
          for (const qrSize of sizesToGenerate) {
            const jobData = {
              templateId,
              colorName: color.name,
              colorHex: color.hex,
              placement,
              qrSize,
              status: "pending",
              createdAt: now,
            };
            await firestoreDb.collection("mockupJobs").add(jobData);
            jobsQueued++;
          }
        }
      }

      console.log(`[Templates TEST] Full save: template=${templateId}, ${jobsQueued} jobs queued`);

      res.json({
        success: true,
        templateId,
        jobsQueued,
        message: `Template saved with ${jobsQueued} mockup jobs queued (test endpoint)`,
      });
    } catch (error: any) {
      console.error("[Templates TEST] Error in full save:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Generate priority mockup - single immediate mockup for digital proof - NO AUTH REQUIRED
  app.post("/api/test/mockup/priority", async (req: any, res) => {
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

      console.log(`[Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);

      // Import the mockup service
      const { getMockupWithFallback } = await import("./lib/mockup-service");
      const storage = (await import("./storage")).storage;
      
      // Generate the mockup immediately via Printful
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        canonicalPlacementId: placement || "FRONT_CHEST",
        artworkUrl,
        artworkVariant: "black",
        qrSize: qrSize as 'small' | 'medium' | 'large',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      }, storage);

      console.log(`[Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        generatedAt: result.generatedAt,
      });
    } catch (error: any) {
      console.error("[Priority Mockup] Error:", error);
      // Return a fallback message but don't fail the overall flow
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  // Test: Get pricing settings - NO AUTH REQUIRED
  app.get("/api/test/pricing-settings", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("testSettings").doc("pricing").get();
      
      // Default size upcharges (from Printify pricing structure)
      const defaultSizeUpcharges: Record<string, number> = {
        'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12
      };
      
      const defaultBrandLabelPricing = {
        printifyInside: 0.55,
        printifyOutside: 0.55,
        printfulInside: 0.99,
        printfulOutside: 2.49,
      };

      if (!doc.exists) {
        return res.json({
          markupPercent: 25,
          markupFixed: 0,
          additionalPlacementCost: 4,
          textLineUpcharge: 2,
          memberProfitShare: 0.25,
          sizeUpcharges: defaultSizeUpcharges,
          hostingTiers: [
            { code: "1_year", name: "1 Year", price: 5 },
            { code: "2_year", name: "2 Years", price: 8 },
            { code: "3_year", name: "3 Years", price: 10 },
          ],
          brandLabelPricing: defaultBrandLabelPricing,
        });
      }
      
      const data = doc.data();
      res.json({
        ...data,
        memberProfitShare: data?.memberProfitShare ?? 0.25,
        sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
        brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
      });
    } catch (error: any) {
      console.error("[Pricing Settings TEST] Error getting settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Save pricing settings - NO AUTH REQUIRED
  app.post("/api/test/pricing-settings", async (req: any, res) => {
    try {
      const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing } = req.body;
      
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("./lib/firebase-admin")).getFirebaseAdmin();
      
      const defaultSizeUpcharges: Record<string, number> = {
        'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12
      };

      const defaultBrandLabelPricing = {
        printifyInside: 0.55,
        printifyOutside: 0.55,
        printfulInside: 0.99,
        printfulOutside: 2.49,
      };
      
      const settings = {
        markupPercent: parseFloat(markupPercent) || 25,
        markupFixed: parseFloat(markupFixed) || 0,
        additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
        textLineUpcharge: parseFloat(textLineUpcharge) || 2,
        memberProfitShare: parseFloat(memberProfitShare) || 0.25,
        sizeUpcharges: sizeUpcharges || defaultSizeUpcharges,
        hostingTiers: hostingTiers || [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: brandLabelPricing || defaultBrandLabelPricing,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await firestoreDb.collection("testSettings").doc("pricing").set(settings, { merge: true });
      
      console.log("[Pricing Settings TEST] Saved settings:", settings);
      
      res.json({
        success: true,
        settings,
        message: "Pricing settings saved",
      });
    } catch (error: any) {
      console.error("[Pricing Settings TEST] Error saving settings:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Sync pricing to all existing product packets across all stores
  app.post("/api/test/pricing-settings/sync", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get current pricing settings
      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
      
      console.log(`[PricingSync] Starting sync with: ${markupPercent}% markup, ${memberProfitShare * 100}% member share`);
      
      // Get all store allowed products
      const storesSnapshot = await firestoreDb.collection("storeAllowedProducts").get();
      
      let storesUpdated = 0;
      let productsUpdated = 0;
      
      for (const storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        const storeId = storeDoc.id;
        
        if (!storeData.products || !Array.isArray(storeData.products)) {
          continue;
        }
        
        // Recalculate pricing for each product
        const updatedProducts = storeData.products.map((p: any) => {
          if (p.baseCost === undefined || p.baseCost === null) {
            return p; // Skip products without base cost
          }
          
          const baseCost = parseFloat(p.baseCost) || 0;
          const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
          const profit = retailPrice - baseCost;
          const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
          
          return {
            ...p,
            retailPrice,
            profit,
            memberEarnings,
            pricingUsed: {
              markupPercent,
              markupFixed,
              additionalPlacementCost,
              textLineUpcharge,
              memberProfitShare,
            },
            pricingSyncedAt: new Date().toISOString(),
          };
        });
        
        await firestoreDb.collection("storeAllowedProducts").doc(storeId).update({
          products: updatedProducts,
          updatedAt: new Date().toISOString(),
        });
        
        storesUpdated++;
        productsUpdated += updatedProducts.length;
      }
      
      console.log(`[PricingSync] Updated ${productsUpdated} products across ${storesUpdated} stores`);
      
      res.json({
        success: true,
        storesUpdated,
        productsUpdated,
        pricingUsed: { markupPercent, markupFixed, memberProfitShare, additionalPlacementCost, textLineUpcharge },
        message: `Synced pricing to ${productsUpdated} products across ${storesUpdated} stores`,
      });
    } catch (error: any) {
      console.error("[PricingSync] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test: Create product packet (master record) - NO AUTH REQUIRED
  app.post("/api/test/packets", async (req: any, res) => {
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
        // Landing page fields
        landingPageTitle,
        landingPageDescription,
        landingPageBackgroundUrl,
        landingPageSlug,
        headerStyle,
        footerStyle,
        // Role/Store/Channel fields
        roleType,
        storeId,
        storeName,
        channelId,
        channelName,
        // Fulfillment provider
        fulfillmentProvider,
        // Play mode video
        playMediaUrl,
        playMediaType,
      } = req.body;

      // Note: qrContent and qrOnlyUrl are generated AFTER packet creation
      // so we don't validate them here - they get populated via PATCH

      const { getFirestoreDb } = await import("./lib/firebase-admin");
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
        // Landing page fields
        landingPageTitle: landingPageTitle || null,
        landingPageDescription: landingPageDescription || null,
        landingPageBackgroundUrl: landingPageBackgroundUrl || null,
        landingPageSlug: landingPageSlug || null,
        headerStyle: headerStyle || null,
        footerStyle: footerStyle || null,
        // Role/Store/Channel
        roleType: roleType || null,
        storeId: storeId || null,
        storeName: storeName || null,
        channelId: channelId || null,
        channelName: channelName || null,
        // Fulfillment provider
        fulfillmentProvider: fulfillmentProvider || 'printify',
        // Play mode video
        playMediaUrl: playMediaUrl || null,
        playMediaType: playMediaType || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const packetRef = await firestoreDb.collection("productPackets").add(packetData);
      const packetId = packetRef.id;
      
      console.log(`[Packets TEST] Created packet: ${packetId}`);

      // Queue batch mockup jobs for all color × placement × size combinations
      let mockupJobsQueued = 0;
      if (blueprintId && printProviderId && colors && Array.isArray(colors) && colors.length > 0) {
        try {
          const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
          
          // Use compositeUrl as the artwork URL for mockups
          const artworkUrl = compositeUrl || qrOnlyUrl;
          if (artworkUrl) {
            const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
            const qrSizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
            
            // Create a pseudo-product ID for the packet to track mockup jobs
            const productIdForMockups = `packet_${packetId}`;
            
            console.log(`[Packets TEST] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
            
            const jobs = await mockupJobQueue.createBatchJobs({
              productId: productIdForMockups,
              colors: colors.map((c: any) => ({ name: c.name || c, hex: c.hex || '#000000' })),
              qrSizes,
              placements: targetPlacements,
              blueprintId: parseInt(blueprintId),
              printProviderId: parseInt(printProviderId),
              artworkUrl,
              artworkVariant: "black",
            });
            
            mockupJobsQueued = jobs.length;
            console.log(`[Packets TEST] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
          } else {
            console.log(`[Packets TEST] No artwork URL available yet, skipping mockup queue`);
          }
        } catch (err: any) {
          console.error(`[Packets TEST] Failed to queue mockup jobs:`, err.message);
          // Don't fail packet creation if mockup queueing fails
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

  // Test: Get all product packets - NO AUTH REQUIRED
  app.get("/api/test/packets", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("productPackets")
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

  // Test: Get product packet by ID - NO AUTH REQUIRED
  app.get("/api/test/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("productPackets").doc(packetId).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const data = doc.data();
      
      // Also find linked template by packetId
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

  // Test: Update packet with final URLs - NO AUTH REQUIRED
  app.patch("/api/test/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const updates = req.body;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb, FieldValue } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("productPackets").doc(packetId);
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

  // Test: Delete packet - NO AUTH REQUIRED
  // CASCADE DELETE: Also removes graphics, templates, and storeProductLinks that reference this packet
  app.delete("/api/test/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("productPackets").doc(packetId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      // CASCADE DELETE: Clean up all related records
      const cascadeResults = {
        graphics: 0,
        templates: 0,
        storeProductLinks: 0,
      };
      
      // Delete related graphics
      const graphicsSnap = await firestoreDb.collection("productGraphics")
        .where("packetId", "==", packetId)
        .get();
      for (const graphicDoc of graphicsSnap.docs) {
        await graphicDoc.ref.delete();
        cascadeResults.graphics++;
      }
      
      // Delete related templates
      const templatesSnap = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .get();
      for (const templateDoc of templatesSnap.docs) {
        await templateDoc.ref.delete();
        cascadeResults.templates++;
      }
      
      // Delete related storeProductLinks
      const linksSnap = await firestoreDb.collection("storeProductLinks")
        .where("packetId", "==", packetId)
        .get();
      for (const linkDoc of linksSnap.docs) {
        await linkDoc.ref.delete();
        cascadeResults.storeProductLinks++;
      }
      
      // Delete the packet itself
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

  // Test: Get landing page by slug - NO AUTH REQUIRED
  app.get("/api/test/landing/:slug", async (req: any, res) => {
    try {
      const { slug } = req.params;
      
      if (!slug) {
        return res.status(400).json({ error: "slug is required" });
      }

      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Find packet by landing page slug
      const snapshot = await firestoreDb.collection("productPackets")
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
        // Fields expected by product-landing.tsx
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

  // Test: Upload content (composite or media) to Firebase Storage - NO AUTH REQUIRED
  app.post("/api/test/content/upload", async (req: any, res) => {
    try {
      const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;

      if (!mode || !userId || !packetId || !base64Data) {
        return res.status(400).json({ 
          error: "mode, userId, packetId, and base64Data are required" 
        });
      }

      const validModes = ['canvas', 'play', 'dynamics', 'basics'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ 
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
        });
      }

      const { uploadCanvasComposite, uploadContent } = await import("./lib/content-upload-service");
      
      let result;
      
      if (mode === 'canvas' || mode === 'basics') {
        result = await uploadCanvasComposite(base64Data, userId, packetId, fileName);
      } else {
        const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        const actualMimeType = base64Match?.[1] || mimeType || 'application/octet-stream';
        const actualBase64 = base64Match?.[2] || base64Data;
        
        console.log(`[Content Upload] Processing ${mode} upload: base64 length=${base64Data?.length || 0}, extracted length=${actualBase64?.length || 0}, mimeType=${actualMimeType}`);
        
        if (!actualBase64 || actualBase64.length === 0) {
          return res.status(400).json({ error: 'No file data received - base64 content is empty' });
        }
        
        const buffer = Buffer.from(actualBase64, 'base64');
        console.log(`[Content Upload] Decoded buffer size: ${buffer.length} bytes`);
        
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'File data is empty after decoding' });
        }
        
        result = await uploadContent(
          buffer, 
          mode as any, 
          userId, 
          packetId, 
          actualMimeType, 
          fileName || 'upload'
        );
      }

      // Update the packet with the uploaded content URL
      const { getFirestoreDb } = await import("./lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };
      
      if (mode === 'canvas' || mode === 'basics') {
        updateData.compositeUrl = result.publicUrl;
      } else if (mode === 'play') {
        updateData.playMediaUrl = result.publicUrl;
        updateData.playMediaType = result.mimeType;
      } else if (mode === 'dynamics') {
        updateData.dynamicsMediaUrl = result.publicUrl;
        updateData.dynamicsMediaType = result.mimeType;
      }
      
      await firestoreDb.collection("productPackets").doc(packetId).update(updateData);

      console.log(`[Content Upload] Uploaded ${mode} content for packet ${packetId}`);

      res.json({
        success: true,
        ...result,
        message: `${mode} content uploaded successfully`,
      });
    } catch (error: any) {
      console.error("[Content Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Save graphics (enlarged QR and/or composite graphic)
  app.post("/api/admin/graphics/save", isAdmin, async (req, res) => {
    try {
      const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId, qrContent, pricing } = req.body;

      // URLs are generated after packet creation, so no validation here

      // Build metadata object without undefined values
      const baseMetadata: Record<string, any> = {};
      if (storeId) baseMetadata.storeId = storeId;
      if (channelId) baseMetadata.channelId = channelId;
      if (qrContent) baseMetadata.qrContent = qrContent;
      if (pricing) baseMetadata.pricing = pricing;

      let qrAsset = null;
      let compositeAsset = null;

      // Save QR-only asset if provided
      if (qrOnlyUrl) {
        qrAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - QR Only`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: qrOnlyUrl,
          storageUrl: qrOnlyUrl,
          thumbnailUrl: qrOnlyUrl,
          fileName: `qr-only-${Date.now()}.png`,
          originalName: `qr-only.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "qr-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isQrOnly: true },
        } as any);
      }

      // Save composite asset if provided
      if (compositeUrl) {
        compositeAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - Composite`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: compositeUrl,
          storageUrl: compositeUrl,
          thumbnailUrl: compositeUrl,
          fileName: `composite-${Date.now()}.png`,
          originalName: `composite.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "composite-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isComposite: true },
        } as any);
      }

      const savedParts = [qrAsset ? 'QR' : null, compositeAsset ? 'Composite' : null].filter(Boolean).join(' + ');
      console.log(`[Graphics] Saved graphics: ${savedParts}`);

      res.json({
        success: true,
        qrAsset,
        compositeAsset,
        qrAssetId: qrAsset?.id,
        compositeAssetId: compositeAsset?.id,
        message: "Graphics saved to library",
      });
    } catch (error: any) {
      console.error("[Graphics] Save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CUSTOM DESIGNS ENDPOINTS ============
  
  // Public: Get custom design by ID (for /customs/:id page)
  app.get("/api/customs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const design = await storage.getCustomDesign(id);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Create custom design
  app.post("/api/admin/custom-designs", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        projectName: z.string().min(1, "Project name is required").max(100),
        productId: z.number(),
        productName: z.string(),
        productImage: z.string().nullable().optional(),
        placements: z.array(z.string()).min(1),
        placementConfigs: z.record(z.string(), z.enum(["full", "qr-only"])).optional(), // per-placement mode
        // QR content type: rich_media (hosted), plain_text (direct), external_url (user's URL)
        qrContentType: z.enum(["rich_media", "plain_text", "external_url"]).optional().default("rich_media"),
        plainTextQrContent: z.string().nullable().optional(), // For plain_text mode - encoded directly in QR
        // For external_url mode - require a valid URL with proper domain structure
        externalUrl: z.string().nullable().optional().refine(
          (val) => {
            if (!val) return true; // Allow null/empty (validated at runtime based on mode)
            // Normalize: add https:// if missing protocol
            const normalized = val.match(/^https?:\/\//) ? val : `https://${val}`;
            // Validate URL structure: must have domain with TLD (e.g., example.com)
            try {
              const url = new URL(normalized);
              // Must have a valid hostname with at least one dot (excludes localhost-style URLs)
              return url.hostname.includes('.') && url.hostname.length > 3;
            } catch {
              return false;
            }
          },
          { message: "Please enter a valid URL (e.g., https://example.com or example.com)" }
        ),
        backgroundImage: z.string().nullable().optional(),
        topText: z.object({
          text: z.string(),
          fontFamily: z.string(),
          fontSize: z.string(),
          color: z.string().optional(),
          letterSpacing: z.number().optional(),
          warpPreset: z.string().optional(),
          strokeColor: z.string().optional(),
          strokeWidth: z.number().optional(),
        }).nullable().optional(),
        bottomText: z.object({
          text: z.string(),
          fontFamily: z.string(),
          fontSize: z.string(),
          color: z.string().optional(),
          letterSpacing: z.number().optional(),
          warpPreset: z.string().optional(),
          strokeColor: z.string().optional(),
          strokeWidth: z.number().optional(),
        }).nullable().optional(),
        // Landing page overlay - displayed when QR is scanned (not printed)
        landingOverlay: z.object({
          enabled: z.boolean(),
          title: z.string().optional(),
          description: z.string().optional(),
          position: z.enum(["top", "bottom"]),
          fontFamily: z.string(),
          color: z.string(),
        }).nullable().optional(),
        textUpcharge: z.number().optional().default(2.00),
        storeType: z.string().nullable().optional(),
        storeName: z.string().nullable().optional(),
        segment: z.string().nullable().optional(),
        isFeatured: z.boolean().optional().default(false),
        isSeasonalPromo: z.boolean().optional().default(false),
        saveTarget: z.enum(["library", "store", "both"]),
        // Pricing data for product catalog entry
        basePrice: z.number().optional().default(0),
        markupPercent: z.number().optional().default(0),
        markupFixed: z.number().optional().default(0),
        hostingPrice: z.number().optional().default(0),
        // USA production flag for product
        madeInUSA: z.boolean().optional().default(false),
        printProviderId: z.number().nullable().optional(),
      });
      
      const validatedData = createSchema.parse(req.body);
      
      // Runtime validation: external_url mode requires a valid external URL
      if (validatedData.qrContentType === "external_url") {
        if (!validatedData.externalUrl || validatedData.externalUrl.trim() === "") {
          return res.status(400).json({ 
            error: "External URL is required when using External URL QR mode" 
          });
        }
      }
      
      // Runtime validation: plain_text mode requires content
      if (validatedData.qrContentType === "plain_text") {
        if (!validatedData.plainTextQrContent || validatedData.plainTextQrContent.trim() === "") {
          return res.status(400).json({ 
            error: "QR content is required when using Plain Text QR mode" 
          });
        }
      }
      
      // Generate slug from user-provided project name
      const slugify = (str: string) => str?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
      
      // Build the slug from project name (e.g., "Hello World QR" -> "hello-world-qr")
      let baseSlug = slugify(validatedData.projectName);
      
      // Fallback if project name slugifies to empty (e.g., emoji-only names)
      if (!baseSlug) {
        const storePart = slugify(validatedData.storeName || 'custom');
        const segmentPart = slugify(validatedData.segment || 'general');
        const timestamp = Date.now().toString(36); // Short unique identifier
        baseSlug = `${storePart}-${segmentPart}-${timestamp}`;
      }
      
      // Check for uniqueness and add counter if needed
      let designId = baseSlug;
      let counter = 1;
      while (await storage.getCustomDesign(designId)) {
        designId = `${baseSlug}-${counter}`;
        counter++;
      }
      
      // Generate QR code pointing to the /customs/:id URL
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "http://localhost:5000";
      
      // Auto-save background image to library_assets (deduplicate by URL)
      let backgroundAssetId: string | null = null;
      if (validatedData.backgroundImage && validatedData.saveTarget !== "store") {
        // Check if this background already exists in library_assets
        const existingAsset = await storage.getLibraryAssetByUrl(validatedData.backgroundImage);
        if (existingAsset) {
          backgroundAssetId = existingAsset.id;
          // Increment usage count and reactivate if needed
          await storage.incrementLibraryAssetUsage(existingAsset.id);
          if (!existingAsset.isActive) {
            await storage.updateLibraryAsset(existingAsset.id, { isActive: true });
          }
        } else {
          // Create new library asset for this background
          const bgFilename = validatedData.backgroundImage.split('/').pop() || 'background.png';
          const newAsset = await storage.createLibraryAsset({
            name: `Background - ${validatedData.storeName || 'Custom'} ${validatedData.segment || ''}`.trim(),
            originalName: bgFilename,
            mimeType: 'image/png',
            fileName: bgFilename,
            sizeBytes: 0, // Unknown size when auto-saving from URL
            storageUrl: validatedData.backgroundImage,
            publicUrl: validatedData.backgroundImage,
            ownerType: 'admin',
            assetType: 'background',
            mediaType: 'image',
            isActive: true,
            isFeatured: false,
            // Set visibility to the store/segment this design is for
            visibleStoreSlugs: validatedData.storeName ? [validatedData.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : null,
            visibleSegments: validatedData.segment ? { segments: [validatedData.segment] } : null,
          });
          backgroundAssetId = newAsset.id;
        }
      }
      
      // Create the design with descriptive ID
      // Default placementConfigs to "full" for all placements if not provided
      const finalPlacementConfigs = validatedData.placementConfigs || 
        Object.fromEntries(validatedData.placements.map(p => [p, "full"]));
      
      // Determine template variant based on QR content type
      // Values: 'plain-text', 'url' (hosted), 'external-url', 'dynamics'
      const templateVariant = validatedData.qrContentType === "plain_text" ? "plain-text" 
        : validatedData.qrContentType === "external_url" ? "external-url" 
        : "url"; // rich_media uses 'url' for hosted landing page
      
      const designData = {
        id: designId,
        projectName: validatedData.projectName,
        productId: validatedData.productId,
        productName: validatedData.productName,
        productImage: validatedData.productImage || null,
        placements: validatedData.placements,
        placementConfigs: finalPlacementConfigs, // per-placement mode map
        backgroundImageUrl: validatedData.backgroundImage || null,
        backgroundAssetId: backgroundAssetId,
        topText: validatedData.topText || null,
        bottomText: validatedData.bottomText || null,
        landingOverlay: validatedData.landingOverlay || null,
        textUpcharge: String(validatedData.textUpcharge),
        storeType: validatedData.storeType || null,
        storeName: validatedData.storeName || null,
        segment: validatedData.segment || null,
        isFeatured: validatedData.isFeatured,
        isSeasonalPromo: validatedData.isSeasonalPromo,
        savedToLibrary: validatedData.saveTarget === "library" || validatedData.saveTarget === "both",
        savedToStore: validatedData.saveTarget === "store" || validatedData.saveTarget === "both",
        // New QR content type fields
        templateVariant,
        // Normalize external URL with https:// if missing protocol
        externalUrl: validatedData.externalUrl 
          ? (validatedData.externalUrl.match(/^https?:\/\//) 
             ? validatedData.externalUrl 
             : `https://${validatedData.externalUrl}`)
          : null,
        // Note: plainTextQrContent is not stored - it's encoded directly in the QR at generation time
      };
      
      const design = await storage.createCustomDesign(designData);
      
      // Determine QR code content based on content type:
      // - rich_media: hosted landing page at /customs/:id
      // - plain_text: direct content encoded in QR
      // - external_url: user's external URL directly
      let qrUrl: string;
      if (validatedData.qrContentType === "external_url" && validatedData.externalUrl) {
        // External URL mode: QR points directly to user's URL (normalized)
        const extUrl = validatedData.externalUrl;
        qrUrl = extUrl.match(/^https?:\/\//) ? extUrl : `https://${extUrl}`;
      } else if (validatedData.qrContentType === "plain_text" && validatedData.plainTextQrContent) {
        // Plain text mode: encode content directly in QR
        qrUrl = validatedData.plainTextQrContent;
      } else {
        // Rich media mode (default): QR points to hosted page
        qrUrl = `${baseUrl}/customs/${design.id}`;
      }
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      
      // Generate print-ready images per placement based on mode
      // "full" mode: header + QR + footer (4500x5400 transparent PNG)
      // "qr-only" mode: just QR code centered (4500x5400 transparent PNG)
      const placementImages: Record<string, string> = {};
      let primaryCompositeUrl: string | null = null; // Prefer "full" mode for primary
      
      const { renderDesignToPng, renderQrOnlyToPng } = await import("./lib/svg-renderer");
      
      // Helper function for canvas fallback when SVG fails
      // qrColor: 'black' for light shirts, 'white' for dark shirts
      const generateFullArtworkWithFallback = async (placementId: string, qrColor: 'black' | 'white' = 'black'): Promise<string | null> => {
        // For white QR, also make text white
        const textColor = qrColor === 'white' ? "#FFFFFF" : "#000000";
        
        const headerStyle = validatedData.topText ? {
          text: validatedData.topText.text,
          fontFamily: validatedData.topText.fontFamily || "Arial",
          fontSize: parseInt(validatedData.topText.fontSize) || 120,
          color: textColor, // Use appropriate color for shirt
          letterSpacing: (validatedData.topText as any).letterSpacing || 0,
          warpPreset: (validatedData.topText as any).warpPreset || "straight",
          strokeColor: (validatedData.topText as any).strokeColor,
          strokeWidth: (validatedData.topText as any).strokeWidth,
        } : undefined;
        
        const footerStyle = validatedData.bottomText ? {
          text: validatedData.bottomText.text,
          fontFamily: validatedData.bottomText.fontFamily || "Arial",
          fontSize: parseInt(validatedData.bottomText.fontSize) || 96,
          color: textColor, // Use appropriate color for shirt
          letterSpacing: (validatedData.bottomText as any).letterSpacing || 0,
          warpPreset: (validatedData.bottomText as any).warpPreset || "straight",
          strokeColor: (validatedData.bottomText as any).strokeColor,
          strokeWidth: (validatedData.bottomText as any).strokeWidth,
        } : undefined;
        
        try {
          // Try SVG renderer first
          const renderResult = await renderDesignToPng({
            templateType: 'shirt-front',
            header: headerStyle,
            footer: footerStyle,
            qrUrl,
            qrColor, // Pass color to SVG renderer
          });
          
          const colorSuffix = qrColor === 'white' ? '-white' : '';
          const fileName = `svg-composite-${design.id}-${placementId}${colorSuffix}-${Date.now()}.png`;
          const uploadResult = await uploadImageFromBuffer(
            renderResult.pngBuffer,
            fileName,
            'image/png'
          );
          console.log(`[Custom Design] Generated ${qrColor.toUpperCase()} full artwork for ${placementId}: ${uploadResult.publicUrl}`);
          return uploadResult.publicUrl;
        } catch (svgError: any) {
          console.error(`[Custom Design] SVG render failed for ${placementId}, falling back to canvas:`, svgError.message);
          
          // Fallback to canvas renderer
          const fallbackTopText = validatedData.topText ? {
            text: validatedData.topText.text,
            fontFamily: validatedData.topText.fontFamily || "Arial",
            fontSize: validatedData.topText.fontSize || "120",
            color: textColor, // Use appropriate color for shirt
            letterSpacing: (validatedData.topText as any).letterSpacing || 0,
            warpPreset: (validatedData.topText as any).warpPreset || "straight",
            strokeColor: (validatedData.topText as any).strokeColor,
            strokeWidth: (validatedData.topText as any).strokeWidth,
          } : null;
          
          const fallbackBottomText = validatedData.bottomText ? {
            text: validatedData.bottomText.text,
            fontFamily: validatedData.bottomText.fontFamily || "Arial",
            fontSize: validatedData.bottomText.fontSize || "96",
            color: textColor, // Use appropriate color for shirt
            letterSpacing: (validatedData.bottomText as any).letterSpacing || 0,
            warpPreset: (validatedData.bottomText as any).warpPreset || "straight",
            strokeColor: (validatedData.bottomText as any).strokeColor,
            strokeWidth: (validatedData.bottomText as any).strokeWidth,
          } : null;
          
          const canvasUrl = await generatePrintifyComposite(
            qrUrl,
            fallbackTopText,
            fallbackBottomText,
            4500,
            5400,
            qrColor // Pass color to canvas renderer
          );
          console.log(`[Custom Design] Generated ${qrColor.toUpperCase()} canvas fallback for ${placementId}: ${canvasUrl}`);
          return canvasUrl;
        }
      }
      
      for (const [placementId, mode] of Object.entries(finalPlacementConfigs)) {
        try {
          let imageUrl: string | null = null;
          let whiteImageUrl: string | null = null;
          
          if (mode === "qr-only") {
            // Generate QR-only image (just QR centered, no text)
            const qrOnlyResult = await renderQrOnlyToPng({ qrUrl });
            const fileName = `qr-only-${design.id}-${placementId}-${Date.now()}.png`;
            const uploadResult = await uploadImageFromBuffer(
              qrOnlyResult.pngBuffer,
              fileName,
              'image/png'
            );
            console.log(`[Custom Design] Generated QR-only for ${placementId}: ${uploadResult.publicUrl}`);
            imageUrl = uploadResult.publicUrl;
            
            // Generate white version for dark shirts
            const qrOnlyWhiteResult = await renderQrOnlyToPng({ qrUrl, qrColor: 'white' });
            const whiteFileName = `qr-only-white-${design.id}-${placementId}-${Date.now()}.png`;
            const whiteUploadResult = await uploadImageFromBuffer(
              qrOnlyWhiteResult.pngBuffer,
              whiteFileName,
              'image/png'
            );
            console.log(`[Custom Design] Generated WHITE QR-only for ${placementId}: ${whiteUploadResult.publicUrl}`);
            whiteImageUrl = whiteUploadResult.publicUrl;
          } else {
            // Generate full artwork (header + QR + footer) - BLACK version for light shirts
            imageUrl = await generateFullArtworkWithFallback(placementId, 'black');
            
            // Generate WHITE version for dark shirts
            whiteImageUrl = await generateFullArtworkWithFallback(placementId, 'white');
          }
          
          if (imageUrl) {
            placementImages[placementId] = imageUrl;
            
            // Prefer "full" mode placements for primary composite (for backward compatibility)
            if (!primaryCompositeUrl && mode === "full") {
              primaryCompositeUrl = imageUrl;
            }
          }
          
          // Store white version with "-white" suffix
          if (whiteImageUrl) {
            placementImages[`${placementId}-white`] = whiteImageUrl;
            console.log(`[Custom Design] Stored white version as ${placementId}-white`);
          }
        } catch (renderError: any) {
          console.error(`[Custom Design] Render failed for ${placementId}:`, renderError.message);
          // Continue with other placements
        }
      }
      
      // If no "full" mode placement succeeded, use any available image as fallback
      if (!primaryCompositeUrl && Object.keys(placementImages).length > 0) {
        primaryCompositeUrl = Object.values(placementImages)[0];
      }
      
      // Update design with QR code and composite images
      const updatedDesign = await storage.updateCustomDesign(design.id, {
        qrCodeUrl: qrCodeDataUrl,
        printifyCompositeUrl: primaryCompositeUrl, // Primary image for backward compat
        placementImages, // Per-placement images map
      });
      
      // If saving to store, also create a product catalog entry with StoreName/Segment category
      if (designData.savedToStore && designData.storeName) {
        const categoryPath = designData.segment 
          ? `${designData.storeName}/${designData.segment}`
          : designData.storeName;
        
        const productId = `custom_${design.id}`;
        
        // Calculate total cost and customer price
        // Base cost includes: base price + text upcharges + hosting (if rich_media)
        const textUpchargeTotal = (validatedData.topText ? validatedData.textUpcharge : 0) + 
                                  (validatedData.bottomText ? validatedData.textUpcharge : 0);
        const totalCost = validatedData.basePrice + textUpchargeTotal + validatedData.hostingPrice;
        
        // Customer price = (total cost) * (1 + markup%) + fixed markup
        const customerPrice = (totalCost * (1 + validatedData.markupPercent / 100)) + validatedData.markupFixed;
        
        // Check if product already exists
        const existingProduct = await storage.getProduct(productId);
        
        if (existingProduct) {
          // Update existing product
          await storage.updateProduct(productId, {
            name: validatedData.productName,
            description: `Custom QR design for ${categoryPath}`,
            category: categoryPath,
            basePrice: String(totalCost.toFixed(2)),
            customerPrice: String(customerPrice.toFixed(2)),
            markupPercent: String(validatedData.markupPercent),
            markupFixed: String(validatedData.markupFixed),
            imageUrl: validatedData.productImage || null,
            blueprintId: validatedData.productId || null,
            printProviderId: validatedData.printProviderId || null,
            madeInUSA: validatedData.madeInUSA || false,
            isFeatured: validatedData.isFeatured || false,
            isEnabled: true,
            metadata: { customDesignId: design.id, source: "custom" },
          });
        } else {
          // Create new product entry for the catalog
          await storage.createProduct({
            id: productId,
            name: validatedData.productName,
            description: `Custom QR design for ${categoryPath}`,
            basePrice: String(totalCost.toFixed(2)),
            customerPrice: String(customerPrice.toFixed(2)),
            markupPercent: String(validatedData.markupPercent),
            markupFixed: String(validatedData.markupFixed),
            category: categoryPath,
            imageUrl: validatedData.productImage || null,
            blueprintId: validatedData.productId || null,
            printProviderId: validatedData.printProviderId || null,
            madeInUSA: validatedData.madeInUSA || false,
            isFeatured: validatedData.isFeatured || false,
            isEnabled: true,
            metadata: { customDesignId: design.id, source: "custom" },
          });
        }
        
        console.log(`[Custom Design] Created/updated product catalog entry: ${productId} in category: ${categoryPath} with price $${customerPrice.toFixed(2)}`);
        
        // AUTO-GENERATE MOCKUPS: Queue batch mockup jobs for all colors
        if (validatedData.productId && validatedData.printProviderId) {
          try {
            const { mockupJobQueue } = await import('./lib/mockup-job-queue.js');
            
            // Get available colors from local catalog
            const { printifyPrintProviders } = await import('@shared/schema');
            const [provider] = await db.select()
              .from(printifyPrintProviders)
              .where(
                and(
                  eq(printifyPrintProviders.blueprintId, validatedData.productId),
                  eq(printifyPrintProviders.providerId, validatedData.printProviderId)
                )
              );
            
            const availableColors = provider?.availableColors as Array<{name: string; hex: string}> || [];
            
            if (availableColors.length > 0) {
              // Get artwork URL from placementImages
              const artworkUrl = (placementImages as any)?.["front-chest"] || 
                                 Object.values(placementImages || {})[0] as string;
              
              if (artworkUrl) {
                // Determine artwork variant (black or white) - use black for now, white version is stored separately
                const artworkVariant = "black" as const;
                
                const jobs = await mockupJobQueue.createBatchJobs({
                  productId,
                  colors: availableColors,
                  qrSizes: ["small", "medium", "large"],
                  placements: ["front-chest"],
                  blueprintId: validatedData.productId,
                  printProviderId: validatedData.printProviderId,
                  artworkUrl,
                  artworkVariant,
                });
                
                console.log(`[Custom Design] Queued ${jobs.length} mockup jobs for ${availableColors.length} colors x 3 sizes`);
              } else {
                console.warn(`[Custom Design] No artwork URL found for auto-mockup generation`);
              }
            } else {
              console.warn(`[Custom Design] No colors found in local catalog for blueprint ${validatedData.productId} provider ${validatedData.printProviderId}`);
            }
          } catch (mockupError: any) {
            console.error(`[Custom Design] Failed to queue mockup jobs:`, mockupError.message);
            // Don't fail the entire request, mockups can be generated later
          }
        }
      }
      
      res.json(updatedDesign);
    } catch (error: any) {
      console.error("[Custom Design Save] Error:", error);
      if (error instanceof z.ZodError) {
        console.error("[Custom Design Save] Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Get all custom designs
  app.get("/api/admin/custom-designs", isAdmin, async (req, res) => {
    try {
      const designs = await storage.getCustomDesigns();
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Update custom design (partial update) - supports both PUT and PATCH
  async function handleCustomDesignUpdate(req: any, res: any) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Validate the design exists
      const existing = await storage.getCustomDesign(id);
      if (!existing) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      const updatedDesign = await storage.updateCustomDesign(id, updates);
      res.json(updatedDesign);
    } catch (error: any) {
      console.error("[Custom Design Update] Error:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  app.put("/api/admin/custom-designs/:id", isAdmin, handleCustomDesignUpdate);
  app.patch("/api/admin/custom-designs/:id", isAdmin, handleCustomDesignUpdate);
  
  // Admin: Delete custom design
  app.delete("/api/admin/custom-designs/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCustomDesign(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRINTIFY MOCKUP GENERATION ============
  
  // Admin: Publish design to Printify and generate mockups for all selected colors
  // This creates a real Printify product with artwork, retrieves mockup images per color
  app.post("/api/admin/designs/:id/publish", isAdmin, async (req, res) => {
    const { id } = req.params;
    const { selectedColors, defaultColor, blueprintId, printProviderId } = req.body;
    
    try {
      // Validate request
      if (!selectedColors || !Array.isArray(selectedColors) || selectedColors.length === 0) {
        return res.status(400).json({ error: "selectedColors array is required" });
      }
      if (!defaultColor) {
        return res.status(400).json({ error: "defaultColor is required" });
      }
      // Ensure defaultColor is in selectedColors
      if (!selectedColors.includes(defaultColor)) {
        return res.status(400).json({ error: "defaultColor must be one of the selectedColors" });
      }
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "blueprintId and printProviderId are required" });
      }
      
      // Get the design
      const design = await storage.getCustomDesign(id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Check print-ready artwork exists
      const printReadyArtUrl = design.printifyCompositeUrl || 
        (design.placementImages as any)?.["front-chest"] ||
        Object.values(design.placementImages || {})[0];
      
      if (!printReadyArtUrl) {
        return res.status(400).json({ error: "No print-ready artwork found. Save the design first." });
      }
      
      // Update status to processing
      await storage.updateCustomDesign(id, {
        publishStatus: "processing",
        publishError: null,
        selectedColors,
        defaultColor,
        blueprintId,
        printProviderId,
      });
      
      // Import Printify client
      const { syncProductVariants, printify } = await import("./lib/printify");
      
      console.log(`[Publish] Starting mockup generation for design ${id}`);
      console.log(`[Publish] Blueprint: ${blueprintId}, Provider: ${printProviderId}`);
      console.log(`[Publish] Colors: ${selectedColors.join(", ")}, Default: ${defaultColor}`);
      
      // Get all variants for this blueprint/provider
      const { variants } = await syncProductVariants(blueprintId, printProviderId);
      
      // Filter variants to only include selected colors
      const selectedVariants = variants.filter(v => 
        v.options?.color && selectedColors.includes(v.options.color)
      );
      
      if (selectedVariants.length === 0) {
        await storage.updateCustomDesign(id, {
          publishStatus: "failed",
          publishError: "No matching variants found for selected colors",
        });
        return res.status(400).json({ error: "No matching variants found for selected colors" });
      }
      
      const variantIds = selectedVariants.map(v => v.id);
      console.log(`[Publish] Found ${variantIds.length} variants for selected colors`);
      
      // Upload artwork to Printify
      console.log(`[Publish] Uploading artwork to Printify: ${printReadyArtUrl}`);
      const imageUpload = await printify.uploadImage(printReadyArtUrl, `design-${id}.png`);
      console.log(`[Publish] Uploaded image ID: ${imageUpload.id}`);
      
      // Get placement info
      const { syncProductPlacements } = await import("./lib/printify");
      const { placements: providerPlacements } = await syncProductPlacements(blueprintId, printProviderId);
      const placement = providerPlacements[0]?.position || "front";
      
      // Create Printify product with all selected variants
      const productData = {
        title: design.projectName || `QR Design - ${id}`,
        description: `Custom QR design: ${design.projectName || id}`,
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantIds.map(vid => ({
          id: vid,
          price: 2500, // $25 placeholder price
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{
            position: placement,
            images: [{
              id: imageUpload.id,
              x: 0.5,
              y: 0.5,
              scale: 1.0,
              angle: 0,
            }],
          }],
        }],
      };
      
      console.log(`[Publish] Creating Printify product...`);
      const printifyProduct = await printify.createProduct(productData);
      console.log(`[Publish] Created Printify product: ${printifyProduct.id}`);
      
      // Poll for product to get mockup images (Printify generates them async)
      let attempts = 0;
      const maxAttempts = 15;
      let productWithMockups: any = null;
      let mockupsReady = false;
      
      while (attempts < maxAttempts && !mockupsReady) {
        // Exponential backoff: 2s, 3s, 4.5s, etc (cap at 10s)
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
          productWithMockups = await printify.getProduct(printifyProduct.id);
          
          if (productWithMockups.images && productWithMockups.images.length > 0) {
            console.log(`[Publish] Mockups ready: ${productWithMockups.images.length} images`);
            mockupsReady = true;
          }
        } catch (pollError: any) {
          // Check for rate limiting
          if (pollError.message?.includes('429') || pollError.message?.includes('rate')) {
            console.warn(`[Publish] Rate limited, backing off... attempt ${attempts}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Extra delay on rate limit
          } else {
            console.error(`[Publish] Poll error: ${pollError.message}`);
          }
        }
        
        attempts++;
        if (!mockupsReady) {
          console.log(`[Publish] Waiting for mockups... attempt ${attempts}/${maxAttempts}`);
        }
      }
      
      // Check if mockups were generated
      if (!mockupsReady || !productWithMockups?.images?.length) {
        console.error(`[Publish] Mockups not ready after ${maxAttempts} attempts`);
        await storage.updateCustomDesign(id, {
          printifyProductId: printifyProduct.id,
          publishStatus: "failed",
          publishError: "Mockups not ready after timeout. Try again later.",
        });
        return res.status(504).json({ 
          error: "Mockups not ready after timeout", 
          printifyProductId: printifyProduct.id,
          message: "Product created on Printify but mockups not yet available. Try publishing again."
        });
      }
      
      // Extract mockups organized by color
      const mockupsByColor: Record<string, { front?: string; angles?: string[] }> = {};
      const selectedVariantIds: Record<string, number> = {};
      
      if (productWithMockups?.images) {
        // Printify returns images with variant_ids, organize by color
        for (const img of productWithMockups.images) {
          // Find which color this image belongs to
          for (const variantId of (img.variant_ids || [])) {
            const variant = selectedVariants.find(v => v.id === variantId);
            if (variant?.options?.color) {
              const color = variant.options.color;
              if (!mockupsByColor[color]) {
                mockupsByColor[color] = { angles: [] };
              }
              // First image for this color becomes the "front"
              if (!mockupsByColor[color].front) {
                mockupsByColor[color].front = img.src;
              }
              mockupsByColor[color].angles?.push(img.src);
            }
          }
        }
      }
      
      // Build variant ID lookup for order fulfillment
      for (const variant of selectedVariants) {
        if (variant.options?.color && variant.options?.size) {
          const key = `${variant.options.color}-${variant.options.size}`;
          selectedVariantIds[key] = variant.id;
        }
      }
      
      console.log(`[Publish] Extracted mockups for ${Object.keys(mockupsByColor).length} colors`);
      
      // Update design with all the mockup data
      await storage.updateCustomDesign(id, {
        printifyProductId: printifyProduct.id,
        printReadyArtUrl,
        mockupsByColor,
        selectedVariantIds,
        publishStatus: "complete",
        publishError: null,
      });
      
      console.log(`[Publish] Design ${id} published successfully`);
      
      res.json({
        success: true,
        printifyProductId: printifyProduct.id,
        mockupsByColor,
        selectedVariantIds,
        imagesCount: productWithMockups?.images?.length || 0,
      });
      
    } catch (error: any) {
      console.error(`[Publish] Error publishing design ${id}:`, error);
      
      // Update status to failed
      await storage.updateCustomDesign(id, {
        publishStatus: "failed",
        publishError: error.message,
      });
      
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Get publish status for a design
  app.get("/api/admin/designs/:id/publish-status", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const design = await storage.getCustomDesign(id);
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      res.json({
        status: (design as any).publishStatus || "draft",
        error: (design as any).publishError,
        mockupsByColor: (design as any).mockupsByColor,
        defaultColor: (design as any).defaultColor,
        printifyProductId: (design as any).printifyProductId,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SVG TEXT WARP RENDER ENDPOINTS ============
  
  // Get available fonts and warp presets for the builder
  app.get("/api/render/config", async (req, res) => {
    try {
      const { getFontAllowlist, getWarpPresets } = await import("./lib/svg-renderer");
      res.json({
        fonts: getFontAllowlist(),
        warpPresets: getWarpPresets(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate SVG preview (returns SVG string for live preview in browser)
  // Supports both GET (query params) and POST (body)
  app.all("/api/render/preview", async (req, res) => {
    try {
      const { buildPreviewSvg } = await import("./lib/svg-renderer");
      // Support both GET query params and POST body
      const params = req.method === 'GET' ? req.query : req.body;
      const { header, footer, qrUrl, previewWidth, previewHeight } = params as any;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const svgString = buildPreviewSvg(
        { templateType: 'shirt-front', header, footer, qrUrl },
        previewWidth || 450,
        previewHeight || 540
      );
      
      res.type('image/svg+xml').send(svgString);
    } catch (error: any) {
      console.error("[SVG Preview] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate full-resolution PNG for Printify upload
  app.post("/api/render/png", isAdmin, async (req, res) => {
    try {
      const { renderDesignToPng } = await import("./lib/svg-renderer");
      const { header, footer, qrUrl, templateType } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const result = await renderDesignToPng({
        templateType: templateType || 'shirt-front',
        header,
        footer,
        qrUrl,
      });
      
      // Upload to object storage
      const fileName = `svg-render-${Date.now()}.png`;
      const uploadResult = await uploadImageFromBuffer(
        result.pngBuffer,
        fileName,
        'image/png'
      );
      
      res.json({
        url: uploadResult.publicUrl,
        width: result.width,
        height: result.height,
      });
    } catch (error: any) {
      console.error("[PNG Render] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate PNG and return as binary (for direct download)
  app.post("/api/render/png/download", isAdmin, async (req, res) => {
    try {
      const { renderDesignToPng } = await import("./lib/svg-renderer");
      const { header, footer, qrUrl, templateType } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const result = await renderDesignToPng({
        templateType: templateType || 'shirt-front',
        header,
        footer,
        qrUrl,
      });
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="printify-design.png"',
        'Content-Length': result.pngBuffer.length,
      });
      res.send(result.pngBuffer);
    } catch (error: any) {
      console.error("[PNG Download] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRICING QUOTE ENDPOINT ============
  
  // Calculate final price for a product with customizations (supports all 4 product lines)
  app.post("/api/pricing/quote", async (req, res) => {
    try {
      const { 
        productId, 
        productLine = "text", // 'text', 'template', 'custom', 'dynamic'
        hasTextAbove, 
        hasTextBelow, 
        templateId,
        hostingTierCode = "1_year",
      } = req.body;
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const settings = await storage.getAdminSettings();
      
      const basePrice = parseFloat(product.basePrice);
      const markupPercent = parseFloat(product.markupPercent || "0") || parseFloat(settings?.globalMarkupPercent || "25");
      const markupFixed = parseFloat(product.markupFixed || "0") || parseFloat(settings?.globalMarkupFixed || "0");
      const qrCost = parseFloat(product.qrProductionCost || "0") || parseFloat(settings?.globalQrProductionCost || "2");
      
      let price = basePrice + qrCost;
      price = price * (1 + markupPercent / 100) + markupFixed;
      
      const breakdown: Record<string, number> = {
        base: basePrice,
        qrProduction: qrCost,
        markup: (basePrice + qrCost) * (markupPercent / 100) + markupFixed,
        textAboveUpcharge: 0,
        textBelowUpcharge: 0,
        templateUpcharge: 0,
        hostingUpcharge: 0,
        dynamicUpcharge: 0,
      };

      // Add text upcharges (applicable to text, template, custom lines)
      if (hasTextAbove && productLine !== "dynamic") {
        const upcharge = parseFloat(settings?.textAboveUpcharge || "2");
        price += upcharge;
        breakdown.textAboveUpcharge = upcharge;
      }
      if (hasTextBelow && productLine !== "dynamic") {
        const upcharge = parseFloat(settings?.textBelowUpcharge || "2");
        price += upcharge;
        breakdown.textBelowUpcharge = upcharge;
      }

      // Template upcharge (Line 2)
      if (productLine === "template" && templateId) {
        const template = await storage.getQrTemplate(templateId);
        if (template) {
          const upcharge = parseFloat(template.priceUpcharge || "0");
          price += upcharge;
          breakdown.templateUpcharge = upcharge;
        }
      }

      // Dynamic QR upcharge (Line 4) - base upcharge for changeable image feature
      if (productLine === "dynamic") {
        const dynamicUpcharge = parseFloat((settings as any)?.dynamicQrUpcharge || "25");
        price += dynamicUpcharge;
        breakdown.dynamicUpcharge = dynamicUpcharge;
      }

      // Hosting tier upcharge (Lines 2, 3, 4 - for image hosting)
      if ((productLine === "template" || productLine === "custom" || productLine === "dynamic") && hostingTierCode !== "1_year") {
        const tier = await storage.getHostingTierByCode(hostingTierCode);
        if (tier && !tier.isIncluded) {
          const upcharge = parseFloat(tier.priceUpcharge || "0");
          price += upcharge;
          breakdown.hostingUpcharge = upcharge;
        }
      }
      
      res.json({
        productLine,
        basePrice,
        finalPrice: Math.round(price * 100) / 100,
        breakdown,
        hostingTier: hostingTierCode,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get enabled products only (for store front)
  app.get("/api/store/products", async (req, res) => {
    try {
      const products = await storage.getEnabledProducts();
      // Don't expose admin pricing fields to storefront
      const safeProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        imageUrl: p.imageUrl,
        manufacturer: p.manufacturer,
        madeInUSA: p.madeInUSA,
        availablePlacements: p.availablePlacements,
        availableColors: p.availableColors,
      }));
      res.json(safeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: MASTER PRODUCTS API ============
  
  app.get("/api/admin/orchestration/master-products", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllMasterProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/master-products/:id", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getMasterProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Master product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/orchestration/master-products", isAdmin, async (req: any, res) => {
    try {
      const { title, description, productType, tags, channels, pricingProfileId, baseCost, retailPrice } = req.body;
      
      if (!title || !productType) {
        return res.status(400).json({ error: "Title and productType are required" });
      }
      
      // Generate unified SKU: QRG-{type}-{seq}
      const seq = Date.now().toString(36).toUpperCase();
      const sku = `QRG-${productType.toUpperCase().slice(0, 3)}-${seq}`;
      
      const product = await storage.createMasterProduct({
        sku,
        title,
        description: description || null,
        productType,
        tags: tags || [],
        channels: channels || null,
        pricingProfileId: pricingProfileId || null,
        baseCost: baseCost || null,
        retailPrice: retailPrice || null,
        status: "draft",
      });
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/orchestration/master-products/:id", isAdmin, async (req: any, res) => {
    try {
      const id = req.params.id;
      const updates = req.body;
      
      const product = await storage.updateMasterProduct(id, updates);
      if (!product) {
        return res.status(404).json({ error: "Master product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/orchestration/master-products/:id", isAdmin, async (req: any, res) => {
    try {
      const id = req.params.id;
      await storage.deleteMasterProduct(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: DESIGN VERSIONS API ============
  
  app.get("/api/admin/orchestration/master-products/:id/design-versions", isAdmin, async (req: any, res) => {
    try {
      const masterProductId = req.params.id;
      const versions = await storage.getDesignVersions(masterProductId);
      res.json(versions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/orchestration/master-products/:id/design-versions", isAdmin, async (req: any, res) => {
    try {
      const masterProductId = req.params.id;
      const { headerText, headerStyle, footerText, footerStyle, qrUrl, renderedPngUrl, renderedSvgUrl, qrCodeUrl, placementImages } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      // Get existing versions to calculate next version number (immutable - no modifications to existing)
      const existingVersions = await storage.getDesignVersions(masterProductId);
      const versionNumber = existingVersions.length + 1;
      
      // Create new version as immutable snapshot (existing versions remain unchanged)
      const version = await storage.createDesignVersion({
        masterProductId,
        versionNumber,
        headerText: headerText || null,
        headerStyle: headerStyle || null,
        footerText: footerText || null,
        footerStyle: footerStyle || null,
        qrUrl,
        renderedPngUrl: renderedPngUrl || null,
        renderedSvgUrl: renderedSvgUrl || null,
        qrCodeUrl: qrCodeUrl || null,
        placementImages: placementImages || null,
        isActive: true,
      });
      
      // Update master product to point to new current version
      await storage.updateMasterProduct(masterProductId, {
        currentDesignVersionId: version.id,
      });
      
      res.json(version);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: CHANNEL CONFIG API ============
  
  app.get("/api/admin/orchestration/channel-configs", isAdmin, async (req: any, res) => {
    try {
      const configs = await storage.getAllChannelConfigs();
      res.json(configs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/channel-configs/:channelType", isAdmin, async (req: any, res) => {
    try {
      const config = await storage.getChannelConfig(req.params.channelType);
      if (!config) {
        return res.status(404).json({ error: "Channel config not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/orchestration/channel-configs", isAdmin, async (req: any, res) => {
    try {
      const { channelType, displayName, isEnabled, apiKeySecretName, shopId, settings } = req.body;
      
      if (!channelType || !displayName) {
        return res.status(400).json({ error: "channelType and displayName are required" });
      }
      
      const config = await storage.createChannelConfig({
        channelType,
        displayName,
        isEnabled: isEnabled ?? false,
        apiKeySecretName: apiKeySecretName || null,
        shopId: shopId || null,
        settings: settings || {},
      });
      
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/orchestration/channel-configs/:channelType", isAdmin, async (req: any, res) => {
    try {
      const { displayName, isEnabled, apiKeySecretName, apiSecretSecretName, shopId, rateLimit, rateLimitWindow, webhookSecret, settings } = req.body;
      
      // Only include fields that were actually provided (don't update lastHealthCheck on config changes)
      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) updates.displayName = displayName;
      if (isEnabled !== undefined) updates.isEnabled = isEnabled;
      if (apiKeySecretName !== undefined) updates.apiKeySecretName = apiKeySecretName;
      if (apiSecretSecretName !== undefined) updates.apiSecretSecretName = apiSecretSecretName;
      if (shopId !== undefined) updates.shopId = shopId;
      if (rateLimit !== undefined) updates.rateLimit = rateLimit;
      if (rateLimitWindow !== undefined) updates.rateLimitWindow = rateLimitWindow;
      if (webhookSecret !== undefined) updates.webhookSecret = webhookSecret;
      if (settings !== undefined) updates.settings = settings;
      
      const config = await storage.updateChannelConfig(req.params.channelType, updates);
      
      if (!config) {
        return res.status(404).json({ error: "Channel config not found" });
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: PUBLISH STATE API ============
  
  app.get("/api/admin/orchestration/master-products/:id/publish-states", isAdmin, async (req: any, res) => {
    try {
      const masterProductId = req.params.id;
      const states = await storage.getPublishStates(masterProductId);
      res.json(states);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORCHESTRATION: PROVIDER HEALTH API ============
  
  // Get health dashboard (cached results with stats)
  app.get("/api/admin/orchestration/provider-health", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("./services/health-monitor");
      const dashboard = await healthMonitor.getHealthDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger immediate health check for all providers
  app.post("/api/admin/orchestration/provider-health/check", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("./services/health-monitor");
      const results = await healthMonitor.checkAllProviders();
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check specific provider health
  app.post("/api/admin/orchestration/provider-health/:providerType/check", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("./services/health-monitor");
      const result = await healthMonitor.checkProvider(req.params.providerType);
      if (!result) {
        return res.status(404).json({ error: "Provider not found" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get provider health history
  app.get("/api/admin/orchestration/provider-health/:providerType/history", isAdmin, async (req: any, res) => {
    try {
      const { healthMonitor } = await import("./services/health-monitor");
      const limit = parseInt(req.query.limit as string) || 100;
      const history = await healthMonitor.getProviderHistory(req.params.providerType, limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUTO-ROUTING ENDPOINTS ====================

  // Route an order to optimal provider
  app.post("/api/admin/orchestration/routing/route", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("./services/auto-router");
      const { blueprintId, prioritize = "balanced", requireUSA, maxCostCents, excludeProviders } = req.body;
      
      if (!blueprintId) {
        return res.status(400).json({ error: "blueprintId is required" });
      }
      
      const result = await autoRouter.routeOrder({
        blueprintId: parseInt(blueprintId),
        prioritize,
        requireUSA,
        maxCostCents,
        excludeProviders
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recommendations for a blueprint (cheapest, fastest, balanced)
  app.get("/api/admin/orchestration/routing/recommendations/:blueprintId", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("./services/auto-router");
      const blueprintId = parseInt(req.params.blueprintId);
      const recommendations = await autoRouter.getRecommendations(blueprintId);
      res.json(recommendations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get routing statistics
  app.get("/api/admin/orchestration/routing/stats", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("./services/auto-router");
      const stats = autoRouter.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recent routing history
  app.get("/api/admin/orchestration/routing/history", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("./services/auto-router");
      const limit = parseInt(req.query.limit as string) || 20;
      const history = autoRouter.getRecentRoutings(limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Batch route multiple blueprints
  app.post("/api/admin/orchestration/routing/batch", isAdmin, async (req: any, res) => {
    try {
      const { autoRouter } = await import("./services/auto-router");
      const { blueprintIds, prioritize = "balanced", requireUSA, maxCostCents } = req.body;
      
      if (!blueprintIds || !Array.isArray(blueprintIds)) {
        return res.status(400).json({ error: "blueprintIds array is required" });
      }
      
      const results = await autoRouter.routeBatch(blueprintIds, {
        prioritize,
        requireUSA,
        maxCostCents
      });
      
      // Convert Map to object for JSON response
      const resultsObj: Record<number, any> = {};
      for (const [id, result] of Array.from(results.entries())) {
        resultsObj[id] = result;
      }
      
      res.json(resultsObj);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================
  // PROFIT CALCULATOR ENDPOINTS
  // =====================================

  // Get complete profit dashboard
  app.get("/api/admin/orchestration/profit/dashboard", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const dashboard = await profitCalculator.getDashboard();
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get channel profit summaries
  app.get("/api/admin/orchestration/profit/channels", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const summaries = await profitCalculator.getChannelProfitSummaries();
      res.json(summaries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get product profit analysis
  app.get("/api/admin/orchestration/profit/products", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const products = await profitCalculator.getProductProfitAnalysis();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get profit alerts
  app.get("/api/admin/orchestration/profit/alerts", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const alerts = await profitCalculator.generateAlerts();
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate profit for specific parameters
  app.post("/api/admin/orchestration/profit/calculate", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const { revenue, productionCost, shippingCost = 0, channel = "direct" } = req.body;
      
      if (typeof revenue !== "number" || !isFinite(revenue) || revenue < 0) {
        return res.status(400).json({ error: "revenue must be a non-negative number" });
      }
      if (typeof productionCost !== "number" || !isFinite(productionCost) || productionCost < 0) {
        return res.status(400).json({ error: "productionCost must be a non-negative number" });
      }
      if (typeof shippingCost !== "number" || !isFinite(shippingCost) || shippingCost < 0) {
        return res.status(400).json({ error: "shippingCost must be a non-negative number" });
      }
      if (typeof channel !== "string" || !["direct", "etsy", "ebay", "amazon", "printify", "printful", "apliiq"].includes(channel.toLowerCase())) {
        return res.status(400).json({ error: "channel must be one of: direct, etsy, ebay, amazon, printify, printful, apliiq" });
      }
      
      const breakdown = profitCalculator.calculateOrderProfit(
        revenue,
        productionCost,
        shippingCost,
        channel
      );
      res.json(breakdown);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Compare channels for a product
  app.post("/api/admin/orchestration/profit/compare-channels", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const { productionCost, basePrice } = req.body;
      
      if (typeof productionCost !== "number" || !isFinite(productionCost) || productionCost < 0) {
        return res.status(400).json({ error: "productionCost must be a non-negative number" });
      }
      if (typeof basePrice !== "number" || !isFinite(basePrice) || basePrice < 0) {
        return res.status(400).json({ error: "basePrice must be a non-negative number" });
      }
      
      const comparison = profitCalculator.compareChannelsForProduct(productionCost, basePrice);
      res.json(comparison);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recommended price for target margin
  app.post("/api/admin/orchestration/profit/recommended-price", isAdmin, async (req: any, res) => {
    try {
      const { profitCalculator } = await import("./services/profit-calculator");
      const { productionCost, targetMarginPercent = 50, channel = "direct" } = req.body;
      
      if (typeof productionCost !== "number" || !isFinite(productionCost) || productionCost < 0) {
        return res.status(400).json({ error: "productionCost must be a non-negative number" });
      }
      if (typeof targetMarginPercent !== "number" || !isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent > 100) {
        return res.status(400).json({ error: "targetMarginPercent must be a number between 0 and 100" });
      }
      if (typeof channel !== "string") {
        return res.status(400).json({ error: "channel must be a string" });
      }
      
      const recommendedPrice = profitCalculator.calculateRecommendedPrice(
        productionCost,
        targetMarginPercent,
        channel
      );
      res.json({ 
        productionCost,
        targetMarginPercent,
        channel,
        recommendedPrice
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== AUTO-REPRICING ENDPOINTS ====================

  // Get all repricing rules
  app.get("/api/admin/orchestration/repricing/rules", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const rules = await autoRepricer.getRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get repricing statistics
  app.get("/api/admin/orchestration/repricing/stats", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const stats = await autoRepricer.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get repricing history
  app.get("/api/admin/orchestration/repricing/history", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const limit = parseInt(req.query.limit as string) || 50;
      if (limit < 1 || limit > 500) {
        return res.status(400).json({ error: "limit must be between 1 and 500" });
      }
      const history = await autoRepricer.getHistory(limit);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new repricing rule
  app.post("/api/admin/orchestration/repricing/rules", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const { name, description, isActive, priority, conditions, actionType, actionParams, appliesTo, appliesToIds } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required and must be a non-empty string" });
      }
      if (!actionType || typeof actionType !== "string") {
        return res.status(400).json({ error: "actionType is required" });
      }
      const validActionTypes = ["adjust_margin", "match_target", "increase_percent", "decrease_percent"];
      if (!validActionTypes.includes(actionType)) {
        return res.status(400).json({ error: `actionType must be one of: ${validActionTypes.join(", ")}` });
      }
      
      const rule = await autoRepricer.createRule({
        name: name.trim(),
        description,
        isActive,
        priority,
        conditions: conditions || {},
        actionType,
        actionParams: actionParams || {},
        appliesTo,
        appliesToIds,
      });
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a repricing rule
  app.patch("/api/admin/orchestration/repricing/rules/:ruleId", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const { ruleId } = req.params;
      
      if (!ruleId) {
        return res.status(400).json({ error: "ruleId is required" });
      }
      
      const updated = await autoRepricer.updateRule(ruleId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a repricing rule
  app.delete("/api/admin/orchestration/repricing/rules/:ruleId", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const { ruleId } = req.params;
      
      if (!ruleId) {
        return res.status(400).json({ error: "ruleId is required" });
      }
      
      await autoRepricer.deleteRule(ruleId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle rule active status
  app.post("/api/admin/orchestration/repricing/rules/:ruleId/toggle", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const { ruleId } = req.params;
      
      const updated = await autoRepricer.toggleRule(ruleId);
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Preview rule impact (dry run)
  app.get("/api/admin/orchestration/repricing/rules/:ruleId/preview", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const { ruleId } = req.params;
      
      const preview = await autoRepricer.previewRule(ruleId);
      res.json(preview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Run repricing evaluation (dry run or apply)
  app.post("/api/admin/orchestration/repricing/run", isAdmin, async (req: any, res) => {
    try {
      const { autoRepricer } = await import("./services/auto-repricer");
      const { dryRun = true } = req.body;
      
      const results = await autoRepricer.evaluateAllProducts(dryRun);
      res.json({
        dryRun,
        productsAffected: results.length,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // QR Scan Analytics Endpoints
  app.get("/api/admin/orchestration/qr-analytics/summary", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("./services/qr-analytics");
      const summary = await qrAnalyticsService.getSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/qr-analytics/products", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("./services/qr-analytics");
      const limit = parseInt(req.query.limit as string) || 20;
      const analytics = await qrAnalyticsService.getProductAnalytics(Math.min(Math.max(1, limit), 100));
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/qr-analytics/trends", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("./services/qr-analytics");
      const days = parseInt(req.query.days as string) || 30;
      const trends = await qrAnalyticsService.getTrends(Math.min(Math.max(1, days), 365));
      res.json(trends);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/orchestration/qr-analytics/recent", isAdmin, async (req: any, res) => {
    try {
      const { qrAnalyticsService } = await import("./services/qr-analytics");
      const limit = parseInt(req.query.limit as string) || 50;
      const recent = await qrAnalyticsService.getRecentScans(Math.min(Math.max(1, limit), 200));
      res.json(recent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public scan logging endpoint (called when QR is scanned)
  app.post("/api/qr/scan", async (req, res) => {
    try {
      const { qrAnalyticsService } = await import("./services/qr-analytics");
      const { masterProductId, customDesignId, qrUrl, country, region } = req.body;
      
      if (!masterProductId && !customDesignId && !qrUrl) {
        return res.status(400).json({ error: "At least one identifier required" });
      }

      const userAgent = req.headers["user-agent"] || "";
      const deviceType = qrAnalyticsService.detectDeviceType(userAgent);

      await qrAnalyticsService.logScan({
        masterProductId,
        customDesignId,
        qrUrl,
        country,
        region,
        deviceType,
        userAgent,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ======== Cross-Sell Bundles ========
  
  // Get all bundles
  app.get("/api/admin/orchestration/bundles", isAdmin, async (req: any, res) => {
    try {
      const allBundles = await db.select().from(productBundles).orderBy(productBundles.displayOrder);
      res.json(allBundles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get bundle by ID with items
  app.get("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const bundle = await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1);
      if (!bundle.length) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id)).orderBy(bundleItems.displayOrder);
      res.json({ ...bundle[0], items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create bundle
  app.post("/api/admin/orchestration/bundles", isAdmin, async (req: any, res) => {
    try {
      const { items, ...bundleData } = req.body;
      const [bundle] = await db.insert(productBundles).values(bundleData).returning();
      
      if (items && items.length > 0) {
        const itemsWithBundleId = items.map((item: any) => ({
          ...item,
          bundleId: bundle.id,
        }));
        await db.insert(bundleItems).values(itemsWithBundleId);
      }
      
      const finalItems = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id));
      res.json({ ...bundle, items: finalItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update bundle
  app.patch("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { items, ...bundleData } = req.body;
      
      const [bundle] = await db.update(productBundles)
        .set({ ...bundleData, updatedAt: new Date() })
        .where(eq(productBundles.id, id))
        .returning();
      
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      if (items !== undefined) {
        await db.delete(bundleItems).where(eq(bundleItems.bundleId, id));
        if (items.length > 0) {
          const itemsWithBundleId = items.map((item: any) => ({
            ...item,
            bundleId: id,
          }));
          await db.insert(bundleItems).values(itemsWithBundleId);
        }
      }
      
      const finalItems = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));
      res.json({ ...bundle, items: finalItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete bundle
  app.delete("/api/admin/orchestration/bundles/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.delete(productBundles).where(eq(productBundles.id, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle bundle active status
  app.post("/api/admin/orchestration/bundles/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [bundle] = await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      const [updated] = await db.update(productBundles)
        .set({ isActive: !bundle.isActive, updatedAt: new Date() })
        .where(eq(productBundles.id, id))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get bundles for a product (for cross-sell display)
  app.get("/api/bundles/for-product/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const now = new Date();
      
      const activeBundles = await db.select()
        .from(productBundles)
        .where(
          and(
            eq(productBundles.isActive, true),
            or(
              isNull(productBundles.startDate),
              lte(productBundles.startDate, now)
            ),
            or(
              isNull(productBundles.endDate),
              gte(productBundles.endDate, now)
            )
          )
        );
      
      const relevantBundles = activeBundles.filter(bundle => {
        if (!bundle.triggerProductIds || bundle.triggerProductIds.length === 0) {
          return true;
        }
        return bundle.triggerProductIds.includes(productId);
      });
      
      const bundlesWithItems = await Promise.all(
        relevantBundles.map(async bundle => {
          const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, bundle.id));
          return { ...bundle, items };
        })
      );
      
      res.json(bundlesWithItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Calculate bundle price
  app.post("/api/bundles/:id/calculate", async (req, res) => {
    try {
      const { id } = req.params;
      const { selectedItems } = req.body;
      
      const [bundle] = await db.select().from(productBundles).where(eq(productBundles.id, id)).limit(1);
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));
      
      let totalRetailPrice = 0;
      const itemDetails: any[] = [];
      
      for (const item of items) {
        if (selectedItems && !selectedItems.includes(item.id)) continue;
        
        let itemPrice = 0;
        let itemName = "";
        
        if (item.masterProductId) {
          const [mp] = await db.select().from(masterProducts).where(eq(masterProducts.id, item.masterProductId)).limit(1);
          if (mp && mp.retailPrice) {
            itemPrice = parseFloat(mp.retailPrice);
            itemName = mp.title;
          }
        } else if (item.productId) {
          // productId is integer, products.id is varchar - convert to string
          const [product] = await db.select().from(products).where(eq(products.id, String(item.productId))).limit(1);
          if (product) {
            itemPrice = parseFloat(product.basePrice);
            itemName = product.name;
          }
        }
        
        const qty = item.quantity || 1;
        const itemDiscount = item.itemDiscountPercent ? parseFloat(item.itemDiscountPercent) / 100 : 0;
        const discountedPrice = itemPrice * (1 - itemDiscount) * qty;
        
        totalRetailPrice += discountedPrice;
        itemDetails.push({
          itemId: item.id,
          name: itemName,
          unitPrice: itemPrice,
          quantity: qty,
          discount: itemDiscount * 100,
          subtotal: discountedPrice,
        });
      }
      
      let bundlePrice = totalRetailPrice;
      let savings = 0;
      
      if (bundle.pricingType === "fixed_price" && bundle.fixedPrice) {
        bundlePrice = parseFloat(bundle.fixedPrice);
        savings = totalRetailPrice - bundlePrice;
      } else if (bundle.pricingType === "discount_percent" && bundle.discountPercent) {
        const discount = parseFloat(bundle.discountPercent) / 100;
        bundlePrice = totalRetailPrice * (1 - discount);
        savings = totalRetailPrice - bundlePrice;
      } else if (bundle.pricingType === "discount_amount" && bundle.discountAmount) {
        bundlePrice = totalRetailPrice - parseFloat(bundle.discountAmount);
        savings = parseFloat(bundle.discountAmount);
      }
      
      res.json({
        bundleId: bundle.id,
        bundleName: bundle.name,
        originalPrice: totalRetailPrice,
        bundlePrice: Math.max(0, bundlePrice),
        savings: Math.max(0, savings),
        savingsPercent: totalRetailPrice > 0 ? (savings / totalRetailPrice) * 100 : 0,
        items: itemDetails,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk publishing endpoints
  const { bulkPublisher } = await import("./services/bulk-publisher");
  
  app.post("/api/admin/orchestration/bulk-publish", isAdmin, async (req: any, res) => {
    try {
      const { productIds, channelTypes } = req.body;
      if (!productIds?.length || !channelTypes?.length) {
        return res.status(400).json({ error: "productIds and channelTypes arrays required" });
      }
      const jobId = await bulkPublisher.createJob({ productIds, channelTypes });
      res.json({ jobId, message: "Bulk publish job started" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/orchestration/bulk-publish/:jobId", isAdmin, async (req: any, res) => {
    try {
      const job = bulkPublisher.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/orchestration/bulk-publish-jobs", isAdmin, async (req: any, res) => {
    try {
      const jobs = bulkPublisher.getAllJobs();
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ================================================================
  // GIFT MODE API
  // ================================================================

  // Helper to generate unique gift codes
  function generateGiftCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "GIFT";
    for (let i = 0; i < 3; i++) {
      code += "-";
      for (let j = 0; j < 4; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return code;
  }

  // Get active gift packages for purchase
  app.get("/api/gifts/packages", async (req: any, res) => {
    try {
      const packages = await storage.getActiveGiftPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single gift package
  app.get("/api/gifts/packages/:id", async (req: any, res) => {
    try {
      const pkg = await storage.getGiftPackage(req.params.id);
      if (!pkg) return res.status(404).json({ error: "Gift package not found" });
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Purchase a gift - creates a gift code
  app.post("/api/gifts/purchase", async (req: any, res) => {
    try {
      const { giftPackageId, buyerEmail, buyerName, personalMessage, recipientEmail } = req.body;
      
      const pkg = await storage.getGiftPackage(giftPackageId);
      if (!pkg) return res.status(404).json({ error: "Gift package not found" });
      if (!pkg.isActive) return res.status(400).json({ error: "Gift package is not available" });
      
      const buyerUserId = req.user?.claims?.sub || null;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (pkg.redemptionValidDays || 365));
      
      const giftCode = await storage.createGiftCode({
        code: generateGiftCode(),
        giftPackageId,
        buyerUserId,
        buyerEmail,
        buyerName,
        personalMessage: pkg.includePersonalMessage ? personalMessage : null,
        expiresAt,
        status: "active",
        lastEmailedTo: recipientEmail || null,
        lastEmailedAt: recipientEmail ? new Date() : null,
      });
      
      res.json({ 
        success: true,
        giftCode: giftCode.code,
        expiresAt: giftCode.expiresAt,
        packageName: pkg.name,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Look up a gift code for redemption
  app.get("/api/gifts/redeem/:code", async (req: any, res) => {
    try {
      const giftCode = await storage.getGiftCodeByCode(req.params.code.toUpperCase());
      
      if (!giftCode) {
        return res.status(404).json({ error: "Gift code not found" });
      }
      
      if (giftCode.status === "redeemed") {
        return res.status(400).json({ error: "This gift has already been redeemed" });
      }
      
      if (giftCode.status === "expired" || new Date() > new Date(giftCode.expiresAt)) {
        return res.status(400).json({ error: "This gift code has expired" });
      }
      
      if (giftCode.status === "cancelled") {
        return res.status(400).json({ error: "This gift code has been cancelled" });
      }
      
      const pkg = await storage.getGiftPackage(giftCode.giftPackageId);
      if (!pkg) {
        return res.status(500).json({ error: "Gift package not found" });
      }
      
      let productDetails = null;
      if (pkg.masterProductId) {
        const product = await storage.getMasterProduct(pkg.masterProductId);
        if (product) {
          // Get first design version for image
          const designVersions = await storage.getDesignVersions(product.id);
          
          productDetails = {
            id: product.id,
            title: product.title,
            imageUrl: designVersions[0]?.renderedPngUrl || null,
            // Colors/sizes are determined at checkout based on provider
            availableColors: [],
            availableSizes: [],
          };
        }
      }
      
      res.json({
        giftCodeId: giftCode.id,
        packageName: pkg.name,
        packageDescription: pkg.description,
        giftType: pkg.giftType,
        personalMessage: giftCode.personalMessage,
        buyerName: giftCode.buyerName,
        expiresAt: giftCode.expiresAt,
        allowColorChoice: pkg.allowColorChoice,
        allowSizeChoice: pkg.allowSizeChoice,
        allowQrCustomization: pkg.allowQrCustomization,
        product: productDetails,
        dynamicsTier: pkg.dynamicsTier,
        dynamicsMonths: pkg.dynamicsMonths,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Redeem a gift code
  app.post("/api/gifts/redeem/:code", async (req: any, res) => {
    try {
      const giftCode = await storage.getGiftCodeByCode(req.params.code.toUpperCase());
      
      if (!giftCode) {
        return res.status(404).json({ error: "Gift code not found" });
      }
      
      if (giftCode.status !== "active") {
        return res.status(400).json({ error: `Gift code is ${giftCode.status}` });
      }
      
      if (new Date() > new Date(giftCode.expiresAt)) {
        await storage.updateGiftCode(giftCode.id, { status: "expired" });
        return res.status(400).json({ error: "This gift code has expired" });
      }
      
      const { recipientEmail, recipientName, selectedColor, selectedSize, qrContent, qrStyle, shippingAddress } = req.body;
      
      const recipientUserId = req.user?.claims?.sub || null;
      
      const redemption = await storage.createGiftRedemption({
        giftCodeId: giftCode.id,
        recipientUserId,
        recipientEmail,
        recipientName,
        selectedColor,
        selectedSize,
        qrContent,
        qrStyle,
        shippingAddress,
        fulfillmentStatus: "pending",
      });
      
      await storage.updateGiftCode(giftCode.id, { status: "redeemed" });
      
      res.json({
        success: true,
        redemptionId: redemption.id,
        message: "Gift redeemed successfully! Your order is being processed.",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all gift packages
  app.get("/api/admin/gifts/packages", isAdmin, async (req: any, res) => {
    try {
      const packages = await storage.getAllGiftPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create gift package
  app.post("/api/admin/gifts/packages", isAdmin, async (req: any, res) => {
    try {
      const pkg = await storage.createGiftPackage(req.body);
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update gift package
  app.patch("/api/admin/gifts/packages/:id", isAdmin, async (req: any, res) => {
    try {
      const pkg = await storage.updateGiftPackage(req.params.id, req.body);
      if (!pkg) return res.status(404).json({ error: "Gift package not found" });
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete gift package
  app.delete("/api/admin/gifts/packages/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteGiftPackage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: List gift codes
  app.get("/api/admin/gifts/codes", isAdmin, async (req: any, res) => {
    try {
      if (db) {
        const { giftCodes } = await import("@shared/schema");
        const { desc } = await import("drizzle-orm");
        const codes = await db.select().from(giftCodes)
          .orderBy(desc(giftCodes.createdAt))
          .limit(100);
        res.json(codes);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get redemptions
  app.get("/api/admin/gifts/redemptions", isAdmin, async (req: any, res) => {
    try {
      if (db) {
        const { giftRedemptions } = await import("@shared/schema");
        const { desc } = await import("drizzle-orm");
        const redemptions = await db.select().from(giftRedemptions)
          .orderBy(desc(giftRedemptions.redeemedAt))
          .limit(100);
        res.json(redemptions);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update redemption fulfillment status
  app.patch("/api/admin/gifts/redemptions/:id", isAdmin, async (req: any, res) => {
    try {
      const redemption = await storage.updateGiftRedemption(req.params.id, req.body);
      if (!redemption) return res.status(404).json({ error: "Redemption not found" });
      res.json(redemption);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================
  // ADMIN PARTNER STORE ENDPOINTS
  // =====================================

  // List all partner stores
  app.get("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const stores = await storage.getPartnerStores();
      res.json(stores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single partner store
  app.get("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.getPartnerStore(req.params.id);
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create partner store
  app.post("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      // Auto-generate apiKey if not provided
      const dataWithApiKey = {
        ...req.body,
        apiKey: req.body.apiKey || `qrg_${crypto.randomUUID().replace(/-/g, '')}`,
      };
      
      // Validate with Zod schema first
      const validated = insertPartnerStoreSchema.parse(dataWithApiKey);
      
      // Check for existing store with same name and internal flag to prevent duplicates
      const existingStores = await storage.getPartnerStores();
      const normalizedName = validated.name?.toLowerCase().trim();
      const isDuplicate = existingStores.some(
        (s) => s.name?.toLowerCase().trim() === normalizedName && s.isInternal === validated.isInternal
      );
      if (isDuplicate) {
        return res.status(409).json({ 
          error: `A ${validated.isInternal ? 'internal' : 'partner'} store with the name "${validated.name}" already exists` 
        });
      }
      
      const store = await storage.createPartnerStore(validated);
      res.json(store);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("[Partner Store Validation Error]", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Partner Store Create Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update partner store
  app.patch("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.updatePartnerStore(req.params.id, req.body);
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete partner store
  app.delete("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deletePartnerStore(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate API key for partner store
  app.post("/api/admin/partner-stores/:id/regenerate-key", isAdmin, async (req: any, res) => {
    try {
      const newApiKey = `qrg_${crypto.randomUUID().replace(/-/g, '')}`;
      const store = await storage.updatePartnerStore(req.params.id, { apiKey: newApiKey });
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json({ apiKey: newApiKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get partner store products
  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      res.json(storeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Email Templates Admin Routes
  // ============================================

  // Get all email templates
  app.get("/api/admin/email-templates", isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single email template
  app.get("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create email template
  app.post("/api/admin/email-templates", isAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const template = await storage.createEmailTemplate(parsed.data);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update email template
  app.patch("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmailTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const template = await storage.updateEmailTemplate(req.params.id, parsed.data);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete email template
  app.delete("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteEmailTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get email logs
  app.get("/api/admin/email-logs", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getEmailLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ BACKGROUND ASSETS ============
  // Uses standalone storage-path-normalizer for path translation
  
  // List background assets from library_assets table
  app.get("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      
      // Get type filter from query param, default to 'source' for backwards compat
      const typeFilter = (req.query.type as string) || 'source';
      const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
      
      if (!validTypes.includes(typeFilter)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
      
      // Query library_assets filtered by assetType
      const assets = await db.select().from(libraryAssets)
        .where(and(eq(libraryAssets.isActive, true), eq(libraryAssets.assetType, typeFilter)))
        .orderBy(libraryAssets.createdAt);
      
      // Map to expected format with proxyUrl - ALWAYS generate from storageUrl
      const assetsWithProxy = assets.map(asset => {
        const filename = (asset.storageUrl || '').split('/').pop() || '';
        return {
          ...asset,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload background assets (bulk upload support + ZIP extraction)
  app.post("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType, sourceAssetId, cropData, tags } = req.body;
      
      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }
      
      if (assetType !== 'source' && assetType !== 'cropped') {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }
      
      const buffer = Buffer.from(imageData, 'base64');
      const isZip = mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed';
      const { libraryAssets } = await import("@shared/schema");
      
      // Handle ZIP file: save original to zip/, extract contents to raw/
      if (isZip) {
        console.log(`[BackgroundAssets] Processing ZIP file: ${name}`);
        
        // 1. Save original zip to library/backgrounds/zip/
        const zipFileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const zipUploadResult = await uploadToFirebaseStorage(
          buffer,
          zipFileName,
          mimeType,
          'library/backgrounds/zip'
        );
        console.log(`[BackgroundAssets] Saved ZIP to: ${zipUploadResult.storageUrl}`);
        
        // 2. Extract and upload each image to library/backgrounds/raw/
        const zip = await JSZip.loadAsync(buffer);
        const extractedAssets: any[] = [];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          // Skip directories and non-image files
          if (zipEntry.dir) continue;
          const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
          if (!imageExtensions.includes(ext)) continue;
          
          // Skip hidden files (like __MACOSX)
          if (filename.startsWith('__') || filename.includes('/.')) continue;
          
          try {
            const imageBuffer = await zipEntry.async('nodebuffer');
            const imageName = filename.split('/').pop() || filename;
            const sanitizedName = imageName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueName = `${Date.now()}-${sanitizedName}`;
            
            // Determine mime type from extension
            const mimeMap: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
            };
            const imageMimeType = mimeMap[ext] || 'image/png';
            
            // Upload to raw folder
            const uploadResult = await uploadToFirebaseStorage(
              imageBuffer,
              uniqueName,
              imageMimeType,
              'library/backgrounds/raw'
            );
            
            // Save to library_assets table
            const displayName = imageName.replace(/\.[^/.]+$/, '');
            const proxyUrl = `/api/library-files/${encodeURIComponent(uniqueName)}`;
            
            const [asset] = await db.insert(libraryAssets).values({
              ownerType: 'admin',
              assetType: assetType,
              mediaType: 'image',
              name: displayName,
              fileName: uniqueName,
              originalName: imageName,
              mimeType: imageMimeType,
              sizeBytes: imageBuffer.length,
              storageUrl: uploadResult.storageUrl,
              publicUrl: proxyUrl,
              isActive: true,
            }).returning();
            
            extractedAssets.push({ ...asset, proxyUrl });
            
            console.log(`[BackgroundAssets] Extracted: ${imageName} -> ${uploadResult.storageUrl}`);
          } catch (extractError) {
            console.error(`[BackgroundAssets] Failed to extract ${filename}:`, extractError);
          }
        }
        
        console.log(`[BackgroundAssets] ZIP extraction complete: ${extractedAssets.length} images`);
        return res.json({
          zipStoragePath: zipUploadResult.storageUrl,
          extractedCount: extractedAssets.length,
          assets: extractedAssets,
        });
      }
      
      // Regular image upload - goes to library/backgrounds/raw/ for source, /cropped/ for cropped
      const folderPath = assetType === 'source' ? 'library/backgrounds/raw' : 'library/backgrounds/cropped';
      const ext = mimeType?.split('/')[1] || 'png';
      const fileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        fileName,
        mimeType || 'image/png',
        folderPath
      );
      
      const proxyUrl = `/api/library-files/${encodeURIComponent(fileName)}`;
      
      // Save metadata to library_assets table
      const [asset] = await db.insert(libraryAssets).values({
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name,
        fileName,
        originalName: name,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        isActive: true,
      }).returning();
      
      // Return asset with proxy URL for immediate display
      res.json({ ...asset, proxyUrl: asset.publicUrl });
    } catch (error: any) {
      console.error("Error uploading background asset:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update background asset
  app.put("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      const { name, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const [updated] = await db.update(libraryAssets)
        .set(updateData)
        .where(eq(libraryAssets.id, req.params.id))
        .returning();
      
      res.json({ ...updated, proxyUrl: updated.publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete background asset
  app.delete("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      
      // Soft delete (set isActive to false)
      await db.update(libraryAssets)
        .set({ isActive: false })
        .where(eq(libraryAssets.id, req.params.id));
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Migrate files from old folder structure to canonical raw folder
  app.post("/api/admin/background-assets/migrate", isAdmin, async (req: any, res) => {
    try {
      const { migrateFilesToCanonicalFolder } = await import("./lib/firebase-storage-service");
      const result = await migrateFilesToCanonicalFolder();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync storage folder with database - creates DB records for existing files
  app.post("/api/admin/background-assets/sync", isAdmin, async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      const folder = 'library/backgrounds/raw';
      
      console.log(`[LibraryAssets] Syncing assets from: ${folder}`);
      
      const storageFiles = await listFilesInFolder(folder);
      console.log(`[LibraryAssets] Found ${storageFiles.length} files`);
      
      // Get existing records from database
      const existingAssets = await db.select().from(libraryAssets)
        .where(and(eq(libraryAssets.isActive, true), eq(libraryAssets.assetType, 'background')));
      const existingPaths = new Set(existingAssets.map(a => a.storageUrl));
      
      // Find files that don't have database records
      const newFiles = storageFiles.filter(f => !existingPaths.has(f.fullPath));
      console.log(`[LibraryAssets] ${newFiles.length} files need database records`);
      
      // Create database records for new files
      const createdAssets: any[] = [];
      for (const file of newFiles) {
        if (!file.contentType.startsWith('image/')) continue;
        
        try {
          const displayName = file.name.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;
          
          const [asset] = await db.insert(libraryAssets).values({
            ownerType: 'admin',
            assetType: 'background',
            mediaType: 'image',
            name: displayName,
            fileName: file.name,
            originalName: file.name,
            mimeType: file.contentType,
            sizeBytes: file.size,
            storageUrl: file.fullPath,
            publicUrl: proxyUrl,
            isActive: true,
          }).returning();
          
          createdAssets.push({ ...asset, proxyUrl: asset.publicUrl });
          console.log(`[LibraryAssets] Created record for: ${file.name}`);
        } catch (err) {
          console.error(`[LibraryAssets] Failed to create record for ${file.name}:`, err);
        }
      }
      
      res.json({
        scanned: storageFiles.length,
        existing: existingAssets.length,
        created: createdAssets.length,
        assets: createdAssets,
      });
    } catch (error: any) {
      console.error("Error syncing library assets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Start cron jobs for hosting expiration checks and order status sync
  startCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
// Force redeploy Sun Jan 18 11:55:44 PM UTC 2026
