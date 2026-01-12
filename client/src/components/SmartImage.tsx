import { useState, useEffect, useCallback } from "react";
import { Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
import { 
  getImageSrc, 
  getThumbnailSrc,
  isPublicUrl, 
  fetchImageAsBlob, 
  revokeObjectUrl,
  type ImageAsset 
} from "@/lib/imageLoader";
import { Nexus } from "@/lib/nexus";

interface SmartImageProps {
  asset?: ImageAsset | null;
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  useThumbnail?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  showErrorState?: boolean;
  retryOnError?: boolean;
}

export function SmartImage({ 
  asset, 
  src, 
  alt, 
  className, 
  fallbackClassName,
  useThumbnail = false,
  onLoad,
  onError,
  showErrorState = true,
  retryOnError = false
}: SmartImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const resolvedSrc = src || (asset ? (useThumbnail ? getThumbnailSrc(asset) : getImageSrc(asset)) : '');

  const loadImage = useCallback(async () => {
    if (!resolvedSrc) {
      setError(new Error('No image source provided'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    let blobUrl: string | null = null;

    try {
      if (isPublicUrl(resolvedSrc)) {
        setImageSrc(resolvedSrc);
        setLoading(false);
        onLoad?.();
      } else {
        blobUrl = await fetchImageAsBlob(resolvedSrc);
        setImageSrc(blobUrl);
        setLoading(false);
        onLoad?.();
      }
    } catch (err: any) {
      Nexus.captureError(err, 'SmartImage', { src: resolvedSrc, retryCount });
      setError(err);
      setLoading(false);
      onError?.(err);
      
      if (retryOnError && retryCount < 2) {
        setTimeout(() => setRetryCount(c => c + 1), 1000 * (retryCount + 1));
      }
    }

    return () => {
      if (blobUrl) revokeObjectUrl(blobUrl);
    };
  }, [resolvedSrc, retryCount, onLoad, onError, retryOnError]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    loadImage().then(cleanupFn => {
      cleanup = cleanupFn;
    });

    return () => {
      cleanup?.();
      if (imageSrc && imageSrc.startsWith('blob:')) {
        revokeObjectUrl(imageSrc);
      }
    };
  }, [resolvedSrc, retryCount]);

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
        {error ? (
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
        {retryOnError && retryCount < 2 && (
          <span className="text-xs text-muted-foreground">Retrying...</span>
        )}
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} loading="lazy" />;
}

export default SmartImage;
