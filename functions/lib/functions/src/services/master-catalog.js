"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTER_CATALOG_SYNCS_COLLECTION = exports.MASTER_CATALOG_COLLECTION = exports.QRG_LEGACY_CODE_MAP = exports.QRG_BLANK_CATEGORIES = exports.QRG_TOP_LEVEL_CATEGORIES = void 0;
exports.resolveQrgCategoryLabel = resolveQrgCategoryLabel;
exports.syncMasterCatalog = syncMasterCatalog;
exports.syncPrintifyToStaging = syncPrintifyToStaging;
exports.syncPrintfulToStaging = syncPrintfulToStaging;
exports.enrichMasterCatalog = enrichMasterCatalog;
const core_1 = require("../core");
const safeAssign_1 = require("../safeAssign");
const instance_resolver_1 = require("./instance-resolver");
const printify_1 = require("./printify");
const printful_1 = require("./printful");
/** Strip HTML tags and collapse whitespace */
function stripHtml(raw) {
    if (!raw)
        return null;
    const stripped = raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    return stripped || null;
}
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}
/** Reject after timeoutMs with a timeout error */
function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)),
    ]);
}
/** Fetch with automatic retry on 429 / 5xx / timeout, up to maxRetries attempts */
async function fetchWithRetry(fn, maxRetries = 3, baseDelayMs = 2000, timeoutMs = 25000) {
    let attempt = 0;
    while (true) {
        try {
            return await withTimeout(fn(), timeoutMs);
        }
        catch (e) {
            const isRateLimit = /429|rate.?limit|too.?many/i.test(e.message ?? '');
            const isServer = /5\d\d|server.?error/i.test(e.message ?? '');
            const isTimeout = /timed out/i.test(e.message ?? '');
            if ((isRateLimit || isServer || isTimeout) && attempt < maxRetries) {
                const wait = baseDelayMs * Math.pow(2, attempt);
                console.warn(`[Enrich] Retry ${attempt + 1}/${maxRetries} after ${wait}ms — ${e.message}`);
                await delay(wait);
                attempt++;
            }
            else {
                throw e;
            }
        }
    }
}
/** Extract plain URL strings from an ImageRecord[] or mixed array */
function toUrlArray(records) {
    return (records || []).map((r) => {
        if (typeof r === 'string')
            return r.trim() || null;
        if (r && typeof r === 'object' && typeof r.url === 'string')
            return r.url.trim() || null;
        return null;
    }).filter((u) => !!u);
}
/** Merge image arrays and return plain URL strings */
function mergeImages(existing, incoming) {
    return toUrlArray((0, instance_resolver_1.mergeImagesByUrl)(existing, incoming));
}
const MASTER_CATALOG_COLLECTION = 'master_catalog';
exports.MASTER_CATALOG_COLLECTION = MASTER_CATALOG_COLLECTION;
const MASTER_CATALOG_SYNCS_COLLECTION = 'master_catalog_syncs';
exports.MASTER_CATALOG_SYNCS_COLLECTION = MASTER_CATALOG_SYNCS_COLLECTION;
const PRINTIFY_BLUEPRINTS_COLLECTION = 'printify_blueprints';
const PRINTIFY_PROVIDERS_COLLECTION = 'printifyPrintProviders';
const PRINTFUL_PRODUCTS_COLLECTION = 'printful_products';
const PRINTFUL_VARIANTS_COLLECTION = 'printful_variants';
// ── QRG Top-Level Category Definitions ───────────────────────────────────────
// Source of truth: replit.md — QRG Numbering System section
// Each top-level gets a X000 code. Subcategories get X100–X900.
// Each subcategory holds up to 99 products (X101–X199, etc.).
exports.QRG_TOP_LEVEL_CATEGORIES = [
    { name: 'Apparel', code: 1000 },
    { name: 'Houseware', code: 2000 },
    { name: 'Print & Display', code: 3000 },
    { name: 'Accessories', code: 4000 },
    { name: 'Pet Products', code: 5000 },
    { name: 'Holiday & Seasonal', code: 6000 },
];
// ── QRG Blank Category Definitions (5-digit BBBBB scheme) ────────────────────
// Structure: [category 1-6][subcategory 1-9][slot 001-999]
// Each subcategory holds up to 999 blanks. If a subcategory ever exceeds 999,
// allocation simply continues past rangeEnd (no hard stop — "screw it").
exports.QRG_BLANK_CATEGORIES = [
    // ── 1x000 Apparel ─────────────────────────────────────────────────────────
    { name: 'T-Shirts', parent: 'Apparel', rangeStart: 11001, rangeEnd: 11999 },
    { name: 'Hoodies & Sweatshirts', parent: 'Apparel', rangeStart: 12001, rangeEnd: 12999 },
    { name: 'Hats', parent: 'Apparel', rangeStart: 13001, rangeEnd: 13999 },
    { name: 'Tank Tops', parent: 'Apparel', rangeStart: 14001, rangeEnd: 14999 },
    { name: 'Long Sleeve', parent: 'Apparel', rangeStart: 15001, rangeEnd: 15999 },
    { name: "Youth/Kids", parent: 'Apparel', rangeStart: 16001, rangeEnd: 16999 },
    { name: "Women's", parent: 'Apparel', rangeStart: 17001, rangeEnd: 17999 },
    { name: 'Specialty Apparel', parent: 'Apparel', rangeStart: 18001, rangeEnd: 18999 },
    // ── 2x000 Houseware ───────────────────────────────────────────────────────
    { name: 'Drinkware', parent: 'Houseware', rangeStart: 21001, rangeEnd: 21999 },
    { name: 'Barware', parent: 'Houseware', rangeStart: 22001, rangeEnd: 22999 },
    { name: 'Drinkware Accessories', parent: 'Houseware', rangeStart: 23001, rangeEnd: 23999 },
    { name: 'Kitchen & Dining', parent: 'Houseware', rangeStart: 24001, rangeEnd: 24999 },
    { name: 'Bedding & Textiles', parent: 'Houseware', rangeStart: 25001, rangeEnd: 25999 },
    { name: 'Home Décor', parent: 'Houseware', rangeStart: 26001, rangeEnd: 26999 },
    // ── 3x000 Print & Display ─────────────────────────────────────────────────
    { name: 'Wall Art & Prints', parent: 'Print & Display', rangeStart: 31001, rangeEnd: 31999 },
    { name: 'Stickers & Magnets', parent: 'Print & Display', rangeStart: 32001, rangeEnd: 32999 },
    { name: 'Stationery & Paper', parent: 'Print & Display', rangeStart: 33001, rangeEnd: 33999 },
    { name: 'Signs & Display', parent: 'Print & Display', rangeStart: 34001, rangeEnd: 34999 },
    { name: 'Books & Photo', parent: 'Print & Display', rangeStart: 35001, rangeEnd: 35999 },
    { name: 'Pins & Patches', parent: 'Print & Display', rangeStart: 36001, rangeEnd: 36999 },
    { name: 'Tags', parent: 'Print & Display', rangeStart: 37001, rangeEnd: 37999 },
    { name: 'Puzzles & Games', parent: 'Print & Display', rangeStart: 38001, rangeEnd: 38999 },
    { name: 'Novelty', parent: 'Print & Display', rangeStart: 39001, rangeEnd: 39999 },
    // ── 4x000 Accessories ─────────────────────────────────────────────────────
    { name: 'Bags & Pouches', parent: 'Accessories', rangeStart: 41001, rangeEnd: 41999 },
    { name: 'Jewelry', parent: 'Accessories', rangeStart: 42001, rangeEnd: 42999 },
    { name: 'Phone & Tech Cases', parent: 'Accessories', rangeStart: 43001, rangeEnd: 43999 },
    { name: 'Travel Accessories', parent: 'Accessories', rangeStart: 44001, rangeEnd: 44999 },
    { name: 'Small Accessories', parent: 'Accessories', rangeStart: 45001, rangeEnd: 45999 },
    // ── 5x000 Pet Products ────────────────────────────────────────────────────
    { name: 'Pet Apparel', parent: 'Pet Products', rangeStart: 51001, rangeEnd: 51999 },
    { name: 'Pet Accessories', parent: 'Pet Products', rangeStart: 52001, rangeEnd: 52999 },
    // ── 6x000 Holiday & Seasonal ──────────────────────────────────────────────
    { name: 'Ornaments & Décor', parent: 'Holiday & Seasonal', rangeStart: 61001, rangeEnd: 61999 },
    { name: 'Stockings & Gifting', parent: 'Holiday & Seasonal', rangeStart: 62001, rangeEnd: 62999 },
    { name: 'Seasonal Apparel', parent: 'Holiday & Seasonal', rangeStart: 63001, rangeEnd: 63999 },
];
// ── Legacy numeric-code → new subcategory label (for Firestore docs written
//    before the 4-digit scheme was introduced) ─────────────────────────────
exports.QRG_LEGACY_CODE_MAP = {
    100: 'T-Shirts',
    200: 'Hoodies & Sweatshirts',
    300: 'Hats',
    400: 'Drinkware',
    500: 'Bags & Pouches',
    510: 'Jewelry',
    600: 'Phone & Tech Cases',
    700: 'Stickers & Magnets',
    710: 'Wall Art & Prints',
    720: 'Stationery & Paper',
    800: 'Home Décor',
    810: 'Specialty Apparel',
    900: 'Pet Accessories',
    910: 'Ornaments & Décor',
};
// ── Old 3-word string names → new subcategory labels ─────────────────────────
const QRG_LEGACY_NAME_MAP = {
    'Tees': 'T-Shirts',
    'Hoodies': 'Hoodies & Sweatshirts',
    'Hats & Caps': 'Hats',
    'Hats': 'Hats',
    'Baby & Kids': 'Youth/Kids',
    'Bottoms & Active': 'Specialty Apparel',
    'Footwear & Socks': 'Specialty Apparel',
    'Sleepwear & Underwear': 'Specialty Apparel',
    'Drinkware': 'Drinkware',
};
/**
 * Resolve any qrgCategory value (old numeric, old string, or new string) to
 * a canonical QRGCategoryName label. Returns 'Unclassified' if unresolvable.
 */
function resolveQrgCategoryLabel(raw) {
    if (raw == null || raw === '')
        return 'Unclassified';
    const n = Number(raw);
    if (!isNaN(n) && exports.QRG_LEGACY_CODE_MAP[n])
        return exports.QRG_LEGACY_CODE_MAP[n];
    const s = String(raw).trim();
    if (QRG_LEGACY_NAME_MAP[s])
        return QRG_LEGACY_NAME_MAP[s];
    const isKnown = exports.QRG_BLANK_CATEGORIES.some(c => c.name === s);
    if (isKnown)
        return s;
    return s || 'Unclassified';
}
/**
 * Classify a product title+typeName into a QRG subcategory.
 * Returns null if unclassified.
 */
function classifyToQRGCategory(title, typeName) {
    const t = ((title || '') + ' ' + (typeName || '')).toLowerCase();
    // ── Pet Products ────────────────────────────────────────────────────────────
    if (/\bpet\b|\bdog\b|\bcat\b|puppy|kitten|pet.?collar|pet.?bandana/.test(t)) {
        if (/collar|leash|\btag\b|bowl|feeder/.test(t))
            return 'Pet Accessories';
        return 'Pet Apparel';
    }
    // ── Holiday & Seasonal ──────────────────────────────────────────────────────
    if (/christmas|holiday|ornament|halloween|easter|thanksgiving|valentine|xmas|stocking|tree.?skirt|snowflake/.test(t)) {
        if (/\bsweater\b|\bshirt\b|\btee\b|hoodie|ugly/.test(t))
            return 'Seasonal Apparel';
        if (/\bstocking\b|gift|gifting/.test(t))
            return 'Stockings & Gifting';
        return 'Ornaments & Décor';
    }
    // ── Youth/Kids (check before general apparel) ───────────────────────────────
    if (/\bbaby\b|onesie|bodysuit|\binfant\b|toddler|\byouth\b|kids?\b|children/.test(t)) {
        if (/sneaker|sandal|slipper|\bslide\b|\bboot\b|\bshoe\b|clog/.test(t))
            return 'Specialty Apparel';
        if (/lounge.?pant|jogger|\bshort\b|legging/.test(t))
            return 'Specialty Apparel';
        if (/\bhat\b|\bcap\b|\bbeanie\b/.test(t))
            return 'Hats';
        if (/puzzle|coloring/.test(t))
            return 'Puzzles & Games';
        return 'Youth/Kids';
    }
    // ── Women's ──────────────────────────────────────────────────────────────────
    if (/\bwomens?\b|\bwomen'?s\b|\bladies\b|\bfeminine\b|\bcurvy\b/.test(t))
        return "Women's";
    // ── Hats ─────────────────────────────────────────────────────────────────────
    if (/snapback|trucker.?hat|dad.?hat|baseball.?cap|bucket.?hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t))
        return 'Hats';
    // ── Long Sleeve (check before T-Shirts) ──────────────────────────────────────
    if (/long.?sleeve/.test(t))
        return 'Long Sleeve';
    // ── Tank Tops (check before T-Shirts) ────────────────────────────────────────
    if (/tank.?top|crop.?top|camisole|\bpolo\b|v-?neck|\bhenley\b|raglan/.test(t))
        return 'Tank Tops';
    // ── T-Shirts ─────────────────────────────────────────────────────────────────
    if (/t-?shirt|tshirt|\btee\b|\bjersey\b|\bblouse\b/.test(t))
        return 'T-Shirts';
    // ── Hoodies & Sweatshirts ────────────────────────────────────────────────────
    if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew.?neck|\bsweater\b/.test(t))
        return 'Hoodies & Sweatshirts';
    // ── Specialty Apparel (bottoms, footwear, sleepwear, active — catch-all) ─────
    if (/pajama|pyjama|\bboxer\b|\bbrief\b|\bthong\b|\bunderwear\b|loungewear|nightwear/.test(t))
        return 'Specialty Apparel';
    if (/swimsuit|bikini|rash.?guard|windbreaker|biker.?short|bodycon|legging|yoga|jogger|sweatpant|sport.?bra|compression|activewear|athletic.?short|bomber|puffer.?jacket|denim.?jacket|work.?jacket|soft.?shell|varsity.?jacket|letterman|anorak|\bdress\b|\bskirt\b|dolman|swim.?trunk|\bshort\b/.test(t))
        return 'Specialty Apparel';
    if (/sneaker|sandal|slipper|flip.?flop|\bslide\b|\bboot\b|clog|\bsock\b/.test(t))
        return 'Specialty Apparel';
    // ── Barware (check before Drinkware to catch glass-word overlap) ────────────
    if (/rocks.?glass|whiskey.?glass|champagne.?glass|sipper.?glass|mixing.?glass|can.?glass|can.?shaped.?glass|stubby.?cooler|highball/.test(t))
        return 'Barware';
    // ── Drinkware ────────────────────────────────────────────────────────────────
    if (/\bmugs?\b|tumbler|water.?bottle|wine.?glass|beer.?stein|beer.?mug|\bflask\b|thermos|travel.?mug|\bpint\b|\bdrinkware\b|insulated.?bottle|insulated.?tumbler|shot.?glass/.test(t))
        return 'Drinkware';
    // ── Drinkware Accessories ────────────────────────────────────────────────────
    if (/beverage.?holder|can.?holder|mason.?jar|protein.?shaker|slim.?beverage|insulated.?food/.test(t))
        return 'Drinkware Accessories';
    // ── Kitchen & Dining ─────────────────────────────────────────────────────────
    if (/cutting.?board|pizza.?board|charcuterie|bento|lunch.?box/.test(t))
        return 'Kitchen & Dining';
    // ── Bedding & Textiles ───────────────────────────────────────────────────────
    if (/comforter|quilt|coverlet|duvet|\bsham\b|fitted.?sheet|flat.?sheet|bed.?runner|window.?curtain|\bcurtain\b|tablecloth|\bnapkin\b|oven.?mitt|beach.?cloth/.test(t))
        return 'Bedding & Textiles';
    // ── Home Décor ───────────────────────────────────────────────────────────────
    if (/\bpillow\b|blanket|\btowel\b|\bapron\b|\brug\b|doormat|table.?runner|cushion|coaster|shower.?curtain|\bbath\b|face.?mask|\bbandana\b|calendar|\bclock\b|\bcandle\b|serving.?tray|phone.?stand|felt.?storage|light.?cube/.test(t))
        return 'Home Décor';
    // ── Wall Art & Prints ────────────────────────────────────────────────────────
    if (/acrylic.?print|acrylic.?sign|metal.?print|gallery.?wrap|art.?board|canvas.?wrap|canvas.?gallery|canvas.?print|wall.?art|\bposter\b|\bframed\b|tapestry|\bflag\b|art.?print|wood.?panel.?painting|ceramic.?photo.?tile|photo.?block|gallery.?board/.test(t))
        return 'Wall Art & Prints';
    // ── Stickers & Magnets ───────────────────────────────────────────────────────
    if (/\bsticker\b|\bmagnet\b|\bdecal\b|\bbumper.?sticker\b/.test(t))
        return 'Stickers & Magnets';
    // ── Books & Photo ────────────────────────────────────────────────────────────
    if (/photo.?book|coloring.?book|board.?book|note.?cube|\bbookmark\b|bible.?cover|softcover|hardcover/.test(t))
        return 'Books & Photo';
    // ── Stationery & Paper ───────────────────────────────────────────────────────
    if (/notebook|journal|planner|stationery|greeting.?card|postcard|notepad|business.?card|note.?pad|post.?it/.test(t))
        return 'Stationery & Paper';
    // ── Signs & Display ──────────────────────────────────────────────────────────
    if (/yard.?sign|lawn.?sign|vinyl.?banner|\bpennant\b|license.?plate|vanity.?plate|foam.?board|aluminum.?composite|aluminum.?panel|\bstandee\b|\bstatue\b|wood.?sign|wooden.?sign|hanging.?sign|wooden.?hanging|free.?standing.?wooden|slate.?desk.?plaque|protest.?sign|plastic.?yard/.test(t))
        return 'Signs & Display';
    // ── Pins & Patches ───────────────────────────────────────────────────────────
    if (/pin.?button|round.?pin|set.?of.?pin|\bpatch\b|embroidered.?patch|iron.?on.?patch/.test(t))
        return 'Pins & Patches';
    // ── Tags ─────────────────────────────────────────────────────────────────────
    if (/luggage.?tag|keyring.?tag|key.?ring|photo.?keyring/.test(t))
        return 'Tags';
    // ── Puzzles & Games ──────────────────────────────────────────────────────────
    if (/\bpuzzle\b|jigsaw|golf.?ball|hockey.?puck|pickleball|ping.?pong|frisbee|wham.?o/.test(t))
        return 'Puzzles & Games';
    // ── Novelty ──────────────────────────────────────────────────────────────────
    if (/\bballoon\b|mylar|car.?seat.?cover|sun.?shade|car.?sun|temporary.?tattoo/.test(t))
        return 'Novelty';
    // ── Bags & Pouches ───────────────────────────────────────────────────────────
    if (/tote.?bag|backpack|fanny.?pack|drawstring.?bag|duffel|duffle|messenger.?bag|crossbody|\bpouch\b|shopping.?bag|laptop.?bag|\bsack\b/.test(t))
        return 'Bags & Pouches';
    // ── Jewelry ──────────────────────────────────────────────────────────────────
    if (/bracelet|necklace|earring|\bring\b|sunglasse|\bscarf\b|\bglove\b|\bbelt\b|headband|neck.?gaiter|\bhair\b|anklet|birthstone.?charm/.test(t))
        return 'Jewelry';
    // ── Phone & Tech Cases ───────────────────────────────────────────────────────
    if (/phone.?case|iphone|samsung.?case|airpod|laptop.?sleeve|mouse.?pad|mousepad|tablet.?case/.test(t))
        return 'Phone & Tech Cases';
    // ── Travel Accessories ───────────────────────────────────────────────────────
    if (/luggage.?cover|passport.?cover/.test(t))
        return 'Travel Accessories';
    // ── Small Accessories ─────────────────────────────────────────────────────────
    if (/compact.?mirror|travel.?mirror|jewelry.?box|\bkeychain\b|\bwallet\b/.test(t))
        return 'Small Accessories';
    return null;
}
function normalizeForMatch(s) {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}
function isBrandModelMatch(brandA, modelA, brandB, modelB) {
    if (!brandA || !modelA || !brandB || !modelB)
        return false;
    const ba = normalizeForMatch(brandA);
    const ma = normalizeForMatch(modelA);
    const bb = normalizeForMatch(brandB);
    const mb = normalizeForMatch(modelB);
    const brandMatch = ba === bb || ba.includes(bb) || bb.includes(ba);
    const modelMatch = ma === mb || ma.includes(mb) || mb.includes(ma);
    return brandMatch && modelMatch;
}
function extractImageUrls(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw)) {
        return raw
            .map((img) => {
            if (typeof img === 'string')
                return img;
            return img?.src || img?.url || img?.imageUrl || null;
        })
            .filter((u) => !!u && typeof u === 'string');
    }
    if (typeof raw === 'string')
        return [raw];
    return [];
}
async function commitBatch(writes) {
    const CHUNK = 400;
    for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = core_1.db.batch();
        for (const w of chunk) {
            if (w.merge) {
                batch.set(w.ref, w.data, { merge: true });
            }
            else {
                batch.set(w.ref, w.data);
            }
        }
        await batch.commit();
    }
}
async function syncMasterCatalog(_options = {}) {
    const { cleanSweep = false } = _options;
    console.log(`[MasterCatalog] Starting QRG sync${cleanSweep ? ' (CLEAN SWEEP — will wipe existing docs)' : ''}...`);
    const stats = {
        created: 0,
        updated: 0,
        bridged: 0,
        printifyOnly: 0,
        printfulOnly: 0,
        unclassified: 0,
        byCategory: { apparel: 0, houseware: 0, printAndDisplay: 0, accessories: 0, petProducts: 0, holidayAndSeasonal: 0 },
    };
    const writes = [];
    // Load everything in parallel
    const [bpSnap, provSnap, pfSnap, pvSnap, masterSnap] = await Promise.all([
        core_1.db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).get(),
        core_1.db.collection(PRINTIFY_PROVIDERS_COLLECTION).get(),
        core_1.db.collection(PRINTFUL_PRODUCTS_COLLECTION).get(),
        core_1.db.collection(PRINTFUL_VARIANTS_COLLECTION).get(),
        core_1.db.collection(MASTER_CATALOG_COLLECTION).get(),
    ]);
    const printifyBlueprints = bpSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printifyProviders = provSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printfulProducts = pfSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    const printfulVariants = pvSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    // Fallback: if printful_products is empty, read from printfulCatalog (legacy collection)
    if (printfulProducts.length === 0) {
        const legacySnap = await core_1.db.collection('printfulCatalog').get();
        for (const doc of legacySnap.docs) {
            printfulProducts.push({ _docId: doc.id, ...doc.data() });
        }
        if (printfulProducts.length > 0) {
            console.log(`[MasterCatalog] printful_products empty — loaded ${printfulProducts.length} from printfulCatalog fallback`);
        }
    }
    // ── Clean sweep: delete all existing master_catalog docs in batches ───────────
    if (cleanSweep && masterSnap.size > 0) {
        console.log(`[MasterCatalog] Clean sweep: deleting ${masterSnap.size} existing docs...`);
        const deleteBatches = [];
        let batch = core_1.db.batch();
        let count = 0;
        for (const doc of masterSnap.docs) {
            batch.delete(doc.ref);
            count++;
            if (count % 400 === 0) {
                deleteBatches.push(batch);
                batch = core_1.db.batch();
            }
        }
        if (count % 400 !== 0)
            deleteBatches.push(batch);
        for (const b of deleteBatches)
            await b.commit();
        console.log(`[MasterCatalog] Clean sweep: deleted ${masterSnap.size} docs.`);
    }
    // Build existing master catalog map (docId → data)
    // On clean sweep this is intentionally empty so all IDs are freshly allocated.
    const existingMaster = new Map();
    if (!cleanSweep) {
        for (const doc of masterSnap.docs) {
            existingMaster.set(doc.id, { _docId: doc.id, ...doc.data() });
        }
    }
    console.log(`[MasterCatalog] Loaded: ${printifyBlueprints.length} blueprints, ${printfulProducts.length} Printful products, ${existingMaster.size} existing master records`);
    // ── Build lookups: providerKey → existing QRG docId ──────────────────────────
    // On a clean sweep both maps are empty so every product gets a fresh 4-digit ID.
    const blueprintToQrgDoc = new Map();
    const printfulToQrgDoc = new Map();
    for (const [docId, data] of existingMaster.entries()) {
        if (Array.isArray(data.providerMappings)) {
            for (const m of data.providerMappings) {
                if (m.provider === 'printify' && m.blueprintId)
                    blueprintToQrgDoc.set(Number(m.blueprintId), docId);
                if (m.provider === 'printful' && m.productId)
                    printfulToQrgDoc.set(Number(m.productId), docId);
            }
        }
        else {
            // Support legacy flat-field schema (docs written before providerMappings[] was introduced)
            if (data.printifyBlueprintId)
                blueprintToQrgDoc.set(Number(data.printifyBlueprintId), docId);
            if (data.printfulProductId)
                printfulToQrgDoc.set(Number(data.printfulProductId), docId);
        }
    }
    // ── Build next available BBB number per category ──────────────────────────────
    // Keyed by category name. Counter starts at rangeStart and advances past any
    // existing assignments found in Firestore (incremental re-sync safe).
    const nextBBB = {};
    for (const cat of exports.QRG_BLANK_CATEGORIES) {
        nextBBB[cat.name] = cat.rangeStart;
    }
    for (const [, data] of existingMaster.entries()) {
        const blankNum = Number(data.qrgBlankId);
        if (data.qrgBlankId && data.qrgCategory && !isNaN(blankNum)) {
            if (nextBBB[data.qrgCategory] !== undefined && blankNum >= nextBBB[data.qrgCategory]) {
                nextBBB[data.qrgCategory] = blankNum + 1;
            }
        }
    }
    // ── Build best Printify provider per blueprint ──────────────────────────────
    const bestProviderByBlueprint = new Map();
    for (const p of printifyProviders) {
        const bid = Number(p.blueprintId);
        const curr = bestProviderByBlueprint.get(bid);
        if (!curr) {
            bestProviderByBlueprint.set(bid, p);
        }
        else {
            const currUSA = curr.isUSA;
            const newUSA = p.isUSA;
            if (!currUSA && newUSA) {
                bestProviderByBlueprint.set(bid, p);
            }
            else if (currUSA === newUSA) {
                const currCost = curr.minCost || 999999;
                const newCost = p.minCost || 999999;
                if (newCost < currCost)
                    bestProviderByBlueprint.set(bid, p);
            }
        }
    }
    // ── Build Printful variant and product lookups ──────────────────────────────
    const variantsByPrintfulId = new Map();
    for (const v of printfulVariants) {
        const pid = Number(v.productId || v.product_id);
        if (!pid)
            continue;
        if (!variantsByPrintfulId.has(pid))
            variantsByPrintfulId.set(pid, []);
        variantsByPrintfulId.get(pid).push(v);
    }
    const printfulById = new Map();
    for (const pf of printfulProducts) {
        printfulById.set(Number(pf.id || pf._docId), pf);
    }
    // ── In-memory docs being built this sync ─────────────────────────────────────
    // docId → accumulated entry (used for bridging within same sync run)
    const inProgressDocs = new Map();
    function allocateQRGDocId(existingDocId, qrgCategory, pendingFallback) {
        if (existingDocId) {
            return { docId: existingDocId, alreadyExists: existingMaster.has(existingDocId) || inProgressDocs.has(existingDocId) };
        }
        if (qrgCategory && nextBBB[qrgCategory] !== undefined) {
            const bbb = nextBBB[qrgCategory];
            nextBBB[qrgCategory] = bbb + 1;
            return { docId: `qrg_${bbb}`, alreadyExists: false };
        }
        return { docId: `pending_${pendingFallback}`, alreadyExists: existingMaster.has(`pending_${pendingFallback}`) };
    }
    function bumpCategoryStats(qrgCategory) {
        if (!qrgCategory) {
            stats.unclassified++;
            return;
        }
        const cat = exports.QRG_BLANK_CATEGORIES.find(c => c.name === qrgCategory);
        if (!cat) {
            stats.unclassified++;
            return;
        }
        switch (cat.parent) {
            case 'Apparel':
                stats.byCategory.apparel++;
                break;
            case 'Houseware':
                stats.byCategory.houseware++;
                break;
            case 'Print & Display':
                stats.byCategory.printAndDisplay++;
                break;
            case 'Accessories':
                stats.byCategory.accessories++;
                break;
            case 'Pet Products':
                stats.byCategory.petProducts++;
                break;
            case 'Holiday & Seasonal':
                stats.byCategory.holidayAndSeasonal++;
                break;
            default: stats.unclassified++;
        }
    }
    const matchedPrintfulIds = new Set();
    // ── Process Printify blueprints ──────────────────────────────────────────────
    for (const bp of printifyBlueprints) {
        const blueprintId = Number(bp.id || bp.blueprintId || bp._docId);
        if (isNaN(blueprintId))
            continue;
        const provider = bestProviderByBlueprint.get(blueprintId);
        const now = new Date().toISOString();
        // Classify into QRG category
        const qrgCategory = classifyToQRGCategory(bp.title, bp.typeName);
        // Try to match with a Printful product by brand+model
        let matchedPrintful = null;
        for (const pf of printfulProducts) {
            if (isBrandModelMatch(bp.brand, bp.model, pf.brand, pf.model)) {
                matchedPrintful = pf;
                break;
            }
        }
        const pfId = matchedPrintful ? Number(matchedPrintful.id || matchedPrintful._docId) : null;
        if (pfId !== null)
            matchedPrintfulIds.add(pfId);
        // Find existing QRG doc: check Printify mapping first, then Printful mapping
        const existingViaBlueprint = blueprintToQrgDoc.get(blueprintId);
        const existingViaPrintful = pfId !== null ? printfulToQrgDoc.get(pfId) : undefined;
        const resolvedExistingId = existingViaBlueprint || existingViaPrintful;
        const { docId, alreadyExists } = allocateQRGDocId(resolvedExistingId, qrgCategory, `py_${blueprintId}`);
        // Register lookups so Printful processing can find this doc
        blueprintToQrgDoc.set(blueprintId, docId);
        if (pfId !== null)
            printfulToQrgDoc.set(pfId, docId);
        const currentDoc = existingMaster.get(docId) || inProgressDocs.get(docId);
        // ── Build Printify provider mapping ──────────────────────────────────────
        const pyMapping = {
            provider: 'printify',
            blueprintId,
            brand: bp.brand || null,
            model: bp.model || null,
            printProviderId: provider?.providerId || null,
            originCountry: provider?.country || null,
            isUSA: provider?.isUSA || false,
        };
        // ── Extract Printify images ───────────────────────────────────────────────
        const pyImagesRaw = extractImageUrls(bp.images);
        // ── Build Printful data if matched ────────────────────────────────────────
        let pfMapping = null;
        let pfImagesRaw = [];
        let pfColors = [];
        let pfSizes = [];
        let pfMinPrice = null;
        let pfMaxPrice = null;
        let pfOriginCountry = null;
        if (matchedPrintful && pfId !== null) {
            const pfVars = variantsByPrintfulId.get(pfId) || [];
            const colorMap = new Map();
            const sizeSet = new Set();
            for (const v of pfVars) {
                if (v.color && !colorMap.has(v.color))
                    colorMap.set(v.color, v.colorCode || v.color_code || '#888888');
                if (v.size)
                    sizeSet.add(v.size);
            }
            pfColors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
            pfSizes = Array.from(sizeSet);
            pfImagesRaw = extractImageUrls(matchedPrintful.images);
            if (pfImagesRaw.length === 0 && matchedPrintful.image)
                pfImagesRaw = [matchedPrintful.image];
            pfMinPrice = matchedPrintful.minPrice ? parseFloat(String(matchedPrintful.minPrice)) : null;
            pfMaxPrice = matchedPrintful.maxPrice ? parseFloat(String(matchedPrintful.maxPrice)) : null;
            pfOriginCountry = matchedPrintful.originCountry || matchedPrintful.origin_country || null;
            pfMapping = {
                provider: 'printful',
                productId: pfId,
                brand: matchedPrintful.brand || null,
                model: matchedPrintful.model || null,
                originCountry: pfOriginCountry,
                isUSA: (pfOriginCountry || '').toUpperCase() === 'US' || (pfOriginCountry || '').toUpperCase() === 'USA',
            };
        }
        // ── Merge provider mappings ───────────────────────────────────────────────
        const existingMappings = currentDoc?.providerMappings || [];
        const newMappings = [...existingMappings];
        const pyIdx = newMappings.findIndex((m) => m.provider === 'printify' && m.blueprintId === blueprintId);
        if (pyIdx >= 0)
            newMappings[pyIdx] = pyMapping;
        else
            newMappings.push(pyMapping);
        if (pfMapping) {
            const pfIdx = newMappings.findIndex((m) => m.provider === 'printful' && m.productId === pfId);
            if (pfIdx >= 0)
                newMappings[pfIdx] = pfMapping;
            else
                newMappings.push(pfMapping);
        }
        // availableVia — provider badge: sorted array of providers that carry this blank
        const availableVia = Array.from(new Set(newMappings.map((m) => m.provider))).sort();
        // ── Merge images by provider — stored separately AND combined ─────────────
        const existingPyImages = currentDoc?.printifyImages || [];
        const existingPfImages = currentDoc?.printfulImages || [];
        const newPyImages = mergeImages(existingPyImages, pyImagesRaw);
        const newPfImages = pfImagesRaw.length > 0
            ? mergeImages(existingPfImages, pfImagesRaw)
            : existingPfImages;
        const combinedImages = mergeImages([], [...newPyImages, ...newPfImages]);
        // ── Colors & sizes: Printful variants win if available, else Printify ─────
        let incomingColors = pfColors;
        if (incomingColors.length === 0 && Array.isArray(provider?.availableColors))
            incomingColors = provider.availableColors;
        const newColors = (0, instance_resolver_1.isMeaningfulValue)(incomingColors) ? incomingColors : (currentDoc?.colors ?? []);
        let incomingSizes = pfSizes;
        if (incomingSizes.length === 0 && Array.isArray(provider?.availableSizes))
            incomingSizes = provider.availableSizes;
        const newSizes = (0, instance_resolver_1.mergeArrayUnionStrings)(currentDoc?.sizes ?? [], incomingSizes);
        // ── Pricing ───────────────────────────────────────────────────────────────
        const pyMinCents = provider?.minCost ?? null;
        const pyMin = pyMinCents !== null ? pyMinCents / 100 : null;
        const pyMaxCents = provider?.maxCost ?? null;
        const pyMax = pyMaxCents !== null ? pyMaxCents / 100 : null;
        const newMinPrice = pyMin !== null && pfMinPrice !== null ? Math.max(pyMin, pfMinPrice) : (pyMin ?? pfMinPrice ?? null);
        const newMaxPrice = pyMax !== null && pfMaxPrice !== null ? Math.max(pyMax, pfMaxPrice) : (pyMax ?? pfMaxPrice ?? null);
        // ── Canonical fields (safe merge — never overwrite with empty) ────────────
        const providerTitle = matchedPrintful?.title || matchedPrintful?.typeName || bp.title || null;
        const canonicalTitle = (0, safeAssign_1.safeAssignRequired)(currentDoc?.canonicalTitle, providerTitle);
        const canonicalBrand = (0, safeAssign_1.safeAssign)(currentDoc?.brand, matchedPrintful?.brand || bp.brand || null);
        // ── Determine categorySource ──────────────────────────────────────────────
        // If existing doc was manually set by admin, respect it. Otherwise derive from classification.
        const categorySource = currentDoc?.categorySource === 'manual'
            ? 'manual'
            : (qrgCategory ? 'mapped' : 'inferred');
        const _blankStr = docId.startsWith('qrg_') ? docId.slice(4) : null;
        const entry = {
            qrgBlankId: _blankStr,
            qrgParentCategory: _blankStr ? _blankStr[0] : null,
            qrgProductType: _blankStr ? _blankStr[1] : null,
            qrgItemNumber: _blankStr ? _blankStr.slice(2) : null,
            qrgCategory: qrgCategory || 'Unclassified',
            canonicalTitle,
            brand: canonicalBrand || currentDoc?.brand || null,
            model: (0, safeAssign_1.safeAssign)(currentDoc?.model, bp.model || matchedPrintful?.model || null),
            description: (0, safeAssign_1.safeAssign)(currentDoc?.description, stripHtml(bp.richDescription || bp.description || null)),
            providerMappings: newMappings,
            availableVia,
            printifyImages: newPyImages,
            printfulImages: newPfImages,
            images: combinedImages,
            colors: newColors,
            sizes: newSizes,
            originCountry: pfOriginCountry || provider?.country || currentDoc?.originCountry || null,
            minPrice: newMinPrice,
            maxPrice: newMaxPrice,
            categorySource,
            // ── Top-level carrier IDs for efficient Firestore querying ──
            printifyBlueprintId: blueprintId,
            printifyPrintProviderId: provider?.providerId ?? null,
            printfulProductId: pfId ?? null,
            lastSyncedAt: now,
            updatedAt: now,
        };
        inProgressDocs.set(docId, { ...currentDoc, ...entry });
        const masterRef = core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(docId);
        const isFirstWrite = !alreadyExists;
        if (isFirstWrite) {
            writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
            stats.created++;
            if (matchedPrintful)
                stats.bridged++;
            else
                stats.printifyOnly++;
        }
        else {
            writes.push({ ref: masterRef, data: entry, merge: true });
            stats.updated++;
        }
        bumpCategoryStats(qrgCategory);
    }
    // ── Process unmatched Printful products ──────────────────────────────────────
    for (const pf of printfulProducts) {
        const pfId = Number(pf.id || pf._docId);
        if (matchedPrintfulIds.has(pfId))
            continue;
        const now = new Date().toISOString();
        const qrgCategory = classifyToQRGCategory(pf.title, pf.typeName);
        const existingQrgDocId = printfulToQrgDoc.get(pfId);
        const { docId, alreadyExists } = allocateQRGDocId(existingQrgDocId, qrgCategory, `pf_${pfId}`);
        printfulToQrgDoc.set(pfId, docId);
        const currentDoc = existingMaster.get(docId) || inProgressDocs.get(docId);
        const pfVars = variantsByPrintfulId.get(pfId) || [];
        const colorMap = new Map();
        const sizeSet = new Set();
        for (const v of pfVars) {
            if (v.color && !colorMap.has(v.color))
                colorMap.set(v.color, v.colorCode || v.color_code || '#888888');
            if (v.size)
                sizeSet.add(v.size);
        }
        const incomingColors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
        const incomingSizes = Array.from(sizeSet);
        let pfImagesRaw = extractImageUrls(pf.images);
        if (pfImagesRaw.length === 0 && pf.image)
            pfImagesRaw = [pf.image];
        const pfOriginCountry = pf.originCountry || pf.origin_country || null;
        const pfMapping = {
            provider: 'printful',
            productId: pfId,
            brand: pf.brand || null,
            model: pf.model || null,
            originCountry: pfOriginCountry,
            isUSA: (pfOriginCountry || '').toUpperCase() === 'US' || (pfOriginCountry || '').toUpperCase() === 'USA',
        };
        const existingMappings = currentDoc?.providerMappings || [];
        const newMappings = [...existingMappings];
        const pfIdx = newMappings.findIndex((m) => m.provider === 'printful' && m.productId === pfId);
        if (pfIdx >= 0)
            newMappings[pfIdx] = pfMapping;
        else
            newMappings.push(pfMapping);
        const availableVia = Array.from(new Set(newMappings.map((m) => m.provider))).sort();
        const existingPfImages = currentDoc?.printfulImages || [];
        const existingPyImages = currentDoc?.printifyImages || [];
        const newPfImages = mergeImages(existingPfImages, pfImagesRaw);
        const combinedImages = mergeImages([], [...existingPyImages, ...newPfImages]);
        const pfMin = pf.minPrice ? parseFloat(String(pf.minPrice)) : null;
        const pfMax = pf.maxPrice ? parseFloat(String(pf.maxPrice)) : null;
        const categorySource = currentDoc?.categorySource === 'manual'
            ? 'manual'
            : (qrgCategory ? 'mapped' : 'inferred');
        const _pfBlankStr = docId.startsWith('qrg_') ? docId.slice(4) : null;
        const entry = {
            qrgBlankId: _pfBlankStr,
            qrgParentCategory: _pfBlankStr ? _pfBlankStr[0] : null,
            qrgProductType: _pfBlankStr ? _pfBlankStr[1] : null,
            qrgItemNumber: _pfBlankStr ? _pfBlankStr.slice(2) : null,
            qrgCategory: qrgCategory || 'Unclassified',
            canonicalTitle: (0, safeAssign_1.safeAssignRequired)(currentDoc?.canonicalTitle, pf.title || pf.typeName || null),
            brand: (0, safeAssign_1.safeAssign)(currentDoc?.brand, pf.brand || null),
            model: (0, safeAssign_1.safeAssign)(currentDoc?.model, pf.model || null),
            description: (0, safeAssign_1.safeAssign)(currentDoc?.description, stripHtml(pf.description || null)),
            providerMappings: newMappings,
            availableVia,
            printifyImages: existingPyImages,
            printfulImages: newPfImages,
            images: combinedImages,
            colors: (0, instance_resolver_1.isMeaningfulValue)(incomingColors) ? incomingColors : (currentDoc?.colors ?? []),
            sizes: (0, instance_resolver_1.mergeArrayUnionStrings)(currentDoc?.sizes ?? [], incomingSizes),
            originCountry: pfOriginCountry || currentDoc?.originCountry || null,
            minPrice: pfMin ?? currentDoc?.minPrice ?? null,
            maxPrice: pfMax ?? currentDoc?.maxPrice ?? null,
            categorySource,
            // ── Top-level carrier IDs for efficient Firestore querying ──
            printifyBlueprintId: null,
            printifyPrintProviderId: null,
            printfulProductId: pfId,
            lastSyncedAt: now,
            updatedAt: now,
        };
        inProgressDocs.set(docId, { ...currentDoc, ...entry });
        const masterRef = core_1.db.collection(MASTER_CATALOG_COLLECTION).doc(docId);
        if (!alreadyExists) {
            writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
            stats.created++;
            stats.printfulOnly++;
        }
        else {
            writes.push({ ref: masterRef, data: entry, merge: true });
            stats.updated++;
        }
        bumpCategoryStats(qrgCategory);
    }
    await commitBatch(writes);
    console.log('[MasterCatalog] QRG sync complete:', stats);
    return stats;
}
// ── Provider staging sync functions ──────────────────────────────────────────
/**
 * Sync Printify blueprints → printify_blueprints collection.
 * Mirrors the pp-catalog.ts sync but runs synchronously (awaited).
 */
async function syncPrintifyToStaging(options = {}) {
    const { onProgress } = options;
    const log = (msg) => { console.log(msg); onProgress?.(msg); };
    if (!printify_1.printifyClient.isConfigured)
        throw new Error('Printify API key not configured');
    log('[Printify] Fetching blueprints from API...');
    const blueprints = await printify_1.printifyClient.getCatalogBlueprints();
    log(`[Printify] Fetched ${blueprints.length} blueprints`);
    const existingSnap = await core_1.db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).get();
    const existingMap = new Map();
    for (const doc of existingSnap.docs)
        existingMap.set(doc.id, doc.data());
    const now = new Date().toISOString();
    let added = 0, updated = 0, errors = 0;
    const writes = [];
    for (const bp of blueprints) {
        try {
            const docId = String(bp.id);
            const existing = existingMap.get(docId);
            const images = Array.isArray(bp.images) ? bp.images.map((img) => typeof img === 'string' ? img : img?.src || img?.url || '').filter(Boolean) : [];
            const data = {
                id: bp.id,
                title: bp.title,
                description: bp.description || null,
                brand: bp.brand || null,
                model: bp.model || null,
                images,
                primaryImageUrl: images[0] || null,
                lastSyncedAt: now,
            };
            if (existing?.richDescription)
                data.richDescription = existing.richDescription;
            writes.push({ ref: core_1.db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).doc(docId), data, merge: true });
            if (existing)
                updated++;
            else
                added++;
        }
        catch (e) {
            errors++;
            log(`[Printify] Error processing bp ${bp.id}: ${e.message}`);
        }
    }
    const CHUNK = 400;
    for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = core_1.db.batch();
        for (const w of chunk)
            batch.set(w.ref, w.data, { merge: w.merge });
        await batch.commit();
        log(`[Printify] Committed ${Math.min(i + CHUNK, writes.length)}/${writes.length}`);
    }
    log(`[Printify] Done: ${blueprints.length} blueprints (${added} added, ${updated} updated)`);
    return { blueprints: blueprints.length, added, updated, errors };
}
/**
 * Sync Printful product catalog → printful_products + printfulCatalog collections.
 * Only fetches the top-level catalog list (no per-product variant calls) for speed.
 */
async function syncPrintfulToStaging(options = {}) {
    const { onProgress } = options;
    const log = (msg) => { console.log(msg); onProgress?.(msg); };
    const apiKey = await (0, printful_1.getPrintfulApiKeyAsync)().catch(() => null);
    if (!apiKey) {
        log('[Printful] API key not configured — skipping');
        return { products: 0, added: 0, updated: 0, errors: 0 };
    }
    const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    log('[Printful] Fetching product catalog...');
    const catResp = await fetch('https://api.printful.com/products', { headers });
    if (!catResp.ok)
        throw new Error(`Printful catalog API error: ${catResp.status}`);
    const catData = await catResp.json();
    const products = catData.result || [];
    log(`[Printful] Fetched ${products.length} products`);
    const existingSnap = await core_1.db.collection(PRINTFUL_PRODUCTS_COLLECTION).get();
    const existingMap = new Map();
    for (const doc of existingSnap.docs)
        existingMap.set(doc.id, doc.data());
    const now = new Date().toISOString();
    let added = 0, updated = 0, errors = 0;
    const writes = [];
    for (const product of products) {
        try {
            const docId = String(product.id);
            const existing = existingMap.get(docId);
            const data = {
                id: product.id,
                provider: 'printful',
                title: product.title || product.type || null,
                type: product.type || null,
                typeName: product.type_name || product.type || null,
                brand: product.brand || null,
                model: product.model || null,
                image: product.image || null,
                images: product.image ? [product.image] : [],
                variantCount: product.variant_count || 0,
                description: null,
                isAvailable: true,
                lastSyncedAt: now,
            };
            writes.push({ ref: core_1.db.collection(PRINTFUL_PRODUCTS_COLLECTION).doc(docId), data });
            // Also keep printfulCatalog up to date (backward compat + fallback)
            writes.push({ ref: core_1.db.collection('printfulCatalog').doc(docId), data: { ...data, category: product.type || null } });
            if (existing)
                updated++;
            else
                added++;
        }
        catch (e) {
            errors++;
            log(`[Printful] Error processing product ${product.id}: ${e.message}`);
        }
    }
    const CHUNK = 400;
    for (let i = 0; i < writes.length; i += CHUNK) {
        const chunk = writes.slice(i, i + CHUNK);
        const batch = core_1.db.batch();
        for (const w of chunk)
            batch.set(w.ref, w.data, { merge: true });
        await batch.commit();
    }
    log(`[Printful] Done: ${products.length} products (${added} added, ${updated} updated)`);
    return { products: products.length, added, updated, errors };
}
// ── Category-based default print positions ────────────────────────────────────
// Used as an instant fallback when provider APIs are unavailable.
// These are accurate for the vast majority of products in each category.
const CATEGORY_DEFAULT_POSITIONS = {
    'T-Shirts': ['front', 'back', 'left_chest'],
    'Hoodies & Sweatshirts': ['front', 'back', 'left_chest', 'right_chest'],
    'Bottoms & Active': ['front', 'back'],
    'Hats & Caps': ['front', 'back', 'left_side', 'right_side'],
    'Footwear & Socks': ['leg', 'sole'],
    'Sleepwear & Underwear': ['front', 'back'],
    'Baby & Kids': ['front', 'back'],
    'Drinkware': ['left', 'right'],
    'Barware': ['left', 'right'],
    'Drinkware Accessories': ['front'],
    'Kitchen & Dining': ['front'],
    'Bedding & Textiles': ['front'],
    'Home Décor': ['front'],
    'Wall Art & Prints': ['front'],
    'Stickers & Magnets': ['front'],
    'Stationery & Paper': ['front'],
    'Signs & Display': ['front'],
    'Books & Photo': ['front', 'back'],
    'Pins & Patches': ['front'],
    'Tags': ['front', 'back'],
    'Puzzles & Games': ['front'],
    'Novelty': ['front'],
    'Bags & Pouches': ['front', 'back'],
    'Jewelry': ['front'],
    'Phone & Tech Cases': ['back'],
    'Travel Accessories': ['front', 'back'],
    'Small Accessories': ['front'],
    'Pet Apparel': ['front', 'back'],
    'Pet Accessories': ['front'],
    'Ornaments & Décor': ['front', 'back'],
    'Stockings & Gifting': ['front', 'back'],
    'Seasonal Apparel': ['front', 'back'],
};
// ── Category-based default print sizes (in inches at 150 DPI) ────────────────
const POSITION_DEFAULT_SIZES = {
    front: { width: 12, height: 16, dpi: 150 },
    back: { width: 12, height: 16, dpi: 150 },
    left_chest: { width: 4, height: 4, dpi: 150 },
    right_chest: { width: 4, height: 4, dpi: 150 },
    left_side: { width: 2.5, height: 2.5, dpi: 150 },
    right_side: { width: 2.5, height: 2.5, dpi: 150 },
    left: { width: 8.5, height: 4, dpi: 150 },
    right: { width: 8.5, height: 4, dpi: 150 },
    leg: { width: 5, height: 8, dpi: 150 },
    sole: { width: 5, height: 9, dpi: 150 },
    back_large: { width: 12, height: 16, dpi: 150 },
};
function buildDefaultSizes(positions) {
    const sizes = {};
    for (const pos of positions) {
        sizes[pos] = POSITION_DEFAULT_SIZES[pos] ?? { width: 8, height: 8, dpi: 150 };
    }
    return sizes;
}
/**
 * Enrich every master catalog doc with:
 *   - printPositions + printSizes (from Printify variant placeholders)
 *   - colors (name + hex) from Printify variant options
 *   - sizes (XS, S, M, L …) from Printify variant options
 *   - minPrice / maxPrice from Printify variant prices
 *   - originCountry from Printify print-provider location
 *
 * Strategy:
 *   1. Fetch getPrintProviders → first provider id + origin country.
 *   2. Fetch getVariants      → positions, colors, sizes, prices.
 *   3. Fall back to category defaults for positions if API fails.
 *
 * Docs are skipped when ALL of the following are already populated
 * (and lastEnrichedAt is within 7 days) unless forceRefresh=true:
 *   printPositions, colors (for Printify items), sizes (for Printify items).
 *
 * BURST_SIZE is kept small (8) with a short inter-burst delay to stay
 * well within Printify's rate limit (~2 req/s sustained).
 */
async function enrichMasterCatalog(options = {}) {
    const { forceRefresh = false, categoryFilter } = options;
    const stats = {
        total: 0,
        printfulEnriched: 0,
        printifyEnriched: 0,
        defaultsApplied: 0,
        skipped: 0,
        errors: 0,
        colorsAdded: 0,
        sizesAdded: 0,
        pricesAdded: 0,
        originAdded: 0,
    };
    const baseQuery = categoryFilter
        ? core_1.db.collection(MASTER_CATALOG_COLLECTION).where('qrgCategory', '==', categoryFilter)
        : core_1.db.collection(MASTER_CATALOG_COLLECTION);
    const snap = await baseQuery.get();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // Small concurrent bursts to respect Printify rate limits (~2 req/s)
    const BURST_SIZE = 6;
    const INTER_BURST_DELAY_MS = 1500;
    const now = new Date().toISOString();
    async function enrichDoc(doc) {
        const data = doc.data();
        stats.total++;
        const providerMappings = Array.isArray(data.providerMappings) ? data.providerMappings : [];
        const pyMap = providerMappings.find((m) => m.provider === 'printify') || null;
        const isPrintifyItem = !!pyMap;
        // Skip if fully enriched within the last 7 days
        const fullyEnriched = !forceRefresh &&
            data.lastEnrichedAt &&
            data.lastEnrichedAt > sevenDaysAgo &&
            Array.isArray(data.printPositions) && data.printPositions.length > 0 &&
            // Printify items also need colors + sizes to be considered done
            (!isPrintifyItem || (Array.isArray(data.colors) && data.colors.length > 0 &&
                Array.isArray(data.sizes) && data.sizes.length > 0));
        if (fullyEnriched) {
            stats.skipped++;
            return;
        }
        const pyBlueprintId = data.printifyBlueprintId ?? pyMap?.blueprintId ?? null;
        let pyProviderId = pyMap?.printProviderId ?? data.printProviderId ?? null;
        const update = { lastEnrichedAt: now };
        let positionsSet = false;
        // ── 1. Printify: providers → origin; variants → positions/colors/sizes/prices
        if (pyBlueprintId && printify_1.printifyClient.isConfigured) {
            try {
                // Step A: get print providers → origin country + provider id
                let originCountry = data.originCountry ?? null;
                if (!pyProviderId || !originCountry) {
                    const providers = await withTimeout(printify_1.printifyClient.getPrintProviders(pyBlueprintId), 10000);
                    const firstProvider = providers?.[0] ?? null;
                    if (firstProvider) {
                        pyProviderId = pyProviderId ?? firstProvider.id ?? null;
                        const loc = firstProvider.location ?? firstProvider;
                        const rawCountry = loc.country ?? null;
                        if (rawCountry && !originCountry) {
                            originCountry = rawCountry;
                            update.originCountry = originCountry;
                            update['providerMappings'] = providerMappings.map((m) => m.provider === 'printify' ? { ...m, originCountry, printProviderId: pyProviderId } : m);
                            stats.originAdded++;
                        }
                    }
                }
                // Step B: get variants → positions, colors, sizes, prices
                if (pyProviderId) {
                    const variantData = await withTimeout(printify_1.printifyClient.getVariants(pyBlueprintId, pyProviderId), 10000);
                    // ── Positions (from placeholders on each variant)
                    const posSet = new Set();
                    for (const v of (variantData?.variants ?? [])) {
                        for (const ph of (v.placeholders ?? [])) {
                            if (ph.position)
                                posSet.add(ph.position);
                        }
                    }
                    if (posSet.size > 0) {
                        const positions = Array.from(posSet);
                        update.printPositions = positions;
                        update.printSizes = buildDefaultSizes(positions);
                        positionsSet = true;
                    }
                    // ── Colors (from top-level options array, type === 'color')
                    const colorGroup = (variantData?.options ?? []).find((o) => (o.type ?? o.name ?? '').toLowerCase().includes('color'));
                    if (colorGroup?.values?.length > 0) {
                        const colors = colorGroup.values.map((v) => ({
                            name: v.title ?? v.name ?? '',
                            hex: (v.colors ?? v.hexColors ?? [])[0] ?? null,
                        })).filter((c) => c.name);
                        if (colors.length > 0) {
                            update.colors = colors;
                            update.colorCount = colors.length;
                            stats.colorsAdded++;
                        }
                    }
                    // ── Sizes (from top-level options array, type === 'size')
                    const sizeGroup = (variantData?.options ?? []).find((o) => (o.type ?? o.name ?? '').toLowerCase().includes('size'));
                    if (sizeGroup?.values?.length > 0) {
                        const sizes = sizeGroup.values
                            .map((v) => v.title ?? v.name ?? '')
                            .filter(Boolean);
                        if (sizes.length > 0) {
                            update.sizes = sizes;
                            stats.sizesAdded++;
                        }
                    }
                    // ── Prices (in cents → dollars; only enabled variants)
                    const enabledPrices = (variantData?.variants ?? [])
                        .filter((v) => v.is_enabled !== false && v.price > 0)
                        .map((v) => v.price / 100);
                    if (enabledPrices.length > 0) {
                        update.minPrice = Math.min(...enabledPrices);
                        update.maxPrice = Math.max(...enabledPrices);
                        stats.pricesAdded++;
                    }
                    stats.printifyEnriched++;
                }
            }
            catch (e) {
                console.warn(`[Enrich] Blueprint ${pyBlueprintId} failed: ${e.message}`);
                stats.errors++;
            }
        }
        // ── 2. Category defaults for positions if Printify call failed/skipped ──
        if (!positionsSet) {
            const category = data.qrgCategory || 'Unclassified';
            const positions = CATEGORY_DEFAULT_POSITIONS[category] ?? ['front'];
            update.printPositions = positions;
            update.printSizes = buildDefaultSizes(positions);
            stats.defaultsApplied++;
        }
        await doc.ref.update(update);
    }
    for (let i = 0; i < snap.docs.length; i += BURST_SIZE) {
        const burst = snap.docs.slice(i, i + BURST_SIZE);
        await Promise.all(burst.map(enrichDoc));
        if (i + BURST_SIZE < snap.docs.length)
            await delay(INTER_BURST_DELAY_MS);
        if (i % (BURST_SIZE * 10) === 0 || i + BURST_SIZE >= snap.docs.length) {
            console.log(`[Enrich] ${Math.min(i + BURST_SIZE, snap.docs.length)}/${snap.docs.length} — ` +
                `printify:${stats.printifyEnriched} colors:${stats.colorsAdded} sizes:${stats.sizesAdded} ` +
                `prices:${stats.pricesAdded} origin:${stats.originAdded} defaults:${stats.defaultsApplied} ` +
                `skipped:${stats.skipped} errors:${stats.errors}`);
        }
    }
    console.log('[MasterCatalog] Enrich complete:', stats);
    return stats;
}
//# sourceMappingURL=master-catalog.js.map