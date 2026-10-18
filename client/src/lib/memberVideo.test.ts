import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('./memberFetch', () => ({ memberFetch: m.fetch }));
import { uploadMemberVideo, saveMemberVideo } from './memberVideo';
beforeEach(() => vi.resetAllMocks());
it('uploads multipart and requires the server to acknowledge the reusable video record', async () => {
  m.fetch.mockResolvedValueOnce({ url: '/api/library-files/member/u/video/one.mp4', assetId: 'asset' });
  const url = await uploadMemberVideo('u', new File(['video'], 'one.mp4', { type: 'video/mp4' }), 'Video');
  expect(url).toBe('/api/library-files/member/u/video/one.mp4');
  expect(m.fetch.mock.calls[0][0]).toBe('/u/media');
  expect(m.fetch.mock.calls[0][1].body.get('file').name).toBe('one.mp4');
  expect(m.fetch).toHaveBeenCalledTimes(1);
});
it('retains retryability when saving a video reference fails', async () => {
  m.fetch.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ asset: { id: 'retry' } });
  await expect(saveMemberVideo('u', 'https://example.test/two.mp4', 'Video')).rejects.toThrow('Unavailable');
  await saveMemberVideo('u', 'https://example.test/two.mp4', 'Video');
  expect(m.fetch.mock.calls[1]).toEqual(['/u/library/video-reference', { method: 'POST', json: { url: 'https://example.test/two.mp4', name: 'Video' } }]);
});
it.each([{ videoUrl: '/wrong-contract' }, { url: '/api/library-files/member/u/video/x.mp4' }, { assetId: 'foreign', url: '/api/library-files/member/another/video/x.mp4' }])('rejects unacknowledged or foreign uploads: %j', async response => {
  m.fetch.mockResolvedValueOnce(response);
  await expect(uploadMemberVideo('u', new File(['video'], 'x.mp4'), 'Video')).rejects.toThrow('did not return');
});
