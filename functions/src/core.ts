import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { admin };
export const db = admin.firestore();
export const storage = admin.storage();

export type FulfillmentProvider = 'printify' | 'printful';
export type PrintMethod = 'dtg' | 'dtf';

export const PRINTIFY_TO_INTERNAL: Record<string, string> = {
  'front': 'front', 'back': 'back', 'pocket': 'pocket',
  'sleeve_left': 'left_sleeve', 'sleeve_right': 'right_sleeve',
  'left': 'left', 'right': 'right',
  'neck_label': 'label_outside', 'label': 'label_inside',
};

export const PRINTFUL_TO_INTERNAL: Record<string, string> = {
  'front': 'front', 'front_large': 'front', 'front_dtf': 'front',
  'back': 'back', 'back_dtf': 'back',
  'sleeve_left': 'left_sleeve', 'sleeve_right': 'right_sleeve',
  'short_sleeve_left_dtf': 'left_sleeve', 'short_sleeve_right_dtf': 'right_sleeve',
  'label_outside': 'label_outside', 'label_inside': 'label_inside',
  'default': 'front',
};

export const INTERNAL_TO_PRINTFUL: Record<string, string> = {
  'front': 'front_large', 'back': 'back',
  'left_sleeve': 'sleeve_left', 'right_sleeve': 'sleeve_right',
  'label_inside': 'label_inside', 'label_outside': 'label_outside',
};

export const INTERNAL_TO_PRINTFUL_DTF: Record<string, string> = {
  'front': 'front_dtf', 'back': 'back_dtf',
  'left_sleeve': 'short_sleeve_left_dtf', 'right_sleeve': 'short_sleeve_right_dtf',
};

export function normalizePlacement(provider: FulfillmentProvider, providerPlacement: string): string {
  const map = provider === 'printify' ? PRINTIFY_TO_INTERNAL : PRINTFUL_TO_INTERNAL;
  return map[providerPlacement] || providerPlacement;
}

export function normalizePlacements(provider: FulfillmentProvider, providerPlacements: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const pp of providerPlacements) {
    const internal = normalizePlacement(provider, pp);
    if (!seen.has(internal)) { seen.add(internal); result.push(internal); }
  }
  return result;
}

export function toProviderPlacement(provider: FulfillmentProvider, internal: string, availablePlacements?: string[], printMethod?: PrintMethod): string {
  if (provider === 'printful' && printMethod === 'dtf') {
    const dtfMapped = INTERNAL_TO_PRINTFUL_DTF[internal];
    if (dtfMapped && (!availablePlacements || availablePlacements.includes(dtfMapped))) {
      return dtfMapped;
    }
  }
  if (provider === 'printify') {
    const INTERNAL_TO_PRINTIFY: Record<string, string> = {
      'front': 'front', 'back': 'back', 'pocket': 'pocket',
      'left_sleeve': 'sleeve_left', 'right_sleeve': 'sleeve_right',
      'label_inside': 'label', 'label_outside': 'neck_label',
      'left': 'left', 'right': 'right',
    };
    return INTERNAL_TO_PRINTIFY[internal] || internal;
  }
  let mapped = INTERNAL_TO_PRINTFUL[internal] || internal;
  if (internal === 'front' && availablePlacements) {
    if (availablePlacements.includes('front_large')) mapped = 'front_large';
    else if (availablePlacements.includes('front')) mapped = 'front';
  }
  return mapped;
}

export function isEmbroideryPlacement(p: string): boolean { return p.startsWith('embroidery_'); }

export function detectPrintMethod(providerPlacement: string): PrintMethod {
  return providerPlacement.endsWith('_dtf') ? 'dtf' : 'dtg';
}

export function groupPlacementsByLocation(provider: FulfillmentProvider, rawPlacements: string[]): { internal: string; methods: { method: PrintMethod; providerName: string }[] }[] {
  const groups = new Map<string, { method: PrintMethod; providerName: string }[]>();
  for (const raw of rawPlacements) {
    const internal = normalizePlacement(provider, raw);
    const method = detectPrintMethod(raw);
    if (!groups.has(internal)) groups.set(internal, []);
    const existing = groups.get(internal)!;
    if (!existing.some(m => m.method === method)) existing.push({ method, providerName: raw });
  }
  const result: { internal: string; methods: { method: PrintMethod; providerName: string }[] }[] = [];
  groups.forEach((methods, internal) => result.push({ internal, methods }));
  return result;
}

export const QR_GEAR_BRANDED_TAG_URL = 'https://qrgear-c1ffd.web.app/img/qr-gear-neck-tag-600.png';
export const LABEL_PLACEMENTS_PRINTFUL = ['label_outside', 'label_inside'];

export function docToObject(doc: FirebaseFirestore.DocumentSnapshot): any {
  if (!doc.exists) return null;
  const data = doc.data()!;
  Object.keys(data).forEach(key => {
    if (data[key] instanceof admin.firestore.Timestamp) {
      data[key] = data[key].toDate();
    }
  });
  return { ...data, id: doc.id };
}

export function docsToArray(snapshot: FirebaseFirestore.QuerySnapshot): any[] {
  return snapshot.docs.map(doc => docToObject(doc));
}

export function isValidHexColor(hexColor: string | undefined | null): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace("#", "");
  return /^[0-9A-Fa-f]{6}$/.test(hex);
}

export function isColorDark(hexColor: string | undefined | null): boolean {
  if (!isValidHexColor(hexColor)) return false;
  const hex = hexColor!.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.5;
}

export function stripUndef(obj: any): any {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export function sanitizeStyleForFirestore(style: any): any {
  if (!style || typeof style !== 'object') return style;
  const sanitized: any = {};
  for (const key of Object.keys(style)) {
    const val = style[key];
    if (val === undefined) continue;
    if (val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      sanitized[key] = val;
    } else if (typeof val === 'object') {
      sanitized[key] = sanitizeStyleForFirestore(val);
    }
  }
  return sanitized;
}

export function generateNanoId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function normalizePrintfulCategory(type: string, title: string): string {
  const text = `${type} ${title}`.toLowerCase();
  if (text.includes('hoodie') || text.includes('hood')) return 'Hoodies';
  if (text.includes('sweatshirt') || text.includes('crewneck') || text.includes('crew neck')) return 'Sweatshirts';
  if (text.includes('sweatpants') || text.includes('jogger')) return 'Sweatpants';
  if (text.includes('tank top') || text.includes('tank')) return 'Tank Tops';
  if (text.includes('long sleeve') || text.includes('longsleeve')) return 'Long Sleeve Shirts';
  if (text.includes('t-shirt') || text.includes('tee') || text.includes('tshirt')) return 'T-Shirts';
  if (text.includes('polo')) return 'Polos';
  if (text.includes('jacket') || text.includes('windbreaker')) return 'Jackets';
  if (text.includes('hat') || text.includes('cap') || text.includes('beanie') || text.includes('trucker')) return 'Hats';
  if (text.includes('bag') || text.includes('tote') || text.includes('backpack') || text.includes('duffel')) return 'Bags';
  if (text.includes('mug') || text.includes('tumbler') || text.includes('bottle')) return 'Drinkware';
  if (text.includes('poster') || text.includes('print') || text.includes('canvas') || text.includes('wall art')) return 'Wall Art';
  if (text.includes('sticker')) return 'Stickers';
  if (text.includes('phone case') || text.includes('iphone') || text.includes('samsung')) return 'Phone Cases';
  if (text.includes('mouse pad') || text.includes('mousepad')) return 'Mouse Pads';
  if (text.includes('pillow') || text.includes('cushion')) return 'Pillows';
  if (text.includes('blanket') || text.includes('throw')) return 'Blankets';
  if (text.includes('towel')) return 'Towels';
  if (text.includes('apron')) return 'Aprons';
  if (text.includes('shorts')) return 'Shorts';
  if (text.includes('dress')) return 'Dresses';
  if (text.includes('legging')) return 'Leggings';
  if (text.includes('socks')) return 'Socks';
  if (text.includes('jersey')) return 'Jerseys';
  if (text.includes('calendar')) return 'Calendars';
  if (text.includes('notebook') || text.includes('journal')) return 'Notebooks';
  if (text.includes('flag') || text.includes('banner')) return 'Flags & Banners';
  if (text.includes('patch')) return 'Patches';
  if (text.includes('embroidered') || text.includes('embroidery')) return 'Embroidered Items';
  return type || 'Other';
}

export function cfCategorizeProduct(title: string): string {
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

export function cfClassifyPrintfulProduct(typeName: string): string {
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

export function cfBuildPrintfulVariantLookup(variants: any[]): Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }> {
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

export const WIDGET_JWT_SECRET = process.env.WIDGET_JWT_SECRET;
export const WIDGET_API_KEY = process.env.WIDGET_API_KEY;
export const KC_API_KEY = process.env['KC-API-KEY'];

export function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateGiftCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
