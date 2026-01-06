/* ==========================================
   MOCKUP FALLBACK CHAIN
   File: client/src/lib/mockup-fallback.ts
   
   Prevents "broken image" UX by providing
   graceful fallback order for mockup URLs.
   ========================================== */

interface MockupsByColor {
  [color: string]: {
    front?: string;
    lifestyle?: string;
    angles?: string[];
  };
}

interface MockupFallbackOptions {
  selectedColor: string | null;
  selectedSize?: string | null;
  mockupsByColor?: MockupsByColor | null;
  defaultMockupImage?: string | null;
  productImageUrl?: string | null;
  placeholderUrl?: string;
}

interface MockupResult {
  url: string | null;
  isLifestyle: boolean;
  source: 'exact' | 'same-color' | 'default' | 'thumbnail' | 'placeholder' | 'none';
}

const DEFAULT_PLACEHOLDER = '/placeholder-product.png';

function isValidUrl(url?: string | null): boolean {
  return !!(url && url.length > 0 && (url.startsWith('http') || url.startsWith('/api/files') || url.startsWith('/')));
}

function normalizeColor(c: string): string {
  return c.replace(/^(Solid|Heather)\s+/i, '').toLowerCase().trim();
}

export function getMockupWithFallback(options: MockupFallbackOptions): MockupResult {
  const {
    selectedColor,
    mockupsByColor,
    defaultMockupImage,
    productImageUrl,
    placeholderUrl = DEFAULT_PLACEHOLDER,
  } = options;

  // 1. Exact match for selected color
  if (selectedColor && mockupsByColor?.[selectedColor]) {
    const m = mockupsByColor[selectedColor];
    if (isValidUrl(m.lifestyle)) {
      return { url: m.lifestyle!, isLifestyle: true, source: 'exact' };
    }
    if (isValidUrl(m.front)) {
      return { url: m.front!, isLifestyle: false, source: 'exact' };
    }
  }

  // 2. Normalized color match (e.g., "Solid Black" matches "Black")
  if (selectedColor && mockupsByColor) {
    const normalizedTarget = normalizeColor(selectedColor);
    for (const [mockupColor, mockup] of Object.entries(mockupsByColor)) {
      if (normalizeColor(mockupColor) === normalizedTarget) {
        if (isValidUrl(mockup.lifestyle)) {
          return { url: mockup.lifestyle!, isLifestyle: true, source: 'same-color' };
        }
        if (isValidUrl(mockup.front)) {
          return { url: mockup.front!, isLifestyle: false, source: 'same-color' };
        }
      }
    }
  }

  // 3. Any available mockup (first valid one)
  if (mockupsByColor) {
    for (const mockup of Object.values(mockupsByColor)) {
      if (isValidUrl(mockup.lifestyle)) {
        return { url: mockup.lifestyle!, isLifestyle: true, source: 'default' };
      }
      if (isValidUrl(mockup.front)) {
        return { url: mockup.front!, isLifestyle: false, source: 'default' };
      }
    }
  }

  // 4. Default mockup image
  if (isValidUrl(defaultMockupImage)) {
    return { url: defaultMockupImage!, isLifestyle: false, source: 'default' };
  }

  // 5. Product thumbnail
  if (isValidUrl(productImageUrl)) {
    return { url: productImageUrl!, isLifestyle: false, source: 'thumbnail' };
  }

  // 6. Placeholder
  if (placeholderUrl) {
    return { url: placeholderUrl, isLifestyle: false, source: 'placeholder' };
  }

  return { url: null, isLifestyle: false, source: 'none' };
}

export function getColorMockupUrl(
  color: string,
  mockupsByColor?: MockupsByColor | null,
  preferLifestyle = true
): string | null {
  if (!mockupsByColor) return null;

  // Exact match
  if (mockupsByColor[color]) {
    const m = mockupsByColor[color];
    if (preferLifestyle && isValidUrl(m.lifestyle)) return m.lifestyle!;
    if (isValidUrl(m.front)) return m.front!;
    if (isValidUrl(m.lifestyle)) return m.lifestyle!;
  }

  // Normalized match
  const normalizedTarget = normalizeColor(color);
  for (const [mockupColor, mockup] of Object.entries(mockupsByColor)) {
    if (normalizeColor(mockupColor) === normalizedTarget) {
      if (preferLifestyle && isValidUrl(mockup.lifestyle)) return mockup.lifestyle!;
      if (isValidUrl(mockup.front)) return mockup.front!;
      if (isValidUrl(mockup.lifestyle)) return mockup.lifestyle!;
    }
  }

  return null;
}
