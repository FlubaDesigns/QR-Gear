import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient } from '../services/printful';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';

  export function register(app: express.Express): void {
  // ============ BATCH: STORE/LIBRARY FILE ROUTES ============

app.get('/store/product/:linkId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const linkDoc = await db.collection('storeProductLinks').doc(linkId).get();
    if (!linkDoc.exists) { res.status(404).json({ error: "Product not found" }); return; }
    const link = linkDoc.data()!;

    let price: number | null = null;
    let availableSizes: string[] = link.enabledSizes || [];
    let availableColors: string[] = link.enabledColors || [];
    let availablePlacements: string[] = [];
    let description = '';
    let category = '';
    let productLine = '';

    if (link.packetId) {
      const packetDoc = await db.collection('packets').doc(link.packetId).get();
      if (packetDoc.exists) {
        const packet = packetDoc.data()!;
        const productId = packet.productId;
        if (productId) {
          price = await getAuthoritativePrice(productId);
          const productDoc = await db.collection('products').doc(productId).get();
          if (productDoc.exists) {
            const product = productDoc.data()!;
            if (availableSizes.length === 0) availableSizes = product.availableSizes || product.sizes || [];
            if (availableColors.length === 0) availableColors = product.availableColors || product.colors || [];
            availablePlacements = product.availablePlacements || [];
            description = product.description || '';
            category = product.category || '';
            productLine = product.productLine || '';
          }
        }
        if (price === null && packet.pricingSnapshot?.totalPrice) {
          price = parseFloat(packet.pricingSnapshot.totalPrice);
        }
      }
    }

    if (price === null && link.pricing) {
      price = parseFloat(link.pricing.customerPrice || link.pricing.totalPrice || link.pricing.retailPrice || '0');
    }

    res.json({
      id: linkDoc.id,
      name: link.productName || 'Untitled Product',
      description,
      category,
      productLine,
      imageUrl: link.mockupUrl || link.compositeUrl || link.qrOnlyUrl || null,
      qrCodeUrl: link.qrOnlyUrl || null,
      qrProductType: link.qrProductState || 'qr-basics',
      price: price !== null ? Math.round(price * 100) / 100 : null,
      availableSizes,
      availableColors,
      availablePlacements,
      defaultColor: link.defaultColor || null,
      mockupsByColor: null,
      selectedGraphicSize: link.selectedGraphicSize || null,
      storeId: link.storeId || null,
      storeName: link.storeName || null,
      channel: link.channel || null,
      collection: link.collection || null,
      packetId: link.packetId || null,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/store/product/:linkId/add-to-cart', async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const { selectedColor, selectedSize, quantity = 1 } = req.body;

    const linkDoc = await db.collection('storeProductLinks').doc(linkId).get();
    if (!linkDoc.exists) { res.status(404).json({ error: "Product not found" }); return; }
    const link = linkDoc.data()!;

    let price: number | null = null;
    let productId: string | null = null;

    if (link.packetId) {
      const packetDoc = await db.collection('packets').doc(link.packetId).get();
      if (packetDoc.exists) {
        const packet = packetDoc.data()!;
        productId = packet.productId || null;
        if (productId) {
          price = await getAuthoritativePrice(productId);
        }
        if (price === null && packet.pricingSnapshot?.totalPrice) {
          price = parseFloat(packet.pricingSnapshot.totalPrice);
        }
      }
    }

    if (price === null && link.pricing) {
      price = parseFloat(link.pricing.customerPrice || link.pricing.totalPrice || link.pricing.retailPrice || '0');
    }

    if (price === null || price <= 0) {
      res.status(400).json({ error: "Price could not be determined for this product" });
      return;
    }

    res.json({
      productId: productId || linkId,
      linkId,
      price: Math.round(price * 100) / 100,
      name: link.productName || 'Untitled Product',
      imageUrl: link.mockupUrl || link.compositeUrl || link.qrOnlyUrl || null,
      selectedColor: selectedColor || link.defaultColor || null,
      selectedSize: selectedSize || null,
      quantity,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/store/:storeType/:storeName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeType, storeName } = req.params;
    const segment = req.query.segment as string | undefined;

    if (storeType === 'channel') {
      const channelDoc = await db.collection('storeChannels').doc(storeName).get();
      if (!channelDoc.exists) {
        res.status(404).json({ error: "Channel not found" });
        return;
      }
      const channelData = channelDoc.data() || {};
      const storeId = channelData.storeId;

      let storeData: any = { id: storeId, name: storeId };
      if (storeId) {
        const storeDoc = await db.collection('stores').doc(storeId).get();
        if (storeDoc.exists) {
          storeData = { id: storeDoc.id, ...storeDoc.data() };
        }
      }

      const channelName = channelData.name || storeName;
      let linksSnapshot = (await db.collection('storeProductLinks')
        .where('storeId', '==', storeId)
        .where('channel', '==', channelName).get());
      if (linksSnapshot.empty && channelName !== storeName) {
        linksSnapshot = await db.collection('storeProductLinks')
          .where('storeId', '==', storeId)
          .where('channel', '==', storeName).get();
      }
      if (segment) {
        const filteredDocs = linksSnapshot.docs.filter((doc: any) => doc.data().collection === segment);
        linksSnapshot = { ...linksSnapshot, docs: filteredDocs, empty: filteredDocs.length === 0, size: filteredDocs.length } as any;
      }

      const productsRaw = linksSnapshot.docs.map((doc: any) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.productName || 'Untitled Product',
          imageUrl: d.mockupUrl || d.compositeUrl || d.qrOnlyUrl || null,
          segment: d.collection || null,
          isFeatured: false,
          isSeasonalPromo: false,
          templateVariant: null,
          qrProductType: d.qrProductState || 'qr-basics',
          qrCodeUrl: d.qrOnlyUrl || null,
          selectedColors: d.enabledColors || [],
          availableSizes: d.enabledSizes || [],
          defaultColor: d.defaultColor || null,
          mockupsByColor: null,
          packetId: d.packetId || null,
          pricing: d.pricing || null,
          createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      });

      const products = await Promise.all(productsRaw.map(async (p: any) => {
        let price: number | null = null;
        if (p.packetId) {
          const pDoc = await db.collection('packets').doc(p.packetId).get();
          if (pDoc.exists) {
            const pkt = pDoc.data()!;
            if (pkt.productId) price = await getAuthoritativePrice(pkt.productId);
            if (price === null && pkt.pricingSnapshot?.totalPrice) price = parseFloat(pkt.pricingSnapshot.totalPrice);
          }
        }
        if (price === null && p.pricing) {
          price = parseFloat(p.pricing.customerPrice || p.pricing.totalPrice || p.pricing.retailPrice || '0');
        }
        return { ...p, price: price !== null ? Math.round(price * 100) / 100 : null, packetId: undefined, pricing: undefined };
      }));

      console.log(`[Public Store] Channel "${storeName}" in store "${storeId}": ${products.length} products`);
      res.json({
        storeType: storeData.roleType || 'internal',
        storeName: channelData.name || storeName,
        segment: segment || null,
        products,
      });
      return;
    }

    const snap = await db.collection('stores').where('roleType', '==', storeType).limit(10).get();
    if (snap.empty) { res.status(404).json({ error: "Store not found" }); return; }

    let matchedStore: any = null;
    for (const doc of snap.docs) {
      const data = doc.data();
      const storeSlug = (data.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (doc.id === storeName || storeSlug === storeName) {
        matchedStore = { id: doc.id, ...data };
        break;
      }
    }
    if (!matchedStore) { res.status(404).json({ error: "Store not found" }); return; }

    const channelsSnap = await db.collection('storeChannels').where('storeId', '==', matchedStore.id).get();
    const channels = channelsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    let linksQuery: any = db.collection('storeProductLinks').where('storeId', '==', matchedStore.id);
    if (segment) {
      linksQuery = linksQuery.where('collection', '==', segment);
    }
    const linksSnapshot = await linksQuery.get();
    const productsRaw2 = linksSnapshot.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.productName || 'Untitled Product',
        imageUrl: d.mockupUrl || d.compositeUrl || d.qrOnlyUrl || null,
        segment: d.collection || null,
        isFeatured: false,
        isSeasonalPromo: false,
        templateVariant: null,
        qrProductType: d.qrProductState || 'qr-basics',
        qrCodeUrl: d.qrOnlyUrl || null,
        selectedColors: d.enabledColors || [],
        availableSizes: d.enabledSizes || [],
        defaultColor: d.defaultColor || null,
        mockupsByColor: null,
        packetId: d.packetId || null,
        pricing: d.pricing || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    const products = await Promise.all(productsRaw2.map(async (p: any) => {
      let price: number | null = null;
      if (p.packetId) {
        const pDoc = await db.collection('packets').doc(p.packetId).get();
        if (pDoc.exists) {
          const pkt = pDoc.data()!;
          if (pkt.productId) price = await getAuthoritativePrice(pkt.productId);
          if (price === null && pkt.pricingSnapshot?.totalPrice) price = parseFloat(pkt.pricingSnapshot.totalPrice);
        }
      }
      if (price === null && p.pricing) {
        price = parseFloat(p.pricing.customerPrice || p.pricing.totalPrice || p.pricing.retailPrice || '0');
      }
      return { ...p, price: price !== null ? Math.round(price * 100) / 100 : null, packetId: undefined, pricing: undefined };
    }));

    console.log(`[Public Store] Store "${matchedStore.name}" (${storeType}): ${products.length} products, ${channels.length} channels`);
    res.json({
      storeType,
      storeName: matchedStore.name,
      segment: segment || null,
      channels,
      products,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/product-categories/seed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Use POST to seed categories" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/product-categories/seed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const defaults = ['T-Shirts', 'Hoodies', 'Mugs', 'Posters', 'Stickers', 'Phone Cases', 'Tote Bags', 'Hats'];
    const batch = db.batch();
    defaults.forEach(name => { const ref = db.collection('product_categories').doc(); batch.set(ref, { name, slug: name.toLowerCase().replace(/\s+/g, '-'), isActive: true, createdAt: new Date() }); });
    await batch.commit();
    res.json({ success: true, count: defaults.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ BATCH: FILE SERVING ROUTES ============

app.get('/library-files/:file', async (req: Request, res: Response): Promise<void> => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const fileName = String(req.params.file || '').trim();
    if (!fileName) { res.status(400).json({ error: 'Missing filename' }); return; }
    const bucket = admin.storage().bucket();
    const roots = ['library/backgrounds/raw', 'library/backgrounds/cropped', 'library/backgrounds/raw/zip', 'library/backgrounds/zip', 'library/templates', 'library/designs', 'custom-designs', 'library/images'];
    for (const root of roots) {
      const file = bucket.file(`${root}/${fileName}`);
      const [exists] = await file.exists();
      if (exists) {
        const [metadata] = await file.getMetadata();
        res.set('Content-Type', metadata.contentType || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=3600');
        const stream = file.createReadStream();
        stream.pipe(res);
        return;
      }
    }
    const imgSnap = await admin.firestore().collection('admin_images').where('isActive', '==', true).get();
    for (const doc of imgSnap.docs) {
      const sUrl = doc.data().storageUrl || '';
      if (sUrl && sUrl.split('/').pop() === fileName) {
        const file = bucket.file(sUrl);
        const [exists] = await file.exists();
        if (exists) {
          const [metadata] = await file.getMetadata();
          res.set('Content-Type', metadata.contentType || 'application/octet-stream');
          res.set('Cache-Control', 'public, max-age=3600');
          file.createReadStream().pipe(res);
          return;
        }
      }
    }
    res.status(404).json({ error: 'File not found' });
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

app.get('/files/:file', async (req: Request, res: Response): Promise<void> => {
  try {
    const fileName = String(req.params.file || '').trim();
    if (!fileName) { res.status(400).json({ error: 'Missing filename' }); return; }
    const bucket = admin.storage().bucket();
    const file = bucket.file(`custom-designs/${fileName}`);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: 'File not found' }); return; }
    const [metadata] = await file.getMetadata();
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000');
    file.createReadStream().pipe(res);
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});

app.get('/media-files/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const fileName = req.params.filename;
    const bucket = admin.storage().bucket();
    const file = bucket.file(`uploads/${fileName}`);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: 'Media file not found' }); return; }
    const [metadata] = await file.getMetadata();
    res.set('Content-Type', metadata.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000');
    file.createReadStream().pipe(res);
  } catch (e: any) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
});


  }
  