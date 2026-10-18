import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { fetchProviderImage, rasterizeProxyImage, providerImageUrl } from '../image-validation';
import { GRF_IMAGE_MAX_BYTES } from '../../../../shared/GRF_engine';
const m = vi.hoisted(() => ({ save: vi.fn(), add: vi.fn(), mime: 'image/svg+xml', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }));
vi.mock('../../core', () => {
  const file = () => ({ exists: async () => [true], getMetadata: async () => [{ contentType: m.mime }], createReadStream: () => Readable.from(m.bytes), save: m.save, makePublic: async () => {} });
  const bucket = () => ({ name: 'fixture', file });
  return { admin: { storage: () => ({ bucket }), auth: () => ({ verifyIdToken: async () => ({ uid: 'owner' }) }) }, storage: { bucket }, db: { collection: () => ({ add: m.add }) } };
});
import { register as images } from '../../routes/images';
import { register as files } from '../../routes/store-files';
let png: Buffer;
beforeEach(async () => { vi.clearAllMocks(); m.mime = 'image/svg+xml'; m.add.mockResolvedValue({ id: 'img' }); png = await sharp({ create: { width: 2, height: 3, channels: 4, background: 'red' } }).png().toBuffer(); });
afterEach(() => vi.unstubAllGlobals());
const app = () => { const a = express(); a.use(express.json()); images(a); files(a); return a; };

describe('QRG-003 public image proxy', () => {
  it('allows only exact HTTPS provider hosts without credentials or alternate ports', () => {
    expect(providerImageUrl('https://images.printify.com/a.png').hostname).toBe('images.printify.com');
    for (const url of ['http://images.printify.com/a', 'https://images.printify.com.evil.invalid/a', 'https://evil-printful.com/a', 'https://user:pass@printful.com/a', 'https://printful.com:444/a', 'file:///tmp/x', 'https://127.0.0.1/a']) expect(() => providerImageUrl(url)).toThrow();
  });
  it('validates every redirect before requesting its destination', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchProviderImage('https://images.printify.com/a')).rejects.toThrow('not allowed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });
  it('follows allowed redirects, decodes pixels and serves only PNG', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/actual.png' } })).mockResolvedValueOnce(new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })));
    const result = await request(app()).get('/proxy-image').query({ url: 'https://images.printify.com/a' });
    expect(result.status).toBe(200); expect(result.headers['content-type']).toBe('image/png'); expect(result.headers['x-content-type-options']).toBe('nosniff');
    expect(await sharp(result.body).metadata()).toMatchObject({ width: 2, height: 3, format: 'png' });
  });
  it('rejects active documents, forged image MIME types and invalid image data', async () => {
    for (const [mime, body] of [['text/html', '<script>alert(1)</script>'], ['image/svg+xml', '<svg/>'], ['image/png', '<html>fake</html>']]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': mime } })));
      expect((await request(app()).get('/proxy-image').query({ url: 'https://images.printify.com/a' })).status).toBeGreaterThanOrEqual(400);
    }
    await expect(rasterizeProxyImage(png.subarray(0, 15), 'image/png')).rejects.toThrow('decoded');
  });
  it('enforces response byte limits and redirect limits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { headers: { 'content-length': String(GRF_IMAGE_MAX_BYTES + 1), 'content-type': 'image/png' } })));
    await expect(fetchProviderImage('https://images.printify.com/a')).rejects.toThrow('too large');
    const mock = vi.fn(async () => new Response(null, { status: 302, headers: { location: '/again' } })); vi.stubGlobal('fetch', mock);
    await expect(fetchProviderImage('https://images.printify.com/a')).rejects.toThrow('redirect'); expect(mock).toHaveBeenCalledTimes(4);
  });
});

describe('QRG-004 stored active uploads', () => {
  it('serves stored SVG and HTML only with sandbox, attachment and nosniff protection', async () => {
    for (const mime of ['image/svg+xml', 'text/html']) {
      m.mime = mime;
      for (const path of ['/media-files/logo.svg', '/files/logo.svg', '/library-files/logo.svg']) {
        const result = await request(app()).get(path);
        expect(result.status).toBe(200); expect(result.headers['content-security-policy']).toContain('sandbox');
        expect(result.headers['content-security-policy']).not.toContain('allow-scripts');
        expect(result.headers['content-disposition']).toBe('attachment'); expect(result.headers['x-content-type-options']).toBe('nosniff'); expect(result.headers['cache-control']).toContain('no-store');
      }
    }
  });
  it('keeps ordinary raster and video responses usable inline', async () => {
    for (const mime of ['image/png', 'video/mp4']) { m.mime = mime; const result = await request(app()).get('/media-files/image'); expect(result.status).toBe(200); expect(result.headers['content-disposition']).toBeUndefined(); }
  });
  it('marks new SVG storage objects as attachments and takes ownership from authentication', async () => {
    const result = await request(app()).post('/images/upload').set('Authorization', 'Bearer fixture').send({ imageData: m.bytes.toString('base64'), originalName: 'logo.svg', mimeType: 'image/svg+xml', userId: 'victim' });
    expect(result.status).toBe(200); expect(m.save).toHaveBeenCalledWith(m.bytes, expect.objectContaining({ metadata: expect.objectContaining({ contentDisposition: 'attachment' }) }));
    expect(m.add).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner' }));
  });
});
