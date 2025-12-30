import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, or, isNull, lte, gte } from "drizzle-orm";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "./lib/qr-generator";
import { insertQrDesignSchema, insertCartItemSchema, insertOrderSchema, insertOrderItemSchema, insertPricingRuleSchema, insertAdminSettingsSchema, insertProductSchema, insertPartnerStoreSchema, insertPartnerStoreProductSchema, productBundles, bundleItems, masterProducts, products, insertEmailTemplateSchema, mockupCache } from "@shared/schema";
import { verifyWidgetToken, signWidgetToken, widgetTokenSchema } from "./lib/widget-auth";
import { printify, getUSAPrintProviders, syncProductPlacements, syncProductVariants, detectCategory } from "./lib/printify";
import { startCostSync, getCostSyncStatus, cancelCostSync, isCostSyncRunning } from "./lib/printify-cost-sync";
import { generatePrintifyComposite } from "./lib/composite-image-generator";
import { uploadImage, uploadImageFromBuffer, getImageBuffer, deleteImage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./lib/image-upload";
import { ObjectStorageService, objectStorageClient } from "./replit_integrations/object_storage";
import { insertHostedImageSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { sendOrderConfirmationEmail } from "./lib/email";
import { submitOrderToPrintify, checkPrintifyOrderStatus } from "./lib/printify-orders";
import { startCronJobs } from "./lib/cron-jobs";
import { generateSitemap } from "./lib/sitemap";
import { z } from "zod";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import Stripe from "stripe";

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

  // Auth routes - returns null if not authenticated (no 401)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Helper to check admin status
      const checkIsAdmin = (userId: string) => {
        const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
        return adminIds.length === 0 || adminIds.includes(userId);
      };

      // Check for email/password session first
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const { passwordHash, ...safeUser } = user;
          return res.json({ ...safeUser, isAdmin: checkIsAdmin(user.id) });
        }
      }
      // Fall back to Replit OAuth
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json(null);
      }
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (user) {
        return res.json({ ...user, isAdmin: checkIsAdmin(userId) });
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

  // Widget API
  app.get("/api/widget/session", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ error: "Token required" });
      }

      const payload = verifyWidgetToken(token);
      
      if (!payload) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Get featured products (limit to 6 for widget)
      const allProducts = await storage.getAllProducts();
      const featuredProducts = allProducts.slice(0, 6).map(p => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl || "",
        basePrice: p.basePrice,
        category: p.category,
      }));

      // Generate QR code linking to KC business listing
      const qrCodeDataUrl = await generateTextQRCode(payload.kcListingUrl, {
        color: "#1e40af",
        backgroundColor: "#ffffff",
      });

      res.json({
        businessName: payload.businessName,
        businessLogoUrl: payload.businessLogoUrl,
        kcListingUrl: payload.kcListingUrl,
        qrCodeDataUrl,
        products: featuredProducts,
      });
    } catch (error: any) {
      console.error("Widget session error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Widget Token Generation (for embed script - requires API key)
  app.post("/api/widget/token", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      const expectedKey = process.env.WIDGET_API_KEY;
      
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid or missing API key" });
      }

      const allowedOrigins = (process.env.ALLOWED_WIDGET_ORIGINS || 'https://kingdomconnects.com').split(',');
      const origin = req.headers.origin || req.headers.referer || '';
      const isAllowedOrigin = allowedOrigins.some(allowed => origin.startsWith(allowed.trim()));
      
      if (!isAllowedOrigin && origin) {
        console.warn("Widget token request from unauthorized origin:", origin);
      }

      const validated = widgetTokenSchema.parse(req.body);
      const token = signWidgetToken(validated);
      
      res.json({ 
        token,
        expiresIn: 3600
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid widget configuration", details: error.errors });
      }
      console.error("Widget token error:", error);
      res.status(500).json({ error: error.message });
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

  // Serve uploaded files from object storage
  app.get("/api/files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      
      // Access file directly using the same pattern as image-upload.ts
      const bucket = objectStorageClient.bucket(bucketName);
      const filePath = `custom-designs/${filename}`;
      const file = bucket.file(filePath);
      
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Get metadata and stream file
      const [metadata] = await file.getMetadata();
      res.setHeader("Content-Type", metadata.contentType || "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000");
      
      file.createReadStream().pipe(res);
    } catch (error: any) {
      console.error("File serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve library files from object storage (supports multiple folder structures)
  app.get("/api/library-files/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      
      const bucket = objectStorageClient.bucket(bucketName);
      
      // First, try to find the actual storage path from the database by URL
      const matchingAsset = await storage.getLibraryAssetByUrl(`/api/library-files/${filename}`);
      
      // Search locations in order of priority
      const searchPaths = matchingAsset?.storageUrl 
        ? [matchingAsset.storageUrl]
        : [
            `library/admin/backgrounds/${filename}`,
            `library/admin/designs/${filename}`,
            `library/admin/videos/${filename}`,
            `library/user/${filename}`,
          ];
      
      let foundFile = null;
      for (const path of searchPaths) {
        const file = bucket.file(path);
        const [exists] = await file.exists();
        if (exists) {
          foundFile = file;
          break;
        }
      }
      
      if (!foundFile) {
        return res.status(404).json({ error: "Library file not found" });
      }
      
      // Get metadata and stream file
      const [metadata] = await foundFile.getMetadata();
      const extension = filename.split(".").pop() || "png";
      let mimeType = metadata.contentType;
      if (!mimeType) {
        if (["mp4", "webm", "mov"].includes(extension)) {
          mimeType = `video/${extension === "mov" ? "quicktime" : extension}`;
        } else {
          mimeType = `image/${extension === "jpg" ? "jpeg" : extension}`;
        }
      }
      
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      foundFile.createReadStream().pipe(res);
    } catch (error: any) {
      console.error("Library file serve error:", error);
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

      // Build line items from cart - customization contains product details
      const lineItems = cartItems.map((item) => {
        const customization = item.customization as any || {};
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: customization.productName || 'QR Gear Product',
              description: `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'}`,
            },
            unit_amount: Math.round(parseFloat(item.price || '0') * 100),
          },
          quantity: item.quantity || 1,
        };
      });

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cart`,
        metadata: {
          userId,
        },
      });

      res.json({ url: session.url, sessionId: session.id });
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
          
          return {
            masterProductId: customization.masterProductId || null,
            variantSku: customization.variantSku || customization.sku || `product-${item.productId}`,
            quantity: item.quantity,
            price: parseFloat(item.price),
            productTitle: product?.name || customization.productName || `Product #${item.productId}`,
            size: customization.selectedSize || customization.size || null,
            color: customization.selectedColor || customization.color || null,
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
      
      res.json({
        isConfigured: printfulClient.isConfigured,
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
      res.json(assets);
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
      
      // Determine folder path based on asset type and categorization
      let folderPath = "library/admin";
      if (assetType === "background") {
        folderPath += "/backgrounds";
        if (season) folderPath += `/seasonal/${season}`;
        else if (event) folderPath += `/events/${event}`;
        else if (category) folderPath += `/${category}`;
      } else if (assetType === "design") {
        folderPath += "/designs";
        if (category) folderPath += `/${category}`;
      } else if (assetType === "video") {
        folderPath += "/videos";
        if (season) folderPath += `/seasonal/${season}`;
        else if (event) folderPath += `/events/${event}`;
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
      const { productId, color, storeId } = req.body;
      
      if (!productId || !color) {
        return res.status(400).json({ error: "productId and color are required" });
      }
      
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
      
      if (!artworkUrl) {
        return res.status(400).json({ error: "No artwork found for this product" });
      }
      
      console.log(`[StorefrontMockup] Getting mockup for ${color} (database-first with Printify fallback)`);
      
      // Use the mockup service with database-first + Printify fallback
      const { getMockupWithFallback } = await import('./lib/mockup-service.js');
      
      const result = await getMockupWithFallback({
        blueprintId,
        printProviderId,
        colorName: color,
        colorHex: colorHex || undefined,
        canonicalPlacementId: "FRONT_CHEST",
        artworkUrl,
        artworkVariant,
      }, storage);
      
      console.log(`[StorefrontMockup] Got mockup (fromCache: ${result.fromCache})`);
      
      // Also update products table for legacy compatibility
      // Store BOTH flat and lifestyle mockups - frontend prefers lifestyle when available
      const existingProductMockups = (product.mockupsByColor as Record<string, any>) || {};
      existingProductMockups[color] = { 
        front: result.mockupUrl,
        lifestyle: result.lifestyleMockupUrl || undefined
      };
      
      await storage.updateProduct(canonicalProductId, {
        mockupsByColor: existingProductMockups,
      });
      
      console.log(`[StorefrontMockup] Updated mockups for ${color}: flat=${!!result.mockupUrl}, lifestyle=${!!result.lifestyleMockupUrl}`);
      
      // Update partner store product if storeId provided
      if (storeId) {
        const storeProduct = await storage.getPartnerStoreProduct(storeId, canonicalProductId);
        if (storeProduct) {
          const existingMockups = (storeProduct.mockupsByColor as Record<string, any>) || {};
          existingMockups[color] = { 
            front: result.mockupUrl,
            lifestyle: result.lifestyleMockupUrl || undefined
          };
          
          await storage.updatePartnerStoreProductByIds(storeProduct.partnerStoreId, canonicalProductId, {
            mockupsByColor: existingMockups,
          });
        }
      }
      
      res.json({ 
        success: true, 
        color, 
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        mockupsByColor: existingProductMockups 
      });
    } catch (error: any) {
      console.error("[StorefrontMockup] Error:", error);
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

  // Start cron jobs for hosting expiration checks and order status sync
  startCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
