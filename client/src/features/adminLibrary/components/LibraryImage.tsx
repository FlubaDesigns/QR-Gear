import { useState, useEffect, useCallback } from "react";
import { Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { useLibraryContext } from "../LibraryContext";
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

function getImageUrl(asset: LibraryAssetWithProxy): string {
  if (asset.proxyUrl) return asset.proxyUrl;
  if (asset.publicUrl) return asset.publicUrl;
  if (asset.storageUrl) {
    const filename = asset.storageUrl.split("/").pop() || "";
    return `/api/library-files/${encodeURIComponent(filename)}`;
  }
  return "";
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
  const { getAuthHeaders } = useLibraryContext();
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
      const headers = await getAuthHeaders();
      const response = await fetch(imageUrl, { headers });

      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
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
  }, [imageUrl, getAuthHeaders, retryCount, onLoad, onError, retryOnError]);

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
