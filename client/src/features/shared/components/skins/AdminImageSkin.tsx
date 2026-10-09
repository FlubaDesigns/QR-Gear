import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { CardSkinProps } from './types';

export function AdminImagePreview({ url, name, className }: { url?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return <div className="flex flex-col items-center justify-center gap-2 min-h-32 bg-muted p-4" role="status"><ImageOff className="h-6 w-6" /><span className="text-xs">{failed ? 'Preview unavailable' : 'No image available'}</span></div>;
  return <img src={url} alt={name} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
export function AdminImageCardSkin({ item, onClick }: CardSkinProps) {
  return <button type="button" onClick={onClick} className="w-full text-left rounded-md overflow-hidden border bg-card focus-visible:ring-2 focus-visible:ring-primary" data-testid={`card-image-${item.id}`}>
    <div className="aspect-square bg-muted flex items-center justify-center"><AdminImagePreview url={item.primaryImage} name={item.name} className="w-full h-full object-contain" /></div>
    <p className="p-2 text-xs truncate" title={item.name}>{item.name}</p>
  </button>;
}
