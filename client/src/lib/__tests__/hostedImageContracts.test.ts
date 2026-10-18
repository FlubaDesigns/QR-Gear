import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ api: vi.fn(), put: vi.fn(), image: null as any }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: m.api }));
vi.mock('@/lib/nexusFetch', () => ({ nexusFetch: m.put }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: m.image, isLoading: false }) }));
vi.mock('wouter', () => ({ useParams: () => ({ id: 'image' }) }));
import { useUpload } from '@/hooks/use-upload';
import ViewImage from '@/pages/view-image';
beforeEach(() => { vi.clearAllMocks(); m.image = { id: 'image', publicUrl: 'https://files.example/image.png', title: 'Image', createdAt: null, views: 0 }; });
it('uses authenticated metadata requests and sends file bytes only to the signed URL', async () => {
  let upload: ReturnType<typeof useUpload>; let tree: any;
  const response = { uploadURL: 'https://storage.example/signed', objectPath: 'uploads/owner/image', metadata: { name: 'image.png', size: 4, contentType: 'image/png' } };
  m.api.mockResolvedValue({ ok: true, json: async () => response }); m.put.mockResolvedValue({ ok: true });
  function Fixture() { upload = useUpload(); return null; }
  act(() => { tree = create(React.createElement(Fixture)); });
  const file = { name: 'image.png', size: 4, type: 'image/png' } as File;
  await act(async () => { expect(await upload.uploadFile(file)).toEqual(response); });
  expect(m.api).toHaveBeenCalledWith('POST', '/api/uploads/request-url', response.metadata);
  expect(m.put).toHaveBeenCalledWith(response.uploadURL, expect.objectContaining({ method: 'PUT', body: file, headers: { 'Content-Type': 'image/png' } }));
  await act(async () => { expect((await upload.getUploadParameters(file as any)).url).toBe(response.uploadURL); });
  act(() => tree.unmount());
});
it('renders the public image URL and handles a missing timestamp', () => {
  let tree: any; act(() => { tree = create(React.createElement(ViewImage)); });
  expect(tree.root.findByProps({ 'data-testid': 'img-hosted-image' }).props.src).toBe(m.image.publicUrl);
  expect(tree.root.findByProps({ 'data-testid': 'text-created-date' }).children).toEqual(['Date unavailable']);
  act(() => tree.unmount());
});
