import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('./memberFetch', () => ({ memberFetch: m.fetch }));
import { uploadMemberVideo, saveMemberVideo } from './memberVideo';
beforeEach(() => vi.clearAllMocks());
it('uploads multipart and creates a real reusable video reference', async () => {
  m.fetch.mockResolvedValueOnce({ url: '/api/library-files/member/u/video/one.mp4', storagePath: 'library/member/u/video/one.mp4' }).mockResolvedValueOnce({ id: 'asset' });
  const url = await uploadMemberVideo('u', new File(['video'], 'one.mp4', { type: 'video/mp4' }), 'Video');
  expect(m.fetch.mock.calls[0][0]).toBe('/u/media');
  expect(m.fetch.mock.calls[0][1].body.get('file').name).toBe('one.mp4');
  expect(m.fetch.mock.calls[1]).toEqual(['/u/library', { method: 'POST', json: { publicUrl: url, storageUrl: 'library/member/u/video/one.mp4', assetType: 'video', mediaType: 'video', name: 'Video', fileName: 'one.mp4' } }]);
  await saveMemberVideo('u', url, 'Video'); expect(m.fetch).toHaveBeenCalledTimes(2);
});
it('retains retryability when the library fails and rejects an unacknowledged upload', async () => {
  m.fetch.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ id: 'retry' });
  await expect(saveMemberVideo('u', 'https://example.test/two.mp4', 'Video')).rejects.toThrow('Unavailable');
  await saveMemberVideo('u', 'https://example.test/two.mp4', 'Video'); expect(m.fetch).toHaveBeenCalledTimes(2);
  m.fetch.mockResolvedValueOnce({ videoUrl: '/wrong-contract' });
  await expect(uploadMemberVideo('u', new File(['video'], 'x.mp4'), 'Video')).rejects.toThrow('did not return');
});
