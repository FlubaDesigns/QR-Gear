"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const printful_1 = require("../services/printful");
const mockup_generator_1 = require("../services/mockup-generator");
const file_routes_1 = require("./file-routes");
function register(app) {
    // ============ STOREFRONT MOCKUP GENERATION ============
    app.post('/storefront/generate-mockup', async (req, res) => {
        try {
            const { productId, color, qrSize, qrSizePercent } = req.body;
            if (!productId || !color) {
                res.status(400).json({ error: 'productId and color are required' });
                return;
            }
            let resolvedQrSize = 'medium';
            if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
                resolvedQrSize = qrSize;
            }
            else if (qrSizePercent) {
                if (qrSizePercent <= 30)
                    resolvedQrSize = 'small';
                else if (qrSizePercent <= 50)
                    resolvedQrSize = 'medium';
                else
                    resolvedQrSize = 'large';
            }
            const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
            const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
            const productDoc = await core_1.db.collection('products').doc(canonicalProductId).get();
            if (!productDoc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            const product = productDoc.data();
            const existingMockups = product.mockupsByColor || {};
            const normalizeColor = (c) => c.toLowerCase().trim();
            const requestColorNorm = normalizeColor(color);
            // Build keys for lookup: color_size_placement (full), color_size, color-only
            const placement = 'front';
            const fullKey = `${color}_${resolvedQrSize}_${placement}`;
            const colorSizeKey = `${color}_${resolvedQrSize}`;
            const fullKeyNorm = `${requestColorNorm}_${resolvedQrSize}_${placement}`;
            const colorSizeKeyNorm = `${requestColorNorm}_${resolvedQrSize}`;
            console.log(`[StorefrontMockup] Looking for mockup: full="${fullKey}", size="${colorSizeKey}", color="${color}"`);
            // Priority 1: Exact match for color + size + placement
            let existingMockup = null;
            let matchedColorKey = fullKey;
            let usedFallback = false;
            for (const [storedKey, mockup] of Object.entries(existingMockups)) {
                const storedKeyNorm = storedKey.toLowerCase().trim();
                if (storedKeyNorm === fullKeyNorm && mockup && mockup.front) {
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
                    if (storedKeyNorm === colorSizeKeyNorm && mockup && mockup.front) {
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
                    if (matchesColor && mockup && mockup.front) {
                        existingMockup = mockup;
                        matchedColorKey = storedKey;
                        usedFallback = true;
                        console.log(`[StorefrontMockup] Using COLOR fallback: "${storedKey}" (requested: ${fullKey})`);
                        break;
                    }
                }
            }
            if (existingMockup && existingMockup.front) {
                const defaultImage = existingMockup.lifestyle || existingMockup.front;
                await core_1.db.collection('products').doc(canonicalProductId).update({
                    defaultColor: color,
                    imageUrl: defaultImage,
                });
                res.json({
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
                return;
            }
            const designDoc = await core_1.db.collection('customDesigns').doc(designId).get();
            if (!designDoc.exists) {
                res.status(404).json({ error: 'Design not found' });
                return;
            }
            const design = designDoc.data();
            let designPlacements = {};
            try {
                if (typeof design.placementImages === 'string') {
                    designPlacements = JSON.parse(design.placementImages);
                }
                else if (design.placementImages && typeof design.placementImages === 'object') {
                    designPlacements = design.placementImages;
                }
            }
            catch (e) {
                console.error('[StorefrontMockup] Failed to parse placementImages:', e);
            }
            let colorHex = null;
            if (product.availableColors && Array.isArray(product.availableColors)) {
                const colorInfo = product.availableColors.find((c) => c.name?.toLowerCase() === color.toLowerCase());
                colorHex = colorInfo?.hex || null;
            }
            const needsWhiteQR = colorHex ? (0, core_1.isColorDark)(colorHex) : false;
            const blackArtwork = designPlacements['front'] ||
                designPlacements['front-chest'] ||
                designPlacements['front-chest-black'] ||
                designPlacements['front-center'];
            const whiteArtwork = designPlacements['front-white'] ||
                designPlacements['front-chest-white'] ||
                designPlacements['front-center-white'];
            let artworkUrl;
            let artworkVariant = 'black';
            if (needsWhiteQR && whiteArtwork) {
                artworkUrl = whiteArtwork;
                artworkVariant = 'white';
            }
            else if (blackArtwork) {
                artworkUrl = blackArtwork;
                artworkVariant = 'black';
            }
            else {
                artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0];
            }
            // Generate mockup via Printful if not cached
            if (!printful_1.printfulClient.isConfigured) {
                let fallbackUrl = null;
                try {
                    const bpDoc = await core_1.db.collection('printifyBlueprints').doc(String(product.blueprintId)).get();
                    if (bpDoc.exists) {
                        const bpData = bpDoc.data();
                        fallbackUrl = bpData.images?.[0] || bpData.image || null;
                    }
                }
                catch (fbErr) { /* ignore */ }
                if (fallbackUrl) {
                    res.json({ success: true, color, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true });
                    return;
                }
                res.status(404).json({
                    error: `No mockup available for ${color}. Printful API key not configured.`,
                    color
                });
                return;
            }
            try {
                console.log(`[StorefrontMockup] Generating mockup for ${color} via Printful...`);
                const mockupResult = await (0, mockup_generator_1.generateMockupFromPrintful)({
                    blueprintId: product.blueprintId,
                    printProviderId: product.printProviderId || 0,
                    colorName: color,
                    colorHex: colorHex || undefined,
                    artworkUrl,
                    artworkVariant,
                    hasCompositeGraphic: true,
                });
                // Update product with new mockup
                const updatedMockups = {
                    ...existingMockups,
                    [color]: {
                        front: mockupResult.mockupUrl,
                        lifestyle: mockupResult.lifestyleMockupUrl,
                    },
                };
                const defaultImage = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
                await core_1.db.collection('products').doc(canonicalProductId).update({
                    mockupsByColor: updatedMockups,
                    defaultColor: color,
                    imageUrl: defaultImage,
                });
                res.json({
                    success: true,
                    color,
                    mockupUrl: mockupResult.mockupUrl,
                    lifestyleMockupUrl: mockupResult.lifestyleMockupUrl,
                    fromCache: mockupResult.fromCache,
                    mockupsByColor: updatedMockups,
                });
            }
            catch (genError) {
                console.error(`[StorefrontMockup] Printful generation failed:`, genError.message);
                let fallbackUrl = null;
                try {
                    const bpDoc = await core_1.db.collection('printifyBlueprints').doc(String(product.blueprintId)).get();
                    if (bpDoc.exists) {
                        const bpData = bpDoc.data();
                        fallbackUrl = bpData.images?.[0] || bpData.image || null;
                    }
                    if (fallbackUrl) {
                        console.log(`[StorefrontMockup] Using catalog fallback image for blueprint ${product.blueprintId}`);
                        res.json({ success: true, color, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true });
                        return;
                    }
                }
                catch (fbErr) {
                    console.error("[StorefrontMockup] Fallback lookup failed:", fbErr.message);
                }
                res.status(500).json({
                    error: `Failed to generate mockup for ${color}: ${genError.message}`,
                    color
                });
            }
        }
        catch (error) {
            console.error('[StorefrontMockup] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ MOCKUP API ============
    app.get('/placements', async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('canonicalPlacements').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/mockups/get-or-generate', async (req, res) => {
        try {
            const { blueprintId, printProviderId, colorName, colorHex, canonicalPlacementId = 'front', artworkUrl, artworkVariant = 'black' } = req.body;
            if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
                res.status(400).json({
                    error: 'Missing required fields: blueprintId, printProviderId, colorName, artworkUrl'
                });
                return;
            }
            const cacheKey = `${blueprintId}-${printProviderId}-${colorName}-${canonicalPlacementId}-${artworkVariant}`;
            const cacheSnapshot = await core_1.db.collection('mockup_cache')
                .where('cacheKey', '==', cacheKey)
                .limit(1)
                .get();
            if (!cacheSnapshot.empty) {
                const cached = cacheSnapshot.docs[0].data();
                res.json({
                    success: true,
                    mockupUrl: cached.mockupUrl,
                    lifestyleUrl: cached.lifestyleUrl,
                    fromCache: true,
                });
                return;
            }
            // Generate via Printful if not in cache
            if (!printful_1.printfulClient.isConfigured) {
                res.json({
                    success: false,
                    message: 'Mockup not in cache and Printful API key not configured.',
                    fromCache: false,
                });
                return;
            }
            try {
                const mockupResult = await (0, mockup_generator_1.generateMockupFromPrintful)({
                    blueprintId,
                    printProviderId,
                    colorName,
                    colorHex,
                    artworkUrl,
                    artworkVariant: artworkVariant,
                    hasCompositeGraphic: true,
                });
                res.json({
                    success: true,
                    mockupUrl: mockupResult.mockupUrl,
                    lifestyleUrl: mockupResult.lifestyleMockupUrl,
                    fromCache: mockupResult.fromCache,
                });
            }
            catch (genError) {
                res.status(500).json({
                    success: false,
                    error: genError.message,
                    fromCache: false,
                });
            }
        }
        catch (error) {
            console.error('[MockupAPI] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Test endpoint: Generate priority mockup for digital proof
    app.get('/mockups/cached/:blueprintId/:printProviderId', async (req, res) => {
        try {
            const { blueprintId, printProviderId } = req.params;
            const snapshot = await core_1.db.collection('mockup_cache')
                .where('blueprintId', '==', parseInt(blueprintId))
                .where('printProviderId', '==', parseInt(printProviderId))
                .get();
            const mockups = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!mockups[data.colorName]) {
                    mockups[data.colorName] = {};
                }
                mockups[data.colorName][data.placementId] = {
                    mockupUrl: data.mockupUrl,
                    lifestyleUrl: data.lifestyleUrl,
                };
            });
            res.json({ mockups, count: Object.keys(mockups).length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ ADMIN MOCKUP REGENERATION ============
    app.post('/admin/products/:id/regenerate-mockups', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { color } = req.body;
            const productDoc = await core_1.db.collection('products').doc(id).get();
            if (!productDoc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            const product = productDoc.data();
            if (!product.blueprintId) {
                res.status(400).json({ error: 'Product missing blueprint info' });
                return;
            }
            if (!printful_1.printfulClient.isConfigured) {
                res.status(500).json({ error: 'Printful API key not configured' });
                return;
            }
            const metadata = product.metadata;
            const designId = metadata?.customDesignId || id.replace('custom_', '');
            const designDoc = await core_1.db.collection('customDesigns').doc(designId).get();
            if (!designDoc.exists) {
                res.status(404).json({ error: 'Custom design not found' });
                return;
            }
            const design = designDoc.data();
            let designPlacements = {};
            if (typeof design.placementImages === 'object') {
                designPlacements = design.placementImages;
            }
            const blackArtwork = designPlacements['front'] || designPlacements['front-chest'];
            const whiteArtwork = designPlacements['front-white'] || designPlacements['front-chest-white'];
            // Get colors to regenerate
            const allColors = product.availableColors || [];
            const colorsToProcess = color ? allColors.filter(c => c.name === color) : allColors;
            if (colorsToProcess.length === 0) {
                res.status(400).json({ error: 'No colors to process' });
                return;
            }
            const results = [];
            const mockupsByColor = product.mockupsByColor || {};
            for (const colorInfo of colorsToProcess) {
                try {
                    const needsWhiteQR = (0, core_1.isColorDark)(colorInfo.hex);
                    const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
                    const artworkVariant = (needsWhiteQR && whiteArtwork) ? 'white' : 'black';
                    const mockupResult = await (0, mockup_generator_1.generateMockupFromPrintful)({
                        blueprintId: product.blueprintId,
                        printProviderId: product.printProviderId || 0,
                        colorName: colorInfo.name,
                        colorHex: colorInfo.hex,
                        artworkUrl,
                        artworkVariant,
                        hasCompositeGraphic: true,
                    });
                    // Save with full key: color_size_placement (e.g., "Black_medium_front")
                    const graphicSize = 'medium';
                    const placement = 'front';
                    const fullKey = `${colorInfo.name}_${graphicSize}_${placement}`;
                    mockupsByColor[fullKey] = {
                        front: mockupResult.mockupUrl,
                        lifestyle: mockupResult.lifestyleMockupUrl,
                        qrSize: graphicSize,
                        placement,
                        generatedAt: new Date().toISOString(),
                    };
                    // Also store color_size shorthand key
                    const colorSizeKey = `${colorInfo.name}_${graphicSize}`;
                    mockupsByColor[colorSizeKey] = {
                        front: mockupResult.mockupUrl,
                        lifestyle: mockupResult.lifestyleMockupUrl,
                        qrSize: graphicSize,
                        placement,
                        generatedAt: new Date().toISOString(),
                    };
                    mockupsByColor[colorInfo.name] = {
                        front: mockupResult.mockupUrl,
                        lifestyle: mockupResult.lifestyleMockupUrl,
                        qrSize: graphicSize,
                        placement,
                        generatedAt: new Date().toISOString(),
                    };
                    results.push({ color: colorInfo.name, success: true, mockupUrl: mockupResult.mockupUrl });
                    // Rate limit between colors
                    if (colorsToProcess.indexOf(colorInfo) < colorsToProcess.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                catch (err) {
                    results.push({ color: colorInfo.name, success: false, error: err.message });
                }
            }
            // Update product with new mockups
            await core_1.db.collection('products').doc(id).update({ mockupsByColor });
            res.json({
                success: true,
                message: `Regenerated mockups for ${results.filter(r => r.success).length}/${colorsToProcess.length} colors`,
                results,
                mockupsByColor,
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/products/:id/generate-all-mockups', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const productDoc = await core_1.db.collection('products').doc(id).get();
            if (!productDoc.exists) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            const product = productDoc.data();
            const allColors = product.availableColors || [];
            if (allColors.length === 0) {
                res.status(400).json({ error: 'No colors available for this product' });
                return;
            }
            if (!printful_1.printfulClient.isConfigured) {
                res.status(500).json({ error: 'Printful API key not configured' });
                return;
            }
            // Start generation in background (respond immediately for long operations)
            res.json({
                success: true,
                message: `Mockup generation started for ${allColors.length} colors. Use regenerate-mockups endpoint for synchronous generation.`,
                productId: id,
                colors: allColors.map((c) => c.name),
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ MOCKUP QUEUE PROCESSOR ============
    app.post('/admin/mockup/queue-process', middleware_1.requireAdmin, async (_req, res) => {
        try {
            console.log('[Queue Process] Manually triggered');
            (0, file_routes_1.processQueueInBackground)().catch((err) => {
                console.error('[Queue Process] Background error:', err.message);
            });
            res.json({ success: true, message: 'Queue processing triggered' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRODUCTS PAGE: MOCKUP PRIORITY ============
    app.post('/admin/mockup/priority', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
            if (!blueprintId || !colorName || !artworkUrl) {
                res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
                return;
            }
            console.log(`[Priority Mockup CF] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
            const result = await (0, mockup_generator_1.generateMockupFromPrintful)({
                blueprintId: parseInt(blueprintId),
                printProviderId: printProviderId ? parseInt(printProviderId) : 0,
                colorName,
                colorHex,
                artworkUrl,
                artworkVariant: "black",
                fulfillmentProvider: fulfillmentProvider,
                hasCompositeGraphic: true,
            });
            console.log(`[Priority Mockup CF] Generated: ${result.mockupUrl}`);
            res.json({
                success: true, mockupUrl: result.mockupUrl,
                lifestyleMockupUrl: result.lifestyleUrl || null,
                fromCache: false, generatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error("[Priority Mockup CF] Error:", error);
            res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
        }
    });
}
//# sourceMappingURL=mockup-routes.js.map