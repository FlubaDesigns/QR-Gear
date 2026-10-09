import { describe, it, expect, vi } from 'vitest';
import { projectTemplateDisplay } from '@shared/templateDisplay';
vi.mock('@/lib/adminFetch', () => ({ adminFetch: vi.fn() }));
import { templateToSkinItem } from '@/features/shared/templateLibrary';

describe('canonical template display', () => {
  it('shows artwork once as Graphic when no mockup exists', () => {
    const result = projectTemplateDisplay({ artworkUrl: 'art.png', thumbnailUrl: 'art.png', packet: { compositeUrl: 'art.png' } });
    expect(result.previewImages).toEqual([{ url: 'art.png', label: 'Graphic' }]);
  });
  it('keeps distinct print, QR and website previews with their real labels', () => {
    const result = projectTemplateDisplay({ priorityMockupUrl: 'mock.jpg', artworkUrl: 'art.png', qrOnlyUrl: 'qr.png', landingPageSnapshotUrl: 'site.png' });
    expect(result.previewImages.map(image => image.label)).toEqual(['Mockup', 'Graphic', 'QR Code', 'Landing Page']);
    expect(result.previewImageUrl).toBe('mock.jpg');
  });
  it('uses canonical pricing, preserves zero, and rejects invalid numeric strings', () => {
    expect(projectTemplateDisplay({ pricing: { customerPrice: 0 }, customerPrice: 45 }).previewPrice).toBe(0);
    expect(projectTemplateDisplay({ pricing: { customerPrice: '27.11' } }).previewPrice).toBe(27.11);
    expect(projectTemplateDisplay({ pricing: { customerPrice: '27garbage' } }).previewPrice).toBeNull();
  });
  it('labels an otherwise unclassified thumbnail as Preview', () => {
    expect(projectTemplateDisplay({ thumbnailUrl: 'thumb.png' }).previewImages).toEqual([{ url: 'thumb.png', label: 'Preview' }]);
  });
  it('gives both screens the API display values and keeps the saved snapshot intact', () => {
    const template = { id: 'template', packetId: null, builderSnapshot: { saved: true }, packet: { productName: 'stale', qrProductState: 'qr_canvas' }, ...projectTemplateDisplay({ name: 'Saved design', artworkUrl: 'art.png', pricing: { customerPrice: 27 } }) };
    const item = templateToSkinItem(template);
    expect(item).toMatchObject({ id: 'template', name: 'Saved design', price: 27, primaryImage: 'art.png', qrMode: 'QR Canvas' });
    expect(item.metadata).toBe(template);
    expect(item.images).toBe(template.previewImages);
  });
});
