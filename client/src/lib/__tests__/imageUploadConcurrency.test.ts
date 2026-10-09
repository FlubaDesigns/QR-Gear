import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
import { ImageUploader } from '@/features/shared/components/utilities/ImageUploader';
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
describe('image upload ownership while reading files', () => {
  it('locks before reading and ignores a second tap without starting another upload', async () => {
    let resolve!: (value: ArrayBuffer) => void;
    const read = vi.fn(() => new Promise<ArrayBuffer>(done => { resolve = done; }));
    const file = { name: 'image.png', type: 'image/png', size: 4, arrayBuffer: read };
    const upload = vi.fn().mockResolvedValue(undefined);
    let tree: any; act(() => { tree = create(React.createElement(ImageUploader, { onUploadSingle: upload, showZipUpload: false })); });
    const input = () => tree.root.findAll((n: any) => n.type === 'input')[0];
    let first: Promise<void>;
    act(() => { first = input().props.onChange({ target: { files: [file], value: '' } }); input().props.onChange({ target: { files: [file], value: '' } }); });
    expect(input().props.disabled).toBe(true); expect(read).toHaveBeenCalledTimes(1); expect(upload).not.toHaveBeenCalled();
    await act(async () => { resolve(new Uint8Array([1,2,3,4]).buffer); await first; });
    expect(upload).toHaveBeenCalledTimes(1); expect(input().props.disabled).toBe(false); act(() => tree.unmount());
  });
  it('uploads the first file before reading the next, instead of retaining the whole batch in memory', async () => {
    const order: string[] = [];
    const files = ['first.png','second.png'].map(name => ({ name, type: 'image/png', size: 1, arrayBuffer: async () => { order.push(`read:${name}`); return new Uint8Array([1]).buffer; } }));
    const upload = vi.fn(async ({ originalFilename }: any) => { order.push(`upload:${originalFilename}`); });
    let tree: any; act(() => { tree = create(React.createElement(ImageUploader, { onUploadSingle: upload, showZipUpload: false })); });
    await act(async () => { await tree.root.findAll((n: any) => n.type === 'input')[0].props.onChange({ target: { files, value: '' } }); });
    expect(order).toEqual(['read:first.png','upload:first.png','read:second.png','upload:second.png']); act(() => tree.unmount());
  });
});
