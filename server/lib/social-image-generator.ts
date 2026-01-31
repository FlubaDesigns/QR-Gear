import { createCanvas, loadImage } from "canvas";
import { uploadImageFromBuffer } from './image-upload';

export interface SocialImageOptions {
  title: string;
  description?: string;
  previewImageUrl?: string;
  packetId: string;
  shareUrl: string;
}

export interface SocialImageResult {
  squareUrl?: string;
  linkPreviewUrl?: string;
  storyUrl?: string;
}

const BRAND_COLOR = '#6366f1';
const DARK_BG = '#1f2937';
const LIGHT_TEXT = '#ffffff';
const MUTED_TEXT = '#9ca3af';

async function loadImageSafe(url: string): Promise<any | null> {
  try {
    return await loadImage(url);
  } catch (error) {
    console.error('[SocialImageGenerator] Failed to load image:', url, error);
    return null;
  }
}

export async function generateSquareImage(options: SocialImageOptions): Promise<Buffer> {
  const { title, description, previewImageUrl } = options;
  
  const SIZE = 1080;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  
  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, SIZE, SIZE);
  
  let previewImg = previewImageUrl ? await loadImageSafe(previewImageUrl) : null;
  
  if (previewImg) {
    const imgSize = Math.min(previewImg.width, previewImg.height);
    const sx = (previewImg.width - imgSize) / 2;
    const sy = (previewImg.height - imgSize) / 2;
    
    ctx.globalAlpha = 0.4;
    ctx.drawImage(previewImg, sx, sy, imgSize, imgSize, 0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1.0;
    
    const gradient = ctx.createLinearGradient(0, SIZE * 0.5, 0, SIZE);
    gradient.addColorStop(0, 'rgba(31, 41, 55, 0.3)');
    gradient.addColorStop(1, 'rgba(31, 41, 55, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, SIZE * 0.5, SIZE, SIZE * 0.5);
  }
  
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, SIZE, 8);
  
  const padding = 60;
  const titleY = previewImg ? SIZE * 0.65 : SIZE * 0.4;
  
  ctx.font = 'bold 56px "Arial"';
  ctx.fillStyle = LIGHT_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const wrappedTitle = wrapText(ctx, title, SIZE - padding * 2);
  let currentY = titleY;
  for (const line of wrappedTitle.slice(0, 3)) {
    ctx.fillText(line, SIZE / 2, currentY);
    currentY += 66;
  }
  
  if (description && currentY < SIZE - 150) {
    ctx.font = '32px "Arial"';
    ctx.fillStyle = MUTED_TEXT;
    const wrappedDesc = wrapText(ctx, description, SIZE - padding * 2);
    currentY += 20;
    for (const line of wrappedDesc.slice(0, 2)) {
      ctx.fillText(line, SIZE / 2, currentY);
      currentY += 40;
    }
  }
  
  ctx.font = 'bold 24px "Arial"';
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillText('QR GEAR', SIZE / 2, SIZE - 50);
  
  return canvas.toBuffer('image/png');
}

export async function generateLinkPreviewImage(options: SocialImageOptions): Promise<Buffer> {
  const { title, description, previewImageUrl } = options;
  
  const WIDTH = 1200;
  const HEIGHT = 630;
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  
  ctx.fillStyle = DARK_BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  let previewImg = previewImageUrl ? await loadImageSafe(previewImageUrl) : null;
  
  if (previewImg) {
    const scale = Math.max(WIDTH / previewImg.width, HEIGHT / previewImg.height);
    const scaledWidth = previewImg.width * scale;
    const scaledHeight = previewImg.height * scale;
    const x = (WIDTH - scaledWidth) / 2;
    const y = (HEIGHT - scaledHeight) / 2;
    
    ctx.globalAlpha = 0.35;
    ctx.drawImage(previewImg, x, y, scaledWidth, scaledHeight);
    ctx.globalAlpha = 1.0;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, 'rgba(31, 41, 55, 0.5)');
    gradient.addColorStop(0.5, 'rgba(31, 41, 55, 0.7)');
    gradient.addColorStop(1, 'rgba(31, 41, 55, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  
  ctx.fillStyle = BRAND_COLOR;
  ctx.fillRect(0, 0, 8, HEIGHT);
  
  const padding = 80;
  const textStartY = HEIGHT * 0.35;
  
  ctx.font = 'bold 52px "Arial"';
  ctx.fillStyle = LIGHT_TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  const wrappedTitle = wrapText(ctx, title, WIDTH - padding * 2);
  let currentY = textStartY;
  for (const line of wrappedTitle.slice(0, 2)) {
    ctx.fillText(line, padding, currentY);
    currentY += 62;
  }
  
  if (description) {
    ctx.font = '28px "Arial"';
    ctx.fillStyle = MUTED_TEXT;
    const wrappedDesc = wrapText(ctx, description, WIDTH - padding * 2);
    currentY += 20;
    for (const line of wrappedDesc.slice(0, 2)) {
      ctx.fillText(line, padding, currentY);
      currentY += 36;
    }
  }
  
  ctx.font = 'bold 22px "Arial"';
  ctx.fillStyle = BRAND_COLOR;
  ctx.textAlign = 'right';
  ctx.fillText('QR GEAR', WIDTH - padding, HEIGHT - 40);
  
  return canvas.toBuffer('image/png');
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export async function generateAndUploadSocialImages(options: SocialImageOptions): Promise<SocialImageResult> {
  const result: SocialImageResult = {};
  const timestamp = Date.now();
  
  try {
    const [squareBuffer, linkBuffer] = await Promise.all([
      generateSquareImage(options),
      generateLinkPreviewImage(options),
    ]);
    
    const [squareUpload, linkUpload] = await Promise.all([
      uploadImageFromBuffer(
        squareBuffer,
        `share-square-${options.packetId}-${timestamp}.png`,
        'image/png',
        'share-assets'
      ),
      uploadImageFromBuffer(
        linkBuffer,
        `share-link-${options.packetId}-${timestamp}.png`,
        'image/png',
        'share-assets'
      ),
    ]);
    
    result.squareUrl = squareUpload.publicUrl;
    result.linkPreviewUrl = linkUpload.publicUrl;
    
    console.log('[SocialImageGenerator] Generated social images for packet:', options.packetId);
  } catch (error) {
    console.error('[SocialImageGenerator] Error generating social images:', error);
  }
  
  return result;
}

export async function regenerateSocialImages(
  itemId: string,
  options: SocialImageOptions
): Promise<SocialImageResult> {
  return generateAndUploadSocialImages(options);
}
