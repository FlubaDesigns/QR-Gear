import { db } from '../core';
import { safeAssign, safeAssignRequired } from '../safeAssign';
import { mergeImagesByUrl, ImageRecord } from './instance-resolver';
import { printifyClient } from './printify';
import { printfulClient, getPrintfulApiKeyAsync } from './printful';
import { getQrgSizeCode, getQrgColorCode, SIZE_LABELS, COLOR_LABELS } from './qrgVariantMappings';

/** Strip HTML tags and collapse whitespace */
function stripHtml(raw: string | null | undefined): string | null {
  if (!raw) return null;
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

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** Reject after timeoutMs with a timeout error */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/** Fetch with automatic retry on 429 / 5xx / timeout, up to maxRetries attempts */
async function fetchWithRetry(
  fn: () => Promise<any>,
  maxRetries = 3,
  baseDelayMs = 2000,
  timeoutMs = 25000
): Promise<any> {
  let attempt = 0;
  while (true) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (e: any) {
      const isRateLimit = /429|rate.?limit|too.?many/i.test(e.message ?? '');
      const isServer   = /5\d\d|server.?error/i.test(e.message ?? '');
      const isTimeout  = /timed out/i.test(e.message ?? '');
      if ((isRateLimit || isServer || isTimeout) && attempt < maxRetries) {
        const wait = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[Enrich] Retry ${attempt + 1}/${maxRetries} after ${wait}ms — ${e.message}`);
        await delay(wait);
        attempt++;
      } else {
        throw e;
      }
    }
  }
}

/** Extract plain URL strings from an ImageRecord[] or mixed array */
function toUrlArray(records: unknown[]): string[] {
  return (records || []).map((r: any) => {
    if (typeof r === 'string') return r.trim() || null;
    if (r && typeof r === 'object' && typeof r.url === 'string') return r.url.trim() || null;
    return null;
  }).filter((u): u is string => !!u);
}

/** Merge image arrays and return plain URL strings */
function mergeImages(existing: unknown[], incoming: unknown[]): string[] {
  return toUrlArray(mergeImagesByUrl(existing, incoming) as ImageRecord[]);
}

const MASTER_CATALOG_COLLECTION = 'master_catalog';
const MASTER_CATALOG_SYNCS_COLLECTION = 'master_catalog_syncs';
const PRINTIFY_BLUEPRINTS_COLLECTION = 'printify_blueprints';
const PRINTIFY_PROVIDERS_COLLECTION = 'printifyPrintProviders';
const PRINTFUL_PRODUCTS_COLLECTION = 'printful_products';
const PRINTFUL_VARIANTS_COLLECTION = 'printful_variants';

// ── QRG Top-Level Category Definitions ───────────────────────────────────────
// Source of truth: replit.md — QRG Numbering System section
// Each top-level gets a X000 code. Subcategories get X100–X900.
// Each subcategory holds up to 99 products (X101–X199, etc.).
export const QRG_TOP_LEVEL_CATEGORIES = [
  { name: 'Apparel',            code: 1000 },
  { name: 'Houseware',          code: 2000 },
  { name: 'Print & Display',    code: 3000 },
  { name: 'Accessories',        code: 4000 },
  { name: 'Pet Products',       code: 5000 },
  { name: 'Holiday & Seasonal', code: 6000 },
] as const;

// ── QRG Blank Category Definitions (5-digit BBBBB scheme) ────────────────────
// Structure: [category 1-6][subcategory 1-9][slot 001-999]
// Each subcategory holds up to 999 blanks. If a subcategory ever exceeds 999,
// allocation simply continues past rangeEnd (no hard stop — "screw it").
export const QRG_BLANK_CATEGORIES = [
  // ── 1x000 Apparel ─────────────────────────────────────────────────────────
  { name: 'T-Shirts',              parent: 'Apparel',            rangeStart: 11101, rangeEnd: 11999 },
  { name: 'Hoodies & Sweatshirts', parent: 'Apparel',            rangeStart: 12101, rangeEnd: 12999 },
  { name: 'Hats',                  parent: 'Apparel',            rangeStart: 13101, rangeEnd: 13999 },
  { name: 'Tank Tops',             parent: 'Apparel',            rangeStart: 14101, rangeEnd: 14999 },
  { name: 'Long Sleeve',           parent: 'Apparel',            rangeStart: 15101, rangeEnd: 15999 },
  { name: "Youth/Kids",            parent: 'Apparel',            rangeStart: 16101, rangeEnd: 16999 },
  { name: "Women's",               parent: 'Apparel',            rangeStart: 17101, rangeEnd: 17999 },
  { name: 'Specialty Apparel',     parent: 'Apparel',            rangeStart: 18101, rangeEnd: 18999 },
  // ── 2x000 Houseware ───────────────────────────────────────────────────────
  { name: 'Drinkware',             parent: 'Houseware',          rangeStart: 21101, rangeEnd: 21999 },
  { name: 'Barware',               parent: 'Houseware',          rangeStart: 22101, rangeEnd: 22999 },
  { name: 'Drinkware Accessories', parent: 'Houseware',          rangeStart: 23101, rangeEnd: 23999 },
  { name: 'Kitchen & Dining',      parent: 'Houseware',          rangeStart: 24101, rangeEnd: 24999 },
  { name: 'Bedding & Textiles',    parent: 'Houseware',          rangeStart: 25101, rangeEnd: 25999 },
  { name: 'Home Décor',            parent: 'Houseware',          rangeStart: 26101, rangeEnd: 26999 },
  // ── 3x000 Print & Display ─────────────────────────────────────────────────
  { name: 'Wall Art & Prints',     parent: 'Print & Display',    rangeStart: 31101, rangeEnd: 31999 },
  { name: 'Stickers & Magnets',    parent: 'Print & Display',    rangeStart: 32101, rangeEnd: 32999 },
  { name: 'Stationery & Paper',    parent: 'Print & Display',    rangeStart: 33101, rangeEnd: 33999 },
  { name: 'Signs & Display',       parent: 'Print & Display',    rangeStart: 34101, rangeEnd: 34999 },
  { name: 'Books & Photo',         parent: 'Print & Display',    rangeStart: 35101, rangeEnd: 35999 },
  { name: 'Pins & Patches',        parent: 'Print & Display',    rangeStart: 36101, rangeEnd: 36999 },
  { name: 'Tags',                  parent: 'Print & Display',    rangeStart: 37101, rangeEnd: 37999 },
  { name: 'Puzzles & Games',       parent: 'Print & Display',    rangeStart: 38101, rangeEnd: 38999 },
  { name: 'Novelty',               parent: 'Print & Display',    rangeStart: 39101, rangeEnd: 39999 },
  // ── 4x000 Accessories ─────────────────────────────────────────────────────
  { name: 'Bags & Pouches',        parent: 'Accessories',        rangeStart: 41101, rangeEnd: 41999 },
  { name: 'Jewelry',               parent: 'Accessories',        rangeStart: 42101, rangeEnd: 42999 },
  { name: 'Phone & Tech Cases',    parent: 'Accessories',        rangeStart: 43101, rangeEnd: 43999 },
  { name: 'Travel Accessories',    parent: 'Accessories',        rangeStart: 44101, rangeEnd: 44999 },
  { name: 'Small Accessories',     parent: 'Accessories',        rangeStart: 45101, rangeEnd: 45999 },
  // ── 5x000 Pet Products ────────────────────────────────────────────────────
  { name: 'Pet Apparel',           parent: 'Pet Products',       rangeStart: 51101, rangeEnd: 51999 },
  { name: 'Pet Accessories',       parent: 'Pet Products',       rangeStart: 52101, rangeEnd: 52999 },
  // ── 6x000 Holiday & Seasonal ──────────────────────────────────────────────
  { name: 'Ornaments & Décor',     parent: 'Holiday & Seasonal', rangeStart: 61101, rangeEnd: 61999 },
  { name: 'Stockings & Gifting',   parent: 'Holiday & Seasonal', rangeStart: 62101, rangeEnd: 62999 },
  { name: 'Seasonal Apparel',      parent: 'Holiday & Seasonal', rangeStart: 63101, rangeEnd: 63999 },
] as const;

export type QRGCategoryName = typeof QRG_BLANK_CATEGORIES[number]['name'];

// ── Legacy numeric-code → new subcategory label (for Firestore docs written
//    before the 4-digit scheme was introduced) ─────────────────────────────
export const QRG_LEGACY_CODE_MAP: Record<number, QRGCategoryName> = {
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
const QRG_LEGACY_NAME_MAP: Record<string, QRGCategoryName> = {
  'Tees':             'T-Shirts',
  'Hoodies':          'Hoodies & Sweatshirts',
  'Hats & Caps':      'Hats',
  'Hats':             'Hats',
  'Baby & Kids':      'Youth/Kids',
  'Bottoms & Active': 'Specialty Apparel',
  'Footwear & Socks': 'Specialty Apparel',
  'Sleepwear & Underwear': 'Specialty Apparel',
  'Drinkware':        'Drinkware',
};

const PARENT_CAT_LABELS: Record<string, string> = {
  '1': 'Apparel',
  '2': 'Houseware',
  '3': 'Print & Display',
  '4': 'Accessories',
  '5': 'Pet Products',
  '6': 'Holiday & Seasonal',
};

/**
 * Resolve any qrgCategory value (old numeric, old string, or new string) to
 * a canonical QRGCategoryName label. Returns 'Unclassified' if unresolvable.
 */
export function resolveQrgCategoryLabel(raw: unknown): string {
  if (raw == null || raw === '') return 'Unclassified';
  const n = Number(raw);
  if (!isNaN(n) && QRG_LEGACY_CODE_MAP[n]) return QRG_LEGACY_CODE_MAP[n];
  const s = String(raw).trim();
  if (QRG_LEGACY_NAME_MAP[s]) return QRG_LEGACY_NAME_MAP[s];
  const isKnown = QRG_BLANK_CATEGORIES.some(c => c.name === s);
  if (isKnown) return s as QRGCategoryName;
  return s || 'Unclassified';
}

/**
 * Classify a product title+typeName into a QRG subcategory.
 * Returns null if unclassified.
 */
function classifyToQRGCategory(title: string, typeName?: string | null): QRGCategoryName | null {
  const t = ((title || '') + ' ' + (typeName || '')).toLowerCase();

  // ── Pet Products ────────────────────────────────────────────────────────────
  if (/\bpet\b|\bdog\b|\bcat\b|puppy|kitten|pet.?collar|pet.?bandana/.test(t)) {
    if (/collar|leash|\btag\b|bowl|feeder/.test(t)) return 'Pet Accessories';
    return 'Pet Apparel';
  }

  // ── Holiday & Seasonal ──────────────────────────────────────────────────────
  if (/christmas|holiday|ornament|halloween|easter|thanksgiving|valentine|xmas|stocking|tree.?skirt|snowflake/.test(t)) {
    if (/\bsweater\b|\bshirt\b|\btee\b|hoodie|ugly/.test(t)) return 'Seasonal Apparel';
    if (/\bstocking\b|gift|gifting/.test(t)) return 'Stockings & Gifting';
    return 'Ornaments & Décor';
  }

  // ── Youth/Kids (check before general apparel) ───────────────────────────────
  if (/\bbaby\b|onesie|bodysuit|\binfant\b|toddler|\byouth\b|kids?\b|children/.test(t)) {
    if (/sneaker|sandal|slipper|\bslide\b|\bboot\b|\bshoe\b|clog/.test(t)) return 'Specialty Apparel';
    if (/lounge.?pant|jogger|\bshort\b|legging/.test(t)) return 'Specialty Apparel';
    if (/\bhat\b|\bcap\b|\bbeanie\b/.test(t)) return 'Hats';
    if (/puzzle|coloring/.test(t)) return 'Puzzles & Games';
    return 'Youth/Kids';
  }

  // ── Women's ──────────────────────────────────────────────────────────────────
  if (/\bwomens?\b|\bwomen'?s\b|\bladies\b|\bfeminine\b|\bcurvy\b/.test(t)) return "Women's";

  // ── Hats ─────────────────────────────────────────────────────────────────────
  if (/snapback|trucker.?hat|dad.?hat|baseball.?cap|bucket.?hat|\bbeanie\b|\bvisor\b|\bcap\b|\bhat\b/.test(t)) return 'Hats';

  // ── Long Sleeve (check before T-Shirts) ──────────────────────────────────────
  if (/long.?sleeve/.test(t)) return 'Long Sleeve';

  // ── Tank Tops (check before T-Shirts) ────────────────────────────────────────
  if (/tank.?top|crop.?top|camisole|\bpolo\b|v-?neck|\bhenley\b|raglan/.test(t)) return 'Tank Tops';

  // ── T-Shirts ─────────────────────────────────────────────────────────────────
  if (/t-?shirt|tshirt|\btee\b|\bjersey\b|\bblouse\b/.test(t)) return 'T-Shirts';

  // ── Hoodies & Sweatshirts ────────────────────────────────────────────────────
  if (/hoodie|hoody|sweatshirt|pullover|\bfleece\b|zip.?up|crewneck|crew.?neck|\bsweater\b/.test(t)) return 'Hoodies & Sweatshirts';

  // ── Specialty Apparel (bottoms, footwear, sleepwear, active — catch-all) ─────
  if (/pajama|pyjama|\bboxer\b|\bbrief\b|\bthong\b|\bunderwear\b|loungewear|nightwear/.test(t)) return 'Specialty Apparel';
  if (/swimsuit|bikini|rash.?guard|windbreaker|biker.?short|bodycon|legging|yoga|jogger|sweatpant|sport.?bra|compression|activewear|athletic.?short|bomber|puffer.?jacket|denim.?jacket|work.?jacket|soft.?shell|varsity.?jacket|letterman|anorak|\bdress\b|\bskirt\b|dolman|swim.?trunk|\bshort\b/.test(t)) return 'Specialty Apparel';
  if (/sneaker|sandal|slipper|flip.?flop|\bslide\b|\bboot\b|clog|\bsock\b/.test(t)) return 'Specialty Apparel';

  // ── Barware (check before Drinkware to catch glass-word overlap) ────────────
  if (/rocks.?glass|whiskey.?glass|champagne.?glass|sipper.?glass|mixing.?glass|can.?glass|can.?shaped.?glass|stubby.?cooler|highball/.test(t)) return 'Barware';

  // ── Drinkware ────────────────────────────────────────────────────────────────
  if (/\bmugs?\b|tumbler|water.?bottle|wine.?glass|beer.?stein|beer.?mug|\bflask\b|thermos|travel.?mug|\bpint\b|\bdrinkware\b|insulated.?bottle|insulated.?tumbler|shot.?glass/.test(t)) return 'Drinkware';

  // ── Drinkware Accessories ────────────────────────────────────────────────────
  if (/beverage.?holder|can.?holder|mason.?jar|protein.?shaker|slim.?beverage|insulated.?food/.test(t)) return 'Drinkware Accessories';

  // ── Kitchen & Dining ─────────────────────────────────────────────────────────
  if (/cutting.?board|pizza.?board|charcuterie|bento|lunch.?box/.test(t)) return 'Kitchen & Dining';

  // ── Bedding & Textiles ───────────────────────────────────────────────────────
  if (/comforter|quilt|coverlet|duvet|\bsham\b|fitted.?sheet|flat.?sheet|bed.?runner|window.?curtain|\bcurtain\b|tablecloth|\bnapkin\b|oven.?mitt|beach.?cloth/.test(t)) return 'Bedding & Textiles';

  // ── Home Décor ───────────────────────────────────────────────────────────────
  if (/\bpillow\b|blanket|\btowel\b|\bapron\b|\brug\b|doormat|table.?runner|cushion|coaster|shower.?curtain|\bbath\b|face.?mask|\bbandana\b|calendar|\bclock\b|\bcandle\b|serving.?tray|phone.?stand|felt.?storage|light.?cube/.test(t)) return 'Home Décor';

  // ── Wall Art & Prints ────────────────────────────────────────────────────────
  if (/acrylic.?print|acrylic.?sign|metal.?print|gallery.?wrap|art.?board|canvas.?wrap|canvas.?gallery|canvas.?print|wall.?art|\bposter\b|\bframed\b|tapestry|\bflag\b|art.?print|wood.?panel.?painting|ceramic.?photo.?tile|photo.?block|gallery.?board/.test(t)) return 'Wall Art & Prints';

  // ── Stickers & Magnets ───────────────────────────────────────────────────────
  if (/\bsticker\b|\bmagnet\b|\bdecal\b|\bbumper.?sticker\b/.test(t)) return 'Stickers & Magnets';

  // ── Books & Photo ────────────────────────────────────────────────────────────
  if (/photo.?book|coloring.?book|board.?book|note.?cube|\bbookmark\b|bible.?cover|softcover|hardcover/.test(t)) return 'Books & Photo';

  // ── Stationery & Paper ───────────────────────────────────────────────────────
  if (/notebook|journal|planner|stationery|greeting.?card|postcard|notepad|business.?card|note.?pad|post.?it/.test(t)) return 'Stationery & Paper';

  // ── Signs & Display ──────────────────────────────────────────────────────────
  if (/yard.?sign|lawn.?sign|vinyl.?banner|\bpennant\b|license.?plate|vanity.?plate|foam.?board|aluminum.?composite|aluminum.?panel|\bstandee\b|\bstatue\b|wood.?sign|wooden.?sign|hanging.?sign|wooden.?hanging|free.?standing.?wooden|slate.?desk.?plaque|protest.?sign|plastic.?yard/.test(t)) return 'Signs & Display';

  // ── Pins & Patches ───────────────────────────────────────────────────────────
  if (/pin.?button|round.?pin|set.?of.?pin|\bpatch\b|embroidered.?patch|iron.?on.?patch/.test(t)) return 'Pins & Patches';

  // ── Tags ─────────────────────────────────────────────────────────────────────
  if (/luggage.?tag|keyring.?tag|key.?ring|photo.?keyring/.test(t)) return 'Tags';

  // ── Puzzles & Games ──────────────────────────────────────────────────────────
  if (/\bpuzzle\b|jigsaw|golf.?ball|hockey.?puck|pickleball|ping.?pong|frisbee|wham.?o/.test(t)) return 'Puzzles & Games';

  // ── Novelty ──────────────────────────────────────────────────────────────────
  if (/\bballoon\b|mylar|car.?seat.?cover|sun.?shade|car.?sun|temporary.?tattoo/.test(t)) return 'Novelty';

  // ── Bags & Pouches ───────────────────────────────────────────────────────────
  if (/tote.?bag|backpack|fanny.?pack|drawstring.?bag|duffel|duffle|messenger.?bag|crossbody|\bpouch\b|shopping.?bag|laptop.?bag|\bsack\b/.test(t)) return 'Bags & Pouches';

  // ── Jewelry ──────────────────────────────────────────────────────────────────
  if (/bracelet|necklace|earring|\bring\b|sunglasse|\bscarf\b|\bglove\b|\bbelt\b|headband|neck.?gaiter|\bhair\b|anklet|birthstone.?charm/.test(t)) return 'Jewelry';

  // ── Phone & Tech Cases ───────────────────────────────────────────────────────
  if (/phone.?case|iphone|samsung.?case|airpod|laptop.?sleeve|mouse.?pad|mousepad|tablet.?case/.test(t)) return 'Phone & Tech Cases';

  // ── Travel Accessories ───────────────────────────────────────────────────────
  if (/luggage.?cover|passport.?cover/.test(t)) return 'Travel Accessories';

  // ── Small Accessories ─────────────────────────────────────────────────────────
  if (/compact.?mirror|travel.?mirror|jewelry.?box|\bkeychain\b|\bwallet\b/.test(t)) return 'Small Accessories';

  return null;
}

function normalizeForMatch(s: string | null | undefined): string {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function isBrandModelMatch(
  brandA: string | null | undefined,
  modelA: string | null | undefined,
  brandB: string | null | undefined,
  modelB: string | null | undefined,
): boolean {
  if (!brandA || !modelA || !brandB || !modelB) return false;
  const ba = normalizeForMatch(brandA);
  const ma = normalizeForMatch(modelA);
  const bb = normalizeForMatch(brandB);
  const mb = normalizeForMatch(modelB);
  const brandMatch = ba === bb || ba.includes(bb) || bb.includes(ba);
  // Use endsWith (not includes) so "3001" matches "bc3001" but NOT "3001b" (baby variant suffix)
  const modelMatch = ma === mb || ma.endsWith(mb) || mb.endsWith(ma);
  return brandMatch && modelMatch;
}

function extractImageUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((img: any) => {
        if (typeof img === 'string') return img;
        return img?.src || img?.url || img?.imageUrl || null;
      })
      .filter((u): u is string => !!u && typeof u === 'string');
  }
  if (typeof raw === 'string') return [raw];
  return [];
}

async function commitBatch(writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any; merge: boolean }>): Promise<void> {
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const w of chunk) {
      if (w.merge) {
        batch.set(w.ref, w.data, { merge: true });
      } else {
        batch.set(w.ref, w.data);
      }
    }
    await batch.commit();
  }
}

export interface SyncStats {
  created: number;
  updated: number;
  bridged: number;
  printifyOnly: number;
  printfulOnly: number;
  unclassified: number;
  byCategory: {
    apparel: number;
    houseware: number;
    printAndDisplay: number;
    accessories: number;
    petProducts: number;
    holidayAndSeasonal: number;
  };
}

export async function syncMasterCatalog(_options: { forceRefresh?: boolean; cleanSweep?: boolean } = {}): Promise<SyncStats> {
  const { cleanSweep = false } = _options;
  console.log(`[MasterCatalog] Starting QRG sync${cleanSweep ? ' (CLEAN SWEEP — will wipe existing docs)' : ''}...`);

  const stats: SyncStats = {
    created: 0,
    updated: 0,
    bridged: 0,
    printifyOnly: 0,
    printfulOnly: 0,
    unclassified: 0,
    byCategory: { apparel: 0, houseware: 0, printAndDisplay: 0, accessories: 0, petProducts: 0, holidayAndSeasonal: 0 },
  };

  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: any; merge: boolean }> = [];

  // Load everything in parallel
  const [bpSnap, provSnap, pfSnap, pvSnap, masterSnap] = await Promise.all([
    db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).get(),
    db.collection(PRINTIFY_PROVIDERS_COLLECTION).get(),
    db.collection(PRINTFUL_PRODUCTS_COLLECTION).get(),
    db.collection(PRINTFUL_VARIANTS_COLLECTION).get(),
    db.collection(MASTER_CATALOG_COLLECTION).get(),
  ]);

  const printifyBlueprints = bpSnap.docs.map(d => ({ _docId: d.id, ...d.data() })) as any[];
  const printifyProviders = provSnap.docs.map(d => ({ _docId: d.id, ...d.data() })) as any[];
  const printfulProducts: any[] = pfSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
  const printfulVariants = pvSnap.docs.map(d => ({ _docId: d.id, ...d.data() })) as any[];

  // Fallback: if printful_products is empty, read from printfulCatalog (legacy collection)
  if (printfulProducts.length === 0) {
    const legacySnap = await db.collection('printfulCatalog').get();
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
    const deleteBatches: FirebaseFirestore.WriteBatch[] = [];
    let batch = db.batch();
    let count = 0;
    for (const doc of masterSnap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 400 === 0) {
        deleteBatches.push(batch);
        batch = db.batch();
      }
    }
    if (count % 400 !== 0) deleteBatches.push(batch);
    for (const b of deleteBatches) await b.commit();
    console.log(`[MasterCatalog] Clean sweep: deleted ${masterSnap.size} docs.`);
  }

  // Build existing master catalog map (docId → data)
  // On clean sweep this is intentionally empty so all IDs are freshly allocated.
  const existingMaster = new Map<string, any>();
  if (!cleanSweep) {
    for (const doc of masterSnap.docs) {
      existingMaster.set(doc.id, { _docId: doc.id, ...doc.data() });
    }
  }

  console.log(`[MasterCatalog] Loaded: ${printifyBlueprints.length} blueprints, ${printfulProducts.length} Printful products, ${existingMaster.size} existing master records`);

  // ── Build lookups: providerKey → existing QRG docId ──────────────────────────
  // On a clean sweep both maps are empty so every product gets a fresh 4-digit ID.
  const blueprintToQrgDoc = new Map<number, string>();
  const printfulToQrgDoc = new Map<number, string>();
  for (const [docId, data] of existingMaster.entries()) {
    // New schema: providerMappings is an object { printify: {...}, printful: {...} }
    const pm = data.providerMappings;
    if (pm && typeof pm === 'object' && !Array.isArray(pm)) {
      if (pm.printify?.blueprintId) blueprintToQrgDoc.set(Number(pm.printify.blueprintId), docId);
      if (pm.printful?.productId) printfulToQrgDoc.set(Number(pm.printful.productId), docId);
    }
  }

  // ── Build next available BBB number per category ──────────────────────────────
  // Keyed by category name. Counter starts at rangeStart and advances past any
  // existing assignments found in Firestore (incremental re-sync safe).
  const nextBBB: Record<string, number> = {};
  for (const cat of QRG_BLANK_CATEGORIES) {
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
  const bestProviderByBlueprint = new Map<number, any>();
  for (const p of printifyProviders) {
    const bid = Number(p.blueprintId);
    const curr = bestProviderByBlueprint.get(bid);
    if (!curr) {
      bestProviderByBlueprint.set(bid, p);
    } else {
      const currUSA = curr.isUSA;
      const newUSA = p.isUSA;
      if (!currUSA && newUSA) {
        bestProviderByBlueprint.set(bid, p);
      } else if (currUSA === newUSA) {
        const currCost = curr.minCost || 999999;
        const newCost = p.minCost || 999999;
        if (newCost < currCost) bestProviderByBlueprint.set(bid, p);
      }
    }
  }

  // ── Build Printful variant and product lookups ──────────────────────────────
  const variantsByPrintfulId = new Map<number, any[]>();
  for (const v of printfulVariants) {
    const pid = Number(v.productId || v.product_id);
    if (!pid) continue;
    if (!variantsByPrintfulId.has(pid)) variantsByPrintfulId.set(pid, []);
    variantsByPrintfulId.get(pid)!.push(v);
  }

  const printfulById = new Map<number, any>();
  for (const pf of printfulProducts) {
    printfulById.set(Number(pf.id || pf._docId), pf);
  }

  // ── In-memory docs being built this sync ─────────────────────────────────────
  // docId → accumulated entry (used for bridging within same sync run)
  const inProgressDocs = new Map<string, any>();

  function allocateQRGDocId(
    existingDocId: string | undefined,
    qrgCategory: QRGCategoryName | null,
  ): { docId: string; alreadyExists: boolean } | null {
    if (existingDocId && existingDocId.startsWith('qrg_')) {
      // Enforce range integrity: the existing docId must belong to the correct
      // category range. If it doesn't (e.g. a bridged doc from the wrong range),
      // fall through and allocate a fresh correct-range ID — no exceptions.
      const num = Number(existingDocId.slice(4));
      const cat = qrgCategory ? QRG_BLANK_CATEGORIES.find(c => c.name === qrgCategory) : null;
      const inCorrectRange = cat
        ? Math.floor(num / 1000) === Math.floor(cat.rangeStart / 1000)
        : true; // no category = unclassified, preserve whatever ID we have
      if (inCorrectRange) {
        return { docId: existingDocId, alreadyExists: existingMaster.has(existingDocId) || inProgressDocs.has(existingDocId) };
      }
      // Range mismatch — fall through to allocate a fresh slot in the correct range
    }
    if (qrgCategory && nextBBB[qrgCategory] !== undefined) {
      const bbb = nextBBB[qrgCategory];
      nextBBB[qrgCategory] = bbb + 1;
      return { docId: `qrg_${bbb}`, alreadyExists: false };
    }
    return null; // Unclassified — skip this product, no pending_* fallback in greenfield mode
  }

  function bumpCategoryStats(qrgCategory: QRGCategoryName | null): void {
    if (!qrgCategory) { stats.unclassified++; return; }
    const cat = QRG_BLANK_CATEGORIES.find(c => c.name === qrgCategory);
    if (!cat) { stats.unclassified++; return; }
    switch (cat.parent) {
      case 'Apparel':            stats.byCategory.apparel++; break;
      case 'Houseware':          stats.byCategory.houseware++; break;
      case 'Print & Display':    stats.byCategory.printAndDisplay++; break;
      case 'Accessories':        stats.byCategory.accessories++; break;
      case 'Pet Products':       stats.byCategory.petProducts++; break;
      case 'Holiday & Seasonal': stats.byCategory.holidayAndSeasonal++; break;
      default:                   stats.unclassified++;
    }
  }

  const matchedPrintfulIds = new Set<number>();

  // ── Process Printify blueprints ──────────────────────────────────────────────
  for (const bp of printifyBlueprints) {
    const blueprintId = Number(bp.id || bp.blueprintId || bp._docId);
    if (isNaN(blueprintId)) continue;

    const provider = bestProviderByBlueprint.get(blueprintId);
    const now = new Date().toISOString();

    // Classify into QRG category
    const qrgCategory = classifyToQRGCategory(bp.title, bp.typeName) as QRGCategoryName | null;

    // Try to match with a Printful product by brand+model
    let matchedPrintful: any = null;
    for (const pf of printfulProducts) {
      if (isBrandModelMatch(bp.brand, bp.model, pf.brand, pf.model)) {
        matchedPrintful = pf;
        break;
      }
    }

    const pfId = matchedPrintful ? Number(matchedPrintful.id || matchedPrintful._docId) : null;
    if (pfId !== null) matchedPrintfulIds.add(pfId);

    // Find existing QRG doc: check Printify mapping first, then Printful mapping
    const existingViaBlueprint = blueprintToQrgDoc.get(blueprintId);
    const existingViaPrintful = pfId !== null ? printfulToQrgDoc.get(pfId) : undefined;
    const resolvedExistingId = existingViaBlueprint || existingViaPrintful;

    const allocatedPy = allocateQRGDocId(resolvedExistingId, qrgCategory);
    if (!allocatedPy) {
      console.warn(`[MasterCatalog] Skipping unclassified Printify blueprint ${blueprintId}: "${bp.title}"`);
      stats.unclassified++;
      continue;
    }
    const { docId, alreadyExists } = allocatedPy;

    // Register lookups so Printful processing can find this doc
    blueprintToQrgDoc.set(blueprintId, docId);
    if (pfId !== null) printfulToQrgDoc.set(pfId, docId);

    const currentDoc = existingMaster.get(docId) || inProgressDocs.get(docId);

    // ── Extract images ────────────────────────────────────────────────────────
    const pyImagesRaw = extractImageUrls(bp.images);
    let pfImagesRaw: string[] = [];
    let pfMinPrice: number | null = null;
    let pfMaxPrice: number | null = null;
    let pfOriginCountry: string | null = null;

    if (matchedPrintful && pfId !== null) {
      pfImagesRaw = extractImageUrls(matchedPrintful.images);
      if (pfImagesRaw.length === 0 && matchedPrintful.image) pfImagesRaw = [matchedPrintful.image];
      pfMinPrice = matchedPrintful.minPrice ? parseFloat(String(matchedPrintful.minPrice)) : null;
      pfMaxPrice = matchedPrintful.maxPrice ? parseFloat(String(matchedPrintful.maxPrice)) : null;
      pfOriginCountry = matchedPrintful.originCountry || matchedPrintful.origin_country || null;
    }

    const combinedImages = mergeImages([], [...pyImagesRaw, ...pfImagesRaw]);

    // ── Build qrgVariants map ─────────────────────────────────────────────────
    const qrgVariants: Record<string, any> = {};
    const allSizeCodes = new Set<string>();
    const allColorCodes = new Set<string>();
    const unmappedSizes = new Set<string>();
    const unmappedColors = new Set<string>();

    // Printful variant records (most precise size+color data)
    if (matchedPrintful && pfId !== null) {
      for (const v of (variantsByPrintfulId.get(pfId) || [])) {
        const sizeCode = getQrgSizeCode(v.size || '');
        const colorCode = getQrgColorCode(v.color || '');
        if (!sizeCode) { if (v.size) unmappedSizes.add(v.size); continue; }
        if (!colorCode) { if (v.color) unmappedColors.add(v.color); continue; }
        const vc = `${sizeCode}${colorCode}`;
        if (!qrgVariants[vc]) {
          qrgVariants[vc] = { sizeCode, colorCode, sizeLabel: SIZE_LABELS[sizeCode] ?? sizeCode, colorLabel: (v.color || COLOR_LABELS[colorCode]) ?? colorCode, providerVariants: {}, availableVia: [] };
        }
        qrgVariants[vc].providerVariants.printful = { variantId: String(v.id || v.variantId || ''), productId: String(pfId) };
        if (!qrgVariants[vc].availableVia.includes('printful')) qrgVariants[vc].availableVia.push('printful');
        allSizeCodes.add(sizeCode);
        allColorCodes.add(colorCode);
      }
    }

    // Printify size/color coverage from provider staging
    for (const sizeStr of (Array.isArray(provider?.availableSizes) ? provider.availableSizes : [])) {
      const sizeCode = getQrgSizeCode(sizeStr);
      if (!sizeCode) { unmappedSizes.add(sizeStr); continue; }
      allSizeCodes.add(sizeCode);
      for (const colorObj of (Array.isArray(provider?.availableColors) ? provider.availableColors : [])) {
        const colorName = typeof colorObj === 'string' ? colorObj : (colorObj?.name || '');
        if (!colorName) continue;
        const colorCode = getQrgColorCode(colorName);
        if (!colorCode) { unmappedColors.add(colorName); continue; }
        allColorCodes.add(colorCode);
        const vc = `${sizeCode}${colorCode}`;
        if (!qrgVariants[vc]) {
          qrgVariants[vc] = { sizeCode, colorCode, sizeLabel: SIZE_LABELS[sizeCode] ?? sizeCode, colorLabel: colorName, providerVariants: {}, availableVia: [] };
        }
        if (!qrgVariants[vc].providerVariants.printify) {
          qrgVariants[vc].providerVariants.printify = { blueprintId: String(blueprintId), printProviderId: String(provider?.providerId ?? '') };
        }
        if (!qrgVariants[vc].availableVia.includes('printify')) qrgVariants[vc].availableVia.push('printify');
      }
    }

    // ── Provider availability ─────────────────────────────────────────────────
    const availableVia: string[] = ['printify'];
    if (matchedPrintful && pfId !== null) availableVia.push('printful');
    availableVia.sort();

    // ── Pricing ───────────────────────────────────────────────────────────────
    const pyMinCents: number | null = provider?.minCost ?? null;
    const pyMin: number | null = pyMinCents !== null ? pyMinCents / 100 : null;
    const pyMaxCents: number | null = provider?.maxCost ?? null;
    const pyMax: number | null = pyMaxCents !== null ? pyMaxCents / 100 : null;
    const newMinPrice = pyMin !== null && pfMinPrice !== null ? Math.max(pyMin, pfMinPrice) : (pyMin ?? pfMinPrice ?? null);
    const newMaxPrice = pyMax !== null && pfMaxPrice !== null ? Math.max(pyMax, pfMaxPrice) : (pyMax ?? pfMaxPrice ?? null);

    // ── Canonical fields ──────────────────────────────────────────────────────
    const providerTitle = matchedPrintful?.title || matchedPrintful?.typeName || bp.title || null;
    const canonicalTitle = safeAssignRequired(currentDoc?.canonicalTitle, providerTitle);
    const canonicalBrand = safeAssign(currentDoc?.brand, matchedPrintful?.brand || bp.brand || null);

    const _blankStr = docId.slice(4);
    const _parentCat = _blankStr[0];

    const entry: any = {
      qrgBlankId: _blankStr,
      qrgParentCategory: _parentCat,
      qrgParentCategoryLabel: PARENT_CAT_LABELS[_parentCat] ?? null,
      qrgProductType: _blankStr[1],
      qrgProductTypeLabel: qrgCategory,
      qrgItemNumber: _blankStr.slice(2),
      qrgCategory,
      canonicalTitle,
      brand: canonicalBrand || currentDoc?.brand || null,
      model: safeAssign(currentDoc?.model, bp.model || matchedPrintful?.model || null),
      description: safeAssign(currentDoc?.description, stripHtml(bp.richDescription || bp.description || null)),
      images: combinedImages,
      availableSizes: Array.from(allSizeCodes).sort(),
      availableColors: Array.from(allColorCodes).sort(),
      qrgVariants,
      providerMappings: {
        printify: {
          blueprintId: String(blueprintId),
          printProviderId: String(provider?.providerId ?? ''),
          rawTitle: bp.title || null,
          rawDescription: bp.description || null,
        },
        printful: (matchedPrintful && pfId !== null) ? {
          productId: String(pfId),
          rawTitle: matchedPrintful.title || matchedPrintful.typeName || null,
          rawDescription: matchedPrintful.description || null,
        } : null,
      },
      availableVia,
      unmappedProviderValues: {
        sizes: Array.from(unmappedSizes),
        colors: Array.from(unmappedColors),
      },
      originCountry: pfOriginCountry || provider?.country || currentDoc?.originCountry || null,
      minPrice: newMinPrice,
      maxPrice: newMaxPrice,
      lastSyncedAt: now,
      updatedAt: now,
    };

    inProgressDocs.set(docId, { ...currentDoc, ...entry });

    const masterRef = db.collection(MASTER_CATALOG_COLLECTION).doc(docId);
    const isFirstWrite = !alreadyExists;

    if (isFirstWrite) {
      writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
      stats.created++;
      if (matchedPrintful) stats.bridged++;
      else stats.printifyOnly++;
    } else {
      writes.push({ ref: masterRef, data: entry, merge: true });
      stats.updated++;
    }

    bumpCategoryStats(qrgCategory);
  }

  // ── Process unmatched Printful products ──────────────────────────────────────
  for (const pf of printfulProducts) {
    const pfId = Number(pf.id || pf._docId);
    if (matchedPrintfulIds.has(pfId)) continue;

    const now = new Date().toISOString();

    const qrgCategory = classifyToQRGCategory(pf.title, pf.typeName) as QRGCategoryName | null;

    const existingQrgDocId = printfulToQrgDoc.get(pfId);
    const allocatedPf = allocateQRGDocId(existingQrgDocId, qrgCategory);
    if (!allocatedPf) {
      console.warn(`[MasterCatalog] Skipping unclassified Printful product ${pfId}: "${pf.title}"`);
      stats.unclassified++;
      continue;
    }
    const { docId, alreadyExists } = allocatedPf;
    printfulToQrgDoc.set(pfId, docId);

    const currentDoc = existingMaster.get(docId) || inProgressDocs.get(docId);

    // ── Build qrgVariants from Printful variant records ───────────────────────
    const qrgVariantsPf: Record<string, any> = {};
    const pfAllSizeCodes = new Set<string>();
    const pfAllColorCodes = new Set<string>();
    const pfUnmappedSizes = new Set<string>();
    const pfUnmappedColors = new Set<string>();

    for (const v of (variantsByPrintfulId.get(pfId) || [])) {
      const sizeCode = getQrgSizeCode(v.size || '');
      const colorCode = getQrgColorCode(v.color || '');
      if (!sizeCode) { if (v.size) pfUnmappedSizes.add(v.size); continue; }
      if (!colorCode) { if (v.color) pfUnmappedColors.add(v.color); continue; }
      const vc = `${sizeCode}${colorCode}`;
      if (!qrgVariantsPf[vc]) {
        qrgVariantsPf[vc] = { sizeCode, colorCode, sizeLabel: SIZE_LABELS[sizeCode] ?? sizeCode, colorLabel: (v.color || COLOR_LABELS[colorCode]) ?? colorCode, providerVariants: {}, availableVia: ['printful'] };
      }
      qrgVariantsPf[vc].providerVariants.printful = { variantId: String(v.id || v.variantId || ''), productId: String(pfId) };
      pfAllSizeCodes.add(sizeCode);
      pfAllColorCodes.add(colorCode);
    }

    let pfImagesRaw = extractImageUrls(pf.images);
    if (pfImagesRaw.length === 0 && pf.image) pfImagesRaw = [pf.image];

    const pfOriginCountry = pf.originCountry || pf.origin_country || null;
    const pfMin: number | null = pf.minPrice ? parseFloat(String(pf.minPrice)) : null;
    const pfMax: number | null = pf.maxPrice ? parseFloat(String(pf.maxPrice)) : null;

    const _pfBlankStr = docId.slice(4);
    const _pfParentCat = _pfBlankStr[0];

    const entry: any = {
      qrgBlankId: _pfBlankStr,
      qrgParentCategory: _pfParentCat,
      qrgParentCategoryLabel: PARENT_CAT_LABELS[_pfParentCat] ?? null,
      qrgProductType: _pfBlankStr[1],
      qrgProductTypeLabel: qrgCategory,
      qrgItemNumber: _pfBlankStr.slice(2),
      qrgCategory,
      canonicalTitle: safeAssignRequired(currentDoc?.canonicalTitle, pf.title || pf.typeName || null),
      brand: safeAssign(currentDoc?.brand, pf.brand || null),
      model: safeAssign(currentDoc?.model, pf.model || null),
      description: safeAssign(currentDoc?.description, stripHtml(pf.description || null)),
      images: mergeImages(currentDoc?.images || [], pfImagesRaw),
      availableSizes: Array.from(pfAllSizeCodes).sort(),
      availableColors: Array.from(pfAllColorCodes).sort(),
      qrgVariants: qrgVariantsPf,
      providerMappings: {
        printify: null,
        printful: {
          productId: String(pfId),
          rawTitle: pf.title || pf.typeName || null,
          rawDescription: pf.description || null,
        },
      },
      availableVia: ['printful'],
      unmappedProviderValues: {
        sizes: Array.from(pfUnmappedSizes),
        colors: Array.from(pfUnmappedColors),
      },
      originCountry: pfOriginCountry || currentDoc?.originCountry || null,
      minPrice: pfMin ?? currentDoc?.minPrice ?? null,
      maxPrice: pfMax ?? currentDoc?.maxPrice ?? null,
      lastSyncedAt: now,
      updatedAt: now,
    };

    inProgressDocs.set(docId, { ...currentDoc, ...entry });

    const masterRef = db.collection(MASTER_CATALOG_COLLECTION).doc(docId);
    if (!alreadyExists) {
      writes.push({ ref: masterRef, data: { ...entry, createdAt: now }, merge: false });
      stats.created++;
      stats.printfulOnly++;
    } else {
      writes.push({ ref: masterRef, data: entry, merge: true });
      stats.updated++;
    }

    bumpCategoryStats(qrgCategory);
  }

  await commitBatch(writes);
  console.log('[MasterCatalog] QRG sync complete:', stats);
  return stats;
}

export { MASTER_CATALOG_COLLECTION, MASTER_CATALOG_SYNCS_COLLECTION };

// ── Provider staging sync functions ──────────────────────────────────────────

/**
 * Sync Printify blueprints → printify_blueprints collection.
 * Mirrors the pp-catalog.ts sync but runs synchronously (awaited).
 */
export async function syncPrintifyToStaging(
  options: { onProgress?: (msg: string) => void } = {}
): Promise<{ blueprints: number; added: number; updated: number; errors: number }> {
  const { onProgress } = options;
  const log = (msg: string) => { console.log(msg); onProgress?.(msg); };

  if (!printifyClient.isConfigured) throw new Error('Printify API key not configured');

  log('[Printify] Fetching blueprints from API...');
  const blueprints: any[] = await printifyClient.getCatalogBlueprints();
  log(`[Printify] Fetched ${blueprints.length} blueprints`);

  const existingSnap = await db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).get();
  const existingMap = new Map<string, any>();
  for (const doc of existingSnap.docs) existingMap.set(doc.id, doc.data());

  const now = new Date().toISOString();
  let added = 0, updated = 0, errors = 0;
  const writes: { ref: FirebaseFirestore.DocumentReference; data: any; merge: boolean }[] = [];

  for (const bp of blueprints) {
    try {
      const docId = String(bp.id);
      const existing = existingMap.get(docId);
      const images: string[] = Array.isArray(bp.images) ? bp.images.map((img: any) => typeof img === 'string' ? img : img?.src || img?.url || '').filter(Boolean) : [];
      const data: any = {
        id: bp.id,
        title: bp.title,
        description: bp.description || null,
        brand: bp.brand || null,
        model: bp.model || null,
        images,
        primaryImageUrl: images[0] || null,
        lastSyncedAt: now,
      };
      if (existing?.richDescription) data.richDescription = existing.richDescription;
      writes.push({ ref: db.collection(PRINTIFY_BLUEPRINTS_COLLECTION).doc(docId), data, merge: true });
      if (existing) updated++; else added++;
    } catch (e: any) {
      errors++;
      log(`[Printify] Error processing bp ${bp.id}: ${e.message}`);
    }
  }

  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const w of chunk) batch.set(w.ref, w.data, { merge: w.merge });
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
export async function syncPrintfulToStaging(
  options: { onProgress?: (msg: string) => void } = {}
): Promise<{ products: number; added: number; updated: number; errors: number }> {
  const { onProgress } = options;
  const log = (msg: string) => { console.log(msg); onProgress?.(msg); };

  const apiKey = await getPrintfulApiKeyAsync().catch(() => null);
  if (!apiKey) {
    log('[Printful] API key not configured — skipping');
    return { products: 0, added: 0, updated: 0, errors: 0 };
  }

  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  log('[Printful] Fetching product catalog...');
  const catResp = await fetch('https://api.printful.com/products', { headers });
  if (!catResp.ok) throw new Error(`Printful catalog API error: ${catResp.status}`);
  const catData = await catResp.json();
  const products: any[] = catData.result || [];
  log(`[Printful] Fetched ${products.length} products`);

  const existingSnap = await db.collection(PRINTFUL_PRODUCTS_COLLECTION).get();
  const existingMap = new Map<string, any>();
  for (const doc of existingSnap.docs) existingMap.set(doc.id, doc.data());

  const now = new Date().toISOString();
  let added = 0, updated = 0, errors = 0;
  const writes: { ref: FirebaseFirestore.DocumentReference; data: any }[] = [];

  for (const product of products) {
    try {
      const docId = String(product.id);
      const existing = existingMap.get(docId);
      const data: any = {
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
      writes.push({ ref: db.collection(PRINTFUL_PRODUCTS_COLLECTION).doc(docId), data });
      // Also keep printfulCatalog up to date (backward compat + fallback)
      writes.push({ ref: db.collection('printfulCatalog').doc(docId), data: { ...data, category: product.type || null } });
      if (existing) updated++; else added++;
    } catch (e: any) {
      errors++;
      log(`[Printful] Error processing product ${product.id}: ${e.message}`);
    }
  }

  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const w of chunk) batch.set(w.ref, w.data, { merge: true });
    await batch.commit();
  }

  log(`[Printful] Done: ${products.length} products (${added} added, ${updated} updated)`);
  return { products: products.length, added, updated, errors };
}

// ── Enrichment ────────────────────────────────────────────────────────────────

export interface EnrichStats {
  total: number;
  printfulEnriched: number;
  printifyEnriched: number;
  defaultsApplied: number;
  skipped: number;
  errors: number;
  colorsAdded: number;
  sizesAdded: number;
  pricesAdded: number;
  originAdded: number;
}

// ── Category-based default print positions ────────────────────────────────────
// Used as an instant fallback when provider APIs are unavailable.
// These are accurate for the vast majority of products in each category.
const CATEGORY_DEFAULT_POSITIONS: Record<string, string[]> = {
  'T-Shirts':              ['front', 'back', 'left_chest'],
  'Hoodies & Sweatshirts': ['front', 'back', 'left_chest', 'right_chest'],
  'Bottoms & Active':      ['front', 'back'],
  'Hats & Caps':           ['front', 'back', 'left_side', 'right_side'],
  'Footwear & Socks':      ['leg', 'sole'],
  'Sleepwear & Underwear': ['front', 'back'],
  'Baby & Kids':           ['front', 'back'],
  'Drinkware':             ['left', 'right'],
  'Barware':               ['left', 'right'],
  'Drinkware Accessories': ['front'],
  'Kitchen & Dining':      ['front'],
  'Bedding & Textiles':    ['front'],
  'Home Décor':            ['front'],
  'Wall Art & Prints':     ['front'],
  'Stickers & Magnets':    ['front'],
  'Stationery & Paper':    ['front'],
  'Signs & Display':       ['front'],
  'Books & Photo':         ['front', 'back'],
  'Pins & Patches':        ['front'],
  'Tags':                  ['front', 'back'],
  'Puzzles & Games':       ['front'],
  'Novelty':               ['front'],
  'Bags & Pouches':        ['front', 'back'],
  'Jewelry':               ['front'],
  'Phone & Tech Cases':    ['back'],
  'Travel Accessories':    ['front', 'back'],
  'Small Accessories':     ['front'],
  'Pet Apparel':           ['front', 'back'],
  'Pet Accessories':       ['front'],
  'Ornaments & Décor':     ['front', 'back'],
  'Stockings & Gifting':   ['front', 'back'],
  'Seasonal Apparel':      ['front', 'back'],
};

// ── Category-based default print sizes (in inches at 150 DPI) ────────────────
const POSITION_DEFAULT_SIZES: Record<string, { width: number; height: number; dpi: number }> = {
  front:        { width: 12,  height: 16,  dpi: 150 },
  back:         { width: 12,  height: 16,  dpi: 150 },
  left_chest:   { width: 4,   height: 4,   dpi: 150 },
  right_chest:  { width: 4,   height: 4,   dpi: 150 },
  left_side:    { width: 2.5, height: 2.5, dpi: 150 },
  right_side:   { width: 2.5, height: 2.5, dpi: 150 },
  left:         { width: 8.5, height: 4,   dpi: 150 },
  right:        { width: 8.5, height: 4,   dpi: 150 },
  leg:          { width: 5,   height: 8,   dpi: 150 },
  sole:         { width: 5,   height: 9,   dpi: 150 },
  back_large:   { width: 12,  height: 16,  dpi: 150 },
};

function buildDefaultSizes(positions: string[]): Record<string, { width: number; height: number; dpi: number }> {
  const sizes: Record<string, { width: number; height: number; dpi: number }> = {};
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
export async function enrichMasterCatalog(
  options: { forceRefresh?: boolean; categoryFilter?: string } = {}
): Promise<EnrichStats> {
  const { forceRefresh = false, categoryFilter } = options;
  const stats: EnrichStats = {
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
    ? db.collection(MASTER_CATALOG_COLLECTION).where('qrgCategory', '==', categoryFilter)
    : db.collection(MASTER_CATALOG_COLLECTION);
  const snap = await baseQuery.get();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Small concurrent bursts to respect Printify rate limits (~2 req/s)
  const BURST_SIZE = 6;
  const INTER_BURST_DELAY_MS = 1500;
  const now = new Date().toISOString();

  async function enrichDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): Promise<void> {
    const data = doc.data() as any;
    stats.total++;

    const providerMappings: any[] = Array.isArray(data.providerMappings) ? data.providerMappings : [];
    const pyMap = providerMappings.find((m: any) => m.provider === 'printify') || null;
    const isPrintifyItem = !!pyMap;

    // Skip if fully enriched within the last 7 days
    const fullyEnriched =
      !forceRefresh &&
      data.lastEnrichedAt &&
      data.lastEnrichedAt > sevenDaysAgo &&
      Array.isArray(data.printPositions) && data.printPositions.length > 0 &&
      // Printify items also need colors + sizes to be considered done
      (!isPrintifyItem || (
        Array.isArray(data.colors) && data.colors.length > 0 &&
        Array.isArray(data.sizes) && data.sizes.length > 0
      ));

    if (fullyEnriched) {
      stats.skipped++;
      return;
    }

    const pyBlueprintId: number | null = data.printifyBlueprintId ?? pyMap?.blueprintId ?? null;
    let pyProviderId: number | null = pyMap?.printProviderId ?? data.printProviderId ?? null;

    const update: Record<string, any> = { lastEnrichedAt: now };
    let positionsSet = false;

    // ── 1. Printify: providers → origin; variants → positions/colors/sizes/prices
    if (pyBlueprintId && printifyClient.isConfigured) {
      try {
        // Step A: get print providers → origin country + provider id
        let originCountry: string | null = data.originCountry ?? null;
        if (!pyProviderId || !originCountry) {
          const providers = await withTimeout(
            printifyClient.getPrintProviders(pyBlueprintId),
            10000
          );
          const firstProvider = (providers as any[])?.[0] ?? null;
          if (firstProvider) {
            pyProviderId = pyProviderId ?? firstProvider.id ?? null;
            const loc = firstProvider.location ?? firstProvider;
            const rawCountry: string | null = loc.country ?? null;
            if (rawCountry && !originCountry) {
              originCountry = rawCountry;
              update.originCountry = originCountry;
              update['providerMappings'] = providerMappings.map((m: any) =>
                m.provider === 'printify' ? { ...m, originCountry, printProviderId: pyProviderId } : m
              );
              stats.originAdded++;
            }
          }
        }

        // Step B: get variants → positions, colors, sizes, prices
        if (pyProviderId) {
          const variantData: any = await withTimeout(
            printifyClient.getVariants(pyBlueprintId, pyProviderId),
            10000
          );

          // ── Positions (from placeholders on each variant)
          const posSet = new Set<string>();
          for (const v of (variantData?.variants ?? [])) {
            for (const ph of (v.placeholders ?? [])) {
              if (ph.position) posSet.add(ph.position as string);
            }
          }
          if (posSet.size > 0) {
            const positions = Array.from(posSet);
            update.printPositions = positions;
            update.printSizes = buildDefaultSizes(positions);
            positionsSet = true;
          }

          // ── Colors (from top-level options array, type === 'color')
          const colorGroup = (variantData?.options ?? []).find((o: any) =>
            (o.type ?? o.name ?? '').toLowerCase().includes('color')
          );
          if (colorGroup?.values?.length > 0) {
            const colors = (colorGroup.values as any[]).map((v: any) => ({
              name: v.title ?? v.name ?? '',
              hex: (v.colors ?? v.hexColors ?? [])[0] ?? null,
            })).filter((c: any) => c.name);
            if (colors.length > 0) {
              update.colors = colors;
              update.colorCount = colors.length;
              stats.colorsAdded++;
            }
          }

          // ── Sizes (from top-level options array, type === 'size')
          const sizeGroup = (variantData?.options ?? []).find((o: any) =>
            (o.type ?? o.name ?? '').toLowerCase().includes('size')
          );
          if (sizeGroup?.values?.length > 0) {
            const sizes = (sizeGroup.values as any[])
              .map((v: any) => v.title ?? v.name ?? '')
              .filter(Boolean);
            if (sizes.length > 0) {
              update.sizes = sizes;
              stats.sizesAdded++;
            }
          }

          // ── Prices (in cents → dollars; only enabled variants)
          const enabledPrices = (variantData?.variants ?? [])
            .filter((v: any) => v.is_enabled !== false && v.price > 0)
            .map((v: any) => v.price / 100);
          if (enabledPrices.length > 0) {
            update.minPrice = Math.min(...enabledPrices);
            update.maxPrice = Math.max(...enabledPrices);
            stats.pricesAdded++;
          }

          stats.printifyEnriched++;
        }
      } catch (e: any) {
        console.warn(`[Enrich] Blueprint ${pyBlueprintId} failed: ${e.message}`);
        stats.errors++;
      }
    }

    // ── 2. Category defaults for positions if Printify call failed/skipped ──
    if (!positionsSet) {
      const category: string = data.qrgCategory || 'Unclassified';
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
    if (i + BURST_SIZE < snap.docs.length) await delay(INTER_BURST_DELAY_MS);
    if (i % (BURST_SIZE * 10) === 0 || i + BURST_SIZE >= snap.docs.length) {
      console.log(
        `[Enrich] ${Math.min(i + BURST_SIZE, snap.docs.length)}/${snap.docs.length} — ` +
        `printify:${stats.printifyEnriched} colors:${stats.colorsAdded} sizes:${stats.sizesAdded} ` +
        `prices:${stats.pricesAdded} origin:${stats.originAdded} defaults:${stats.defaultsApplied} ` +
        `skipped:${stats.skipped} errors:${stats.errors}`
      );
    }
  }

  console.log('[MasterCatalog] Enrich complete:', stats);
  return stats;
}
