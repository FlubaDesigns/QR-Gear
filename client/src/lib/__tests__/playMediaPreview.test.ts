import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PhoneMockupCard from '@/components/PhoneMockupCard';
import { playMediaPreview } from '@/lib/playMediaPreview';

let tree: ReturnType<typeof create>;
let visibility: (entries: any[]) => void;
beforeEach(() => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: any) { visibility = callback; } observe() {} disconnect() {} });
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });
function render(source?: string, type = 'qr-play') {
  act(() => { tree = create(React.createElement(PhoneMockupCard, { qrCodeUrl: '/qr.png', landingPageSnapshotUrl: '/snapshot.png', playMediaUrl: source, playPosterUrl: '/artwork.png', qrProductType: type, productName: 'Monument' })); });
  act(() => visibility([{ isIntersecting: true }]));
}
it('opens the actual YouTube player on first view with no excerpt limit', () => {
  render('https://www.youtube.com/watch?v=DVUbzOk8mCc');
  const iframe = tree.root.findByType('iframe');
  const url = new URL(iframe.props.src);
  expect(url.pathname).toBe('/embed/DVUbzOk8mCc');
  expect(url.searchParams.get('autoplay')).toBe('1');
  expect(url.searchParams.get('mute')).toBe('1');
  expect(url.searchParams.has('end')).toBe(false);
  expect(tree.root.findAllByProps({ 'aria-label': 'Play video' })).toHaveLength(0);
  expect(tree.root.findByType('a').props.href).toBe('https://www.youtube.com/watch?v=DVUbzOk8mCc');
  act(() => visibility([{ isIntersecting: false }]));
  expect(tree.root.findByType('iframe')).toBe(iframe);
});
it('lets files play beyond 15 seconds and preserves playback when scrolling', () => {
  render('https://storage.example/graphic.mp4');
  const video = tree.root.findByType('video');
  expect(video.props).toMatchObject({ src: 'https://storage.example/graphic.mp4', muted: true, controls: true, autoPlay: true, playsInline: true });
  const target = { currentTime: 80, paused: false, pause: vi.fn() };
  video.props.onTimeUpdate?.({ currentTarget: target });
  video.props.onPlay?.({ currentTarget: target });
  expect(target.pause).not.toHaveBeenCalled();
  expect(target.currentTime).toBe(80);
  act(() => visibility([{ isIntersecting: false }]));
  expect(tree.root.findByType('video')).toBe(video);
});
it('keeps full playback controls when reduced motion disables autoplay', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  render('https://www.youtube.com/watch?v=rgomsxUVa2U');
  const url = new URL(tree.root.findByType('iframe').props.src);
  expect(url.searchParams.get('autoplay')).toBe('0');
  expect(url.searchParams.has('end')).toBe(false);
});
it('shows an explicit unavailable state for missing or failed media', () => {
  render();
  expect(tree.root.findByProps({ role: 'status' }).children.join('')).toContain('No video is attached');
  act(() => tree.unmount());
  render('https://storage.example/graphic.mp4');
  act(() => tree.root.findByType('video').props.onError());
  expect(tree.root.findByProps({ role: 'status' }).children.join('')).toContain('Watch full video');
});
it('preserves image destination previews for non-video products', () => {
  render(undefined, 'qr-canvas');
  expect(tree.root.findByProps({ 'data-testid': 'img-phone-destination' }).props.src).toBe('/snapshot.png');
  expect(tree.root.findAllByType('iframe')).toHaveLength(0);
});
it('recognizes supported URL forms and rejects invalid schemes and video IDs', () => {
  expect(playMediaPreview('https://youtu.be/DVUbzOk8mCc', false)?.url).toContain('autoplay=0');
  expect(playMediaPreview('https://www.youtube.com/embed/DVUbzOk8mCc', true)?.kind).toBe('embed');
  expect(playMediaPreview('https://vimeo.com/123456/abc123', true)?.url).toContain('h=abc123');
  expect(playMediaPreview('https://youtube.com/watch?v=bad', true)).toBeNull();
  expect(playMediaPreview('javascript:alert(1)', true)).toBeNull();
});
