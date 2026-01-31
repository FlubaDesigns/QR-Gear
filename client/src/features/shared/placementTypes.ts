// Shared placement types and constants
// Single source of truth - imported by test-products, test-members, and anywhere else

export type PlacementId = 
  // Shirts/Hoodies
  | "front-chest" | "front-center" | "back" | "left-shoulder" | "right-shoulder" | "pocket"
  // Mugs
  | "mug-wrap" | "mug-front" | "mug-back"
  // Hats
  | "hat-front" | "hat-side" | "hat-back"
  // Bags
  | "bag-front" | "bag-back" | "bag-pocket";

export type PlacementType = "graphic" | "qr";

export type PlacementSize = "small" | "medium" | "large";

export interface PlacementOption {
  id: PlacementId;
  label: string;
}

export interface PlacementConfig {
  [key: string]: PlacementType;
}

export interface PlacementSizeConfig {
  [key: string]: PlacementSize;
}

// Placements that can ONLY have QR codes (no graphics option)
export const QR_ONLY_PLACEMENTS: PlacementId[] = ["left-shoulder", "right-shoulder"];

// All available placements with labels
export const ALL_PLACEMENT_OPTIONS: PlacementOption[] = [
  // Shirts/Hoodies
  { id: "front-chest", label: "Front Chest" },
  { id: "front-center", label: "Front Center" },
  { id: "back", label: "Back" },
  { id: "left-shoulder", label: "Left Shoulder (QR Only)" },
  { id: "right-shoulder", label: "Right Shoulder (QR Only)" },
  { id: "pocket", label: "Pocket" },
  // Mugs
  { id: "mug-wrap", label: "Wrap Around" },
  { id: "mug-front", label: "Front" },
  { id: "mug-back", label: "Back" },
  // Hats
  { id: "hat-front", label: "Front" },
  { id: "hat-side", label: "Side" },
  { id: "hat-back", label: "Back" },
  // Bags
  { id: "bag-front", label: "Front Panel" },
  { id: "bag-back", label: "Back Panel" },
  { id: "bag-pocket", label: "Pocket" },
];

// Category to placement mapping
export const CATEGORY_PLACEMENTS: Record<string, PlacementId[]> = {
  "T-Shirts": ["front-chest", "front-center", "back", "left-shoulder", "right-shoulder"],
  "Sweatshirts & Hoodies": ["front-chest", "front-center", "back", "left-shoulder", "right-shoulder", "pocket"],
  "Long Sleeve Shirts": ["front-chest", "front-center", "back", "left-shoulder", "right-shoulder"],
  "Tank Tops": ["front-chest", "front-center", "back"],
  "Drinkware": ["mug-wrap", "mug-front", "mug-back"],
  "Mugs": ["mug-wrap", "mug-front", "mug-back"],
  "Tumblers": ["mug-wrap", "mug-front", "mug-back"],
  "Hats & Caps": ["hat-front", "hat-side", "hat-back"],
  "Hats": ["hat-front", "hat-side", "hat-back"],
  "Beanies": ["hat-front"],
  "Bags": ["bag-front", "bag-back", "bag-pocket"],
  "Tote Bags": ["bag-front", "bag-back"],
  "Backpacks": ["bag-front", "bag-pocket"],
};

// Default placements for unknown categories
export const DEFAULT_PLACEMENTS: PlacementId[] = ["front-chest", "front-center", "back"];

// Helper to normalize category names
function normalizeCategory(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("t-shirt") || lower.includes("tshirt") || lower.includes("tee")) return "T-Shirts";
  if (lower.includes("long sleeve")) return "Long Sleeve Shirts";
  if (lower.includes("sweatshirt") || lower.includes("hoodie")) return "Sweatshirts & Hoodies";
  if (lower.includes("tank")) return "Tank Tops";
  if (lower.includes("drinkware") || lower.includes("mug") || lower.includes("tumbler")) return "Drinkware";
  if (lower.includes("hat") || lower.includes("cap")) return "Hats & Caps";
  if (lower.includes("beanie")) return "Hats & Caps";
  if (lower.includes("bag")) return "Bags";
  return category;
}

// Get placements for a category
export function getPlacementsForCategory(category: string | null): PlacementOption[] {
  if (!category) {
    return DEFAULT_PLACEMENTS
      .map(id => ALL_PLACEMENT_OPTIONS.find(opt => opt.id === id))
      .filter((opt): opt is PlacementOption => opt !== undefined);
  }
  
  const normalized = normalizeCategory(category);
  const placementIds = CATEGORY_PLACEMENTS[normalized] || DEFAULT_PLACEMENTS;
  return placementIds
    .map(id => ALL_PLACEMENT_OPTIONS.find(opt => opt.id === id))
    .filter((opt): opt is PlacementOption => opt !== undefined);
}

// Check if a placement is QR-only
export function isQrOnlyPlacement(placementId: string): boolean {
  return (QR_ONLY_PLACEMENTS as string[]).includes(placementId);
}
