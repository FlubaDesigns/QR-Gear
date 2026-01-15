import { useState, useEffect, useCallback } from "react";
import { Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
import { getImageUrl } from "../shared/imageUtils";
import type { LibraryAssetWithProxy } from "../shared/types";

interface LibraryImageProps {
  asset: LibraryAssetWithProxy;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  showErrorState?: boolean;
  retryOnError?: boolean;
}

export function LibraryImage({
  asset,
  alt,
  className,
  fallbackClassName,
  onLoad,
  onError,
  showErrorState = true,
  retryOnError = false,
}: LibraryImageProps) {
  const { api } = useLibraryContext();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const imageUrl = getImageUrl(asset);

  const loadImage = useCallback(async () => {
    if (!imageUrl) {
      setError(new Error("No image source provided"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const blobUrl = await api.fetchImageBlob(imageUrl);
      setImageSrc(blobUrl);
      setLoading(false);
      onLoad?.();
    } catch (err: any) {
      console.error("[LibraryImage] Load error:", err, { imageUrl });
      setError(err);
      setLoading(false);
      onError?.(err);

      if (retryOnError && retryCount < 2) {
        setTimeout(() => setRetryCount((c) => c + 1), 1000 * (retryCount + 1));
      }
    }
  }, [imageUrl, api, retryCount, onLoad, onError, retryOnError]);

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
        {retryOnError && retryCount < 2 && <span className="text-xs text-muted-foreground">Retrying...</span>}
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} loading="lazy" />;
}

export default LibraryImage;
