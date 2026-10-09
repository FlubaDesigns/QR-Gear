import { describe, expect, it } from 'vitest';
import { buildProductGallery } from '../../features/storefront-shared/buildProductGallery';

const navy = { lifestyle: 'navy-life', front: 'navy-front', angles: ['navy-back'] };
const black = { lifestyle: 'black-life', front: 'black-front' };
const proofs = ['shirt-art', 'url-image', 'qr-code'];
const source = { name: 'Navy', mockupsByColor: { Navy: navy, Black: black }, images: ['navy-front', 'navy-life', 'navy-back', ...proofs] };

describe('generated packet gallery', () => {
  it('replaces only the QR Play landing snapshot and preserves model, artwork and QR order', () => {
    const product = { ...source, qrProductType: 'qr-play', playMediaUrl: 'https://example.com/video.mp4', landingPageSnapshotUrl: 'url-image', qrCodeUrl: 'qr-code' };
    const gallery = buildProductGallery(product, 'Navy');
    expect(gallery.map(i => i.url)).toEqual(['navy-front', 'navy-life', 'navy-back', 'shirt-art', product.playMediaUrl, 'qr-code']);
    expect(gallery[4].type).toBe('video');
    expect(buildProductGallery({ ...product, qrProductType: 'qr-canvas' }, 'Navy').map(i => i.url)).toContain('url-image');
  });
  it('includes a saved video before the QR when a snapshot was never generated', () => {
    expect(buildProductGallery({ images: ['art', 'qr'], qrCodeUrl: 'qr', qrProductType: 'qr-play', playMediaUrl: 'movie' }).map(i => i.url)).toEqual(['art', 'movie', 'qr']);
  });
  it('prefers the saved model over a supplier cache alias only for its matching color', () => {
    const product = { imageUrl: 'saved-green', images: ['saved-green', ...proofs], mockupsByColor: {
      'military-green': { front: 'supplier-green', lifestyle: 'woman-green' },
      'Military Green': { front: 'saved-green' },
      Black: black,
    } };
    expect(buildProductGallery(product, 'Military Green').map(i => i.url)).toEqual(['saved-green', 'woman-green', ...proofs]);
    expect(buildProductGallery(product, 'Black').map(i => i.url)).toEqual(['black-front', 'black-life', ...proofs]);
  });
  it('keeps every generated proof alongside selected-color mockups without duplicates', () => {
    expect(buildProductGallery(source, 'Navy').map(i => i.url)).toEqual(['navy-front', 'navy-life', 'navy-back', ...proofs]);
  });
  it('changes color mockups without dropping proofs or leaking the previous color', () => {
    expect(buildProductGallery(source, 'Black').map(i => i.url)).toEqual(['black-front', 'black-life', ...proofs]);
  });
  it('keeps generated proofs visible while a selected color has no mockup yet', () => {
    expect(buildProductGallery(source, 'Red').map(i => i.url)).toEqual(proofs);
  });
  it('retains API order when no color mockups exist and deduplicates legacy URLs', () => {
    expect(buildProductGallery({ images: proofs }).map(i => i.url)).toEqual(proofs);
    expect(buildProductGallery({ imageUrl: 'a', packetImageUrl: 'a' }).map(i => i.url)).toEqual(['a']);
  });
});


it('keeps Red and Heather Red mockups separate', () => {
  const product = { mockupsByColor: { Red: { front: 'red' }, 'Heather Red': { front: 'heather-red' } } };
  expect(buildProductGallery(product, 'Heather Red').map(i => i.url)).toEqual(['heather-red']);
  expect(buildProductGallery(product, 'Red').map(i => i.url)).toEqual(['red']);
});
