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

  export function register(app: express.Express): void {
  app.get('/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'ok', 
    mode: 'firebase-functions', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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
        const originalDescription = rawRichDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const adminDescription = catalogBlankDescriptions[blankKey] || '';
        const productTitle = p.title || p.name || 'Untitled Product';
        const description = adminDescription || originalDescription || `${productTitle}${p.brand ? ' by ' + p.brand : ''}. Premium quality custom product.`;

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
          description,
          providerDescription: originalDescription,
          adminCatalogDescription: adminDescription || null,
          effectiveDescription: description,
          originalDescription,
          adminDescription,
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
    const { customization, quantity } = req.body;
    
    const productId = customization?.productId;
    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    const pricingInput: CustomizationPricing = {
      productId,
      productLine: customization?.productLine || 'text',
      hasTextAbove: customization?.hasTextAbove || false,
      hasTextBelow: customization?.hasTextBelow || false,
      templateId: customization?.templateId,
      hostingTierCode: customization?.hostingTierCode || customization?.dynamicHostingTier || '1_year',
    };

    const authoritativePrice = await calculateAuthoritativePrice(pricingInput);
    if (authoritativePrice === null) {
      res.status(400).json({ error: 'Product not found or has no valid price' });
      return;
    }

    const cartItem = {
      customization,
      quantity: quantity || 1,
      price: authoritativePrice.toString(),
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

app.post('/checkout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const userId = (req as any).user.uid;
    const { successUrl, cancelUrl } = req.body;

    const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    
    if (cartSnapshot.empty) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lineItemsPromises = cartItems.map(async (item: any) => {
      const customization = item.customization || {};
      const productId = customization.productId;
      const productName = customization.productName || 'Custom QR Product';
      const productImage = customization.productImage;
      
      let price: number | null = null;
      if (productId) {
        const pricingInput: CustomizationPricing = {
          productId,
          productLine: customization.productLine || 'text',
          hasTextAbove: customization.hasTextAbove || false,
          hasTextBelow: customization.hasTextBelow || false,
          templateId: customization.templateId,
          hostingTierCode: customization.hostingTierCode || customization.dynamicHostingTier || '1_year',
        };
        price = await calculateAuthoritativePrice(pricingInput);
      }
      if (price === null) {
        price = parseFloat(item.price);
      }
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for item: ${productName}`);
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            images: productImage ? [productImage] : [],
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: item.quantity || 1,
      };
    });

    const lineItems = await Promise.all(lineItemsPromises);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
      },
      success_url: successUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/cart`,
      metadata: {
        userId,
        referrerId: req.body.referrerId || '',
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/checkout/embedded', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const userId = (req as any).user.uid;
    const { returnUrl } = req.body;

    const cartSnapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    
    if (cartSnapshot.empty) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lineItemsPromises = cartItems.map(async (item: any) => {
      const customization = item.customization || {};
      const productId = customization.productId;
      const productName = customization.productName || 'Custom QR Product';
      const productImage = customization.productImage;
      
      let price: number | null = null;
      if (productId) {
        const pricingInput: CustomizationPricing = {
          productId,
          productLine: customization.productLine || 'text',
          hasTextAbove: customization.hasTextAbove || false,
          hasTextBelow: customization.hasTextBelow || false,
          templateId: customization.templateId,
          hostingTierCode: customization.hostingTierCode || customization.dynamicHostingTier || '1_year',
        };
        price = await calculateAuthoritativePrice(pricingInput);
      }
      if (price === null) {
        price = parseFloat(item.price);
      }
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for item: ${productName}`);
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: productName,
            images: productImage ? [productImage] : [],
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: item.quantity || 1,
      };
    });

    const lineItems = await Promise.all(lineItemsPromises);
    const cartItemIds = cartItems.map((item: any) => item.id);

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
      },
      return_url: returnUrl || `${req.headers.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        cartItemIds: JSON.stringify(cartItemIds),
      },
    });

    res.json({ clientSecret: session.client_secret });
  } catch (error: any) {
    console.error('Embedded checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/checkout/session-status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const sessionId = req.query.session_id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'session_id is required' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/checkout/verify/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Stripe not configured' });
      return;
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/gallery', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrDesigns')
      .where('isPublic', '==', true)
      .limit(50)
      .get();
    const items = docsToArray(snapshot);
    items.sort((a: any, b: any) => {
      const dateA = a.createdAt?._seconds || 0;
      const dateB = b.createdAt?._seconds || 0;
      return dateB - dateA;
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const bucket = storage.bucket();
    const file = bucket.file(`custom-designs/${filename}`);
    
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    file.createReadStream().pipe(res);
  } catch (error: any) {
    console.error('File serving error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/library-files/:storeType/:mediaType/:fname', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeType, mediaType, fname } = req.params;
    if (storeType === 'member') { res.status(400).json({ error: 'Use /library-files/member/:userId/:mediaType/:filename' }); return; }
    const storagePath = `library/${storeType}/${mediaType}/${fname}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: 'File not found' }); return; }
    const [metadata] = await file.getMetadata();
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=3600');
    file.createReadStream().pipe(res);
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

app.get('/library-files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const bucket = storage.bucket();
    
    // Search in new canonical paths first, then legacy paths
    const possiblePaths = [
      `library/backgrounds/raw/${filename}`,
      `library/backgrounds/cropped/${filename}`,
      `library/backgrounds/archive/${filename}`,
      `library/backgrounds/zip/${filename}`,
      `libraries/designs/${filename}`,
      `libraries/videos/${filename}`,
      `library/${filename}`,
      `library/admin/backgrounds/${filename}`,
      `library/admin/designs/${filename}`,
      `library/backgrounds/raw/zip/${filename}`,
    ];
    
    for (const path of possiblePaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      
      if (exists) {
        const [metadata] = await file.getMetadata();
        res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        file.createReadStream().pipe(res);
        return;
      }
    }
    
    res.status(404).json({ error: 'File not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC test endpoint - no auth
app.get('/test-images', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('library_assets').where('isActive', '==', true).limit(20).get();
    const assets = snapshot.docs.map(doc => {
      const data = doc.data();
      const storageUrl = data.storageUrl || '';
      const filename = storageUrl.split('/').pop() || '';
      return {
        id: doc.id,
        name: data.name,
        storageUrl,
        publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
      };
    });
    res.json(assets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC test endpoint - real product config data (no auth)

// PUBLIC test endpoint - update product options (no auth)

// PUBLIC test endpoint - sync product from Printify (no auth - simplified)

app.get('/admin/settings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('settings').doc('admin').set(req.body, { merge: true });
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.data());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('products').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = req.body.id || `product_${Date.now()}`;
    await db.collection('products').doc(productId).set({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('products').doc(productId).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('products').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('products').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/products/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const current = doc.data()!.isEnabled || false;
    await db.collection('products').doc(req.params.id).update({
      isEnabled: !current,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const updated = await db.collection('products').doc(req.params.id).get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('products').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/orders', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('orders').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await db.collection('orders').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/users', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('users').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/categories', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('productCategories').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/browsing-history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('browsingHistory')
      .where('userId', '==', userId)
      .orderBy('viewedAt', 'desc')
      .limit(20)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/browsing-history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const docRef = await db.collection('browsingHistory').add({
      ...req.body,
      userId,
      viewedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/coupons/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons')
      .where('code', '==', req.params.code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      res.status(404).json({ error: 'Coupon not found or expired' });
      return;
    }
    
    const coupon = docToObject(snapshot.docs[0]);
    
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Coupon has expired' });
      return;
    }
    
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      res.status(400).json({ error: 'Coupon has reached maximum redemptions' });
      return;
    }
    
    res.json(coupon);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



  }
  