import { useRef, useEffect } from "react";
import { generateQRCodeUrl } from "@/features/shared/components/wizardSteps/wizardTypes";
import { GRAPHIC_LAYOUT_DEFAULTS } from "@/features/shared/graphics/graphicLayout";
import qLogoSrc from "@assets/qr_gear_logo_transparent_1778357953260.png";

export function generateBrandedQRDataUrl(content: string, size: number = 200, qrColor: "black" | "white" = "black"): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    const qrUrl = generateQRCodeUrl(content, size, qrColor);
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      ctx.drawImage(qrImg, 0, 0, size, size);

      const logoImg = new Image();
      logoImg.onload = () => {
        const logoSize = size * GRAPHIC_LAYOUT_DEFAULTS.logoSizePct;
        const bgSize = logoSize * GRAPHIC_LAYOUT_DEFAULTS.logoBgScale;
        const bgX = (size - bgSize) / 2;
        const bgY = (size - bgSize) / 2;
        const bgRadius = bgSize * GRAPHIC_LAYOUT_DEFAULTS.logoBgRadiusPct;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgSize, bgSize, bgRadius);
        ctx.fill();
        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        resolve(canvas.toDataURL("image/png"));
      };
      logoImg.onerror = () => resolve(canvas.toDataURL("image/png"));
      logoImg.src = qLogoSrc;
    };
    qrImg.onerror = () => resolve("");
    qrImg.src = qrUrl;
  });
}

interface BrandedQRProps {
  content: string;
  size?: number;
  qrColor?: "black" | "white";
  className?: string;
  alt?: string;
  "data-testid"?: string;
}

export function BrandedQR({
  content,
  size = 200,
  qrColor = "black",
  className,
  alt = "QR Code",
  "data-testid": testId,
}: BrandedQRProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    const qrUrl = generateQRCodeUrl(content, size, qrColor);
    const qrImg = new Image();
    qrImg.crossOrigin = "anonymous";
    qrImg.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(qrImg, 0, 0, size, size);

      const logoImg = new Image();
      logoImg.onload = () => {
        const logoSize = size * GRAPHIC_LAYOUT_DEFAULTS.logoSizePct;
        const bgSize = logoSize * GRAPHIC_LAYOUT_DEFAULTS.logoBgScale;
        const bgX = (size - bgSize) / 2;
        const bgY = (size - bgSize) / 2;
        const bgRadius = bgSize * GRAPHIC_LAYOUT_DEFAULTS.logoBgRadiusPct;

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgSize, bgSize, bgRadius);
        ctx.fill();

        const logoX = (size - logoSize) / 2;
        const logoY = (size - logoSize) / 2;
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      };
      logoImg.src = qLogoSrc;
    };
    qrImg.src = qrUrl;
  }, [content, size, qrColor]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={alt}
      data-testid={testId}
    />
  );
}
