/** BLD structure contract. BLD.md owns the rules; every runtime uses this module. */
export const BLD_CONTEXTS = { S: 'Shirt graphic', U: 'URL destination' } as const;
export const BLD_LAYOUTS = { Z: 'Zone', P: 'Palette', I: 'Image', V: 'Video', D: 'Document' } as const;
export const BLD_LAYOUTS_BY_CONTEXT = { S: ['Z', 'P'], U: ['I', 'V', 'D'] } as const;
export const BLD_VEHICLES = { txt: 'Text', img: 'Image', qrc: 'QR code', act: 'Action / CTA', vid: 'Video', doc: 'Document' } as const;
export const BLD_VEHICLES_BY_CONTEXT = { S: ['txt', 'img', 'qrc', 'act'], U: ['txt', 'img', 'qrc', 'act', 'vid', 'doc'] } as const;
export const BLD_MAX_INSTANCES = 9;
export const BLD_MAX_SEQUENCE = 999;
export type BldContext = keyof typeof BLD_CONTEXTS;
export type BldLayoutMode = keyof typeof BLD_LAYOUTS;
export type BldInstanceType = keyof typeof BLD_VEHICLES;

export interface BldInstance {
  seq: string;
  type: BldInstanceType;
  role?: string;
  required?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  strokeWidth?: number;
  strokeColor?: string;
  warpPreset?: string;
  verticalOffset?: number;
  horizontalOffset?: number;
  url?: string; // BLD.md's explicit act-only structural carve-out.
  size?: number;
  positionLR?: number;
  positionUD?: number;
  imageScale?: number;
  playback?: 'file' | 'external';
  ratio?: string;
  length?: number;
  format?: string;
  pages?: number;
  layout?: 'portrait' | 'landscape';
}

export interface BldStructure {
  context: BldContext;
  layoutMode: BldLayoutMode;
  instances: BldInstance[];
}

export class BldValidationError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'BldValidationError';
  }
}

const NUMERIC_FIELDS = ['fontSize', 'letterSpacing', 'strokeWidth', 'verticalOffset', 'horizontalOffset', 'size', 'positionLR', 'positionUD', 'imageScale', 'length', 'pages'];
const STRING_FIELDS = ['seq', 'type', 'role', 'fontFamily', 'strokeColor', 'warpPreset', 'url', 'playback', 'ratio', 'format', 'layout'];
const SLOT_FIELDS = new Set([...NUMERIC_FIELDS, ...STRING_FIELDS, 'fontWeight', 'required']);
const RECORD_FIELDS = new Set(['context', 'layoutMode', 'instances', 'bldId', 'instanceCount', 'buildSequence', 'name', 'source', 'isActive', 'createdAt', 'updatedAt']);

export function parseBldId(id: unknown): { context: BldContext; layoutMode: BldLayoutMode; instanceCount: number; buildSequence: number } | null {
  if (typeof id !== 'string') return null;
  const match = /^BLD-(SZ|SP|UI|UV|UD)(\d)-(\d{3})$/.exec(id);
  if (!match || Number(match[3]) === 0) return null;
  return { context: match[1][0] as BldContext, layoutMode: match[1][1] as BldLayoutMode, instanceCount: Number(match[2]), buildSequence: Number(match[3]) };
}

export function isValidBldId(id: unknown): id is string { return parseBldId(id) !== null; }

export function formatBldId(context: BldContext, layoutMode: BldLayoutMode, instanceCount: number, buildSequence: number): string {
  if (!Number.isInteger(instanceCount) || instanceCount < 0 || instanceCount > BLD_MAX_INSTANCES ||
      !Number.isInteger(buildSequence) || buildSequence < 1 || buildSequence > BLD_MAX_SEQUENCE) {
    throw new BldValidationError('BLD requires 0–9 instances and a build sequence from 001–999.');
  }
  const id = `BLD-${context}${layoutMode}${instanceCount}-${String(buildSequence).padStart(3, '0')}`;
  if (!isValidBldId(id)) throw new BldValidationError('Invalid BLD context/layout combination.');
  return id;
}

/** Strict validation: unknown fields cannot smuggle content into a structural record. */
export function validateBldStructure(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'BLD must be an object.';
  const def = value as Record<string, any>;
  for (const field of Object.keys(def)) {
    if (!RECORD_FIELDS.has(field)) return `BLD field "${field}" is not structural; content and product links belong outside BLD.`;
  }
  if (!Object.prototype.hasOwnProperty.call(BLD_CONTEXTS, def.context)) return 'BLD context must be S or U.';
  const layouts: readonly string[] = BLD_LAYOUTS_BY_CONTEXT[def.context as BldContext];
  if (!layouts.includes(def.layoutMode)) return `BLD ${def.context} layoutMode must be ${layouts.join(', ')}.`;
  if (!Array.isArray(def.instances)) return 'BLD instances must be an array.';
  if (def.instances.length > BLD_MAX_INSTANCES) return `BLD supports at most ${BLD_MAX_INSTANCES} instances.`;
  if (def.instanceCount !== undefined && def.instanceCount !== def.instances.length) return 'BLD instanceCount does not match its instances.';
  if (def.buildSequence !== undefined && (!Number.isInteger(def.buildSequence) || def.buildSequence < 1 || def.buildSequence > BLD_MAX_SEQUENCE)) return 'BLD buildSequence must be from 001–999.';
  if (def.bldId !== undefined) {
    const id = parseBldId(def.bldId);
    if (!id || id.context !== def.context || id.layoutMode !== def.layoutMode || id.instanceCount !== def.instances.length ||
        (def.buildSequence !== undefined && id.buildSequence !== def.buildSequence)) return 'BLD ID does not match its structure.';
  }
  if (def.name !== undefined && typeof def.name !== 'string') return 'BLD name must be a string.';
  for (let index = 0; index < def.instances.length; index++) {
    const slot = def.instances[index];
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) return `BLD slot ${index + 1} must be an object.`;
    if (slot.seq !== String(index + 1).padStart(2, '0')) return 'BLD slot sequences must be unique, ordered, and consecutive from 01.';
    if (!Object.prototype.hasOwnProperty.call(BLD_VEHICLES, slot.type)) return `BLD slot ${slot.seq} has an invalid vehicle type.`;
    for (const [field, v] of Object.entries(slot)) {
      if (!SLOT_FIELDS.has(field)) return `BLD slot ${slot.seq}: "${field}" is not a structural field.`;
      if (NUMERIC_FIELDS.includes(field) && (typeof v !== 'number' || !Number.isFinite(v))) return `BLD slot ${slot.seq}: ${field} must be a finite number.`;
      if (STRING_FIELDS.includes(field) && typeof v !== 'string') return `BLD slot ${slot.seq}: ${field} must be a string.`;
    }
    if (slot.required !== undefined && typeof slot.required !== 'boolean') return `BLD slot ${slot.seq}: required must be boolean.`;
    if (slot.fontWeight !== undefined && !(typeof slot.fontWeight === 'string' || (typeof slot.fontWeight === 'number' && Number.isFinite(slot.fontWeight)))) return `BLD slot ${slot.seq}: invalid fontWeight.`;
    if (slot.playback !== undefined && !['file', 'external'].includes(slot.playback)) return `BLD slot ${slot.seq}: playback must be file or external.`;
    if (slot.ratio !== undefined && !['16:9', '9:16', '1:1', '4:3'].includes(slot.ratio)) return `BLD slot ${slot.seq}: invalid video ratio.`;
    if (slot.format !== undefined && !['pdf', 'docx', 'pptx'].includes(slot.format)) return `BLD slot ${slot.seq}: invalid document format.`;
    if (slot.layout !== undefined && !['portrait', 'landscape'].includes(slot.layout)) return `BLD slot ${slot.seq}: invalid document layout.`;
    if (slot.url !== undefined && slot.type !== 'act') return `BLD slot ${slot.seq}: only act may contain a structural url.`;
    if (slot.type === 'act' && slot.required !== false) return `BLD slot ${slot.seq}: act must be optional (required: false).`;
    const vehicles: readonly string[] = BLD_VEHICLES_BY_CONTEXT[def.context as BldContext];
    if (!vehicles.includes(slot.type)) return `BLD slot ${slot.seq}: ${slot.type} requires U context.`;
    if (def.layoutMode === 'P' && slot.type === 'qrc' && (slot.positionLR === undefined || slot.positionUD === undefined)) return `BLD slot ${slot.seq}: Palette QR requires positionLR and positionUD.`;
  }
  return null;
}

/** Unselected/unknown editor modes remain incomplete, never silently become Zone. */
export function builderBldLayoutMode(mode: unknown): 'Z' | 'P' | null {
  return mode === 'zone' ? 'Z' : mode === 'freeform' ? 'P' : null;
}


/** Extract structure from the existing editor snapshot. Actual content stays in working.graphics for Assembly. */
export function extractBldInstances(working: Record<string, any>): BldInstance[] {
  const graphics = (working.graphics || {}) as Record<string, any>;
  const content  = (graphics.content  || {}) as Record<string, any>;

  const instances: BldInstance[] = [];
  let seq = 1;

  const pad = (n: number) => String(n).padStart(2, '0');

  // ── 01 Image layer (background or palette area image) ─────────────────────
  const bgUrl       = graphics.loadedBackground?.url || null;
  const areaImgUrl  = content.areaImageUrl || null;
  const imageUrl    = bgUrl || areaImgUrl || null;
  if (imageUrl) {
    instances.push({
      seq:      pad(seq++),
      type:     'img',
      role:     bgUrl ? 'background' : 'area_image',
      size:     content.areaImageScale ?? 100,
      positionLR: content.areaImageOffsetX ?? 50,
      positionUD: content.areaImageOffsetY ?? 50,
    });
  }

  // ── 02 QR code ─────────────────────────────────────────────────────────────
  const qrSizePercent = typeof content.qrSizePercent === 'number' ? content.qrSizePercent : 75;
  const qrPositionX   = typeof content.qrPositionX   === 'number' ? content.qrPositionX   : 50;
  const qrPositionY   = typeof content.qrPositionY   === 'number' ? content.qrPositionY   : 50;
  const layoutMode    = content.graphicLayoutMode || 'zone';

  const qrcInstance: BldInstance = {
    seq:  pad(seq++),
    type: 'qrc',
    size: qrSizePercent,
  };
  if (layoutMode === 'freeform') {
    qrcInstance.positionLR = qrPositionX;
    qrcInstance.positionUD = qrPositionY;
  }
  instances.push(qrcInstance);

  // ── Header text ────────────────────────────────────────────────────────────
  const header = content.headerStyle || {};
  if (header.enabled && header.text) {
    instances.push({
      seq:          pad(seq),
      type:         'txt',
      role:         'header',
      fontFamily:   header.fontFamily || '',
      fontSize:     header.fontSize ? Number(header.fontSize) : undefined,
      fontWeight:   header.fontWeight,
      letterSpacing:   header.letterSpacing != null ? Number(header.letterSpacing) : undefined,
      strokeWidth:     header.strokeWidth   != null ? Number(header.strokeWidth)   : undefined,
      strokeColor:     header.strokeColor   || '',
      warpPreset:      header.warpPreset    || '',
      verticalOffset:  header.verticalOffset   != null ? Number(header.verticalOffset)   : undefined,
      horizontalOffset: header.horizontalOffset != null ? Number(header.horizontalOffset) : undefined,
    });
    seq++;
  }

  // ── Footer text ────────────────────────────────────────────────────────────
  const footer = content.footerStyle || {};
  if (footer.enabled && footer.text) {
    instances.push({
      seq:          pad(seq),
      type:         'txt',
      role:         'footer',
      fontFamily:   footer.fontFamily || '',
      fontSize:     footer.fontSize ? Number(footer.fontSize) : undefined,
      fontWeight:   footer.fontWeight,
      letterSpacing:   footer.letterSpacing != null ? Number(footer.letterSpacing) : undefined,
      strokeWidth:     footer.strokeWidth   != null ? Number(footer.strokeWidth)   : undefined,
      strokeColor:     footer.strokeColor   || '',
      warpPreset:      footer.warpPreset    || '',
      verticalOffset:  footer.verticalOffset   != null ? Number(footer.verticalOffset)   : undefined,
      horizontalOffset: footer.horizontalOffset != null ? Number(footer.horizontalOffset) : undefined,
    });
    seq++;
  }

  // ── Sub-bottom text ────────────────────────────────────────────────────────
  const subBottom = content.subBottomStyle || {};
  if (subBottom.enabled && subBottom.text) {
    instances.push({
      seq:        pad(seq),
      type:       'txt',
      role:       'sub_bottom',
      fontFamily: subBottom.fontFamily || '',
      fontSize:   subBottom.fontSize ? Number(subBottom.fontSize) : undefined,
      fontWeight: subBottom.fontWeight,
      letterSpacing: subBottom.letterSpacing != null ? Number(subBottom.letterSpacing) : undefined,
      strokeWidth:   subBottom.strokeWidth   != null ? Number(subBottom.strokeWidth)   : undefined,
      strokeColor:   subBottom.strokeColor   || '',
    });
    seq++;
  }

  // ── Landing text blocks (additional dynamic text layers) ───────────────────
  const landingBlocks: any[] = Array.isArray(content.landingTextBlocks)
    ? content.landingTextBlocks
    : [];
  for (const block of landingBlocks) {
    if (!block.enabled || !block.text) continue;
    instances.push({
      seq:          pad(seq),
      type:         'txt',
      role:         block.role || 'landing_text',
      fontFamily:   block.fontFamily || '',
      fontSize:     block.fontSize ? Number(block.fontSize) : undefined,
      fontWeight:   block.fontWeight,
      letterSpacing:    block.letterSpacing    != null ? Number(block.letterSpacing)    : undefined,
      strokeWidth:      block.strokeWidth      != null ? Number(block.strokeWidth)      : undefined,
      strokeColor:      block.strokeColor      || '',
      warpPreset:       block.warpPreset       || '',
      verticalOffset:   block.verticalOffset   != null ? Number(block.verticalOffset)   : undefined,
      horizontalOffset: block.horizontalOffset != null ? Number(block.horizontalOffset) : undefined,
      imageScale:  block.imageScale  != null ? Number(block.imageScale) : undefined,
    });
    seq++;
  }

  return instances.map(slot => Object.fromEntries(Object.entries(slot).filter(([, value]) => value !== undefined && value !== null && value !== '')) as unknown as BldInstance);
}
