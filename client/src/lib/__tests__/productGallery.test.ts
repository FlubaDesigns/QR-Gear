import { describe, expect, it } from 'vitest';
import { buildProductGallery } from '../../features/storefront-shared/buildProductGallery';

const navy = { lifestyle: 'navy-life', front: 'navy-front', angles: ['navy-back'] };
const black = { lifestyle: 'black-life', front: 'black-front' };
const proofs = ['shirt-art', 'url-image', 'qr-code'];
const source = { name: 'Navy', mockupsByColor: { Navy: navy, Black: black }, images: ['navy-front', 'navy-life', 'navy-back', ...proofs] };

describe('generated packet gallery', () => {
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
