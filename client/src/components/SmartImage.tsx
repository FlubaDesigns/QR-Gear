import { useState, useEffect } from "react";
import { Loader2, Image as ImageIcon } from "lucide-react";
import { getImageSrc, isPublicUrl, fetchImageAsBlob, type ImageAsset } from "@/lib/imageLoader";
import { Nexus } from "@/lib/nexus";

interface SmartImageProps {
  asset?: ImageAsset;
  src?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function SmartImage({ asset, src, alt, className, fallbackClassName }: SmartImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const resolvedSrc = src || (asset ? getImageSrc(asset) : '');

  useEffect(() => {
    if (!resolvedSrc) {
      setError(true);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let blobUrl: string | null = null;

    const loadImage = async () => {
      try {
        if (isPublicUrl(resolvedSrc)) {
          if (isMounted) {
            setImageSrc(resolvedSrc);
            setLoading(false);
          }
        } else {
          blobUrl = await fetchImageAsBlob(resolvedSrc);
          if (isMounted) {
            setImageSrc(blobUrl);
            setLoading(false);
          }
        }
      } catch (err: any) {
        Nexus.captureError(err, 'SmartImage', { src: resolvedSrc });
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [resolvedSrc]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}>
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} />;
}

export default SmartImage;
