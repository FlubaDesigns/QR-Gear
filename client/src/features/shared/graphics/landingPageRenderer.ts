import { DEFAULT_FONT_SIZE_NUM } from "../components/TextStyleEditor";

export interface LandingPageTextStyle {
  text: string;
  enabled?: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  letterSpacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
  verticalOffset?: number;
  horizontalOffset?: number;
}

export interface LandingPageRenderOptions {
  backgroundUrl?: string | null;
  titleStyle?: LandingPageTextStyle | null;
  descriptionStyle?: LandingPageTextStyle | null;
}

const CANVAS_WIDTH = 2700;
const CANVAS_HEIGHT = 4800;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    const absoluteSrc = src.startsWith("/")
      ? `${window.location.origin}${src}`
      : src;
    img.src = absoluteSrc;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

function drawAutoFitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseFontSize: number,
  fontFamily: string,
  color: string,
  strokeColor?: string,
  strokeWidth?: number,
  lineHeight: number = 1.2
) {
  const minScale = 0.65;
  let currentFontSize = baseFontSize;

  ctx.font = `bold ${currentFontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let textWidth = ctx.measureText(text).width;

  if (textWidth > maxWidth) {
    const scale = maxWidth / textWidth;
    if (scale >= minScale) {
      currentFontSize = Math.floor(baseFontSize * scale);
      ctx.font = `bold ${currentFontSize}px ${fontFamily}`;
      textWidth = ctx.measureText(text).width;
    } else {
      currentFontSize = Math.floor(baseFontSize * minScale);
      ctx.font = `bold ${currentFontSize}px ${fontFamily}`;
    }
  }

  textWidth = ctx.measureText(text).width;

  if (textWidth <= maxWidth) {
    if (strokeColor && strokeWidth && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * 2;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  } else {
    const lines = wrapText(ctx, text, maxWidth);
    const totalHeight = lines.length * currentFontSize * lineHeight;
    const startY = y - totalHeight / 2 + (currentFontSize * lineHeight) / 2;

    lines.forEach((line, index) => {
      const lineY = startY + index * currentFontSize * lineHeight;
      if (strokeColor && strokeWidth && strokeWidth > 0) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth * 2;
        ctx.strokeText(line, x, lineY);
      }
      ctx.fillStyle = color;
      ctx.fillText(line, x, lineY);
    });
  }
}

export async function renderLandingPage(
  options: LandingPageRenderOptions
): Promise<string> {
  const { backgroundUrl, titleStyle, descriptionStyle } = options;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (backgroundUrl) {
    try {
      const bgImg = await loadImage(backgroundUrl);
      const scale = Math.max(
        CANVAS_WIDTH / bgImg.width,
        CANVAS_HEIGHT / bgImg.height
      );
      const scaledWidth = bgImg.width * scale;
      const scaledHeight = bgImg.height * scale;
      const x = (CANVAS_WIDTH - scaledWidth) / 2;
      const y = (CANVAS_HEIGHT - scaledHeight) / 2;
      ctx.drawImage(bgImg, x, y, scaledWidth, scaledHeight);
    } catch (e) {
      console.warn("[landingPageRenderer] Failed to load background:", e);
    }
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (titleStyle && titleStyle.enabled !== false && titleStyle.text) {
    const fontSize = parseInt(titleStyle.fontSize) || DEFAULT_FONT_SIZE_NUM;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 360));
    const verticalOffset = titleStyle.verticalOffset ?? 84;
    const horizontalOffset = titleStyle.horizontalOffset ?? 8;
    const textY = CANVAS_HEIGHT * (1 - verticalOffset / 100);
    const textX = CANVAS_WIDTH / 2 + horizontalOffset * 5;
    const maxWidth = CANVAS_WIDTH * 0.9;
    drawAutoFitText(
      ctx,
      titleStyle.text,
      textX,
      textY,
      maxWidth,
      scaledFontSize,
      titleStyle.fontFamily || "Arial",
      titleStyle.color || "#ffffff",
      titleStyle.strokeColor,
      titleStyle.strokeWidth
    );
  }

  if (
    descriptionStyle &&
    descriptionStyle.enabled !== false &&
    descriptionStyle.text
  ) {
    const fontSize = parseInt(descriptionStyle.fontSize) || DEFAULT_FONT_SIZE_NUM;
    const scaledFontSize = Math.round(fontSize * (CANVAS_WIDTH / 360));
    const verticalOffset = descriptionStyle.verticalOffset ?? 72;
    const horizontalOffset = descriptionStyle.horizontalOffset ?? 10;
    const textY = CANVAS_HEIGHT * (1 - verticalOffset / 100);
    const textX = CANVAS_WIDTH / 2 + horizontalOffset * 5;
    const maxWidth = CANVAS_WIDTH * 0.9;
    drawAutoFitText(
      ctx,
      descriptionStyle.text,
      textX,
      textY,
      maxWidth,
      scaledFontSize,
      descriptionStyle.fontFamily || "Arial",
      descriptionStyle.color || "#cccccc",
      descriptionStyle.strokeColor,
      descriptionStyle.strokeWidth
    );
  }

  return canvas.toDataURL("image/png");
}

export function getLandingPageDimensions(): { width: number; height: number } {
  return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
}
