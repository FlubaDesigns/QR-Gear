import { Loader2 } from "lucide-react";
import { useProductGraphicPreview } from "@/hooks/useProductGraphicPreview";
import type { TextStyle } from "@/features/shared/graphics/productGraphicRenderer";

interface TextOverlay {
  text: string;
  enabled: boolean;
  fontFamily: string;
  fontSize: string;
  color: string;
  warpPreset?: string;
  letterSpacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
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
  qrContent?: string;
  placement?: string;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
}

function toTextStyle(overlay?: TextOverlay): TextStyle | null {
  if (!overlay || !overlay.enabled || !overlay.text) return null;
  return {
    text: overlay.text,
    enabled: overlay.enabled,
    fontFamily: overlay.fontFamily || "Arial",
    fontSize: overlay.fontSize || "18px",
    color: overlay.color || "#000000",
    letterSpacing: overlay.letterSpacing,
    strokeColor: overlay.strokeColor,
    strokeWidth: overlay.strokeWidth,
    verticalOffset: overlay.verticalOffset,
    horizontalOffset: overlay.horizontalOffset,
  };
}

export function GraphicPreviewView({
  backgroundColor = "#1a1a2e",
  backgroundImage,
  headerStyle,
  footerStyle,
  showQRCode = true,
  aspectRatio = "square",
  className = "",
  qrContent,
  placement,
  qrPositionX,
  qrPositionY,
  qrSizePercent,
}: GraphicPreviewViewProps) {
  const aspectClass =
    aspectRatio === "portrait" ? "aspect-[2/3]" : "aspect-square";

  const { dataUrl, isLoading } = useProductGraphicPreview({
    qrContent: qrContent || "https://qrgear.app",
    qrColor:
      backgroundColor && getLuminance(backgroundColor) < 0.5
        ? "white"
        : "black",
    headerStyle: toTextStyle(headerStyle),
    footerStyle: toTextStyle(footerStyle),
    backgroundColor,
    transparent: false,
    placement,
    qrPositionX,
    qrPositionY,
    qrSizePercent,
    enabled: showQRCode || !!(headerStyle?.enabled || footerStyle?.enabled),
    debounceMs: 300,
  });

  return (
    <div
      className={`relative w-[120px] sm:w-[160px] ${aspectClass} rounded-lg overflow-hidden border-2 border-border shadow-lg ${className}`}
      style={
        backgroundImage
          ? { background: `url(${backgroundImage}) center/cover` }
          : undefined
      }
      data-testid="graphic-preview-view"
    >
      {isLoading && !dataUrl ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : dataUrl ? (
        <img
          src={dataUrl}
          alt="Product graphic preview"
          className="w-full h-full object-contain"
          data-testid="img-graphic-preview"
        />
      ) : (
        <div
          className="w-full h-full"
          style={{ backgroundColor: backgroundColor || "#1a1a2e" }}
        />
      )}
      {isLoading && dataUrl && (
        <div className="absolute top-1 right-1">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function getLuminance(hex: string): number {
  const rgb = hex.replace("#", "").match(/.{2}/g);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => parseInt(c, 16) / 255);
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
