// ============================================================
// SINGLE SOURCE OF TRUTH for all placement data across the app.
// Admin builder, member wizards, and public wizard all read from here.
// ============================================================
// PHILOSOPHY: Placements come from the fulfillment provider API (Printify/Printful).
// We do NOT guess or hardcode placements per category.
// Fallback is always just front + back if the API doesn't return data.

export type PlacementType = "graphic" | "qr";

export type PlacementSize = "small" | "medium" | "large";

export interface PlacementOption {
  id: string;
  label: string;
  description?: string;
  sizeLabel?: string;
}

export interface PlacementConfig {
  [key: string]: PlacementType;
}

export interface PlacementSizeConfig {
  [key: string]: PlacementSize;
}

// Placements that are auto-handled as branding — never shown to the user as a choice.
// The system automatically attaches the QR Gear branded tag to these.
export const BRANDING_PLACEMENTS: string[] = ["neck"];

// Placements that can ONLY have QR codes (no full graphics option).
// Uses actual Printify/Printful API position names.
export const QR_ONLY_PLACEMENTS: string[] = ["left_sleeve", "right_sleeve"];

// Fallback placements when the API doesn't return data.
// Only front and back — the two safest universal placements.
export const FALLBACK_PLACEMENTS: PlacementOption[] = [
  { id: "front", label: "Front", description: "Large main print", sizeLabel: '12"×16"' },
  { id: "back", label: "Back", description: "Large back print", sizeLabel: '12"×16"' },
];

// Human-readable labels for known Printify/Printful position codes.
// Used by getPlacementLabel() for any placement the API returns.
const PLACEMENT_LABELS: Record<string, string> = {
  'front': 'Front',
  'back': 'Back',
  'neck': 'Neck Label',
  'left_sleeve': 'Left Sleeve',
  'right_sleeve': 'Right Sleeve',
  'front_large': 'Front (Large)',
  'front_small': 'Front (Small)',
  'front_center': 'Front Center',
  'back_center': 'Back Center',
  'pocket': 'Pocket',
  'center': 'Center',
  'left': 'Left Side',
  'right': 'Right Side',
  'side': 'Side',
  'wraparound': 'Wraparound',
};

// Known placement details for wizard UI — descriptions and typical print sizes.
// These are informational only; the actual placements come from the provider API.
const PLACEMENT_DETAILS: Record<string, { description: string; sizeLabel: string }> = {
  'front': { description: 'Large main print', sizeLabel: '12"×16"' },
  'back': { description: 'Large back print', sizeLabel: '12"×16"' },
  'pocket': { description: 'Small logo area', sizeLabel: '4"×4"' },
  'left_sleeve': { description: 'Sleeve print', sizeLabel: '4"×4"' },
  'right_sleeve': { description: 'Sleeve print', sizeLabel: '4"×4"' },
  'front_large': { description: 'Large front print', sizeLabel: '14"×18"' },
  'front_small': { description: 'Small front print', sizeLabel: '8"×8"' },
  'front_center': { description: 'Center front print', sizeLabel: '12"×16"' },
  'back_center': { description: 'Center back print', sizeLabel: '12"×14"' },
  'center': { description: 'Center print', sizeLabel: '10"×10"' },
  'left': { description: 'Left side print', sizeLabel: '10"×10"' },
  'right': { description: 'Right side print', sizeLabel: '10"×10"' },
  'side': { description: 'Side print', sizeLabel: '4"×3.5"' },
  'wraparound': { description: 'Full wrap print', sizeLabel: '9.5"×3.5"' },
};

// Get a human-readable label for a placement position
export function getPlacementLabel(position: string): string {
  if (PLACEMENT_LABELS[position]) return PLACEMENT_LABELS[position];
  return position
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Build a full PlacementOption from a position code (used by wizards and builders)
export function buildPlacementOption(position: string): PlacementOption {
  const details = PLACEMENT_DETAILS[position];
  return {
    id: position,
    label: getPlacementLabel(position),
    description: details?.description || 'Print area',
    sizeLabel: details?.sizeLabel || '',
  };
}

// Check if a placement is QR-only
export function isQrOnlyPlacement(placementId: string): boolean {
  return QR_ONLY_PLACEMENTS.includes(placementId);
}

// Check if a placement is auto-branding (not user-selectable)
export function isBrandingPlacement(placementId: string): boolean {
  return BRANDING_PLACEMENTS.includes(placementId);
}

// Filter out branding placements from a list — returns only user-selectable placements
export function filterSelectablePlacements(placements: PlacementOption[]): PlacementOption[] {
  return placements.filter(p => !isBrandingPlacement(p.id));
}

// Size scaling for different placement areas (used by renderer)
// Large areas get more dramatic size differences, small areas get gradual ones.
export const PLACEMENT_SIZE_SCALES: Record<string, Record<PlacementSize, number>> = {
  "front": { small: 0.6, medium: 0.8, large: 1.0 },
  "back": { small: 0.6, medium: 0.8, large: 1.0 },
  "front_large": { small: 0.6, medium: 0.8, large: 1.0 },
  "front_small": { small: 0.7, medium: 0.85, large: 1.0 },
  "front_center": { small: 0.6, medium: 0.8, large: 1.0 },
  "left_sleeve": { small: 0.7, medium: 0.85, large: 1.0 },
  "right_sleeve": { small: 0.7, medium: 0.85, large: 1.0 },
  "pocket": { small: 0.7, medium: 0.85, large: 1.0 },
  "left": { small: 0.7, medium: 0.85, large: 1.0 },
  "right": { small: 0.7, medium: 0.85, large: 1.0 },
  "center": { small: 0.6, medium: 0.8, large: 1.0 },
  "wraparound": { small: 0.65, medium: 0.8, large: 1.0 },
  "side": { small: 0.7, medium: 0.85, large: 1.0 },
};

// Base dimensions per placement at 300 DPI (width × height in pixels).
// These are the LARGE sizes — small/medium use the scale factors above.
export const PLACEMENT_BASE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "front": { width: 3600, height: 4800 },
  "back": { width: 3600, height: 4200 },
  "front_large": { width: 3600, height: 4800 },
  "front_small": { width: 3000, height: 2400 },
  "front_center": { width: 3600, height: 4800 },
  "back_center": { width: 3600, height: 4200 },
  "pocket": { width: 1200, height: 1200 },
  "left_sleeve": { width: 900, height: 900 },
  "right_sleeve": { width: 900, height: 900 },
  "neck": { width: 750, height: 750 },
  "center": { width: 3000, height: 3000 },
  "left": { width: 3000, height: 3000 },
  "right": { width: 3000, height: 3000 },
  "side": { width: 1200, height: 1050 },
  "wraparound": { width: 2850, height: 1050 },
};

// Fallback dimensions for any placement not in the table above
export const DEFAULT_PLACEMENT_DIMENSIONS = { width: 3000, height: 3000 };
