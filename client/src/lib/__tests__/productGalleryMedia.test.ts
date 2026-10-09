import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, it } from 'vitest';
import ProductGalleryMedia from '@/components/ProductGalleryMedia';
import { publicProductText } from '@shared/descriptionLayers';
let tree: ReturnType<typeof create>;
afterEach(() => { if (tree) act(() => tree.unmount()); });
it('shows a real paused file frame with controls and a non-playing thumbnail', () => {
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item: { type: 'video', url: 'https://example.com/movie.mp4' } })); });
  const video = tree.root.findByType('video');
  expect(video.props).toMatchObject({ src: 'https://example.com/movie.mp4#t=1', controls: true, muted: true, playsInline: true });
  expect(video.props.autoPlay).toBeUndefined();
  const target = { currentTime: 0, duration: 145 };
  video.props.onLoadedMetadata({ currentTarget: target });
  expect(target.currentTime).toBe(1);
  act(() => { tree.update(React.createElement(ProductGalleryMedia, { item: { type: 'video', url: 'https://example.com/movie.mp4' }, thumbnail: true })); });
  expect(tree.root.findByType('video').props.controls).toBe(false);
});
it('shows a YouTube still until Play is selected, then uses the saved video embed', () => {
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item: { type: 'video', url: 'https://www.youtube.com/watch?v=DVUbzOk8mCc' } })); });
  expect(tree.root.findByType('img').props.src).toBe('https://i.ytimg.com/vi/DVUbzOk8mCc/hqdefault.jpg');
  expect(tree.root.findAllByType('iframe')).toHaveLength(0);
  act(() => tree.root.findByType('button').props.onClick());
  expect(tree.root.findByType('iframe').props.src).toContain('/embed/DVUbzOk8mCc?autoplay=1');
});
it('exposes a source link instead of a blank player when direct media fails', () => {
  act(() => { tree = create(React.createElement(ProductGalleryMedia, { item: { type: 'video', url: 'https://example.com/movie.mp4' } })); });
  act(() => tree.root.findByType('video').props.onError());
  expect(tree.root.findByType('a').props.href).toBe('https://example.com/movie.mp4');
});
it('uses public QR Gear branding without changing other descriptive facts', () => {
  for (const name of ['Bella + Canvas 3001', 'BELLA+CANVAS 3001', 'Bella & Canvas 3001', 'Bella and Canvas', 'Bella &amp; Canvas']) {
    expect(publicProductText(`A ${name} tee, 100% cotton.`)).toBe('A QR Gear tee, 100% cotton.');
  }
  expect(publicProductText('QR Gear USA 250 — 1941')).toBe('QR Gear USA 250 — 1941');
});
