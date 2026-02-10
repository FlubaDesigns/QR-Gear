import type { TextStyleConfig } from "@/features/shared/components/TextStyleEditor";

interface TextStyleProp {
  text: string;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  enabled?: boolean;
  verticalOffset?: number;
  horizontalOffset?: number;
}

interface UnifiedGraphicProps {
  headerStyle?: TextStyleProp;
  footerStyle?: TextStyleProp;
  qrColor?: 'black' | 'white';
  backgroundColor?: string;
  showQRCode?: boolean;
  className?: string;
  width?: number | string;
  highlightHeader?: boolean;
  highlightFooter?: boolean;
  'data-testid'?: string;
}

const CANVAS_W = 1200;
const CANVAS_H = 1800;
const PADDING = 60;
const QR_SIZE = 270;
const MAX_TEXT_WIDTH = CANVAS_W - PADDING * 2;
const SCALE_FACTOR = 7.5;
const BG_PADDING = 20;
const BG_RADIUS = 16;

const HEADER_ZONE_TOP = 0;
const HEADER_ZONE_HEIGHT = CANVAS_H * 0.25;
const QR_ZONE_TOP = HEADER_ZONE_HEIGHT;
const QR_ZONE_HEIGHT = CANVAS_H * 0.50;
const FOOTER_ZONE_TOP = QR_ZONE_TOP + QR_ZONE_HEIGHT;
const FOOTER_ZONE_HEIGHT = CANVAS_H * 0.25;

export function getUnifiedFontSize(fontSize: string): number {
  if (fontSize === '12px' || fontSize === 'sm') return 10 * SCALE_FACTOR;
  if (fontSize === '24px' || fontSize === 'lg') return 16 * SCALE_FACTOR;
  return 12 * SCALE_FACTOR;
}

function wrapText(text: string, fontSize: number): string[] {
  const charWidth = 0.55 * fontSize;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = testLine.length * charWidth;

    if (testWidth > MAX_TEXT_WIDTH && currentLine) {
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

function StylizedQRCode({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const cellSize = size / 25;
  const finderSize = 7 * cellSize;

  const finderPattern = (fx: number, fy: number) => (
    <g key={`finder-${fx}-${fy}`}>
      <rect x={fx} y={fy} width={finderSize} height={finderSize} fill={color} />
      <rect x={fx + cellSize} y={fy + cellSize} width={5 * cellSize} height={5 * cellSize} fill={color === '#000000' ? '#FFFFFF' : '#000000'} />
      <rect x={fx + 2 * cellSize} y={fy + 2 * cellSize} width={3 * cellSize} height={3 * cellSize} fill={color} />
    </g>
  );

  const dots: JSX.Element[] = [];
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
  };
  const rand = rng(42);

  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < 25; col++) {
      if (row < 7 && col < 7) continue;
      if (row < 7 && col >= 18) continue;
      if (row >= 18 && col < 7) continue;
      if (rand() > 0.45) {
        dots.push(
          <rect
            key={`dot-${row}-${col}`}
            x={x + col * cellSize}
            y={y + row * cellSize}
            width={cellSize * 0.85}
            height={cellSize * 0.85}
            rx={cellSize * 0.15}
            fill={color}
          />
        );
      }
    }
  }

  return (
    <g>
      {dots}
      {finderPattern(x, y)}
      {finderPattern(x + 18 * cellSize, y)}
      {finderPattern(x, y + 18 * cellSize)}
    </g>
  );
}

function renderTextInZone(
  style: TextStyleProp,
  zoneTop: number,
  zoneHeight: number,
  fontSize: number,
  opacity: number,
  keyPrefix: string
): JSX.Element[] {
  if (!style.enabled || !style.text) {
    return [];
  }

  const lines = wrapText(style.text, fontSize);
  const fontFamily = style.fontFamily || 'Arial';
  const fillColor = style.color || '#000000';
  const hasStroke = !!(style.strokeColor && style.strokeWidth && style.strokeWidth > 0);
  const strokeWidth = hasStroke ? (style.strokeWidth! * SCALE_FACTOR) : 0;
  const elements: JSX.Element[] = [];

  const vOffset = style.verticalOffset ?? 50;
  const hOffset = style.horizontalOffset ?? 50;

  const totalTextHeight = lines.length * fontSize * 1.3;
  const Y_PAD = PADDING;
  const startY = zoneTop + Y_PAD + (zoneHeight - 2 * Y_PAD - totalTextHeight) * (vOffset / 100);
  const X_MARGIN = CANVAS_W * 0.2;
  const textXPos = X_MARGIN + (CANVAS_W - 2 * X_MARGIN) * (hOffset / 100);

  for (let i = 0; i < lines.length; i++) {
    const textY = startY + i * fontSize * 1.3 + fontSize * 0.85;
    const key = `${keyPrefix}-${i}`;

    if (hasStroke) {
      elements.push(
        <text
          key={`${key}-stroke`}
          x={textXPos}
          y={textY}
          textAnchor="middle"
          fontFamily={`"${fontFamily}"`}
          fontSize={fontSize}
          fontWeight="bold"
          fill="none"
          stroke={style.strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
        >
          {lines[i]}
        </text>
      );
    }

    elements.push(
      <text
        key={key}
        x={textXPos}
        y={textY}
        textAnchor="middle"
        fontFamily={`"${fontFamily}"`}
        fontSize={fontSize}
        fontWeight="bold"
        fill={fillColor}
        opacity={opacity}
      >
        {lines[i]}
      </text>
    );
  }

  return elements;
}

export function UnifiedGraphic({
  headerStyle,
  footerStyle,
  qrColor = 'black',
  backgroundColor,
  showQRCode = true,
  className,
  width,
  highlightHeader,
  highlightFooter,
  'data-testid': testId,
}: UnifiedGraphicProps) {
  const headerOpacity = highlightFooter ? 0.4 : 1;
  const footerOpacity = highlightHeader ? 0.4 : 1;

  const headerFontSize = headerStyle ? getUnifiedFontSize(headerStyle.fontSize || '18px') : 90;
  const footerFontSize = footerStyle ? getUnifiedFontSize(footerStyle.fontSize || '18px') : 90;

  const headerElements = headerStyle
    ? renderTextInZone(headerStyle, HEADER_ZONE_TOP, HEADER_ZONE_HEIGHT, headerFontSize, headerOpacity, 'header')
    : [];

  const footerElements = footerStyle
    ? renderTextInZone(footerStyle, FOOTER_ZONE_TOP, FOOTER_ZONE_HEIGHT, footerFontSize, footerOpacity, 'footer')
    : [];

  const qrX = (CANVAS_W - QR_SIZE) / 2;
  const qrY = QR_ZONE_TOP + (QR_ZONE_HEIGHT - QR_SIZE) / 2;

  const qrFill = qrColor === 'white' ? '#FFFFFF' : '#000000';
  const qrBg = qrColor === 'white' ? '#000000' : '#FFFFFF';

  const svgStyle: React.CSSProperties = {};
  if (width !== undefined) {
    svgStyle.width = typeof width === 'number' ? `${width}px` : width;
    svgStyle.height = 'auto';
  }

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={svgStyle}
      data-testid={testId}
    >
      {backgroundColor && backgroundColor !== 'transparent' && (
        <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={backgroundColor} />
      )}

      {headerElements}

      {showQRCode && (
        <g>
          <rect
            x={qrX - BG_PADDING}
            y={qrY - BG_PADDING}
            width={QR_SIZE + BG_PADDING * 2}
            height={QR_SIZE + BG_PADDING * 2}
            rx={BG_RADIUS}
            ry={BG_RADIUS}
            fill={qrBg}
          />
          <StylizedQRCode x={qrX} y={qrY} size={QR_SIZE} color={qrFill} />
        </g>
      )}

      {footerElements}
    </svg>
  );
}

export { CANVAS_W, CANVAS_H, HEADER_ZONE_TOP, HEADER_ZONE_HEIGHT, QR_ZONE_TOP, QR_ZONE_HEIGHT, FOOTER_ZONE_TOP, FOOTER_ZONE_HEIGHT, QR_SIZE };

export default UnifiedGraphic;
