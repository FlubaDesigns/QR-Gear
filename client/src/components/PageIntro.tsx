import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { pageImages } from '@/data/pageImages';

export function PageImage({ compact = false }: { compact?: boolean }) {
  const [location] = useLocation();
  const image = pageImages[location];
  if (!image) throw new Error(`No editorial image is registered for ${location}`);
  return (
    <figure className="m-0" data-testid="page-editorial-image">
      <img src={image.src} alt={image.alt} width={1536} height={1024}
        className={compact ? 'block w-full aspect-[3/1] object-cover rounded-2xl' : 'block w-full h-auto rounded-2xl'}
        loading="eager" decoding="async" />
    </figure>
  );
}

export default function PageIntro({ children }: { children: ReactNode }) {
  return (
    <div className="row">
      <div className="layout__split-2 items-center">
        <div>{children}</div>
        <PageImage />
      </div>
    </div>
  );
}
