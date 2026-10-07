import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uploadAdminImages, adminImageToSkinItem, useCreateImageFolder, useAdminImageUpload } from '@/features/shared/adminImageLibrary';
const m = vi.hoisted(() => ({ fetch: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.fetch }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: m.invalidate }), useMutation: (options: any) => options }));
beforeEach(() => { vi.clearAllMocks(); });
describe('shared Images client flow', () => {
  it('uses the public thumbnail URL, never the authenticated proxy or raw storage path', () => {
    expect(adminImageToSkinItem({ id: 'image', name: 'Image', publicUrl: 'https://storage.googleapis.com/bucket/image.png', proxyUrl: '/api/admin/images/image/file', storageUrl: 'internal/path' } as any).primaryImage).toBe('https://storage.googleapis.com/bucket/image.png');
  });
  it('reports partial success and continues through the remaining files', async () => {
    m.fetch.mockResolvedValueOnce({ id: 'first' }).mockRejectedValueOnce(new Error('Upload failed')).mockResolvedValueOnce({ id: 'third' });
    const files = ['first', 'second', 'third'].map(name => ({ name, file: new Blob(['png'], { type: 'image/png' }) }));
    const result = await uploadAdminImages({ files, folder: 'USA 250' });
    expect(result.uploaded.map(image => image.id)).toEqual(['first', 'third']);
    expect(result.failed).toEqual([{ name: 'second', message: 'Upload failed' }]);
    expect(m.fetch).toHaveBeenCalledTimes(3);
    expect((m.fetch.mock.calls[0][1].body as FormData).get('folder')).toBe('USA 250');
  });
  it('does not send unsupported files to the server', async () => {
    const result = await uploadAdminImages({ files: [{ name: 'bad.gif', file: new Blob(['gif'], { type: 'image/gif' }) }], folder: 'general' });
    expect(m.fetch).not.toHaveBeenCalled(); expect(result.failed).toHaveLength(1);
  });
  it('returns the server canonical folder instead of the typed spelling', async () => {
    m.fetch.mockResolvedValue({ folder: 'USA 250', created: false });
    const mutation = useCreateImageFolder() as any;
    expect(await mutation.mutationFn(' usa  250 ')).toEqual({ folder: 'USA 250', created: false });
    expect(m.fetch).toHaveBeenCalledWith('/images/folders', { method: 'POST', json: { name: 'usa 250' } });
  });
  it('refreshes both image lists and folders after every completed upload batch', () => {
    const mutation = useAdminImageUpload() as any; mutation.onSettled();
    expect(m.invalidate).toHaveBeenCalledWith({ queryKey: ['admin-images'] });
  });
});
