import { UnifiedGraphic } from "@/features/shared/components/UnifiedGraphic";

interface TextOverlay {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  warpPreset: string;
  letterSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  verticalOffset?: number;
  horizontalOffset?: number;
}

export interface GraphicPreviewViewProps {
  backgroundColor?: string;
  backgroundImage?: string;
  headerStyle?: TextOverlay;
  footerStyle?: TextOverlay;
  showQRCode?: boolean;
  aspectRatio?: "square" | "portrait";
  className?: string;
}

function getLuminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => parseInt(c, 16) / 255);
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function GraphicPreviewView({
  backgroundColor = '#1a1a2e',
  backgroundImage,
  headerStyle,
  footerStyle,
  showQRCode = true,
  aspectRatio = "square",
  className = "",
}: GraphicPreviewViewProps) {
  const aspectClass = aspectRatio === "portrait" ? "aspect-[2/3]" : "aspect-square";
  const isDark = getLuminance(backgroundColor) < 0.5;
  const qrColor = isDark ? 'white' : 'black';

  return (
    <div 
      className={`relative w-[160px] ${aspectClass} rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      style={backgroundImage ? { background: `url(${backgroundImage}) center/cover` } : undefined}
      data-testid="graphic-preview-view"
    >
      <UnifiedGraphic
        headerStyle={headerStyle ? { ...headerStyle, enabled: headerStyle.enabled } : undefined}
        footerStyle={footerStyle ? { ...footerStyle, enabled: footerStyle.enabled } : undefined}
        qrColor={qrColor}
        backgroundColor={backgroundImage ? undefined : backgroundColor}
        showQRCode={showQRCode}
        width="100%"
        className="w-full h-full"
      />
    </div>
  );
}
