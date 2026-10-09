import { useState } from 'react';
import { Play } from 'lucide-react';
import { playMediaPreview } from '@/lib/playMediaPreview';
import type { StorefrontMediaItem } from '@/features/storefront-shared/mediaTypes';

/** One renderer for the main gallery, thumbnails and lightbox. */
export default function ProductGalleryMedia({ item, thumbnail = false, className = '', testId }: {
  item: StorefrontMediaItem; thumbnail?: boolean; className?: string; testId?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  if (item.type !== 'video') return <img src={item.url} alt={item.alt || 'Product image'} className={className} data-testid={testId} />;
  const preview = playMediaPreview(item.url, playing);
  const poster = preview && 'posterUrl' in preview ? preview.posterUrl : undefined;
  return (
    <div className={`relative bg-black flex items-center justify-center ${className}`} data-testid={testId}
      onClick={thumbnail ? undefined : e => e.stopPropagation()}
      onTouchStart={thumbnail ? undefined : e => e.stopPropagation()}>
      {!preview || failed ? <div className="p-3 text-center text-white text-xs" role="status">
        {thumbnail ? 'Video' : <>Preview unavailable. <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline">Watch video</a></>}
      </div> : preview.kind === 'file' ? <>
        <video src={`${preview.url.split('#')[0]}#t=1`} controls={!thumbnail} muted playsInline preload="metadata"
          aria-label={item.alt || 'Product video'} className="w-full h-full object-contain"
          onLoadedMetadata={e => { const v = e.currentTarget; if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = Math.min(1, v.duration / 2); }}
          onLoadedData={() => setReady(true)} onError={() => setFailed(true)} />
        {!ready && <span className="absolute text-white text-xs pointer-events-none">Video preview</span>}
      </> : playing && !thumbnail ? <iframe src={preview.url} title={item.alt || 'Product video'}
        className="w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : <>
        {poster && <img src={poster} alt={item.alt || 'Video preview'} className="w-full h-full object-contain" onError={() => setFailed(true)} />}
        {!thumbnail && <button type="button" aria-label="Play video" onClick={() => setPlaying(true)}
          className="absolute inset-0 flex flex-col gap-2 items-center justify-center text-white bg-black/20">
          <Play className="h-14 w-14 p-3 rounded-full bg-black/70" fill="currentColor" />
          <span className="bg-black/70 px-3 py-1 rounded">Play video</span>
        </button>}
      </>}
      {thumbnail && <Play aria-hidden="true" className="absolute w-7 h-7 p-1.5 rounded-full bg-black/70 text-white pointer-events-none" fill="currentColor" />}
    </div>
  );
}
