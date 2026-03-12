"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINTFUL_KEY_CACHE_TTL = exports.PRINTFUL_API_BASE = exports.PrintfulClient = exports.printfulClient = void 0;
exports.updatePrintfulKeyCache = updatePrintfulKeyCache;
exports.getPrintfulApiKey = getPrintfulApiKey;
exports.getPrintfulApiKeyAsync = getPrintfulApiKeyAsync;
exports.getPrintfulApiKeyFromFirestore = getPrintfulApiKeyFromFirestore;
exports.getPrintfulStoreId = getPrintfulStoreId;
const core_1 = require("../core");
// ============ PRINTFUL CLIENT (No Replit Dependencies) ============
const PRINTFUL_API_BASE = 'https://api.printful.com';
exports.PRINTFUL_API_BASE = PRINTFUL_API_BASE;
let _cachedPrintfulKey = null;
let _printfulKeyLastFetch = 0;
const PRINTFUL_KEY_CACHE_TTL = 60000;
exports.PRINTFUL_KEY_CACHE_TTL = PRINTFUL_KEY_CACHE_TTL;
async function getPrintfulApiKeyFromFirestore() {
    const now = Date.now();
    if (_cachedPrintfulKey && (now - _printfulKeyLastFetch) < PRINTFUL_KEY_CACHE_TTL) {
        return _cachedPrintfulKey;
    }
    try {
        const doc = await core_1.db.collection('system_config').doc('api_keys').get();
        if (doc.exists) {
            const data = doc.data();
            if (data.printfulApiKey && data.printfulApiKey.length > 10) {
                _cachedPrintfulKey = data.printfulApiKey;
                _printfulKeyLastFetch = now;
                return _cachedPrintfulKey;
            }
        }
    }
    catch (e) { }
    return null;
}
function getPrintfulApiKey() {
    if (_cachedPrintfulKey)
        return _cachedPrintfulKey;
    const key = process.env.PRINTFUL_API_KEY;
    if (!key)
        throw new Error('PRINTFUL_API_KEY not configured');
    return key;
}
async function getPrintfulApiKeyAsync() {
    const firestoreKey = await getPrintfulApiKeyFromFirestore();
    if (firestoreKey)
        return firestoreKey;
    const key = process.env.PRINTFUL_API_KEY;
    if (!key)
        throw new Error('PRINTFUL_API_KEY not configured');
    return key;
}
// Get Printful Store ID - fallback for Cloud Functions environment
function getPrintfulStoreId() {
    return process.env.PRINTFUL_STORE_ID || '17456917';
}
class PrintfulClient {
    async getHeaders() {
        const key = await getPrintfulApiKeyAsync();
        return {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
        };
    }
    get isConfigured() {
        try {
            if (_cachedPrintfulKey)
                return true;
            const key = process.env.PRINTFUL_API_KEY;
            return !!key && key.length > 10;
        }
        catch {
            return false;
        }
    }
    async request(method, endpoint, body) {
        const url = `${PRINTFUL_API_BASE}${endpoint}`;
        const headers = await this.getHeaders();
        const options = { method, headers };
        if (body)
            options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Printful API error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        return data.result;
    }
    async getProduct(productId) {
        return this.request('GET', `/products/${productId}`);
    }
    async getPrintfiles(productId) {
        const storeId = getPrintfulStoreId();
        const storeParam = storeId ? `?store_id=${storeId}` : '';
        return this.request('GET', `/mockup-generator/printfiles/${productId}${storeParam}`);
    }
    async getVariantsByColor(productId, colorName) {
        const productData = await this.getProduct(productId);
        console.log(`[Printful] Product ${productId} has ${productData?.variants?.length || 0} variants`);
        if (!productData?.variants || productData.variants.length === 0) {
            console.log(`[Printful] No variants found for product ${productId}`);
            return [];
        }
        const lowerColor = colorName.toLowerCase().replace(/^solid\s+/i, '').trim();
        console.log(`[Printful] Searching for color: "${lowerColor}" in product ${productId}`);
        // First try exact and partial matches
        let matches = productData.variants.filter(v => v.color.toLowerCase() === lowerColor ||
            v.color.toLowerCase().includes(lowerColor) ||
            lowerColor.includes(v.color.toLowerCase()) ||
            v.name.toLowerCase().includes(lowerColor));
        console.log(`[Printful] Found ${matches.length} exact matches for color "${colorName}"`);
        // If no matches and we have variants, fall back to first variant
        if (matches.length === 0 && productData.variants.length > 0) {
            console.log(`[Printful] No exact color match for "${colorName}" in product ${productId}, using first variant: ${productData.variants[0].color}`);
            matches = [productData.variants[0]];
        }
        return matches;
    }
    async createMockupTask(productId, variantIds, files, format = 'jpg', optionGroups) {
        const body = { variant_ids: variantIds, format, files };
        if (optionGroups?.length)
            body.option_groups = optionGroups;
        const storeId = getPrintfulStoreId();
        const storeParam = storeId ? `?store_id=${storeId}` : '';
        console.log('[Printful] Creating mockup task for product', productId, 'store_id:', storeId, 'variant_ids:', variantIds);
        console.log('[Printful] Request body:', JSON.stringify(body));
        return this.request('POST', `/mockup-generator/create-task/${productId}${storeParam}`, body);
    }
    async getMockupTaskResult(taskKey) {
        const storeId = getPrintfulStoreId();
        const storeParam = storeId ? `&store_id=${storeId}` : '';
        return this.request('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}${storeParam}`);
    }
    async waitForMockupTask(taskKey, maxWaitMs = 60000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            const result = await this.getMockupTaskResult(taskKey);
            if (result.status === 'completed')
                return result;
            if (result.status === 'failed')
                throw new Error(`Printful mockup failed: ${result.error}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error(`Printful mockup task timed out after ${maxWaitMs}ms`);
    }
}
exports.PrintfulClient = PrintfulClient;
const printfulClient = new PrintfulClient();
exports.printfulClient = printfulClient;
function updatePrintfulKeyCache(apiKey) {
    _cachedPrintfulKey = apiKey;
    _printfulKeyLastFetch = Date.now();
}
//# sourceMappingURL=printful.js.map