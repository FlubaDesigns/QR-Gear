// Shared placement types and constants
// Single source of truth for placement handling
// PHILOSOPHY: Placements come from the fulfillment provider API (Printify/Printful).
// We do NOT guess or hardcode placements per category.
// Fallback is always just front + back if the API doesn't return data.

export type PlacementType = "graphic" | "qr";

export type PlacementSize = "small" | "medium" | "large";

export interface PlacementOption {
  id: string;
  label: string;
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

// Placements that can ONLY have QR codes (no full graphics option)
// Uses actual Printify API position names
export const QR_ONLY_PLACEMENTS: string[] = ["left_sleeve", "right_sleeve"];

// Fallback placements when the API doesn't return data.
// Only front and back — the two safest universal placements.
export const FALLBACK_PLACEMENTS: PlacementOption[] = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
];

// Human-readable labels for known Printify/Printful position codes
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

// Get a human-readable label for a placement position
export function getPlacementLabel(position: string): string {
  if (PLACEMENT_LABELS[position]) return PLACEMENT_LABELS[position];
  return position
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
