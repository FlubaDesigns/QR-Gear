/**
 * Local Mockup Generator
 * Composites QR artwork onto shirt template images
 * Does NOT depend on Printify - generates mockups locally
 */

import { createCanvas, loadImage } from 'canvas';
// @ts-ignore - object storage may not have type declarations
import { Client as ObjectStorageClient } from "@replit/object-storage";

interface MockupConfig {
  shirtColor: string;
  shirtHex: string;
  artworkUrl: string;
  artworkVariant: 'black' | 'white';
}

interface GeneratedMockup {
  flatUrl: string;
  lifestyleUrl: string | null;
}

const SHIRT_TEMPLATES: Record<string, { light: string; dark: string }> = {
  'default': {
    light: 'https://images.printify.com/api/catalog/6243def5557712315a70b714.jpg',
    dark: 'https://images.printify.com/api/catalog/6243def5557712315a70b714.jpg'
  }
};

const PLACEMENT_CONFIG = {
  'front-chest': {
    x: 0.5,
    y: 0.35,
    scale: 0.25,
  }
};

export async function generateLocalMockup(
  config: MockupConfig,
  blueprintId: number,
  printProviderId: number
): Promise<GeneratedMockup | null> {
  try {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';
    
    const artworkFullUrl = config.artworkUrl.startsWith('http') 
      ? config.artworkUrl 
      : `${baseUrl}${config.artworkUrl}`;

    console.log(`[LocalMockup] Loading artwork from: ${artworkFullUrl}`);
    
    const artworkImg = await loadImage(artworkFullUrl);
    
    const canvasWidth = 800;
    const canvasHeight = 1000;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = config.shirtHex || '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    const shirtShape = createShirtShape(ctx as any, canvasWidth, canvasHeight, config.shirtHex);
    
    const placement = PLACEMENT_CONFIG['front-chest'];
    const artworkSize = Math.min(canvasWidth, canvasHeight) * placement.scale;
    const artworkX = canvasWidth * placement.x - artworkSize / 2;
    const artworkY = canvasHeight * placement.y - artworkSize / 2;
    
    ctx.drawImage(artworkImg, artworkX, artworkY, artworkSize, artworkSize);
    
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
    
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      console.error('[LocalMockup] No bucket ID configured');
      return null;
    }
    
    const client = new ObjectStorageClient({ bucketId });
    const colorSlug = config.shirtColor.toLowerCase().replace(/\s+/g, '-');
    const filename = `local-mockup-${blueprintId}-${printProviderId}-${colorSlug}.jpg`;
    const fullPath = `custom-designs/${filename}`;
    
    await client.uploadFromBytes(fullPath, buffer);
    
    const publicUrl = `/api/files/${filename}`;
    console.log(`[LocalMockup] Generated mockup: ${publicUrl}`);
    
    return {
      flatUrl: publicUrl,
      lifestyleUrl: null
    };
  } catch (err) {
    console.error('[LocalMockup] Failed to generate mockup:', err);
    return null;
  }
}

function createShirtShape(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
): void {
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, width, height);
  
  ctx.fillStyle = color;
  ctx.beginPath();
  
  const neckWidth = width * 0.15;
  const shoulderWidth = width * 0.9;
  const sleeveLength = width * 0.2;
  const bodyTop = height * 0.15;
  const bodyBottom = height * 0.95;
  
  ctx.moveTo(width * 0.5 - neckWidth / 2, bodyTop);
  
  ctx.lineTo(width * 0.05, bodyTop + height * 0.05);
  ctx.lineTo(width * 0.05 - sleeveLength * 0.3, bodyTop + height * 0.2);
  ctx.lineTo(width * 0.05, bodyTop + height * 0.25);
  
  ctx.lineTo(width * 0.1, bodyBottom);
  ctx.lineTo(width * 0.9, bodyBottom);
  
  ctx.lineTo(width * 0.95, bodyTop + height * 0.25);
  ctx.lineTo(width * 0.95 + sleeveLength * 0.3, bodyTop + height * 0.2);
  ctx.lineTo(width * 0.95, bodyTop + height * 0.05);
  
  ctx.lineTo(width * 0.5 + neckWidth / 2, bodyTop);
  
  ctx.arc(width * 0.5, bodyTop, neckWidth / 2, 0, Math.PI, true);
  
  ctx.closePath();
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export async function generateAllColorMockups(
  blueprintId: number,
  printProviderId: number,
  colors: Array<{ name: string; hex: string }>,
  artworkBlackUrl: string,
  artworkWhiteUrl: string
): Promise<Record<string, { front: string; lifestyle: string | null }>> {
  const results: Record<string, { front: string; lifestyle: string | null }> = {};
  
  for (const color of colors) {
    const isDark = isColorDark(color.hex);
    const artworkUrl = isDark ? artworkWhiteUrl : artworkBlackUrl;
    const artworkVariant = isDark ? 'white' : 'black';
    
    console.log(`[LocalMockup] Generating for ${color.name} (${isDark ? 'dark' : 'light'} shirt, ${artworkVariant} QR)`);
    
    const mockup = await generateLocalMockup({
      shirtColor: color.name,
      shirtHex: color.hex,
      artworkUrl,
      artworkVariant
    }, blueprintId, printProviderId);
    
    if (mockup) {
      results[color.name] = {
        front: mockup.flatUrl,
        lifestyle: mockup.lifestyleUrl
      };
    }
  }
  
  return results;
}

function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  
  return luminance < 0.5;
}
