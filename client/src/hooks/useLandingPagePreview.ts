import { useState, useEffect, useRef } from "react";
import {
  renderLandingPage,
  type LandingPageTextStyle,
} from "@/features/shared/graphics/landingPageRenderer";

interface UseLandingPagePreviewOptions {
  backgroundUrl?: string | null;
  titleStyle?: LandingPageTextStyle | null;
  descriptionStyle?: LandingPageTextStyle | null;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseLandingPagePreviewResult {
  dataUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useLandingPagePreview(
  options: UseLandingPagePreviewOptions
): UseLandingPagePreviewResult {
  const {
    backgroundUrl,
    titleStyle,
    descriptionStyle,
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

    const hasContent =
      (titleStyle?.enabled !== false && titleStyle?.text) ||
      (descriptionStyle?.enabled !== false && descriptionStyle?.text) ||
      backgroundUrl;

    if (!hasContent) {
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
        const result = await renderLandingPage({
          backgroundUrl,
          titleStyle:
            titleStyle?.enabled !== false && titleStyle?.text
              ? titleStyle
              : null,
          descriptionStyle:
            descriptionStyle?.enabled !== false && descriptionStyle?.text
              ? descriptionStyle
              : null,
        });

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
    backgroundUrl,
    titleStyle?.text,
    titleStyle?.enabled,
    titleStyle?.fontSize,
    titleStyle?.fontFamily,
    titleStyle?.color,
    titleStyle?.strokeColor,
    titleStyle?.strokeWidth,
    titleStyle?.verticalOffset,
    titleStyle?.horizontalOffset,
    descriptionStyle?.text,
    descriptionStyle?.enabled,
    descriptionStyle?.fontSize,
    descriptionStyle?.fontFamily,
    descriptionStyle?.color,
    descriptionStyle?.strokeColor,
    descriptionStyle?.strokeWidth,
    descriptionStyle?.verticalOffset,
    descriptionStyle?.horizontalOffset,
    enabled,
    debounceMs,
  ]);

  return { dataUrl, isLoading, error };
}
