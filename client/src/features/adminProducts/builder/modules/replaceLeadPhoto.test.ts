import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from '@/lib/adminFetch';
import { leadPhotoPatch, replaceLeadPhoto } from './replaceLeadPhoto';
import { buildPacketImageOrder, packetLeadColor } from '@shared/productImages';

vi.mock('@/lib/adminFetch', () => ({ adminFetch: vi.fn() }));
const request = vi.mocked(adminFetch);
const url = 'https://example.com/new.png';
const packet = {
  builderSnapshot: { qrConfig: { selectedColor: { name: 'Black' } }, layoutConfig: { selectedPlacements: ['front', 'back'], placementSizes: { front: 'medium' } } },
  placementMockupUrls: { front: 'https://example.com/old.jpg', back: 'https://example.com/back.jpg' },
  priorityMockupUrl: 'https://example.com/old.jpg', lifestyleMockupUrl: 'https://example.com/woman.jpg',
  mockupsByColor: { Black: { front: { medium: 'https://example.com/old.jpg', lifestyle: 'https://example.com/woman.jpg' }, back: { medium: 'https://example.com/back.jpg' } }, Navy: { front: { medium: 'https://example.com/navy.jpg' } } },
  compositeUrl: 'https://example.com/print.png', qrContent: 'https://example.com/landing', assemblyId: 'existing-assembly',
};
const file = { name: 'model.png', type: 'image/png', size: 50 } as File;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('FileReader', class {
    result = 'data:image/png;base64,dGVzdA=='; onload: (() => void) | null = null;
    readAsDataURL() { this.onload?.(); }
  });
});

describe('saved product lead photo', () => {
  it('adds a new lead color without overwriting the old color, print or QR', () => {
    const before = JSON.stringify(packet);
    const older = { ...packet, builderSnapshot: { ...packet.builderSnapshot, layoutConfig: { ...packet.builderSnapshot.layoutConfig, placementSizes: {} } } };
    const { patch, color } = leadPhotoPatch(older, url, 'asset', 'Military Green');
    expect(color).toBe('Military Green');
    expect(patch['mockupsByColor.Military Green.front.medium']).toBe(url);
    expect(patch).not.toHaveProperty('mockupsByColor.Black.front.medium');
    expect(JSON.stringify(packet)).toBe(before);
  });
  it('opens the saved lead color even when another color was cached first', () => {
    const updated = { ...packet, priorityMockupUrl: url, mockupsByColor: { ...packet.mockupsByColor, 'Military Green': { front: { medium: url } } } };
    expect(packetLeadColor(updated)).toBe('Military Green');
    expect(packetLeadColor({ ...packet, priorityMockupUrl: null })).toBe('Black');
    expect(packetLeadColor({})).toBeNull();
  });
  it('replaces only display references and keeps print, QR, other colors and lifestyle intact', () => {
    const before = JSON.stringify(packet);
    const { patch } = leadPhotoPatch(packet, url, 'GRF-21221-000100');
    expect(Object.keys(patch).sort()).toEqual(['mockupsByColor.Black.front.medium', 'placementMockupUrls.front', 'priorityMockupUrl', 'storeFrontGrfId'].sort());
    const updated = { ...packet, priorityMockupUrl: patch.priorityMockupUrl, placementMockupUrls: { ...packet.placementMockupUrls, front: url } };
    expect(buildPacketImageOrder(updated)[0]).toBe(url);
    expect(buildPacketImageOrder(updated)).toContain(packet.compositeUrl);
    expect(JSON.stringify(packet)).toBe(before);
  });
  it('rejects missing saved placement or unsafe field paths', () => {
    expect(() => leadPhotoPatch({}, url, 'asset')).toThrow('saved build');
    expect(() => leadPhotoPatch({ ...packet, builderSnapshot: { ...packet.builderSnapshot, qrConfig: { selectedColor: { name: 'Black.admin' } } } }, url, 'asset')).toThrow('safely');
  });
  it('uses the actual saved mockup size when the older layout leaves it implicit', () => {
    const older = { ...packet, builderSnapshot: { ...packet.builderSnapshot, layoutConfig: { ...packet.builderSnapshot.layoutConfig, placementSizes: {} } } };
    expect(leadPhotoPatch(older, url, 'asset').patch['mockupsByColor.Black.front.medium']).toBe(url);
  });
  it('registers the right output format before patching and rebuilding the existing product', async () => {
    request.mockResolvedValueOnce({ instance: { id: 'instance' } }).mockResolvedValueOnce({ packet })
      .mockResolvedValueOnce({ grfId: 'GRF-21221-000100', asset: { publicUrl: url } }).mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: true });
    const result = await replaceLeadPhoto('packet', 'instance', file);
    expect(result.url).toBe(url);
    expect(request.mock.calls.map(call => call[0])).toEqual(['/catalog-instances/by-packet/packet', '/packets/packet', '/graphics/save-grf', '/packets/packet', '/catalog-instances/instance/rebuild-images']);
    expect(request.mock.calls[2][1]?.json).toMatchObject({ assetClass: '2', channel: '2', purpose: '2', format: '1', mimeType: 'image/png' });
    expect(request.mock.calls[3][1]?.json).not.toHaveProperty('builderSnapshot');
  });
  it('does not upload or mutate a different saved product', async () => {
    request.mockResolvedValueOnce({ instance: { id: 'different-instance' } });
    await expect(replaceLeadPhoto('packet', 'instance', file)).rejects.toThrow('changed');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('stops without patching when the upload fails', async () => {
    request.mockResolvedValueOnce({ instance: { id: 'instance' } }).mockResolvedValueOnce({ packet }).mockRejectedValueOnce(new Error('Upload failed'));
    await expect(replaceLeadPhoto('packet', 'instance', file)).rejects.toThrow('Upload failed');
    expect(request).toHaveBeenCalledTimes(3);
  });
  it('reports a failed gallery rebuild instead of claiming success', async () => {
    request.mockResolvedValueOnce({ instance: { id: 'instance' } }).mockResolvedValueOnce({ packet })
      .mockResolvedValueOnce({ grfId: 'GRF-21221-000100', asset: { publicUrl: url } }).mockResolvedValueOnce({ success: true }).mockRejectedValueOnce(new Error('Gallery unavailable'));
    await expect(replaceLeadPhoto('packet', 'instance', file)).rejects.toThrow('Gallery unavailable');
  });
});
