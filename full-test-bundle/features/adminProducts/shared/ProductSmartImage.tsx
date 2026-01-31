import { useState } from "react";
import { ImageOff } from "lucide-react";

interface ProductSmartImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function ProductSmartImage({ 
  src, 
  alt, 
  className = "", 
  fallbackClassName = "" 
}: ProductSmartImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const normalizedSrc = normalizeImageUrl(src);

  if (!normalizedSrc || hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}>
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
        </div>
      )}
      <img
        src={normalizedSrc}
        alt={alt}
        className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}

function normalizeImageUrl(src?: string | null): string | null {
  if (!src) return null;
  
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  if (src.startsWith('/api/')) {
    return src;
  }
  
  if (src.startsWith('gs://')) {
    const match = src.match(/gs:\/\/([^/]+)\/(.+)/);
    if (match) {
      const [, bucket, path] = match;
      return `https://storage.googleapis.com/${bucket}/${encodeURIComponent(path)}`;
    }
    return null;
  }
  
  if (src.startsWith('/')) {
    return src;
  }
  
  return src;
}

export { normalizeImageUrl };
