import { getGraphicLayout, GRAPHIC_LAYOUT_DEFAULTS } from "@/features/shared/graphics/graphicLayout";
import qLogoSrc from "@assets/file_000000002248722f8de433ffa27b321e~2_1775452887346.png";

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
  qrColor?: "black" | "white";
  backgroundColor?: string;
  showQRCode?: boolean;
  className?: string;
  width?: number | string;
  highlightHeader?: boolean;
  highlightFooter?: boolean;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
  subBottomEnabled?: boolean;
  subBottomText?: string;
  "data-testid"?: string;
}

const CANVAS_W = 1200;
const CANVAS_H = 1800;
const SCALE_FACTOR = 7.5;
const MAX_TEXT_WIDTH = CANVAS_W * 0.9;

export function getUnifiedFontSize(fontSize: string): number {
  const num = parseInt(fontSize, 10);
  if (!isNaN(num) && num > 0) return Math.round(num * (CANVAS_W / 1200) * 2.5);
  return Math.round(144 * (CANVAS_W / 1200) * 2.5);
}

function wrapText(text: string, fontSize: number): string[] {
  const charWidth = 0.55 * fontSize;
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

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

  if (currentLine) lines.push(currentLine);
  return lines;
}

function StylizedQRCode({
  x,
  y,
  size,
  color,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const cellSize = size / 25;
  const finderSize = 7 * cellSize;

  const finderPattern = (fx: number, fy: number) => (
    <g key={`finder-${fx}-${fy}`}>
      <rect x={fx} y={fy} width={finderSize} height={finderSize} fill={color} />
      <rect
        x={fx + cellSize}
        y={fy + cellSize}
        width={5 * cellSize}
        height={5 * cellSize}
        fill={color === "#000000" ? "#FFFFFF" : "#000000"}
      />
      <rect
        x={fx + 2 * cellSize}
        y={fy + 2 * cellSize}
        width={3 * cellSize}
        height={3 * cellSize}
        fill={color}
      />
    </g>
  );

  const dots: JSX.Element[] = [];
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
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
  if (!style.enabled || !style.text) return [];

  // Split on explicit newlines first, then word-wrap each segment so pressing
  // Enter in the text field forces a line break in the rendered graphic.
  const segments = style.text.split('\n');
  const lines: string[] = [];
  for (const seg of segments) {
    const wrapped = wrapText(seg, fontSize);
    if (wrapped.length === 0) {
      lines.push(''); // preserve intentional blank lines
    } else {
      lines.push(...wrapped);
    }
  }

  const fontFamily = style.fontFamily || "Arial";
  const fillColor = style.color || "#000000";
  const hasStroke = !!(style.strokeColor && style.strokeWidth && style.strokeWidth > 0);
  const strokeWidth = hasStroke ? style.strokeWidth! * SCALE_FACTOR : 0;
  const elements: JSX.Element[] = [];

  const vOffset = style.verticalOffset ?? 50;
  const hOffset = style.horizontalOffset ?? 50;

  const totalTextHeight = lines.length * fontSize * 1.3;
  const marginY = zoneHeight * 0.01;
  const usableHeight = zoneHeight - 2 * marginY;
  const startY = zoneTop + marginY + (vOffset / 100) * (usableHeight - totalTextHeight);

  // Compute X position so the slider's full 0–100 range maps to left-bleed →
  // right-bleed, regardless of text width.  We estimate the widest line's
  // pixel width using the same char-width approximation as wrapText, then
  // position the center so the text edge lands on the bleed boundary at the
  // extremes.  textAnchor stays "middle" throughout.
  const leftBleed  = CANVAS_W * 0.06;           // ~72 px on a 1200-wide canvas
  const rightBleed = CANVAS_W - leftBleed;       // ~1128 px
  const charWidth  = 0.55 * fontSize;
  const maxLineW   = Math.max(...lines.map(l => (l.length || 0) * charWidth), 1);
  const halfText   = maxLineW / 2;
  // At hOffset=0 the left edge should sit at leftBleed;  center = leftBleed + halfText.
  // At hOffset=100 the right edge should sit at rightBleed; center = rightBleed - halfText.
  // Clamp so very wide text stays centered rather than going backward.
  const leftCenter  = Math.min(leftBleed  + halfText, CANVAS_W / 2);
  const rightCenter = Math.max(rightBleed - halfText, CANVAS_W / 2);
  const textXPos = leftCenter + (hOffset / 100) * (rightCenter - leftCenter);

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
  qrColor = "black",
  backgroundColor,
  showQRCode = true,
  className,
  width,
  highlightHeader,
  highlightFooter,
  qrPositionX = GRAPHIC_LAYOUT_DEFAULTS.defaultQrPositionX,
  qrPositionY = GRAPHIC_LAYOUT_DEFAULTS.defaultQrPositionY,
  qrSizePercent = GRAPHIC_LAYOUT_DEFAULTS.defaultQrSizePercent,
  subBottomEnabled = false,
  subBottomText = "",
  "data-testid": testId,
}: UnifiedGraphicProps) {
  const headerActive = !!(
    headerStyle &&
    headerStyle.enabled !== false &&
    headerStyle.text
  );

  const footerActive = !!(
    footerStyle &&
    footerStyle.enabled !== false &&
    footerStyle.text
  );

  const subBottomActive = !!(subBottomEnabled && subBottomText?.trim());

  const layout = getGraphicLayout({
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    headerActive,
    footerActive,
    subBottomActive,
    qrPositionX,
    qrPositionY,
    qrSizePercent,
  });

  const headerOpacity = highlightFooter ? 0.4 : 1;
  const footerOpacity = highlightHeader ? 0.4 : 1;

  const headerFontSize = headerStyle
    ? getUnifiedFontSize(headerStyle.fontSize || "18px")
    : 90;

  const footerFontSize = footerStyle
    ? getUnifiedFontSize(footerStyle.fontSize || "18px")
    : 90;

  const headerElements = headerStyle
    ? renderTextInZone(
        headerStyle,
        layout.zones.header.y,
        layout.zones.header.height,
        headerFontSize,
        headerOpacity,
        "header"
      )
    : [];

  const footerElements = footerStyle
    ? renderTextInZone(
        footerStyle,
        layout.zones.footer.y,
        layout.zones.footer.height,
        footerFontSize,
        footerOpacity,
        "footer"
      )
    : [];

  const qrFill = qrColor === "white" ? "#FFFFFF" : "#000000";
  const qrBg = qrColor === "white" ? "#000000" : "#FFFFFF";

  const svgStyle: React.CSSProperties = {};
  if (width !== undefined) {
    svgStyle.width = typeof width === "number" ? `${width}px` : width;
    svgStyle.height = "auto";
  }

  const subBottomCenterY =
    layout.zones.subBottom.y + layout.zones.subBottom.height / 2;

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={svgStyle}
      data-testid={testId}
    >
      {backgroundColor && backgroundColor !== "transparent" && (
        <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill={backgroundColor} />
      )}

      {headerElements}

      {showQRCode && (
        <g>
          <rect
            x={layout.qr.background.x}
            y={layout.qr.background.y}
            width={layout.qr.background.width}
            height={layout.qr.background.height}
            rx={layout.qr.bgRadius}
            ry={layout.qr.bgRadius}
            fill={qrBg}
          />
          <StylizedQRCode
            x={layout.qr.square.x}
            y={layout.qr.square.y}
            size={layout.qr.square.width}
            color={qrFill}
          />
          <rect
            x={layout.qr.logoBg.x}
            y={layout.qr.logoBg.y}
            width={layout.qr.logoBg.width}
            height={layout.qr.logoBg.height}
            rx={layout.qr.logoBg.width * 0.12}
            ry={layout.qr.logoBg.height * 0.12}
            fill="#FFFFFF"
          />
          <image
            href={qLogoSrc}
            x={layout.qr.logoImg.x}
            y={layout.qr.logoImg.y}
            width={layout.qr.logoImg.width}
            height={layout.qr.logoImg.height}
          />
        </g>
      )}

      {subBottomActive && (
        <text
          x={CANVAS_W / 2}
          y={subBottomCenterY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily='"Arial"'
          fontSize={34}
          fill="#666666"
        >
          {subBottomText}
        </text>
      )}

      {footerElements}
    </svg>
  );
}

export default UnifiedGraphic;
