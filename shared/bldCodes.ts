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


/** One ordered layer walk supplies both structural slots and content bindings. */
export interface BuilderLayer { instance: BldInstance; value?: string; color?: string; imageUrl?: string; assetKey?: string }
export function extractBuilderLayers(working: Record<string, any>): BuilderLayer[] {
  const c = working.graphics?.content || {};
  const layers: BuilderLayer[] = [];
  const add = (instance: Omit<BldInstance, 'seq'>, content: Omit<BuilderLayer, 'instance'> = {}) => {
    const clean = Object.fromEntries(Object.entries(instance).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    layers.push({ instance: { ...clean, seq: String(layers.length + 1).padStart(2, '0') } as BldInstance, ...content });
  };
  // loadedBackground and landingTextBlocks belong to the URL destination, not print.
  if (c.areaImageUrl) add({ type: 'img', role: 'area_image', size: c.areaImageScale ?? 100,
    positionLR: c.areaImageOffsetX ?? 50, positionUD: c.areaImageOffsetY ?? 50 },
    { imageUrl: c.areaImageUrl, assetKey: 'backgroundGrfId' });
  add({ type: 'qrc', size: c.qrSizePercent ?? 75,
    ...(c.graphicLayoutMode === 'freeform' ? { positionLR: c.qrPositionX ?? 50, positionUD: c.qrPositionY ?? 50 } : {}) },
    { assetKey: 'qrGrfId' });
  for (const [key, role] of [['headerStyle', 'header'], ['footerStyle', 'footer'], ['subBottomStyle', 'sub_bottom']]) {
    const style = c[key] || {};
    if (!style.enabled) continue;
    const isImage = key !== 'subBottomStyle' && style.mode === 'image';
    if (!(isImage ? style.imageUrl : style.text)) continue;
    const instance: any = { type: isImage ? 'img' : 'txt', role };
    const fields = isImage ? ['imageScale', 'verticalOffset', 'horizontalOffset'] :
      ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'strokeWidth', 'strokeColor', 'warpPreset', 'verticalOffset', 'horizontalOffset'];
    for (const field of fields) if (style[field] !== undefined && style[field] !== null && style[field] !== '') {
      instance[field] = NUMERIC_FIELDS.includes(field) ? Number(style[field]) : style[field];
    }
    add(instance, isImage ? { imageUrl: style.imageUrl, assetKey: `${role}GrfId` } :
      { value: style.text, ...(style.color ? { color: style.color } : {}) });
  }
  return layers;
}
export function extractBldInstances(working: Record<string, any>): BldInstance[] {
  return extractBuilderLayers(working).map(layer => layer.instance);
}

export function sameBldStructure(a: any, b: any): boolean {
  const normalize = (v: any): any => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])])) : v;
  const structure = (v: any) => ({ context: v.context, layoutMode: v.layoutMode, instances: v.instances });
  return JSON.stringify(normalize(structure(a))) === JSON.stringify(normalize(structure(b)));
}

/** Apply only layouts the physical editor can represent, retaining the user's content. */
export function applyBuilderBld(def: any, current: Record<string, any>): Record<string, any> {
  const { id, validationError, ...record } = def;
  const error = validateBldStructure(record);
  if (error) throw new Error(error);
  if (def.isActive === false || def.context !== 'S') throw new Error('Choose an active physical-product BLD.');
  const c = JSON.parse(JSON.stringify(current));
  c.graphicLayoutMode = def.layoutMode === 'P' ? 'freeform' : 'zone';
  c.areaImageUrl = '';
  for (const key of ['headerStyle', 'footerStyle', 'subBottomStyle']) c[key] = { ...c[key], enabled: false };
  const roles = new Set<string>();
  let qrCount = 0;
  for (const slot of def.instances as BldInstance[]) {
    const { seq, type, role, required, ...style } = slot;
    if (type === 'qrc') {
      qrCount++;
      c.qrSizePercent = slot.size ?? 75; c.qrPositionX = slot.positionLR ?? 50; c.qrPositionY = slot.positionUD ?? 50;
    } else if (role === 'area_image' && type === 'img') {
      c.areaImageUrl = current.areaImageUrl || '';
      c.areaImageScale = slot.size ?? 100; c.areaImageOffsetX = slot.positionLR ?? 50; c.areaImageOffsetY = slot.positionUD ?? 50;
    } else if (role && ['header', 'footer', 'sub_bottom'].includes(role) && ['txt', 'img'].includes(type) && !(role === 'sub_bottom' && type === 'img')) {
      const key = role === 'sub_bottom' ? 'subBottomStyle' : `${role}Style`;
      const previous = current[key] || {};
      c[key] = { enabled: true, mode: type === 'img' ? 'image' : 'text', text: previous.text || '',
        imageUrl: previous.imageUrl || '', color: previous.color || '#000000', ...style };
    } else throw new Error(`BLD slot ${seq} cannot be represented by this product editor.`);
    if (role && roles.has(role)) throw new Error(`BLD role ${role} is repeated; this editor supports one per role.`);
    if (role) roles.add(role);
  }
  if (qrCount !== 1) throw new Error('This product editor requires exactly one QR slot.');
  return c;
}
