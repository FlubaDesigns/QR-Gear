import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
  import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
  import { printfulClient } from '../services/printful';
  import type { CustomizationPricing } from '../services/pricing';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';
  import Stripe from 'stripe';
  import { getNexusMailService, sendOrderConfirmation as nexusOrderConfirmation, sendShippingNotification as nexusShippingNotification, seedDefaultTemplates } from '../nexusmail';
  import { registerCoreCheckoutRoutes } from './core-routes-checkout';

  export function register(app: express.Express): void {
  registerCoreCheckoutRoutes(app);
  app.get('/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'ok', 
    mode: 'firebase-functions', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    buildId: process.env.QRGEAR_BUILD_ID || 'unknown',
  });
});

app.get('/members/allowed-products', async (req: Request, res: Response): Promise<void> => {
  try {
    const section = req.query.section as string | undefined;
    const validSections = ['member', 'public', 'external', 'marketplace', 'platform'];
    if (section && !validSections.includes(section)) {
      res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` });
      return;
    }

    const pricingDoc = await db.collection('testSettings').doc('pricing').get();
    const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
    const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
    const markupPercent = pricingSettings?.markupPercent ?? 25;
    const markupFixed = pricingSettings?.markupFixed ?? 0;

    const effectiveSection = section || 'member';
    let catalogBlankFilter: Set<string> | null = null;
    let catalogBlankDescriptions: Record<string, string> = {};
    const assignDoc = await db.collection('systemSettings').doc('catalog-assignments').get();
    const catalogId = assignDoc.exists ? assignDoc.data()?.[effectiveSection] : null;
    if (catalogId) {
      const catDoc = await db.collection('catalogs').doc(catalogId).get();
      if (catDoc.exists) {
        const blankIds = catDoc.data()?.blankIds || [];
        catalogBlankFilter = new Set(blankIds.map(String));
        catalogBlankDescriptions = catDoc.data()?.blankDescriptions || {};
        console.log(`[Member Products CF] Filtering by catalog "${catDoc.data()?.name}" (${blankIds.length} blanks) for section "${effectiveSection}"`);
      }
    }

    const blueprintCache = new Map<number, any>();

    const enrichProducts = async (rawProducts: any[]) => {
      return await Promise.all((rawProducts || []).map(async (p: any) => {
        let baseCost = Number(p.baseCost || 0);
        let imageUrl = p.imageUrl || p.thumbnailUrl || p.image_url || null;
        const blueprintId = Number(p.blueprintId || p.blueprint_id || 0) || null;
        const printProviderId = Number(p.printProviderId || p.print_provider_id || 0) || null;

        if (blueprintId) {
          try {
            if (!blueprintCache.has(blueprintId)) {
              const bpDoc = await db.collection('printify_blueprints').doc(String(blueprintId)).get();
              if (bpDoc.exists) blueprintCache.set(blueprintId, bpDoc.data());
            }
            const bpData = blueprintCache.get(blueprintId);
            if (bpData) {
              const bpImage =
                bpData.images?.[0] ||
                bpData.imageUrl ||
                bpData.image_url ||
                null;
              if ((!imageUrl || String(imageUrl).includes('/api/files/')) && bpImage) imageUrl = bpImage;
            }
          } catch (e: any) {
            console.log(`[Member Products CF] Blueprint image lookup failed for ${blueprintId}: ${e.message}`);
          }
        }

        if (baseCost === 0 && blueprintId && printProviderId) {
          try {
            const provDoc = await db.collection('printifyPrintProviders')
              .doc(`${blueprintId}_${printProviderId}`)
              .get();

            if (provDoc.exists) {
              const minCost = provDoc.data()?.minCost;
              if (minCost) baseCost = Number(minCost) / 100;
            }
          } catch (e: any) {
            console.warn(`[Member Products CF] Cost lookup failed for ${blueprintId}_${printProviderId}: ${e.message}`);
          }
        }

        const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
        const profit = retailPrice - baseCost;
        const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;

        let placements = p.placements;
        if (!placements || placements.length === 0) {
          placements = [
            { id: 'front', title: 'Front', widthInches: '12"', heightInches: '16"' },
            { id: 'back', title: 'Back', widthInches: '12"', heightInches: '16"' },
            { id: 'pocket', title: 'Left Chest', widthInches: '4"', heightInches: '4"' },
            { id: 'left_sleeve', title: 'Left Sleeve', widthInches: '4"', heightInches: '4"' },
            { id: 'right_sleeve', title: 'Right Sleeve', widthInches: '4"', heightInches: '4"' },
          ];
        } else {
          placements = placements.map((pl: any) => {
            const nId = normalizePlacement(p.fulfillmentProvider || 'printify', pl.id || pl.type || '');
            return { ...pl, id: nId };
          });
        }

        const fulfillmentProvider = p.fulfillmentProvider || 'printify';
        const blankKey = fulfillmentProvider === 'printful' ? `pf:${blueprintId}` : String(blueprintId);
        const bpData = blueprintId ? blueprintCache.get(blueprintId) : null;
        const rawRichDesc = bpData?.richDescription || bpData?.description || p.description || '';
        const providerDescription = rawRichDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const adminCatalogDescription = catalogBlankDescriptions[blankKey] || '';
        const productTitle = p.title || p.name || 'Untitled Product';
        const effectiveDescription = adminCatalogDescription || providerDescription || `${productTitle}${p.brand ? ' by ' + p.brand : ''}. Premium quality custom product.`;

        return {
          ...p,
          blueprintId,
          printProviderId,
          canonicalBlankKey: blankKey,
          provider: fulfillmentProvider,
          title: p.title || p.name || 'Untitled Product',
          imageUrl,
          baseCost,
          retailPrice,
          profit,
          memberEarnings,
          placements,
          description: effectiveDescription,
          providerDescription,
          originalDescription: providerDescription,
          adminCatalogDescription: adminCatalogDescription || null,
          effectiveDescription,
        };
      }));
    };

    const memberDoc = await db.collection('storeAllowedProducts').doc('member-products').get();
    const memberData = memberDoc.exists ? memberDoc.data() : null;
    const memberProducts = Array.isArray(memberData?.products) ? memberData.products : [];

    if (memberProducts.length > 0) {
      let products = await enrichProducts(memberProducts);
      if (catalogBlankFilter) {
        products = products.filter((p: any) => catalogBlankFilter!.has(p.canonicalBlankKey || String(p.blueprintId)));
        console.log(`[Member Products CF] Catalog filter applied: ${products.length} products remain from ${memberProducts.length}`);
      }
      console.log(`[Member Products CF] Using curated member-products doc with ${products.length} products`);
      res.json({
        products,
        storeId: 'member-products',
        source: 'storeAllowedProducts/member-products'
      });
      return;
    }

    const catalogSnap = await db.collection('products')
      .where('isEnabled', '==', true)
      .get();

    const catalogProducts = catalogSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        blueprintId: d.blueprintId || d.blueprint_id || null,
        printProviderId: d.printProviderId || d.print_provider_id || null,
        title: d.title || d.name || 'Untitled Product',
        imageUrl: d.imageUrl || d.thumbnailUrl || d.image_url || null,
        baseCost: d.baseCost || 0,
        placements: d.placements || [],
        brand: d.brand || null,
        isEnabled: d.isEnabled === true,
      };
    }).filter(p => !!p.blueprintId);

    let products = await enrichProducts(catalogProducts);
    if (catalogBlankFilter) {
      products = products.filter((p: any) => catalogBlankFilter!.has(p.canonicalBlankKey || String(p.blueprintId)));
      console.log(`[Member Products CF] Catalog filter applied (fallback): ${products.length} products remain`);
    }

    console.log(`[Member Products CF] member-products empty/missing. Falling back to /products catalog with ${products.length} products`);

    res.json({
      products,
      storeId: 'member-products',
      source: 'products-fallback'
    });
  } catch (error: any) {
    console.error('[Member Products CF] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const featured = req.query.featured === 'true';
    let query: FirebaseFirestore.Query = db.collection('products').where('isEnabled', '==', true);
    if (featured) {
      query = query.where('isFeatured', '==', true);
    }
    const snapshot = await query.get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/designs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/user', async (req: Request, res: Response): Promise<void> => {
  try {
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
      // Return null instead of 401 for unauthenticated requests
      res.json(null);
      return;
    }

    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      const newUser = {
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0],
        isAdmin: ADMIN_USER_IDS.includes(decodedToken.uid),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(decodedToken.uid).set(newUser);
      res.json({ ...newUser, id: decodedToken.uid });
      return;
    }

    // Merge Firestore data with isAdmin check from both sources
    const userData = docToObject(userDoc);
    const isAdmin = userData.isAdmin === true || ADMIN_USER_IDS.includes(decodedToken.uid);
    res.json({ ...userData, isAdmin });
  } catch (error: any) {
    // Return null on error instead of 401
    console.error('[/auth/user] Error:', error.message);
    res.json(null);
  }
});

app.get('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const { customization, quantity, price: clientPrice } = req.body;

    const productId = customization?.productId;
    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    // ── Resolve authoritative price ───────────────────────────────────────
    // New store products use admin_catalog_instances (linkId/instanceId).
    // Old products use the products collection.
    // The add-to-cart endpoint already validated the price — trust it when
    // a catalog instance is involved, falling back to old pricing logic.
    let authoritativePrice: number | null = null;

    // Path 1: catalog instance (new store system)
    const instanceId = customization?.instanceId || customization?.linkId || productId;
    const instanceDoc = await db.collection('admin_catalog_instances').doc(instanceId).get();
    if (instanceDoc.exists) {
      const d = instanceDoc.data()!;
      authoritativePrice = d.resolved?.pricing?.customerPrice ?? null;

      // If not on the instance, check the packet
      if ((authoritativePrice === null || authoritativePrice <= 0) && d.currentPacketId) {
        try {
          const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
          if (pDoc.exists) {
            const pkt = pDoc.data()!;
            authoritativePrice = pkt.pricing?.customerPrice ?? null;
          }
        } catch (_) {}
      }

      // Last resort: trust the already-validated price from the add-to-cart step
      if ((authoritativePrice === null || authoritativePrice <= 0) && clientPrice) {
        authoritativePrice = parseFloat(String(clientPrice));
      }
    }

    // Path 2: legacy products collection (old builder flow)
    if (authoritativePrice === null || authoritativePrice <= 0) {
      const pricingInput: CustomizationPricing = {
        productId,
        productLine: customization?.productLine || 'text',
        hasTextAbove: customization?.hasTextAbove || false,
        hasTextBelow: customization?.hasTextBelow || false,
        templateId: customization?.templateId,
        hostingTierCode: customization?.hostingTierCode || customization?.dynamicHostingTier || '1_year',
      };
      authoritativePrice = await calculateAuthoritativePrice(pricingInput);
    }

    if (authoritativePrice === null || authoritativePrice <= 0) {
      res.status(400).json({ error: 'Product not found or has no valid price' });
      return;
    }

    const cartItem = {
      customization,
      quantity: quantity || 1,
      price: (Math.round(authoritativePrice * 100) / 100).toString(),
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('cartItems').add(cartItem);
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    await db.collection('cartItems').doc(req.params.id).update({ quantity });
    const doc = await db.collection('cartItems').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('cartItems').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('orders').add({
      ...req.body,
      userId,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrTemplates').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'QR Template not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/hosting-tiers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stores/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores')
      .where('slug', '==', req.params.slug)
      .limit(1)
      .get();
    if (snapshot.empty) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(docToObject(snapshot.docs[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/stripe/publishable-key', async (_req: Request, res: Response): Promise<void> => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }
  res.json({ publishableKey: key });
});

}
