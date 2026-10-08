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
  act(() => { tree = create(React.createElement(PhoneMockupCard, { qrCodeUrl: '/qr.png', landingPageSnapshotUrl: '/snapshot.png', playMediaUrl: source, qrProductType: type, productName: 'Monument' })); });
  act(() => visibility([{ isIntersecting: true }]));
}
it('renders the saved YouTube video as an embed, never as an image or video file', () => {
  render('https://www.youtube.com/watch?v=DVUbzOk8mCc');
  const iframe = tree.root.findByType('iframe');
  expect(iframe.props.src).toContain('/embed/DVUbzOk8mCc?');
  expect(iframe.props.src).toContain('mute=1');
  expect(iframe.props.src).toContain('end=15');
  expect(tree.root.findAllByType('video')).toHaveLength(0);
  expect(tree.root.findByType('a').props.href).toBe('https://www.youtube.com/watch?v=DVUbzOk8mCc');
});
it('plays the actual file muted, bounds the preview and removes playback offscreen', () => {
  render('https://storage.example/graphic.mp4');
  const video = tree.root.findByType('video');
  expect(video.props).toMatchObject({ src: 'https://storage.example/graphic.mp4', muted: true, controls: true, autoPlay: true, playsInline: true });
  const target = { currentTime: 16, paused: false, pause: vi.fn() };
  video.props.onTimeUpdate({ currentTarget: target });
  expect(target.pause).toHaveBeenCalledOnce();
  video.props.onPlay({ currentTarget: target });
  expect(target.currentTime).toBe(0);
  act(() => visibility([{ isIntersecting: false }]));
  expect(tree.root.findAllByType('video')).toHaveLength(0);
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
