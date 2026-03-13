import { storage } from "../storage";
import { printify } from "./printify";
import type { PrintifyPrintProvider, PrintifyVariant, PrintifyBlueprint, PrintifyProduct, PrintifyOrderLineItem, PrintifyOrderAddress, CreateOrderRequest } from "./printify";

export async function getUSAPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
  const providers = await printify.getPrintProviders(blueprintId);
  return providers.filter(p => p.location?.country === 'US' || p.location?.country === 'USA');
}

interface PrintArea {
  position: string;
  width: number;
  height: number;
}

interface PlacementInfo {
  position: string;
  label: string;
  printArea: PrintArea;
}

// Fetch available print areas/placements for a blueprint/provider combo
export async function syncProductPlacements(blueprintId: number, printProviderId: number): Promise<{
  placements: PlacementInfo[];
  mockupImageUrl: string | null;
}> {
  try {
    const result = await printify.getVariants(blueprintId, printProviderId);
    const variants = result.variants || [];
    
    // Extract unique placements from variant placeholders
    const placementMap = new Map<string, PlacementInfo>();
    
    for (const variant of variants) {
      if (variant.placeholders) {
        for (const placeholder of variant.placeholders) {
          const position = placeholder.position;
          if (!placementMap.has(position)) {
            placementMap.set(position, {
              position,
              label: formatPlacementLabel(position),
              printArea: {
                position,
                width: placeholder.width,
                height: placeholder.height,
              },
            });
          }
        }
      }
    }
    
    const placements = Array.from(placementMap.values());
    
    // Get blueprint details for mockup image
    const blueprint = await printify.getBlueprintDetails(blueprintId);
    const mockupImageUrl = blueprint.images?.[0] || null;
    
    return { placements, mockupImageUrl };
  } catch (error) {
    console.error('Error syncing product placements:', error);
    return { placements: [], mockupImageUrl: null };
  }
}

// Convert Printify position codes to human-readable labels
function formatPlacementLabel(position: string): string {
  const labelMap: Record<string, string> = {
    'front': 'Front',
    'back': 'Back',
    'left': 'Left Side',
    'right': 'Right Side',
    'front_large': 'Front (Large)',
    'front_small': 'Front (Small)',
    'sleeve_left': 'Left Sleeve',
    'sleeve_right': 'Right Sleeve',
    'pocket': 'Pocket',
    'center': 'Center',
    'front_center': 'Front Center',
    'back_center': 'Back Center',
    'side': 'Side',
    'wraparound': 'Wraparound',
  };
  
  if (labelMap[position]) return labelMap[position];
  
  // Auto-format: replace underscores, capitalize words
  return position
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get provider colors with automatic fallback to Printify API
 * 1. First checks local database (printify_print_providers table)
 * 2. If colors are missing or empty, calls Printify API to fetch them
 * 3. Saves fetched colors to local database for future use
 * 4. Returns colors with hex values
 */
export async function getProviderColorsWithFallback(
  blueprintId: number,
  printProviderId: number,
  storage: any // Passed in to avoid circular dependency
): Promise<Array<{ name: string; hex: string }>> {
  // Step 1: Check local database first
  const localProvider = await storage.getPrintifyPrintProvider(blueprintId, printProviderId);
  
  if (localProvider?.availableColors && Array.isArray(localProvider.availableColors)) {
    const colors = localProvider.availableColors as Array<{ name: string; hex: string }>;
    // Check if colors have hex values
    const hasHexValues = colors.some(c => c.hex);
    if (colors.length > 0 && hasHexValues) {
      console.log(`[ColorFallback] Using local colors for ${blueprintId}/${printProviderId}: ${colors.length} colors`);
      return colors;
    }
  }
  
  // Step 2: Colors not in local database or missing hex - fetch from Printify
  console.log(`[ColorFallback] Local colors missing for ${blueprintId}/${printProviderId}, calling Printify API...`);
  
  try {
    const { colors, sizes } = await syncProductVariants(blueprintId, printProviderId);
    
    // Step 3: Save to local database for future use
    if (colors.length > 0) {
      await storage.updatePrintifyProviderCosts(blueprintId, printProviderId, {
        availableColors: colors,
        availableSizes: sizes,
      });
      console.log(`[ColorFallback] Saved ${colors.length} colors from Printify to local database`);
    }
    
    return colors;
  } catch (error: any) {
    console.error(`[ColorFallback] Printify API call failed: ${error.message}`);
    // Return empty array if API fails
    return [];
  }
}

// Fetch colors and sizes from Printify for a blueprint/provider combo
export async function syncProductVariants(blueprintId: number, printProviderId: number): Promise<{
  colors: Array<{ name: string; hex: string }>;
  sizes: string[];
  variants: PrintifyVariant[];
}> {
  const result = await printify.getVariants(blueprintId, printProviderId);
  const variants = result.variants || [];
  
  // Extract unique colors with their hex codes
  const colorMap = new Map<string, string>();
  const sizeSet = new Set<string>();
  
  for (const variant of variants) {
    if (variant.options?.color) {
      // Printify color format varies - extract name and try to map hex
      const colorName = variant.options.color;
      if (!colorMap.has(colorName)) {
        // Try to extract hex from variant if available, otherwise use common mapping
        const hex = getColorHex(colorName);
        colorMap.set(colorName, hex);
      }
    }
    if (variant.options?.size) {
      sizeSet.add(variant.options.size);
    }
  }
  
  // Convert to arrays
  const colors = Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }));
  
  // Sort sizes in logical order
  const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '11oz', '15oz'];
  const sizes = Array.from(sizeSet).sort((a, b) => {
    const aIdx = sizeOrder.indexOf(a);
    const bIdx = sizeOrder.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
  
  return { colors, sizes, variants };
}

// Comprehensive color name to hex mapping for Printify apparel
function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    // Basic colors
    'White': '#FFFFFF',
    'Black': '#000000',
    'Red': '#DC2626',
    'Blue': '#2563EB',
    'Green': '#16A34A',
    'Yellow': '#FACC15',
    'Orange': '#F97316',
    'Purple': '#9333EA',
    'Pink': '#EC4899',
    'Brown': '#92400E',
    'Gray': '#6B7280',
    'Grey': '#6B7280',
    
    // Heather variants
    'Heather Gray': '#9CA3AF',
    'Heather Grey': '#9CA3AF',
    'Athletic Heather': '#9CA3AF',
    'Dark Heather': '#374151',
    'Dark Grey Heather': '#4B5563',
    'Heather Navy': '#1E3A5F',
    'Heather Peach': '#FBBF94',
    'Heather Mauve': '#C4A5A5',
    'Heather Olive': '#6B7355',
    'Heather Red': '#B91C1C',
    'Heather Blue': '#60A5FA',
    'Heather Green': '#22C55E',
    'Heather Purple': '#A855F7',
    'Heather Prism Dusty Blue': '#7DA7BC',
    'Heather Prism Ice Blue': '#B8D4E3',
    'Heather Prism Mint': '#98E4D2',
    'Heather Prism Peach': '#F5C8A3',
    'Heather Prism Lilac': '#D8B4E2',
    'Heather Raspberry': '#9B1B57',
    'Heather Midnight Navy': '#1E3A5F',
    'Heather True Royal': '#3B5DC9',
    'Heather Deep Teal': '#0D5C63',
    'Heather Forest': '#1D4D2B',
    
    // Sport/Athletic
    'Sport Gray': '#6B7280',
    'Sport Grey': '#6B7280',
    
    // Blues
    'Navy': '#1E3A5F',
    'Navy Blue': '#1E3A5F',
    'Midnight Navy': '#1A2744',
    'True Navy': '#1E3A5F',
    'Royal': '#4169E1',
    'Royal Blue': '#4169E1',
    'True Royal': '#4169E1',
    'Light Blue': '#93C5FD',
    'Sky Blue': '#87CEEB',
    'Carolina Blue': '#56A0D3',
    'Ocean': '#006994',
    'Ocean Blue': '#006994',
    'Teal': '#0D9488',
    'Deep Teal': '#0D5C63',
    'Sapphire': '#0F52BA',
    'Indigo': '#4B0082',
    'Aqua': '#06B6D4',
    'Turquoise': '#40E0D0',
    'Cobalt': '#0047AB',
    'Steel Blue': '#4682B4',
    'Slate': '#708090',
    'Denim': '#1560BD',
    
    // Greens
    'Forest Green': '#228B22',
    'Dark Green': '#006400',
    'Kelly Green': '#4CBB17',
    'Irish Green': '#009A44',
    'Turf Green': '#3C8D0D',
    'Military Green': '#4B5320',
    'Olive': '#6B8E23',
    'Olive Drab': '#6B8E23',
    'Sage': '#9CAF88',
    'Mint': '#98FB98',
    'Seafoam': '#71EEB8',
    'Lime': '#84CC16',
    'Leaf': '#568203',
    'Hunter Green': '#355E3B',
    
    // Reds & Pinks
    'Cardinal': '#C41E3A',
    'Cardinal Red': '#C41E3A',
    'Maroon': '#800000',
    'Burgundy': '#722F37',
    'Crimson': '#DC143C',
    'Cherry Red': '#DE3163',
    'Light Pink': '#FFB6C1',
    'Hot Pink': '#FF69B4',
    'Fuchsia': '#FF00FF',
    'Magenta': '#FF00FF',
    'Berry': '#8E4585',
    'Coral': '#FF7F50',
    'Salmon': '#FA8072',
    'Rose': '#FF007F',
    'Heliconia': '#E31557',
    'Azalea': '#FF3399',
    
    // Purples
    'Violet': '#8B5CF6',
    'Lavender': '#E6E6FA',
    'Plum': '#8E4585',
    'Lilac': '#C8A2C8',
    'Orchid': '#DA70D6',
    'Purple Rush': '#652DC1',
    'Team Purple': '#652DC1',
    
    // Browns & Neutrals
    'Charcoal': '#36454F',
    'Natural': '#F5F5DC',
    'Cream': '#FFFDD0',
    'Solid Cream': '#FFFDD0',
    'Beige': '#F5F5DC',
    'Sand': '#C2B280',
    'Tan': '#D2B48C',
    'Khaki': '#C3B091',
    'Chocolate': '#7B3F00',
    'Dark Chocolate': '#3D1C02',
    'Solid Dark Chocolate': '#3D1C02',
    'Coffee': '#6F4E37',
    'Espresso': '#3C2218',
    'Chestnut': '#954535',
    'Coyote Brown': '#81613C',
    'Russet': '#80461B',
    
    // Grays
    'Ice Grey': '#D3D3D3',
    'Ice Gray': '#D3D3D3',
    'Light Gray': '#D1D5DB',
    'Light Grey': '#D1D5DB',
    'Silver': '#C0C0C0',
    'Ash': '#B2BEB5',
    'Graphite': '#383838',
    'Charcoal Heather': '#4B5563',
    'Heavy Metal': '#2E3339',
    'Solid Heavy Metal': '#2E3339',
    'Smoke': '#738276',
    'Storm': '#4F5D75',
    
    // Golds & Yellows
    'Gold': '#FFD700',
    'Daisy': '#FFD93D',
    'Sunshine': '#FFD93D',
    'Lemon': '#FFF44F',
    'Banana': '#FFE135',
    'Mustard': '#FFDB58',
    'Honey': '#EB9605',
    
    // Oranges
    'Burnt Orange': '#CC5500',
    'Tangerine': '#FF9966',
    'Sunset': '#FAD6A5',
    'Peach': '#FFCBA4',
    'Apricot': '#FBCEB1',
    'Tennessee Orange': '#FF8200',
    'Texas Orange': '#BF5700',
    
    // Solid prefix variants (Printify uses these)
    'Solid Black': '#000000',
    'Solid White': '#FFFFFF',
    'Solid Red': '#DC2626',
    'Solid Navy': '#1E3A5F',
    'Solid Natural': '#F5F5DC',
    'Solid Kelly Green': '#4CBB17',
    'Solid Light Blue': '#93C5FD',
    'Solid Light Grey': '#D1D5DB',
    'Solid Light Gray': '#D1D5DB',
    'Solid Light Pink': '#FFB6C1',
    'Solid Midnight Navy': '#1A2744',
    'Solid Military Green': '#4B5320',
    'Solid Purple Rush': '#652DC1',
    'Solid Royal': '#4169E1',
    'Solid Turquoise': '#40E0D0',
    'Solid Cardinal Red': '#C41E3A',
  };
  
  // Try exact match first
  if (colorMap[colorName]) return colorMap[colorName];
  
  // Try case-insensitive match
  const lowerName = colorName.toLowerCase();
  for (const [key, value] of Object.entries(colorMap)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  
  // Try partial match for compound names (e.g., "Heather Prism Dusty Blue" matches "Dusty Blue")
  for (const [key, value] of Object.entries(colorMap)) {
    if (lowerName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerName)) {
      return value;
    }
  }
  
  // Intelligent fallback based on color keywords in name
  if (lowerName.includes('black')) return '#000000';
  if (lowerName.includes('white')) return '#FFFFFF';
  if (lowerName.includes('navy')) return '#1E3A5F';
  if (lowerName.includes('red')) return '#DC2626';
  if (lowerName.includes('blue')) return '#2563EB';
  if (lowerName.includes('green')) return '#16A34A';
  if (lowerName.includes('yellow')) return '#FACC15';
  if (lowerName.includes('orange')) return '#F97316';
  if (lowerName.includes('purple')) return '#9333EA';
  if (lowerName.includes('pink')) return '#EC4899';
  if (lowerName.includes('gray') || lowerName.includes('grey')) return '#6B7280';
  if (lowerName.includes('brown') || lowerName.includes('chocolate')) return '#92400E';
  if (lowerName.includes('heather')) return '#9CA3AF';
  
  // Default to neutral gray for truly unknown colors
  return '#808080';
}

// Category detection from product title/brand
function detectCategory(title: string, brand: string): string {
  const combined = `${title} ${brand}`.toLowerCase();
  
  if (combined.includes('hat') || combined.includes('cap') || combined.includes('beanie')) {
    return 'hats';
  }
  if (combined.includes('mug') || combined.includes('cup') || combined.includes('tumbler')) {
    return 'drinkware';
  }
  if (combined.includes('bag') || combined.includes('tote') || combined.includes('backpack')) {
    return 'bags';
  }
  if (combined.includes('hoodie') || combined.includes('sweatshirt')) {
    return 'hoodies';
  }
  if (combined.includes('tank')) {
    return 'tanks';
  }
  if (combined.includes('polo')) {
    return 'polos';
  }
  if (combined.includes('long sleeve')) {
    return 'long-sleeves';
  }
  if (combined.includes('shirt') || combined.includes('tee') || combined.includes('t-shirt')) {
    return 't-shirts';
  }
  if (combined.includes('sticker') || combined.includes('decal')) {
    return 'stickers';
  }
  if (combined.includes('poster') || combined.includes('print') || combined.includes('canvas')) {
    return 'wall-art';
  }
  if (combined.includes('phone') || combined.includes('case')) {
    return 'phone-cases';
  }
  
  return 'other';
}

export { detectCategory };
