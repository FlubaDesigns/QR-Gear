import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, it } from 'vitest';
import ProductGalleryMedia from '@/components/ProductGalleryMedia';
import { publicProductText } from '@shared/descriptionLayers';
let tree: ReturnType<typeof create>;
afterEach(() => { if (tree) act(() => tree.unmount()); });
it('autoplays the full file from its beginning with controls, while thumbnails stay paused', () => {
  const item = { type: 'video' as const, url: 'https://example.com/movie.mp4' };
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item })); });
  const video = tree.root.findByType('video');
  expect(video.props).toMatchObject({ src: item.url, controls: true, muted: true, playsInline: true, autoPlay: true });
  expect(video.props.onLoadedMetadata).toBeUndefined();
  expect(video.props.onTimeUpdate).toBeUndefined();
  act(() => { tree.update(React.createElement(ProductGalleryMedia, { item, thumbnail: true })); });
  expect(tree.root.findByType('video').props).toMatchObject({ autoPlay: false, controls: false });
});
it('opens the real YouTube player immediately on the video slide and removes it for thumbnails', () => {
  const item = { type: 'video' as const, url: 'https://www.youtube.com/watch?v=rgomsxUVa2U' };
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item })); });
  const url = new URL(tree.root.findByType('iframe').props.src);
  expect(url.pathname).toBe('/embed/rgomsxUVa2U');
  expect(url.searchParams.get('autoplay')).toBe('1');
  expect(url.searchParams.has('end')).toBe(false);
  expect(tree.root.findAllByType('button')).toHaveLength(0);
  act(() => { tree.update(React.createElement(ProductGalleryMedia, { item, thumbnail: true })); });
  expect(tree.root.findAllByType('iframe')).toHaveLength(0);
  expect(tree.root.findByType('img').props.src).toContain('/vi/rgomsxUVa2U/');
});
it('exposes a source link instead of a blank player when direct media fails', () => {
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item: { type: 'video', url: 'https://example.com/movie.mp4' } })); });
  act(() => tree.root.findByType('video').props.onError());
  expect(tree.root.findByType('a').props.href).toBe('https://example.com/movie.mp4');
});
it('retains a visible thumbnail if the external thumbnail fails without replacing the player', () => {
  const item = { type: 'video' as const, url: 'https://www.youtube.com/watch?v=DVUbzOk8mCc', posterUrl: 'https://example.com/art.png' };
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item, thumbnail: true })); });
  act(() => tree.root.findByType('img').props.onError());
  expect(tree.root.findByType('img').props.src).toBe(item.posterUrl);
  act(() => { tree.update(React.createElement(ProductGalleryMedia, { item })); });
  expect(tree.root.findByType('iframe').props.src).toContain('/embed/DVUbzOk8mCc?autoplay=1');
});
it('uses public QR Gear branding without changing other descriptive facts', () => {
  for (const name of ['Bella + Canvas 3001', 'BELLA+CANVAS 3001', 'Bella & Canvas 3001', 'Bella and Canvas', 'Bella &amp; Canvas']) {
    expect(publicProductText(`A ${name} tee, 100% cotton.`)).toBe('A QR Gear tee, 100% cotton.');
  }
  expect(publicProductText('QR Gear USA 250 — 1941')).toBe('QR Gear USA 250 — 1941');
});
