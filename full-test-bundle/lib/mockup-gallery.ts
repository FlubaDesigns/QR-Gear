export interface GalleryImage {
  url: string;
  alt?: string;
  label?: string;
}

export interface MockupData {
  front?: string;
  lifestyle?: string;
  angles?: string[];
}

export interface MockupsByColor {
  [color: string]: MockupData;
}

export interface ProductForGallery {
  name?: string;
  imageUrl?: string | null;
  defaultMockupImage?: string | null;
  mockupsByColor?: MockupsByColor | null;
}

export function buildMockupGalleryImages(
  product: ProductForGallery | null | undefined,
  selectedColor: string | null | undefined,
  localMockups?: Record<string, MockupData>
): GalleryImage[] {
  const images: GalleryImage[] = [];
  
  if (!product) return images;
  
  const color = selectedColor || Object.keys(product.mockupsByColor || {})[0];
  
  if (color) {
    const localMockup = localMockups?.[color];
    const productMockup = product.mockupsByColor?.[color];
    const mockups = localMockup || productMockup;
    
    if (mockups?.lifestyle) {
      images.push({ 
        url: mockups.lifestyle, 
        label: "Lifestyle", 
        alt: `${product.name || 'Product'} - ${color} lifestyle view` 
      });
    }
    
    if (mockups?.front) {
      images.push({ 
        url: mockups.front, 
        label: "Front", 
        alt: `${product.name || 'Product'} - ${color} front view` 
      });
    }
    
    if (mockups?.angles && Array.isArray(mockups.angles)) {
      mockups.angles.forEach((angle, i) => {
        images.push({ 
          url: angle, 
          label: `View ${i + 2}`, 
          alt: `${product.name || 'Product'} - ${color} angle ${i + 2}` 
        });
      });
    }
  }
  
  if (images.length === 0) {
    if (product.defaultMockupImage) {
      images.push({ url: product.defaultMockupImage, label: "Product" });
    } else if (product.imageUrl) {
      images.push({ url: product.imageUrl, label: "Product" });
    }
  }
  
  return images;
}
