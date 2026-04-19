import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, normalizePrintfulCategory } from '../core';
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



export function registerPpCatalogBrowseRoutes(app: express.Express): void {
app.get('/public/catalog/placements', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string;
    const blueprintId = req.query.blueprintId ? parseInt(req.query.blueprintId as string) : null;
    const printProviderId = req.query.printProviderId ? parseInt(req.query.printProviderId as string) : null;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : null;

    if (provider === 'printify') {
      if (!blueprintId || !printProviderId) { res.status(400).json({ error: "blueprintId and printProviderId required for Printify" }); return; }
      if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
      try {
        const variantData = await printifyClient.getVariants(blueprintId, printProviderId);
        const placementSet = new Set<string>();
        if (variantData?.variants) {
          for (const v of variantData.variants) {
            if (v.placeholders) {
              for (const ph of v.placeholders) { placementSet.add(ph.position || ph.placeholder); }
            }
          }
        }
        if (placementSet.size === 0) placementSet.add('front');
        const normalized = normalizePlacements('printify', Array.from(placementSet));
        const mapped = normalized.map(p => ({
          id: p, type: p, title: p.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), additionalPrice: 0,
        }));
        res.json({ placements: mapped, source: 'printify-api' });
      } catch (err: any) {
        res.json({ placements: [{ id: 'front', type: 'front', title: 'Front', additionalPrice: 0 }], source: 'default-fallback' });
      }
      return;
    }

    if (provider === 'printful') {
      if (!productId) { res.status(400).json({ error: "productId required for Printful" }); return; }
      const printfileInfo = await printfulClient.getPrintfiles(productId);
      const rawPlacements = printfileInfo?.available_placements ? Object.keys(printfileInfo.available_placements) : [];
      const printPlacements = rawPlacements.filter(p => !isEmbroideryPlacement(p));
      const grouped = groupPlacementsByLocation('printful', printPlacements);
      const mapped = grouped.map(g => ({
        id: g.internal, type: g.internal,
        title: g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: 0,
        methods: g.methods.map(m => ({ method: m.method, providerName: m.providerName })),
      }));
      res.json({ placements: mapped, source: 'printful-api' });
      return;
    }

    res.status(400).json({ error: "provider must be 'printify' or 'printful'" });
  } catch (error: any) {
    console.error("Public placement fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRINTIFY CATALOG BROWSER ============

const CF_USA_MADE_BRANDS = [
  'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
  'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
  'shaka wear', 'backpacks usa', 'american giant', 'next level',
];

function classifyCategory(title: string): string {
  const t = (title || '').toLowerCase();
  if (/christmas|holiday|ornament|halloween|easter|thanksgiving|valentine|xmas/.test(t)) return 'Holiday & Seasonal';
  if (/\bpet\b|\bdog\b|\bcat\b|puppy|kitten|\banimal\b/.test(t)) return 'Pet Products';
  if (/notebook|journal|planner|stationery|greeting card|postcard|notepad/.test(t)) return 'Stationery & Paper';
  if (/acrylic print|acrylic sign|metal print|gallery wrap|art board|canvas wrap|canvas gallery|canvas print|wall art|poster|framed|tapestry|\bbanner\b|\bflag\b|art print/.test(t)) return 'Wall Art & Posters';
  if (/tote bag|backpack|fanny pack|drawstring bag|duffel|duffle|messenger bag|crossbody|\bpouch\b|shopping bag|laptop bag/.test(t)) return 'Bags & Accessories';
  if (/phone case|iphone|samsung case|airpod|laptop sleeve|mouse pad|mousepad|tablet case/.test(t)) return 'Phone Cases & Tech';
  if (/sticker|magnet|decal|\bpatch\b/.test(t)) return 'Stickers & Magnets';
  if (/mugs?|tumbler|water bottle|wine glass|beer stein|beer mug|\bflask\b|thermos|travel mug|\bpint\b|drinkware|insulated bottle|insulated tumbler|shot glass/.test(t)) return 'Drinkware';
  if (/snapback|trucker hat|dad hat|baseball cap|bucket hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t)) return 'Hats & Caps';
  if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew neck|\bsweater\b/.test(t)) return 'Sweatshirts & Hoodies';
  if (/swimsuit|bikini|rash guard|windbreaker|biker short|boxer brief|bodycon|legging|yoga|jogger|sweatpant|sport bra|compression|activewear|athletic short/.test(t)) return 'Activewear & Specialty';
  if (/t-shirt|tshirt|\btee\b|tank top|\bpolo\b|v-neck|\bhenley\b|long sleeve|\bjersey\b|raglan|crop top|camisole|\bblouse\b|\bshirt\b/.test(t)) return 'T-Shirts & Tops';
  if (/\bpillow\b|blanket|\btowel\b|\bapron\b|\brug\b|doormat|table runner|cushion|coaster|shower curtain|duvet|bedding|\bbath\b|face mask|\bbandana\b|\bsock\b|calendar|\bclock\b|\bcandle\b|keychain|\bwallet\b|serving tray|phone stand/.test(t)) return 'Home & Living';
  if (/bracelet|necklace|earring|\bring\b|\bwatch\b|sunglasse|\bscarf\b|\bglove\b|\bbelt\b|headband|neck gaiter|hair/.test(t)) return 'Accessories';
  return 'Other';
}

function cfCategorizeProduct(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) return "T-Shirts & Tops";
  if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) return "Sweatshirts & Hoodies";
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) return "Hats & Caps";
  if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) return "Drinkware";
  if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) return "Bags & Accessories";
  if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) return "Phone Cases & Tech";
  if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) return "Stickers & Magnets";
  if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) return "Wall Art & Posters";
  if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) return "Home & Living";
  if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) return "Stationery & Paper";
  if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) return "Activewear & Specialty";
  if (t.includes('pet') || t.includes('dog')) return "Pet Products";
  if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) return "Holiday & Seasonal";
  if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) return "Accessories";
  return "Other";
}

function cfClassifyPrintfulProduct(typeName: string): string {
  const n = (typeName || "").toLowerCase();
  if (n.startsWith("all-over print")) return "All-Over Print";
  if (n.includes("t-shirt") || n.includes("tank top") || n.includes("crop top") || n.includes("jersey") || (n.includes("tee") && !n.includes("steer"))) return "T-Shirts & Tops";
  if (n.includes("hoodie") || n.includes("hood") || n.includes("sweatshirt") || n.includes("pullover") || n.includes("fleece")) return "Hoodies & Sweatshirts";
  if (n.includes("hat") || n.includes("beanie") || n.includes("cap") || n.includes("visor")) return "Hats & Headwear";
  if (n.includes("mug") || n.includes("tumbler") || n.includes("glass") || n.includes("bottle") || n.includes("can cooler") || n.includes("wine")) return "Drinkware";
  if (n.includes("poster") || n.includes("canvas") || n.includes("framed") || n.includes("tapestry") || n.includes("flag") || n.includes("pennant") || n.includes("metal print") || n.includes("photo paper")) return "Wall Art & Prints";
  if (n.includes("iphone") || n.includes("samsung") || n.includes("airpods") || n.includes("magsafe") || n.includes("phone case") || n.includes("snap case")) return "Phone & Tech Cases";
  if (n.includes("sticker") || n.includes("decal") || n.includes("magnet") || n.includes("patch")) return "Stickers & Patches";
  if (n.includes("bag") || n.includes("tote") || n.includes("backpack") || n.includes("fanny pack") || n.includes("crossbody") || n.includes("luggage") || n.includes("duffle") || n.includes("weekender")) return "Bags & Accessories";
  if (n.includes("pillow") || n.includes("blanket") || n.includes("comforter") || n.includes("rug") || n.includes("towel") || n.includes("curtain") || n.includes("coaster") || n.includes("apron") || n.includes("shower")) return "Home & Living";
  if (n.includes("sock") || n.includes("gaiter") || n.includes("bandana") || n.includes("headband") || n.includes("scarf")) return "Socks & Accessories";
  if (n.includes("pet") || n.includes("dog") || n.includes("collar") || n.includes("leash")) return "Pet Products";
  if (n.includes("notebook") || n.includes("journal") || n.includes("notepad") || n.includes("calendar") || n.includes("greeting card") || n.includes("business card")) return "Stationery & Paper";
  if (n.includes("dress") || n.includes("skirt") || n.includes("bikini") || n.includes("swimsuit") || n.includes("swim trunk")) return "Dresses & Swimwear";
  if (n.includes("short") || n.includes("pant") || n.includes("jogger") || n.includes("legging") || n.includes("sweatpant")) return "Bottoms";
  if (n.includes("ornament") || n.includes("christmas") || n.includes("stocking") || n.includes("gift wrap")) return "Seasonal & Holiday";
  if (n.includes("jacket") || n.includes("windbreaker") || n.includes("bomber") || n.includes("vest") || n.includes("sweater")) return "Outerwear & Layers";
  if (n.includes("canvas shoe") || n.includes("athletic shoe") || n.includes("slide") || n.includes("sneaker") || (n.includes("shoe") && !n.includes("shower"))) return "Footwear";
  if (n.includes("mouse pad") || n.includes("desk mat") || n.includes("laptop")) return "Desk & Office";
  if (n.includes("kid") || n.includes("youth") || n.includes("baby")) return "Kids & Youth";
  if (n.includes("polo")) return "Polo Shirts";
  if (n.includes("pin button") || n.includes("pin ") || n.includes("set of pin")) return "Pins & Buttons";
  return "Other";
}

function cfBuildPrintfulVariantLookup(variants: any[]): Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }> {
  const lookup = new Map<number, { colorsMap: Map<string, string>; sizesSet: Set<string> }>();
  for (const v of variants) {
    const pid = v.productId;
    if (!pid) continue;
    if (!lookup.has(pid)) lookup.set(pid, { colorsMap: new Map(), sizesSet: new Set() });
    const entry = lookup.get(pid)!;
    if (v.color && !entry.colorsMap.has(v.color)) entry.colorsMap.set(v.color, v.colorCode || "#888");
    if (v.size) entry.sizesSet.add(v.size);
  }
  const result = new Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }>();
  for (const [pid, entry] of Array.from(lookup.entries())) {
    result.set(pid, {
      colors: Array.from(entry.colorsMap.entries()).map(([name, hex]: [string, string]) => ({ name, hex })),
      sizes: Array.from(entry.sizesSet),
    });
  }
  return result;
}

app.get('/admin/printify/catalog', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const providerFilter = (req.query.provider as string) || 'all';
    const categories: Record<string, any[]> = {};

    const bpSnapshot = await db.collection("printify_blueprints").get();
    const allPrintifyBlueprints = bpSnapshot.docs.map(doc => {
      const d = doc.data();
      return { id: d.id || parseInt(doc.id), title: d.title, description: d.description || '', richDescription: d.richDescription || '', brand: d.brand, model: d.model, images: d.images || [] };
    });

    const provSnapshot = await db.collection("printify_providers").get();
    let allProviders = provSnapshot.docs.map(doc => doc.data());
    if (allProviders.length === 0) {
      const ppSnapshot = await db.collection("printifyPrintProviders").get();
      allProviders = ppSnapshot.docs.map(doc => {
        const d = doc.data();
        return { blueprintId: d.blueprintId, providerId: d.providerId, minCost: d.minCost || 0, maxCost: d.maxCost || 0, availableColors: d.availableColors || [], availableSizes: d.availableSizes || [] };
      });
    }
    const providersByBlueprint = new Map<number, { colors: Array<{name: string; hex?: string}>; sizes: string[]; minCost: number; maxCost: number; providerId: number }>();
    for (const prov of allProviders) {
      const existing = providersByBlueprint.get(prov.blueprintId);
      const colors = Array.isArray(prov.availableColors) ? prov.availableColors : [];
      const sizes = Array.isArray(prov.availableSizes) ? prov.availableSizes : [];
      const minCost = prov.minCost || 0;
      const maxCost = prov.maxCost || 0;
      if (!existing || colors.length > existing.colors.length) {
        providersByBlueprint.set(prov.blueprintId, { colors, sizes, minCost, maxCost, providerId: prov.providerId });
      }
    }

    const pfSnapshot = await db.collection("printful_products").get();
    const allPrintfulRows = pfSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));

    let matchedModels: Set<string> | null = null;
    if (providerFilter === 'matched') {
      const printifyModels = new Set(allPrintifyBlueprints.filter(bp => bp.model && bp.model.trim() !== '').map(bp => bp.model.trim().toLowerCase()));
      const printfulModels = new Set(allPrintfulRows.filter((pf: any) => pf.model && pf.model.trim() !== '').map((pf: any) => pf.model!.trim().toLowerCase()));
      matchedModels = new Set(Array.from(printifyModels).filter(m => printfulModels.has(m)));
    }

    if (providerFilter === 'all' || providerFilter === 'printify' || providerFilter === 'matched') {
      let blueprints = allPrintifyBlueprints;
      if (providerFilter === 'matched') { blueprints = blueprints.filter(bp => bp.model && matchedModels!.has(bp.model.trim().toLowerCase())); }
      for (const bp of blueprints) {
        const brandLower = (bp.brand || '').toLowerCase();
        const isUSABrand = CF_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        const category = cfCategorizeProduct(bp.title);
        if (!categories[category]) categories[category] = [];
        const modelLower = (bp.model || '').trim().toLowerCase();
        const matchedPrintful = modelLower ? allPrintfulRows.find((pf: any) => ((pf as any).model || '').trim().toLowerCase() === modelLower) : null;
        const provData = providersByBlueprint.get(bp.id);
        const rawDesc = bp.richDescription || bp.description || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        categories[category].push({
          id: bp.id, title: bp.title, description: cleanDesc, brand: bp.brand, model: bp.model,
          imageUrl: bp.images?.[0] || null, madeInUSA: isUSABrand, blueprintId: bp.id,
          printProviderId: provData?.providerId || null,
          minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null,
          maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
          colorCount: provData?.colors.length || 0, availableColors: provData?.colors || [],
          availableSizes: provData?.sizes || [], fulfillmentProvider: 'printify', provider: 'printify',
          dualProvider: !!matchedPrintful, matchedProviderId: matchedPrintful ? `printful-${(matchedPrintful as any).id}` : null,
        });
      }
    }

    if (providerFilter === 'all' || providerFilter === 'printful' || providerFilter === 'matched') {
      let printfulRows = allPrintfulRows as any[];
      if (providerFilter === 'matched') { printfulRows = printfulRows.filter(pf => pf.model && matchedModels!.has(pf.model.trim().toLowerCase())); }
      for (const pf of printfulRows) {
        const isUSA = (pf.originCountry || '').toUpperCase() === 'USA' || (pf.originCountry || '').toUpperCase() === 'US';
        const brandLower = (pf.brand || '').toLowerCase();
        const isUSABrand = isUSA || CF_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        const category = cfCategorizeProduct(pf.title);
        if (!categories[category]) categories[category] = [];
        const modelLower = (pf.model || '').trim().toLowerCase();
        const matchedPrintify = modelLower ? allPrintifyBlueprints.find(bp => (bp.model || '').trim().toLowerCase() === modelLower) : null;
        const pfColors = Array.isArray(pf.availableColors) ? pf.availableColors : [];
        const pfSizes = Array.isArray(pf.availableSizes) ? pf.availableSizes : [];
        categories[category].push({
          id: pf.id, title: pf.title, description: pf.description || '', brand: pf.brand || '', model: pf.model || '',
          imageUrl: pf.image || null, madeInUSA: isUSABrand, blueprintId: pf.id, printProviderId: null,
          minPrice: pf.minPrice || null, maxPrice: pf.maxPrice || null, colorCount: pfColors.length,
          availableColors: pfColors, availableSizes: pfSizes, fulfillmentProvider: 'printful', provider: 'printful',
          dualProvider: !!matchedPrintify, matchedProviderId: matchedPrintify ? `printify-${matchedPrintify.id}` : null,
        });
      }
    }

    const sortedCategories = [
      "T-Shirts & Tops", "Sweatshirts & Hoodies", "Hats & Caps", "Drinkware",
      "Bags & Accessories", "Phone Cases & Tech", "Stickers & Magnets",
      "Wall Art & Posters", "Home & Living", "Stationery & Paper",
      "Activewear & Specialty", "Accessories", "Pet Products", "Holiday & Seasonal", "Other"
    ];
    const result = sortedCategories
      .filter(name => categories[name] && categories[name].length > 0)
      .map(name => ({
        name, items: categories[name].sort((a: any, b: any) => a.title.localeCompare(b.title)),
        count: categories[name].length,
        usaCount: categories[name].filter((i: any) => i.madeInUSA).length,
        printifyCount: categories[name].filter((i: any) => i.provider === 'printify').length,
        printfulCount: categories[name].filter((i: any) => i.provider === 'printful').length,
      }));
    const extraCategories = Object.entries(categories)
      .filter(([name]) => !sortedCategories.includes(name))
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({
        name, items: items.sort((a: any, b: any) => a.title.localeCompare(b.title)),
        count: items.length, usaCount: items.filter((i: any) => i.madeInUSA).length,
        printifyCount: items.filter((i: any) => i.provider === 'printify').length,
        printfulCount: items.filter((i: any) => i.provider === 'printful').length,
      }));
    res.json([...result, ...extraCategories]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/printify/catalog/:blueprintId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const blueprintId = parseInt(req.params.blueprintId);
    const [blueprint, providers] = await Promise.all([
      printifyClient.getBlueprintDetails(blueprintId),
      printifyClient.getPrintProviders(blueprintId),
    ]);
    res.json({ blueprint, providers });
  } catch (error: any) {
    console.error("Printify blueprint error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/printify/catalog/batch-details', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const { blueprintIds } = req.body;
    if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) { res.status(400).json({ error: "blueprintIds array required" }); return; }
    const limitedIds = blueprintIds.slice(0, 20);
    const results: Record<number, any> = {};
    for (const blueprintId of limitedIds) {
      try {
        const [blueprint, providers] = await Promise.all([
          printifyClient.getBlueprintDetails(blueprintId),
          printifyClient.getPrintProviders(blueprintId),
        ]);
        const usaProviders = providers.filter((p: any) => p.location?.country === 'US' || p.location?.country === 'USA');
        let variants: any[] = [];
        const selectedProvider = usaProviders[0] || providers[0];
        if (selectedProvider) {
          try { const variantData = await printifyClient.getVariants(blueprintId, selectedProvider.id); variants = variantData.variants || []; } catch {}
        }
        const liveColors = Array.from(new Set(variants.map((v: any) => v.options?.color).filter(Boolean)));
        const liveSizes = Array.from(new Set(variants.map((v: any) => v.options?.size).filter(Boolean)));
        let basePrice = 0, maxPrice = 0;
        const costs = variants.map((v: any) => v.cost || 0).filter((c: number) => c > 0);
        basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
        maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
        results[blueprintId] = {
          blueprintId, basePrice, maxPrice, costsAvailable: basePrice > 0,
          colors: liveColors, sizes: liveSizes,
          madeInUSA: usaProviders.length > 0, providerId: selectedProvider?.id, providerName: selectedProvider?.title,
        };
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err: any) {
        results[blueprintId] = { blueprintId, error: true, message: err.message || "Failed to fetch details" };
      }
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRINTFUL PRODUCTS CATALOG ============

app.get('/admin/catalog/printful-products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const products = productsSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));
    const variantsSnapshot = await db.collection("printful_variants").get();
    const allVariants = variantsSnapshot.docs.map(doc => doc.data());
    const variantLookup = cfBuildPrintfulVariantLookup(allVariants);
    const grouped: Record<string, any[]> = {};
    for (const p of products as any[]) {
      const categoryName = cfClassifyPrintfulProduct(p.typeName || p.type || "");
      if (!grouped[categoryName]) grouped[categoryName] = [];
      const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
      grouped[categoryName].push({
        id: p.id, title: p.title, brand: p.brand || "", model: p.model || "",
        imageUrl: p.image || null, madeInUSA: (p.originCountry || "").toUpperCase() === "US",
        minPrice: p.minPrice || null, maxPrice: p.maxPrice || null,
        colorCount: vData.colors.length, availableColors: vData.colors, availableSizes: vData.sizes,
        blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
        fulfillmentProvider: 'printful',
      });
    }
    const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/printful-status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const variantsSnapshot = await db.collection("printful_variants").get();
    res.json({
      isConfigured: printfulClient.isConfigured,
      productCount: productsSnapshot.size,
      variantCount: variantsSnapshot.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/master-catalog', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('master_catalog').get();
    const categories: Record<string, any[]> = {};

    for (const doc of snap.docs) {
      const p = doc.data() as any;
      const category = (p.category && p.category !== 'Other') ? p.category : classifyCategory(p.title || '');
      if (!categories[category]) categories[category] = [];
      const blueprintId = p.printifyBlueprintId ?? p.blueprintId ?? null;
      const printfulId = p.printfulProductId ?? p.printfulId ?? null;
      const colors = p.colors ?? p.availableColors ?? [];
      const sizes = p.sizes ?? p.availableSizes ?? [];
      const allImages: string[] = Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []);
      const imageUrl = allImages[0] ?? null;
      const fulfillmentProvider = p.fulfillmentProvider ?? (blueprintId != null ? 'printify' : 'printful');
      categories[category].push({
        docId: doc.id,
        qrgId: p.qrgId ?? null,
        qrgCategory: p.qrgCategory ?? null,
        id: blueprintId ?? printfulId,
        title: (p.title || "").trim(),
        description: (p.description || "").trim() || null,
        brand: p.brand ?? null,
        model: p.model ?? null,
        images: allImages,
        imageUrl,
        madeInUSA: p.madeInUSA ?? ((p.originCountry || '').toUpperCase() === 'US'),
        blueprintId,
        printProviderId: p.printProviderId ?? null,
        minPrice: p.minPrice ?? null,
        maxPrice: p.maxPrice ?? null,
        colorCount: colors.length,
        availableColors: colors,
        availableSizes: sizes,
        fulfillmentProvider,
        availableVia: p.availableVia ?? [fulfillmentProvider],
        printfulId,
        providers: p.providers ?? [fulfillmentProvider],
      });
    }

    const CATEGORY_ORDER = ["T-Shirts & Tops","Sweatshirts & Hoodies","Hats & Caps","Drinkware","Bags & Accessories","Phone Cases & Tech","Stickers & Magnets","Wall Art & Posters","Home & Living","Stationery & Paper","Activewear & Specialty","Accessories","Pet Products","Holiday & Seasonal","Other"];
    const result = Object.entries(categories)
      .map(([name, items]) => ({ name, items: items.sort((a: any, b: any) => a.title.localeCompare(b.title)), count: items.length }))
      .sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.name); const bi = CATEGORY_ORDER.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1; if (bi === -1) return -1;
        return ai - bi;
      });

    res.json(result);
  } catch (e: any) {
    console.error('[MasterCatalog] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/master-catalog/joint', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [masterSnap, catalogsSnap] = await Promise.all([
      db.collection('master_catalog').get(),
      db.collection('catalogs').get(),
    ]);

    const adminDescribedKeys = new Set<string>();
    for (const catDoc of catalogsSnap.docs) {
      const blankDescriptions = (catDoc.data().blankDescriptions || {}) as Record<string, string>;
      for (const [key, val] of Object.entries(blankDescriptions)) {
        if (val && String(val).trim().length > 0) adminDescribedKeys.add(key);
      }
    }

    const CATEGORY_ORDER = ["T-Shirts & Tops","Sweatshirts & Hoodies","Hats & Caps","Drinkware","Bags & Accessories","Phone Cases & Tech","Stickers & Magnets","Wall Art & Posters","Home & Living","Stationery & Paper","Activewear & Specialty","Accessories","Pet Products","Holiday & Seasonal","Other"];
    const categories: Record<string, any[]> = {};

    for (const doc of masterSnap.docs) {
      const p = doc.data() as any;
      const masterDesc = (p.description || "").trim();
      if (!masterDesc) continue;
      const blueprintId = p.printifyBlueprintId ?? p.blueprintId ?? null;
      const printfulId = p.printfulProductId ?? p.printfulId ?? null;
      const blankKey = blueprintId ? String(blueprintId) : (printfulId ? `pf:${printfulId}` : null);
      if (!blankKey || !adminDescribedKeys.has(blankKey)) continue;

      const category = (p.category && p.category !== 'Other') ? p.category : classifyCategory(p.title || '');
      if (!categories[category]) categories[category] = [];
      const colors = p.colors ?? p.availableColors ?? [];
      const sizes = p.sizes ?? p.availableSizes ?? [];
      const allImages: string[] = Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : []);
      const imageUrl = allImages[0] ?? null;
      const fulfillmentProvider = p.fulfillmentProvider ?? (blueprintId != null ? 'printify' : 'printful');
      categories[category].push({
        docId: doc.id,
        id: blueprintId ?? printfulId,
        title: (p.title || "").trim(),
        description: masterDesc,
        brand: p.brand ?? null,
        model: p.model ?? null,
        images: allImages,
        imageUrl,
        madeInUSA: p.madeInUSA ?? ((p.originCountry || '').toUpperCase() === 'US'),
        blueprintId,
        printProviderId: p.printProviderId ?? null,
        minPrice: p.minPrice ?? null,
        maxPrice: p.maxPrice ?? null,
        colorCount: colors.length,
        availableColors: colors,
        availableSizes: sizes,
        fulfillmentProvider,
        availableVia: p.availableVia ?? [fulfillmentProvider],
        printfulId,
        providers: p.providers ?? [fulfillmentProvider],
      });
    }

    const result = Object.entries(categories)
      .map(([name, items]) => ({ name, items: (items as any[]).sort((a, b) => a.title.localeCompare(b.title)), count: items.length }))
      .sort((a, b) => {
        const ai = CATEGORY_ORDER.indexOf(a.name); const bi = CATEGORY_ORDER.indexOf(b.name);
        if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
        if (ai === -1) return 1; if (bi === -1) return -1;
        return ai - bi;
      });

    res.json(result);
  } catch (e: any) {
    console.error('[JointCatalog] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/catalog/printful-products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const products = productsSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));
    const variantsSnapshot = await db.collection("printful_variants").get();
    const allVariants = variantsSnapshot.docs.map(doc => doc.data());
    const variantLookup = cfBuildPrintfulVariantLookup(allVariants);
    const grouped: Record<string, any[]> = {};
    for (const p of products as any[]) {
      const categoryName = cfClassifyPrintfulProduct(p.typeName || p.type || "");
      if (!grouped[categoryName]) grouped[categoryName] = [];
      const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
      const placements = ((p as any).availablePlacements || []).map((pid: string) => {
        const nId = normalizePlacement('printful', pid);
        const title = nId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        return { id: nId, type: nId, title, additionalPrice: 0 };
      });
      grouped[categoryName].push({
        id: p.id, title: (p as any).title, brand: (p as any).brand || "", model: (p as any).model || "",
        imageUrl: (p as any).image || null, madeInUSA: ((p as any).originCountry || "").toUpperCase() === "US",
        minPrice: (p as any).minPrice || null, maxPrice: (p as any).maxPrice || null,
        colorCount: vData.colors.length, availableColors: vData.colors, availableSizes: vData.sizes,
        blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
        fulfillmentProvider: 'printful', placements: placements.length > 0 ? placements : null,
      });
    }
    const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

}
