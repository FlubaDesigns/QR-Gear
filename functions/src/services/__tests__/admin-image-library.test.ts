import { describe, it, expect } from 'vitest';
import { createAdminImageLibrary } from '../admin-image-library';
import { parseImageUpload } from '../admin-image-routes';
import { IMAGE_LIBRARY_MAX_BYTES } from '../../../../shared/imageLibrary';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=', 'base64');
function fixture() {
  const docs = new Map<string, any>(); const files = new Map<string, { bytes: Buffer; contentType: string }>(); let seq = 0;
  const ref = (path: string): any => ({ path, id: path.split('/').pop(), get: async () => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data: any) => { docs.set(path, data); }, update: async (data: any) => { if (!docs.has(path)) throw new Error('Not found'); docs.set(path, { ...docs.get(path), ...data }); } });
  const collection = (name: string) => ({ doc: (id?: string) => ref(`${name}/${id || ++seq}`),
    get: async () => ({ docs: [...docs].filter(([path]) => path.startsWith(name + '/')).map(([path, data]) => ({ id: path.split('/').pop(), data: () => data })) }) });
  let queue = Promise.resolve();
  const db = { collection, runTransaction: (fn: any) => { const task = queue.then(() => fn({ get: (target: any) => target.get(), set: (target: any, data: any) => target.set(data) })); queue = task.catch(() => {}); return task; } };
  const bucket = () => ({ name: 'test-bucket', file: (path: string) => ({ path,
    save: async (bytes: Buffer, options: any) => { files.set(path, { bytes, contentType: options.metadata.contentType }); }, makePublic: async () => {} }) });
  return { ...createAdminImageLibrary({ db, bucket, now: () => '2026-10-07' }), docs, files };
}
describe('shared Images service', () => {
  it('uses the existing folder spelling and preserves empty folders after archive', async () => {
    const f = fixture(); f.docs.set('admin_images/old', { name: 'Old', folder: 'Area-Images', isActive: true, storageUrl: 'old.png' });
    expect(await f.createFolder('  area-images  ')).toEqual({ folder: 'Area-Images', created: false });
    await f.archive('old'); expect(await f.listFolders()).toEqual(['Area-Images']);
  });
  it('creates one canonical folder for repeated concurrent requests', async () => {
    const f = fixture(); const results = await Promise.all([f.createFolder('USA  250'), f.createFolder('usa 250')]);
    expect(results.map(result => result.folder)).toEqual(['USA 250', 'USA 250']);
    expect([...f.docs.keys()].filter(key => key.startsWith('admin_image_folders/'))).toHaveLength(1);
  });
  it('preserves bytes, uses the real extension, and encodes thumbnail URLs', async () => {
    const f = fixture(); const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const image = await f.upload({ bytes: svg, mimeType: 'image/svg+xml', name: 'logo.svg', folder: 'Website #1' });
    expect(image.storageUrl).toMatch(/-logo\.svg$/); expect(image.storageUrl).not.toContain('svg+xml');
    expect(image.publicUrl).toContain('Website%20%231/'); expect(f.files.get(image.storageUrl)?.bytes).toEqual(svg);
    expect((await f.list())[0].publicUrl).toBe(image.publicUrl);
  });
  it('archives list entries while preserving files and existing ID-based uses', async () => {
    const f = fixture(); const image = await f.upload({ bytes: png, mimeType: 'image/png', name: 'image.png', folder: 'general' });
    await f.archive(image.id); expect(await f.list()).toEqual([]); expect(f.files.size).toBe(1);
    expect((await f.getFile(image.id))?.file.path).toBe(image.storageUrl);
    expect(f.docs.get(`admin_images/${image.id}`).isActive).toBe(false);
  });
  it('rejects unsupported, mismatched, and oversized uploads before writing data', async () => {
    const f = fixture(); const upload = (bytes: Buffer, mimeType: string) => f.upload({ bytes, mimeType, name: 'file', folder: 'general' });
    await expect(upload(png, 'image/jpeg')).rejects.toThrow('bytes');
    await expect(upload(png, 'image/gif')).rejects.toThrow('Unsupported');
    await expect(upload(Buffer.alloc(IMAGE_LIBRARY_MAX_BYTES + 1), 'image/png')).rejects.toThrow('20 MB');
    expect(f.docs.size).toBe(0); expect(f.files.size).toBe(0);
  });
  it('parses multipart uploads with a quoted boundary without changing image bytes', async () => {
    const form = new FormData(); form.append('file', new Blob([png], { type: 'image/png' }), 'test.png'); form.append('folder', 'USA 250');
    const body = new Response(form); const rawBody = Buffer.from(await body.arrayBuffer());
    const contentType = body.headers.get('content-type')!.replace(/boundary=(.*)/, 'boundary="$1"');
    const parsed = await parseImageUpload({ headers: { 'content-type': contentType }, rawBody } as any);
    expect(parsed.bytes).toEqual(png); expect(parsed.folder).toBe('USA 250'); expect(parsed.name).toBe('test.png');
  });
});
