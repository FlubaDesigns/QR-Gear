import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode-svg';
import path from 'path';
import fs from 'fs';

export interface TextStyle {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  letterSpacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  warpPreset: WarpPreset;
}

export type WarpPreset = 
  | 'straight'
  | 'arc-up'
  | 'arc-down'
  | 'arc-strong-up'
  | 'arc-strong-down'
  | 'wave'
  | 'wave-strong'
  | 'circle-top'
  | 'circle-bottom';

export interface RenderRequest {
  templateType: 'shirt-front' | 'shirt-back' | 'hat-front' | 'mug-wrap';
  header?: TextStyle;
  footer?: TextStyle;
  qrUrl: string;
  qrSize?: number;
  qrColor?: 'black' | 'white'; // Color of QR code for light/dark shirts
}

export interface QrOnlyRequest {
  qrUrl: string;
  qrSize?: number;
  qrColor?: 'black' | 'white'; // Color of QR code for light/dark shirts
}

export interface RenderResult {
  pngBuffer: Buffer;
  width: number;
  height: number;
}

const CANVAS_WIDTH = 4500;
const CANVAS_HEIGHT = 5400;

const HEADER_CENTER_Y = 800;
const QR_CENTER_Y = 2700;
const FOOTER_CENTER_Y = 4600;

const QR_SIZE = 1200;

const FONT_ALLOWLIST = [
  'Arial',
  'Arial Black',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Courier New',
  'Orbitron',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Oswald',
  'Playfair Display',
  'Bebas Neue',
  'Permanent Marker',
  'Bangers',
  'Lobster',
];

export function getFontAllowlist(): string[] {
  return [...FONT_ALLOWLIST];
}

export function getWarpPresets(): { value: WarpPreset; label: string }[] {
  return [
    { value: 'straight', label: 'Straight' },
    { value: 'arc-up', label: 'Arc Up' },
    { value: 'arc-down', label: 'Arc Down' },
    { value: 'arc-strong-up', label: 'Arc Up (Strong)' },
    { value: 'arc-strong-down', label: 'Arc Down (Strong)' },
    { value: 'wave', label: 'Wave' },
    { value: 'wave-strong', label: 'Wave (Strong)' },
    { value: 'circle-top', label: 'Circle Top' },
    { value: 'circle-bottom', label: 'Circle Bottom' },
  ];
}

function getWarpPath(preset: WarpPreset, centerY: number, width: number): { path: string; id: string } {
  const startX = (CANVAS_WIDTH - width) / 2;
  const endX = startX + width;
  const midX = CANVAS_WIDTH / 2;
  
  switch (preset) {
    case 'arc-up': {
      const curveHeight = 80;
      return {
        id: `path-arc-up-${centerY}`,
        path: `M ${startX} ${centerY} Q ${midX} ${centerY - curveHeight} ${endX} ${centerY}`
      };
    }
    case 'arc-down': {
      const curveHeight = 80;
      return {
        id: `path-arc-down-${centerY}`,
        path: `M ${startX} ${centerY} Q ${midX} ${centerY + curveHeight} ${endX} ${centerY}`
      };
    }
    case 'arc-strong-up': {
      const curveHeight = 180;
      return {
        id: `path-arc-strong-up-${centerY}`,
        path: `M ${startX} ${centerY} Q ${midX} ${centerY - curveHeight} ${endX} ${centerY}`
      };
    }
    case 'arc-strong-down': {
      const curveHeight = 180;
      return {
        id: `path-arc-strong-down-${centerY}`,
        path: `M ${startX} ${centerY} Q ${midX} ${centerY + curveHeight} ${endX} ${centerY}`
      };
    }
    case 'wave': {
      const waveHeight = 50;
      const quarterX = startX + width / 4;
      const threeQuarterX = startX + (width * 3) / 4;
      return {
        id: `path-wave-${centerY}`,
        path: `M ${startX} ${centerY} Q ${quarterX} ${centerY - waveHeight} ${midX} ${centerY} Q ${threeQuarterX} ${centerY + waveHeight} ${endX} ${centerY}`
      };
    }
    case 'wave-strong': {
      const waveHeight = 120;
      const quarterX = startX + width / 4;
      const threeQuarterX = startX + (width * 3) / 4;
      return {
        id: `path-wave-strong-${centerY}`,
        path: `M ${startX} ${centerY} Q ${quarterX} ${centerY - waveHeight} ${midX} ${centerY} Q ${threeQuarterX} ${centerY + waveHeight} ${endX} ${centerY}`
      };
    }
    case 'circle-top': {
      const radius = width / 2;
      return {
        id: `path-circle-top-${centerY}`,
        path: `M ${startX} ${centerY} A ${radius} ${radius} 0 0 1 ${endX} ${centerY}`
      };
    }
    case 'circle-bottom': {
      const radius = width / 2;
      return {
        id: `path-circle-bottom-${centerY}`,
        path: `M ${startX} ${centerY} A ${radius} ${radius} 0 0 0 ${endX} ${centerY}`
      };
    }
    case 'straight':
    default:
      return {
        id: `path-straight-${centerY}`,
        path: `M ${startX} ${centerY} L ${endX} ${centerY}`
      };
  }
}

function generateQrSvg(url: string, size: number, qrColor: 'black' | 'white' = 'black'): string {
  const color = qrColor === 'white' ? '#FFFFFF' : '#000000';
  const qr = new QRCode({
    content: url,
    width: size,
    height: size,
    color: color,
    background: 'transparent',
    ecl: 'H',
    padding: 0,
    join: true,
  });
  
  let svgContent = qr.svg();
  svgContent = svgContent.replace(/<\?xml[^?]*\?>/g, '');
  svgContent = svgContent.replace(/<!DOCTYPE[^>]*>/g, '');
  
  return svgContent;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFont(font: string): string {
  if (FONT_ALLOWLIST.includes(font)) {
    return font;
  }
  return 'Arial';
}

function buildTextElement(style: TextStyle, centerY: number, pathWidth: number): string {
  const sanitizedFont = sanitizeFont(style.fontFamily);
  const escapedText = escapeXml(style.text);
  const letterSpacing = style.letterSpacing ?? 0;
  const fontSize = Math.min(Math.max(style.fontSize, 48), 400);
  
  const warp = getWarpPath(style.warpPreset || 'straight', centerY, pathWidth);
  
  let textStyle = `font-family: '${sanitizedFont}', Arial, sans-serif; font-size: ${fontSize}px; fill: ${style.color || '#000000'};`;
  
  if (letterSpacing !== 0) {
    textStyle += ` letter-spacing: ${letterSpacing}px;`;
  }
  
  let defs = '';
  let textContent = '';
  
  if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
    const strokeStyle = `${textStyle} stroke: ${style.strokeColor}; stroke-width: ${style.strokeWidth}px; fill: none;`;
    
    defs += `<path id="${warp.id}" d="${warp.path}" fill="none" stroke="none"/>`;
    
    textContent = `
      <text style="${strokeStyle}" text-anchor="middle">
        <textPath href="#${warp.id}" startOffset="50%">${escapedText}</textPath>
      </text>
      <text style="${textStyle}" text-anchor="middle">
        <textPath href="#${warp.id}" startOffset="50%">${escapedText}</textPath>
      </text>
    `;
  } else {
    defs += `<path id="${warp.id}" d="${warp.path}" fill="none" stroke="none"/>`;
    
    textContent = `
      <text style="${textStyle}; font-weight: bold;" text-anchor="middle">
        <textPath href="#${warp.id}" startOffset="50%">${escapedText}</textPath>
      </text>
    `;
  }
  
  return { defs, textContent } as any;
}

function buildTextElementResult(style: TextStyle, centerY: number, pathWidth: number): { defs: string; textContent: string } {
  const sanitizedFont = sanitizeFont(style.fontFamily);
  const escapedText = escapeXml(style.text);
  const letterSpacing = style.letterSpacing ?? 0;
  const fontSize = Math.min(Math.max(style.fontSize, 48), 400);
  
  const warp = getWarpPath(style.warpPreset || 'straight', centerY, pathWidth);
  
  let textStyle = `font-family: '${sanitizedFont}', Arial, sans-serif; font-size: ${fontSize}px; fill: ${style.color || '#000000'}; font-weight: bold;`;
  
  if (letterSpacing !== 0) {
    textStyle += ` letter-spacing: ${letterSpacing}px;`;
  }
  
  let defs = `<path id="${warp.id}" d="${warp.path}" fill="none" stroke="none"/>`;
  let textContent = '';
  
  if (style.strokeColor && style.strokeWidth && style.strokeWidth > 0) {
    const strokeStyle = `font-family: '${sanitizedFont}', Arial, sans-serif; font-size: ${fontSize}px; stroke: ${style.strokeColor}; stroke-width: ${style.strokeWidth}px; fill: none; font-weight: bold;`;
    if (letterSpacing !== 0) {
      textStyle += ` letter-spacing: ${letterSpacing}px;`;
    }
    
    textContent = `
      <text style="${strokeStyle}" text-anchor="middle">
        <textPath href="#${warp.id}" startOffset="50%">${escapedText}</textPath>
      </text>
      <text style="${textStyle}" text-anchor="middle">
        <textPath href="#${warp.id}" startOffset="50%">${escapedText}</textPath>
      </text>
    `;
  } else {
    textContent = `
      <text style="${textStyle}" text-anchor="middle">
        <textPath href="#${warp.id}" startOffset="50%">${escapedText}</textPath>
      </text>
    `;
  }
  
  return { defs, textContent };
}

export function buildDesignSvg(request: RenderRequest): string {
  const qrSize = request.qrSize || QR_SIZE;
  const qrX = (CANVAS_WIDTH - qrSize) / 2;
  const qrY = QR_CENTER_Y - qrSize / 2;
  
  const textPathWidth = 3600;
  
  let allDefs = '';
  let allContent = '';
  
  if (request.header && request.header.text) {
    const headerResult = buildTextElementResult(request.header, HEADER_CENTER_Y, textPathWidth);
    allDefs += headerResult.defs;
    allContent += headerResult.textContent;
  }
  
  const qrColor = request.qrColor || 'black';
  const qrSvgRaw = generateQrSvg(request.qrUrl, qrSize, qrColor);
  const qrSvgMatch = qrSvgRaw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const qrInnerContent = qrSvgMatch ? qrSvgMatch[1] : '';
  
  allContent += `
    <g transform="translate(${qrX}, ${qrY})">
      ${qrInnerContent}
    </g>
  `;
  
  if (request.footer && request.footer.text) {
    const footerResult = buildTextElementResult(request.footer, FOOTER_CENTER_Y, textPathWidth);
    allDefs += footerResult.defs;
    allContent += footerResult.textContent;
  }
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">
  <defs>
    ${allDefs}
  </defs>
  ${allContent}
</svg>`;
  
  return svg;
}

export function buildPreviewSvg(request: RenderRequest, previewWidth: number = 450, previewHeight: number = 540): string {
  const fullSvg = buildDesignSvg(request);
  
  return fullSvg.replace(
    `width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"`,
    `width="${previewWidth}" height="${previewHeight}"`
  );
}

export async function renderSvgToPng(svgString: string): Promise<RenderResult> {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'original',
    },
    font: {
      loadSystemFonts: true,
    },
    logLevel: 'off',
  });
  
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  
  return {
    pngBuffer,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}

export async function renderDesignToPng(request: RenderRequest): Promise<RenderResult> {
  const svg = buildDesignSvg(request);
  return renderSvgToPng(svg);
}

/**
 * Render just a QR code centered on the canvas (no text)
 * Used for "qr-only" placement mode on smaller print areas like sleeves
 */
export async function renderQrOnlyToPng(request: QrOnlyRequest): Promise<RenderResult> {
  const qrSize = request.qrSize || 2400; // Larger QR for print quality
  const qrColor = request.qrColor || 'black';
  const qrX = (CANVAS_WIDTH - qrSize) / 2;
  const qrY = (CANVAS_HEIGHT - qrSize) / 2;
  
  const qrSvgRaw = generateQrSvg(request.qrUrl, qrSize, qrColor);
  const qrSvgMatch = qrSvgRaw.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  const qrInnerContent = qrSvgMatch ? qrSvgMatch[1] : '';
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">
  <g transform="translate(${qrX}, ${qrY})">
    ${qrInnerContent}
  </g>
</svg>`;
  
  return renderSvgToPng(svg);
}
