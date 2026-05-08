/**
 * shared/VVSS_engine.ts
 *
 * Single source of truth for the VVSS (Viewer / View / Skin / Shape) UI architecture.
 *
 * Every repeating data surface in the app is described by a four-digit VVSS code:
 *   [Viewer][View][Skin][Shape]
 *
 * This engine defines:
 *   — All valid codes and their component names
 *   — The SkinItem contract and all prop interfaces
 *   — Code parser, builder, and validator
 *   — Naming convention helpers
 *   — Folder path constants
 *
 * Import from here everywhere. Never define VVSS types or codes in component files.
 *
 * See VVSS.md for the full spec. See ARCHITECTURE_VIEWER.md for the binding law.
 */

// ── Digit 1 — Viewer (pane structure) ─────────────────────────────────────────

export const VIEWER_CODES = {
  '1': { component: 'SinglePaneViewer', description: 'One full-width pane' },
  '2': { component: 'TwoPaneViewer',    description: 'Side by side — list left, detail right' },
} as const;

export type ViewerCode = keyof typeof VIEWER_CODES;

// ── Digit 2 — View (scroll / layout) ──────────────────────────────────────────

export const VIEW_CODES = {
  '0': { component: 'SingleView',   description: 'No scroll — one focused item or workspace' },
  '1': { component: 'VScrollView',  description: 'Vertical scroll — grid or list' },
  '2': { component: 'HScrollView',  description: 'Horizontal scroll — rail or strip' },
  '3': { component: 'SlideView',    description: 'Paginated — one item at a time, step forward/back' },
  '4': { component: 'TableView',    description: 'Data rows with columns' },
  '5': { component: 'FocusView',    description: 'One dominant item + supporting context' },
} as const;

export type ViewCode = keyof typeof VIEW_CODES;

// ── Digit 3 — Skin (card component) ───────────────────────────────────────────

export const SKIN_CODES = {
  '1': { pattern: '[DataType]CardSkin', description: 'Standard card — image, name, metadata' },
  '2': { pattern: '[DataType]RowSkin',  description: 'Compact horizontal row — text-focused' },
} as const;

export type SkinCode = keyof typeof SKIN_CODES;

// ── Digit 4 — Shape (popup layer) ─────────────────────────────────────────────

export const SHAPE_CODES = {
  '0': { description: 'Flat — no popup, the Skin is the whole experience' },
  '1': { description: 'Popup — the Skin renders ModalView containing a named [DataType]Shape' },
} as const;

export type ShapeCode = keyof typeof SHAPE_CODES;

// ── VVSS four-digit code ───────────────────────────────────────────────────────

export interface VvssCode {
  viewer: ViewerCode;
  view:   ViewCode;
  skin:   SkinCode;
  shape:  ShapeCode;
}

export function parseVvssCode(code: string): VvssCode {
  if (!/^\d{4}$/.test(code)) throw new Error(`Invalid VVSS code "${code}": must be exactly 4 digits`);
  const [viewer, view, skin, shape] = code.split('') as [ViewerCode, ViewCode, SkinCode, ShapeCode];
  if (!VIEWER_CODES[viewer]) throw new Error(`Invalid VVSS viewer digit "${viewer}"`);
  if (!VIEW_CODES[view])     throw new Error(`Invalid VVSS view digit "${view}"`);
  if (!SKIN_CODES[skin])     throw new Error(`Invalid VVSS skin digit "${skin}"`);
  if (!SHAPE_CODES[shape])   throw new Error(`Invalid VVSS shape digit "${shape}"`);
  return { viewer, view, skin, shape };
}

export function buildVvssCode(viewer: ViewerCode, view: ViewCode, skin: SkinCode, shape: ShapeCode): string {
  return `${viewer}${view}${skin}${shape}`;
}

export function isValidVvssCode(code: string): boolean {
  try { parseVvssCode(code); return true; } catch { return false; }
}

// ── Naming convention helpers ──────────────────────────────────────────────────

export function skinComponentName(dataType: string, skinCode: SkinCode): string {
  return skinCode === '1' ? `${dataType}CardSkin` : `${dataType}RowSkin`;
}

export function shapeComponentName(dataType: string): string {
  return `${dataType}Shape`;
}

export function skinFileName(dataType: string): string {
  return `skins/${dataType}Skin.tsx`;
}

export function shapeFileName(dataType: string): string {
  return `shapes/${dataType}Shape.tsx`;
}

// ── Folder path constants ──────────────────────────────────────────────────────

export const VVSS_FOLDERS = {
  viewers: 'client/src/features/shared/components/viewers/',
  views:   'client/src/features/shared/components/views/',
  skins:   'client/src/features/shared/components/skins/',
  shapes:  'client/src/features/shared/components/shapes/',
} as const;

// ── SkinItem contract ──────────────────────────────────────────────────────────
// All items passed into any Skin must conform to SkinItem.
// Controllers extend SkinItem with domain-specific fields.
// Skins may read domain fields but must never write back.

export interface SkinItem {
  id:             string;
  name:           string;
  primaryImage?:  string | null;
  secondaryImage?: string | null;
  dimensions?:    string | null;
  metadata?:      Record<string, unknown>;
  [key: string]:  unknown;
}

// ── Action contracts ───────────────────────────────────────────────────────────

export interface SkinActions {
  onEdit?:    (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?:  (id: string) => void;
  onSelect?:  (id: string) => void;
  onCrop?:    (id: string) => void;
}

// ── Prop interfaces ────────────────────────────────────────────────────────────
// Every Skin and Shape receives one of these. Import from here — never redefine.

export interface SkinProps {
  item:            SkinItem;
  actions?:        SkinActions;
  isActionPending?: boolean;
}

export interface CardSkinProps extends SkinProps {
  onClick?:    () => void;
  isSelected?: boolean;
}

export interface DetailSkinProps extends SkinProps {
  onClose?: () => void;
  onPrev?:  () => void;
  onNext?:  () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}
