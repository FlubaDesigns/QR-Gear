import { beforeEach, expect, it, vi } from 'vitest';
import { database } from './composition-fixture';
const m = vi.hoisted(() => ({ db: null as any, validate: vi.fn(), artwork: vi.fn(), update: vi.fn(), upload: vi.fn(), get: vi.fn() }));
vi.mock('../../core', () => ({ db: { collection: (...a: any[]) => m.db.collection(...a) } }));
vi.mock('../assembly-store', () => ({ validatePacketComposition: m.validate, packetPrintifyArtwork: m.artwork }));
vi.mock('../printify', () => ({ printifyClient: { getProduct: m.get, uploadImage: m.upload, updateProduct: m.update } }));
import { republishInstanceToPrintify, compositeChanged } from '../printify-republish';
beforeEach(() => { vi.clearAllMocks(); m.db = database({ 'admin_catalog_instances/i': { currentPacketId: 'p', printifyProductId: 'remote' }, 'productPackets/p': {} }).db;
 m.validate.mockResolvedValue({}); m.artwork.mockResolvedValue(['front','sleeve_left','sleeve_right'].map(position => ({ position, imageUrl: `https://files/${position}` })));
 m.get.mockResolvedValue({ variants: [{ id: 1, is_enabled: true }] }); m.upload.mockResolvedValue({ id: 'file' }); m.update.mockResolvedValue(undefined);
});
it('uses every canonical placement including the right sleeve', async () => {
 expect((await republishInstanceToPrintify('i')).success).toBe(true);
 expect(m.update.mock.calls[0][1].print_areas[0].placeholders.map((p: any) => p.position)).toEqual(['front','sleeve_left','sleeve_right']);
 expect(compositeChanged({ placementGraphicUrls: { right_sleeve: 'old' } }, { placementGraphicUrls: { right_sleeve: 'new' } })).toBe(true);
});
it('fails before provider access when the canonical projection rejects a missing placement', async () => {
 m.artwork.mockRejectedValue(new Error('Generate right_sleeve'));
 expect((await republishInstanceToPrintify('i')).success).toBe(false); expect(m.get).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
