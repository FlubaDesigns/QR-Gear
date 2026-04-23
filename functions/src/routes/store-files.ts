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

    // Helper: normalize images array (items may be strings or {url} objects)
    const toUrlArr = (imgs: any[]): string[] =>
      (imgs || []).map((img: any) => (typeof img === 'string' ? img : img?.url || null)).filter(Boolean);

    // ── Path A: storeProductLinks (original path) ───────────────────────────
    const linkDoc = await db.collection('storeProductLinks').doc(linkId).get();
    if (linkDoc.exists) {
      const link = linkDoc.data()!;

      let price: number | null = null;
      let availableSizes: string[] = link.enabledSizes || [];
      let availableColors: string[] = link.enabledColors || [];
      let availablePlacements: string[] = [];
      let description = '';
      let category = '';
      let productLine = '';
      let packetImageUrl: string | null = null;

      if (link.packetId) {
        const packetDoc = await db.collection('packets').doc(link.packetId).get();
        if (packetDoc.exists) {
          const packet = packetDoc.data()!;
          packetImageUrl = packet.priorityMockupUrl || packet.landingPageSnapshotUrl || packet.productGraphicUrl || null;
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

      // Build ordered gallery: mockup first, then any stored images array
      const heroUrl = link.mockupUrl || packetImageUrl || link.compositeUrl || link.qrOnlyUrl || null;
      const storedImages = toUrlArr(link.images || []);
      const allImages: string[] = [];
      if (heroUrl) allImages.push(heroUrl);
      storedImages.forEach((u) => { if (u !== heroUrl) allImages.push(u); });

      res.json({
        id: linkDoc.id,
        name: link.productName || 'Untitled Product',
        description,
        category,
        productLine,
        imageUrl: allImages[0] || null,
        images: allImages,
        packetImageUrl,
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
      return;
    }

    // ── Path B: admin_catalog_instances (products from store catalog listing) ─
    const instanceDoc = await db.collection('admin_catalog_instances').doc(linkId).get();
    if (!instanceDoc.exists) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const d = instanceDoc.data()!;
    const resolved = d.resolved || {};

    let price: number | null = resolved.pricing?.customerPrice ?? null;
    let packetMockupUrl: string | null = null;

    if (d.currentPacketId) {
      try {
        const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
        if (pDoc.exists) {
          const pkt = pDoc.data()!;
          packetMockupUrl = pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
          if (price === null && pkt.pricing?.customerPrice) price = pkt.pricing.customerPrice;
        }
      } catch (_) {}
    }

    const toStrArr = (arr: any[]): string[] =>
      (arr || []).map((v: any) => (typeof v === 'string' ? v : v?.name || v?.label || String(v))).filter(Boolean);

    // Build ordered gallery: packet mockup first, then provider catalog images
    const providerImages = toUrlArr(resolved.images || []);
    const allImages: string[] = [];
    if (packetMockupUrl) allImages.push(packetMockupUrl);
    providerImages.forEach((u) => { if (u !== packetMockupUrl) allImages.push(u); });

    res.json({
      id: instanceDoc.id,
      name: resolved.title || 'Untitled',
      description: resolved.description || '',
      category: resolved.category || '',
      productLine: resolved.productLine || '',
      imageUrl: allImages[0] || null,
      images: allImages,
      packetImageUrl: packetMockupUrl,
      qrCodeUrl: null,
      qrProductType: d.qrProductType || 'qr-basics',
      price: price !== null ? Math.round(price * 100) / 100 : null,
      availableSizes: toStrArr(d.enabledSizes || resolved.sizes || []),
      availableColors: toStrArr(d.enabledColors || resolved.colors || []),
      availablePlacements: [],
      defaultColor: null,
      mockupsByColor: null,
      selectedGraphicSize: null,
      storeId: d.storeId || null,
      storeName: d.storeName || null,
      channel: d.channelId || null,
      collection: d.collectionName || null,
      packetId: d.currentPacketId || null,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/store/product/:linkId/add-to-cart', async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const { selectedColor, selectedSize, quantity = 1 } = req.body;

    // ── Path A: storeProductLinks ──────────────────────────────────────────
    const linkDoc = await db.collection('storeProductLinks').doc(linkId).get();
    if (linkDoc.exists) {
      const link = linkDoc.data()!;

      let price: number | null = null;
      let productId: string | null = null;

      if (link.packetId) {
        const packetDoc = await db.collection('packets').doc(link.packetId).get();
        if (packetDoc.exists) {
          const packet = packetDoc.data()!;
          productId = packet.productId || null;
          if (productId) price = await getAuthoritativePrice(productId);
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
      return;
    }

    // ── Path B: admin_catalog_instances ────────────────────────────────────
    const instanceDoc = await db.collection('admin_catalog_instances').doc(linkId).get();
    if (!instanceDoc.exists) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const d = instanceDoc.data()!;
    const resolved = d.resolved || {};

    let price: number | null = resolved.pricing?.customerPrice ?? null;
    let heroImageUrl: string | null = null;

    if (d.currentPacketId) {
      try {
        const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
        if (pDoc.exists) {
          const pkt = pDoc.data()!;
          heroImageUrl = pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
          if (price === null && pkt.pricing?.customerPrice) price = pkt.pricing.customerPrice;
        }
      } catch (_) {}
    }

    // Fallback to first provider catalog image
    if (!heroImageUrl && resolved.images?.length) {
      const img = resolved.images[0];
      heroImageUrl = typeof img === 'string' ? img : (img?.url || null);
    }

    if (price === null || price <= 0) {
      res.status(400).json({ error: "Price could not be determined for this product" });
      return;
    }

    res.json({
      productId: linkId,
      linkId,
      price: Math.round(price * 100) / 100,
      name: resolved.title || 'Untitled',
      imageUrl: heroImageUrl,
      selectedColor: selectedColor || null,
      selectedSize: selectedSize || null,
      quantity,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/store/:storeType/:storeName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeType, storeName } = req.params;
    const segment = req.query.segment as string | undefined;
    const channel = req.query.channel as string | undefined;
    const collection = req.query.collection as string | undefined;

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

      const instancesSnap = await db.collection('admin_catalog_instances')
        .where('storeId', '==', storeId)
        .where('channelId', '==', storeName)
        .get();

      const getFirstImageUrl = (images: any[]): string | null => {
        if (!images?.length) return null;
        const img = images[0];
        if (typeof img === 'string') return img;
        return img?.url || null;
      };

      const products = await Promise.all(
        instancesSnap.docs
          .filter((doc: any) => {
            if (!segment) return true;
            return doc.data().collectionName === segment;
          })
          .map(async (doc: any) => {
            const d = doc.data();
            const resolved = d.resolved || {};
            const pricing = resolved.pricing || null;
            let price: number | null = pricing?.customerPrice ?? null;
            // Lifestyle/person image from the Printify catalog — this is always first
            const imageUrl = getFirstImageUrl(resolved.images || []);
            // QR graphic mockup from the packet — shown as secondary image
            let packetImageUrl: string | null = null;

            if (d.currentPacketId) {
              try {
                const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
                if (pDoc.exists) {
                  const pkt = pDoc.data()!;
                  packetImageUrl = pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                  if (price === null && pkt.pricing?.customerPrice) price = pkt.pricing.customerPrice;
                }
              } catch (_) {}
            }

            const toStringArray = (arr: any[]): string[] =>
              (arr || []).map((v: any) => (typeof v === 'string' ? v : v?.name || v?.label || String(v))).filter(Boolean);
            const toImgUrl = (img: any): string | null =>
              typeof img === 'string' ? img : (img?.url || null);

            const rawColors = d.enabledColors || resolved.colors || [];
            const rawSizes = d.enabledSizes || resolved.sizes || [];

            // Build ordered gallery: packet mockup first, then provider images
            const providerImgs = (resolved.images || []).map(toImgUrl).filter(Boolean) as string[];
            const allImages: string[] = [];
            if (packetImageUrl) allImages.push(packetImageUrl);
            providerImgs.forEach((u) => { if (u !== packetImageUrl) allImages.push(u); });

            return {
              id: doc.id,
              name: resolved.title || 'Untitled',
              imageUrl: allImages[0] || null,
              images: allImages,
              packetImageUrl,
              segment: d.collectionName || null,
              isFeatured: false,
              isSeasonalPromo: false,
              templateVariant: null,
              qrProductType: 'qr-basics',
              qrCodeUrl: null,
              selectedColors: toStringArray(rawColors),
              availableSizes: toStringArray(rawSizes),
              defaultColor: null,
              mockupsByColor: null,
              price: price !== null ? Math.round(price * 100) / 100 : null,
              createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
          })
      );

      console.log(`[Public Store] Channel "${storeName}" in store "${storeId}": ${products.length} catalog instances`);
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
      const storeSlugCompact = storeSlug.replace(/-/g, '');
      if (doc.id === storeName || storeSlug === storeName || storeSlugCompact === storeName) {
        matchedStore = { id: doc.id, ...data };
        break;
      }
    }
    // Channel-first fallback: if store not found by name, resolve it via the channel doc
    if (!matchedStore && channel) {
      const fallbackChan = await db.collection('storeChannels').doc(channel).get();
      if (fallbackChan.exists) {
        const fcData = fallbackChan.data() || {};
        if (fcData.storeId) {
          const storeDoc = await db.collection('stores').doc(fcData.storeId).get();
          if (storeDoc.exists) matchedStore = { id: storeDoc.id, ...storeDoc.data() };
        }
      }
    }
    if (!matchedStore) { res.status(404).json({ error: "Store not found" }); return; }

    // ---- Channel-scoped query: /api/store/internal/qr-gear?channel=usa250[&collection=monuments] ----
    if (channel) {
      const channelDoc = await db.collection('storeChannels').doc(channel).get();
      if (!channelDoc.exists || (channelDoc.data() || {}).storeId !== matchedStore.id) {
        res.status(404).json({ error: 'Channel not found in this store' });
        return;
      }
      const channelData = channelDoc.data() || {};

      const instancesSnap = await db.collection('admin_catalog_instances')
        .where('storeId', '==', matchedStore.id)
        .where('channelId', '==', channel)
        .get();

      const getFirstImgUrl = (images: any[]): string | null => {
        if (!images?.length) return null;
        const img = images[0];
        return typeof img === 'string' ? img : (img?.url || null);
      };
      const toStrArr = (arr: any[]): string[] =>
        (arr || []).map((v: any) => typeof v === 'string' ? v : v?.name || v?.label || String(v)).filter(Boolean);

      // Normalize to slug for comparison so "Armed Forces" matches URL param "armed-forces"
      const toSlug = (s: string) => s.toLowerCase().replace(/[\s_]+/g, '-');
      const collectionSlug = collection ? toSlug(collection) : null;

      const channelProducts = await Promise.all(
        instancesSnap.docs
          .filter((doc: any) => {
            if (!collection) return true;
            const name: string = doc.data().collectionName || '';
            return name === collection || toSlug(name) === collectionSlug;
          })
          .map(async (doc: any) => {
            const d = doc.data();
            const resolved = d.resolved || {};
            let price: number | null = resolved.pricing?.customerPrice ?? null;
            const imageUrl = getFirstImgUrl(resolved.images || []);
            let packetImageUrl: string | null = null;

            if (d.currentPacketId) {
              try {
                const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
                if (pDoc.exists) {
                  const pkt = pDoc.data()!;
                  packetImageUrl = pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                  if (price === null && pkt.pricing?.customerPrice) price = pkt.pricing.customerPrice;
                }
              } catch (_) {}
            }

            const toImgUrlCh = (img: any): string | null =>
              typeof img === 'string' ? img : (img?.url || null);
            const providerImgsCh = (resolved.images || []).map(toImgUrlCh).filter(Boolean) as string[];
            const allImagesCh: string[] = [];
            if (packetImageUrl) allImagesCh.push(packetImageUrl);
            providerImgsCh.forEach((u) => { if (u !== packetImageUrl) allImagesCh.push(u); });

            return {
              id: doc.id,
              name: resolved.title || 'Untitled',
              imageUrl: allImagesCh[0] || null,
              images: allImagesCh,
              packetImageUrl,
              segment: d.collectionName || null,
              isFeatured: false,
              isSeasonalPromo: false,
              templateVariant: null,
              qrProductType: 'qr-basics',
              qrCodeUrl: null,
              selectedColors: toStrArr(d.enabledColors || resolved.colors || []),
              availableSizes: toStrArr(d.enabledSizes || resolved.sizes || []),
              defaultColor: null,
              mockupsByColor: null,
              price: price !== null ? Math.round(price * 100) / 100 : null,
              createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
          })
      );

      console.log(`[Public Store] Channel "${channel}" in "${matchedStore.name}": ${channelProducts.length} instances${collection ? ` / collection: ${collection}` : ''}`);
      res.json({
        storeType: matchedStore.roleType || storeType,
        storeName: matchedStore.name || storeName,
        channelId: channel,
        channelName: channelData.name || channel,
        collection: collection || null,
        segment: null,
        products: channelProducts,
      });
      return;
    }
    // ---- End channel-scoped query ----

    const channelsSnap = await db.collection('storeChannels').where('storeId', '==', matchedStore.id).get();
    const channels = channelsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const getFirstImgUrl2 = (images: any[]): string | null => {
      if (!images?.length) return null;
      const img = images[0];
      return typeof img === 'string' ? img : (img?.url || null);
    };
    const toStrArr2 = (arr: any[]): string[] =>
      (arr || []).map((v: any) => typeof v === 'string' ? v : v?.name || v?.label || String(v)).filter(Boolean);

    const storeInstancesSnap = await db.collection('admin_catalog_instances')
      .where('storeId', '==', matchedStore.id)
      .get();

    const products = await Promise.all(
      storeInstancesSnap.docs
        .filter((doc: any) => !segment || doc.data().collectionName === segment)
        .map(async (doc: any) => {
          const d = doc.data();
          const resolved = d.resolved || {};
          let price: number | null = resolved.pricing?.customerPrice ?? null;
          const imageUrl = getFirstImgUrl2(resolved.images || []);
          let packetImageUrl: string | null = null;

          if (d.currentPacketId) {
            try {
              const pDoc = await db.collection('productPackets').doc(d.currentPacketId).get();
              if (pDoc.exists) {
                const pkt = pDoc.data()!;
                packetImageUrl = pkt.compositeUrl || pkt.landingPageSnapshotUrl || pkt.productGraphicUrl || null;
                if (price === null && pkt.pricing?.customerPrice) price = pkt.pricing.customerPrice;
              }
            } catch (_) {}
          }

          const toImgUrlSt = (img: any): string | null =>
            typeof img === 'string' ? img : (img?.url || null);
          const providerImgsSt = (resolved.images || []).map(toImgUrlSt).filter(Boolean) as string[];
          const allImagesSt: string[] = [];
          if (packetImageUrl) allImagesSt.push(packetImageUrl);
          providerImgsSt.forEach((u) => { if (u !== packetImageUrl) allImagesSt.push(u); });

          return {
            id: doc.id,
            name: resolved.title || 'Untitled',
            imageUrl: allImagesSt[0] || null,
            images: allImagesSt,
            packetImageUrl,
            segment: d.collectionName || null,
            isFeatured: false,
            isSeasonalPromo: false,
            templateVariant: null,
            qrProductType: 'qr-basics',
            qrCodeUrl: null,
            selectedColors: toStrArr2(d.enabledColors || resolved.colors || []),
            availableSizes: toStrArr2(d.enabledSizes || resolved.sizes || []),
            defaultColor: null,
            mockupsByColor: null,
            price: price !== null ? Math.round(price * 100) / 100 : null,
            createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
        })
    );

    console.log(`[Public Store] Store "${matchedStore.name}" (${storeType}): ${products.length} catalog instances, ${channels.length} channels`);
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
  