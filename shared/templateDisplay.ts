/** Canonical template display projection. Saved builderSnapshot remains the restoration source. */
export interface TemplatePreview {
  previewTitle: string;
  previewImageUrl: string | null;
  previewPrice: number | null;
  previewImages: { url: string; label: string }[];
}

export interface LibraryTemplate extends TemplatePreview {
  id: string;
  packetId?: string | null;
  packet?: Record<string, any> | null;
  builderSnapshot?: Record<string, any>;
  qrContent?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  qrProductState?: string | null;
  createdAt?: string | null;
}

export function projectTemplateDisplay(data: Record<string, any>): TemplatePreview {
  const packet = data.packet || {};
  const previewImages: TemplatePreview['previewImages'] = [];
  const add = (url: unknown, label: string) => {
    if (typeof url === 'string' && url.trim() && !previewImages.some(image => image.url === url)) {
      previewImages.push({ url, label });
    }
  };
  add(data.priorityMockupUrl || packet.priorityMockupUrl, 'Mockup');
  add(data.compositeUrl || data.artworkUrl || packet.compositeUrl, 'Graphic');
  add(data.qrOnlyUrl || packet.qrOnlyUrl, 'QR Code');
  add(data.landingPageSnapshotUrl || packet.landingPageSnapshotUrl, 'Landing Page');
  if (!previewImages.length) add(data.thumbnailUrl, 'Preview');
  const rawPrice = data.pricing?.customerPrice ?? data.customerPrice;
  const price = typeof rawPrice === 'number' ? rawPrice : typeof rawPrice === 'string' && rawPrice.trim() ? Number(rawPrice) : NaN;
  return {
    previewTitle: data.productName || data.name || packet.productName || 'Untitled Template',
    previewImageUrl: previewImages[0]?.url ?? null,
    previewPrice: Number.isFinite(price) && price >= 0 ? price : null,
    previewImages,
  };
}
