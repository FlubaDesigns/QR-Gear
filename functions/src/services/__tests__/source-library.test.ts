import { describe, it, expect } from 'vitest';
import { createGrfRegistrar } from '../grf-store';
import { GRF_IMAGE_MAX_BYTES, normalizeMimeType, parseGrfId } from '../../../../shared/GRF_engine';
function fixture() {
  const docs = new Map<string, any>();
  const files = new Map<string, { bytes: Buffer; mime: string }>();
  const ref = (path: string): any => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }), set: async (value: any) => docs.set(path, value) });
  let tail = Promise.resolve();
  const db: any = {
    collection: (collection: string) => ({ doc: (id: string) => ref(`${collection}/${id}`), where: (field: string, _op: string, value: any) => ({ get: async () => ({ docs: [...docs.entries()].filter(([path, data]) => path.startsWith(collection + '/') && data[field] === value).map(([, data]) => ({ data: () => data })) }) }) }),
    runTransaction: (fn: any) => {
      const run = tail.then(() => fn({ get: (r: any) => r.get(), set: (r: any, value: any) => docs.set(r.path, { ...docs.get(r.path), ...value }), create: (r: any, value: any) => { if (docs.has(r.path)) throw new Error('collision'); docs.set(r.path, value); } }));
      tail = run.catch(() => {}); return run;
    },
  };
  const registrar = createGrfRegistrar({ db, now: () => 'now', bucket: () => ({ name: 'test', file: (path: string) => ({ save: async (bytes: Buffer, opts: any) => files.set(path, { bytes: Buffer.from(bytes), mime: opts.metadata.contentType }), makePublic: async () => {} }) }) });
  return { ...registrar, docs, files };
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=', 'base64');
const otherPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64');
const upload = (f: ReturnType<typeof fixture>, image = png, name = 'original.png') => f.registerSourceImage({ imageUrl: 'data:image/png;base64,' + image.toString('base64'), mimeType: 'image/png', originalFilename: name });
describe('Source library registration', () => {
  it('preserves original bytes and filename and reuses identical uploads', async () => {
    const f = fixture(); const first = await upload(f); const second = await upload(f, png, 'second-name.png');
    expect(second.grfId).toBe(first.grfId); expect(f.files.size).toBe(1);
    const [path, saved] = [...f.files][0];
    expect(path).toBe(`grf/${first.grfId}/original.png`); expect(saved.bytes).toEqual(png); expect(saved.mime).toBe('image/png'); expect(first.asset?.originalFilename).toBe('original.png');
  });
  it('reserves one identity for concurrent identical uploads', async () => {
    const f = fixture(); const results = await Promise.all([upload(f), upload(f)]);
    expect(results[0].grfId).toBe(results[1].grfId); expect(f.files.size).toBe(1);
  });
  it('preserves earlier crops and reuses identical retries with distinct global sequences', async () => {
    const f = fixture(); const source = await upload(f);
    const crop = (bytes: Buffer) => f.registerSourceCrop({ sourceGrfId: source.grfId, croppedImageData: bytes.toString('base64'), croppedMimeType: 'image/png' });
    const first = await crop(png); const before = [...f.files].map(([path, value]) => [path, Buffer.from(value.bytes)] as const);
    const second = await crop(otherPng); const retry = await crop(otherPng);
    expect(second.croppedGrfId).not.toBe(first.croppedGrfId); expect(retry.croppedGrfId).toBe(second.croppedGrfId); expect(first.backgroundGrfId).toBe(second.backgroundGrfId);
    for (const [path, bytes] of before) expect(f.files.get(path)?.bytes).toEqual(bytes);
    const ids = [source.grfId, first.croppedGrfId, second.croppedGrfId, first.backgroundGrfId]; expect(new Set(ids.map(id => parseGrfId(id).sequence)).size).toBe(4);
    const derivative = f.docs.get(`grf_assets/${first.croppedGrfId}`);
    expect(derivative.sourceGrfId).toBe(source.grfId); expect(derivative.mimeType).toBe('image/png'); expect(derivative.storagePath).toMatch(/cropped\.png$/); expect(f.files.get(derivative.storagePath)?.bytes).toEqual(png);
  });
  it('resolves background recrops through the stored original', async () => {
    const f = fixture(); const source = await upload(f);
    const first = await f.registerSourceCrop({ sourceGrfId: source.grfId, croppedImageData: png.toString('base64'), croppedMimeType: 'image/png' });
    const next = await f.registerSourceCrop({ sourceGrfId: first.backgroundGrfId, croppedImageData: otherPng.toString('base64'), croppedMimeType: 'image/png' });
    expect(f.docs.get(`grf_assets/${next.croppedGrfId}`).sourceGrfId).toBe(source.grfId); expect(next.backgroundGrfId).toBe(first.backgroundGrfId);
  });
  it('rejects missing and archived sources without creating crops', async () => {
    const f = fixture(); const source = await upload(f); const args = { sourceGrfId: 'GRF-11411-999999', croppedImageData: png.toString('base64'), croppedMimeType: 'image/png' };
    await expect(f.registerSourceCrop(args)).rejects.toThrow('missing or archived'); f.docs.get(`grf_assets/${source.grfId}`).isActive = false;
    await expect(f.registerSourceCrop({ ...args, sourceGrfId: source.grfId })).rejects.toThrow('missing or archived'); expect(f.files.size).toBe(1);
  });
  it('rejects unsupported formats and mislabeled bytes before allocating IDs', async () => {
    const f = fixture(); expect(normalizeMimeType('image/jpg')).toBe('image/jpeg');
    for (const mime of ['image/heic','image/gif','image/avif','image/bmp','image/tiff']) expect(() => normalizeMimeType(mime)).toThrow('Unsupported');
    await expect(f.registerSourceImage({ imageUrl: png.toString('base64'), mimeType: 'image/jpeg' })).rejects.toThrow('bytes do not match');
    await expect(f.registerSourceImage({ imageUrl: 'data:image/jpeg;base64,' + png.toString('base64'), mimeType: 'image/png' })).rejects.toThrow('upload type'); expect(f.docs.size).toBe(0); expect(f.files.size).toBe(0);
  });
  it('enforces the shared upload limit before storage or ID allocation', async () => {
    const f = fixture(); await expect(f.registerSourceImage({ imageUrl: 'A'.repeat(Math.ceil(GRF_IMAGE_MAX_BYTES / 3) * 4 + 4), mimeType: 'image/png' })).rejects.toMatchObject({ status: 413 }); expect(f.docs.size).toBe(0);
  });
});
