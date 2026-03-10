import { useState, useEffect, useRef } from "react";
import {
  renderProductGraphic,
  type RenderOptions,
  type TextStyle,
} from "@/features/shared/graphics/productGraphicRenderer";

interface UseProductGraphicPreviewOptions {
  qrContent?: string;
  qrColor?: "black" | "white";
  headerStyle?: TextStyle | null;
  footerStyle?: TextStyle | null;
  backgroundColor?: string;
  transparent?: boolean;
  placement?: string;
  qrPositionX?: number;
  qrPositionY?: number;
  qrSizePercent?: number;
  headerImageUrl?: string;
  footerImageUrl?: string;
  areaImageUrl?: string;
  areaImageMode?: "replace-qr" | "behind-qr";
  enabled?: boolean;
  debounceMs?: number;
}

interface UseProductGraphicPreviewResult {
  dataUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useProductGraphicPreview(
  options: UseProductGraphicPreviewOptions
): UseProductGraphicPreviewResult {
  const {
    qrContent = "https://qrgear.app",
    qrColor = "black",
    headerStyle,
    footerStyle,
    backgroundColor,
    transparent = false,
    placement,
    qrPositionX = 50,
    qrPositionY = 50,
    qrSizePercent = 50,
    headerImageUrl,
    footerImageUrl,
    areaImageUrl,
    areaImageMode,
    enabled = true,
    debounceMs = 400,
  } = options;

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationId = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setDataUrl(null);
      setIsLoading(false);
      return;
    }

    const hasText =
      (headerStyle?.enabled !== false && headerStyle?.text) ||
      (footerStyle?.enabled !== false && footerStyle?.text);
    const hasImage = headerImageUrl || footerImageUrl || areaImageUrl ||
      (headerStyle?.mode === "image" && headerStyle?.imageUrl) ||
      (footerStyle?.mode === "image" && footerStyle?.imageUrl);

    if (!qrContent && !hasText && !hasImage) {
      setDataUrl(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const currentId = ++generationId.current;

    timeoutRef.current = setTimeout(async () => {
      try {
        const renderOpts: RenderOptions = {
          qrContent: qrContent || "https://qrgear.app",
          qrColor,
          headerStyle: headerStyle?.enabled !== false ? headerStyle : null,
          footerStyle: footerStyle?.enabled !== false ? footerStyle : null,
          backgroundColor,
          transparent,
          placement,
          qrPositionX,
          qrPositionY,
          qrSizePercent,
          headerImageUrl,
          footerImageUrl,
          areaImageUrl,
          areaImageMode,
        };

        const result = await renderProductGraphic(renderOpts);

        if (currentId === generationId.current) {
          setDataUrl(result);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (currentId === generationId.current) {
          setError(err.message || "Render failed");
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    qrContent,
    qrColor,
    headerStyle?.text,
    headerStyle?.enabled,
    headerStyle?.fontSize,
    headerStyle?.fontFamily,
    headerStyle?.color,
    headerStyle?.strokeColor,
    headerStyle?.strokeWidth,
    headerStyle?.verticalOffset,
    headerStyle?.horizontalOffset,
    headerStyle?.mode,
    headerStyle?.imageUrl,
    footerStyle?.text,
    footerStyle?.enabled,
    footerStyle?.fontSize,
    footerStyle?.fontFamily,
    footerStyle?.color,
    footerStyle?.strokeColor,
    footerStyle?.strokeWidth,
    footerStyle?.verticalOffset,
    footerStyle?.horizontalOffset,
    footerStyle?.mode,
    footerStyle?.imageUrl,
    backgroundColor,
    transparent,
    placement,
    qrPositionX,
    qrPositionY,
    qrSizePercent,
    headerImageUrl,
    footerImageUrl,
    areaImageUrl,
    areaImageMode,
    enabled,
    debounceMs,
  ]);

  return { dataUrl, isLoading, error };
}
