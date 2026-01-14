import { useState, useEffect, useCallback } from "react";
import { Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { getAssetImageUrl, type LibraryAssetWithProxy } from "../shared/types";

interface LibraryImageProps {
  asset?: LibraryAssetWithProxy | null;
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  showErrorState?: boolean;
}

export function LibraryImage({
  asset,
  src,
  alt,
  className,
  fallbackClassName,
  onLoad,
  onError,
  showErrorState = true,
}: LibraryImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const resolvedSrc = src || getAssetImageUrl(asset) || "";

  const loadImage = useCallback(async () => {
    if (!resolvedSrc) {
      setError(new Error("No image source provided"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Images are served from public endpoints - no auth needed
      const response = await fetch(resolvedSrc);
      if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setImageSrc(blobUrl);
      setLoading(false);
      onLoad?.();
    } catch (err: any) {
      console.error("[LibraryImage] Load error:", err);
      setError(err);
      setLoading(false);
      onError?.(err);
    }
  }, [resolvedSrc, onLoad, onError]);

  useEffect(() => {
    loadImage();
    
    return () => {
      if (imageSrc && imageSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [loadImage]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !imageSrc) {
    if (!showErrorState) return null;
    return (
      <div className={`flex flex-col items-center justify-center bg-muted gap-1 ${fallbackClassName || className}`}>
        {error ? <AlertCircle className="h-5 w-5 text-muted-foreground" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} loading="lazy" />;
}
