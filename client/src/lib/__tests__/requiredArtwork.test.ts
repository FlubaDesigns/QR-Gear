vi.mock('@assets/qr_gear_logo_transparent_1778357953260.png', () => ({ default: 'https://files/logo.png' }));
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('@/lib/fontLoader', () => ({ loadGoogleFonts: async () => {} }));
vi.mock('@/features/shared/components/TextStyleEditor', () => ({ DEFAULT_FONT_SIZE_NUM: 24 }));
import { renderProductGraphic } from '@/features/shared/graphics/productGraphicRenderer';
import { renderLandingPage } from '@/features/shared/graphics/landingPageRenderer';
import { buildQrDestination } from '@shared/qrDestination';
import { isClaimCode, normalizeClaimCode } from '@shared/claimCode';
afterEach(() => vi.unstubAllGlobals());
function canvas() {
 const ctx = new Proxy({ measureText: () => ({ width: 10 }), drawImage: vi.fn() }, { get: (target: any, key) => target[key] || (() => {}) });
 vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx, toDataURL: () => 'data:image/png;base64,done' }) });
 vi.stubGlobal('window', { location: { origin: 'https://example.invalid' }, Image: class { width = 100; height = 100; onload: any; onerror: any; set src(value: string) { queueMicrotask(() => value.includes('missing') ? this.onerror() : this.onload()); } } });
 return ctx;
}
it('rejects incomplete selected print art instead of returning a successful composite', async () => {
 canvas();
 await expect(renderProductGraphic({ qrContent: 'hello', headerStyle: { enabled: true, mode: 'image', imageUrl: 'https://files/missing.png' }, graphicLayoutMode: 'zone' } as any)).rejects.toThrow('Selected artwork');
});
it('rejects a missing selected landing background but can render a valid background', async () => {
 const ctx = canvas(); await expect(renderLandingPage({ backgroundUrl: 'https://files/missing.png' })).rejects.toThrow('Selected landing');
 expect(await renderLandingPage({ backgroundUrl: 'https://files/canvas.png' })).toContain('data:image/png'); expect(ctx.drawImage).toHaveBeenCalled();
});
it('keeps Plus content direct and preserves both current activation code formats', () => {
 expect(buildQrDestination('qr_plus', 'https://destination.invalid', '/m/hosted')).toBe('https://destination.invalid');
 expect(buildQrDestination('qr_canvas', 'ignored', '/m/hosted')).toBe('/m/hosted');
 expect(() => buildQrDestination('qr_plus', '', '/m/hosted')).toThrow('destination');
 expect(isClaimCode('aBcDeFgH1234')).toBe(true); expect(normalizeClaimCode('aBcDeFgH1234')).toBe('aBcDeFgH1234');
 expect(isClaimCode('a'.repeat(24))).toBe(true); expect(normalizeClaimCode('a'.repeat(24))).toBe('A'.repeat(24));
 expect(isClaimCode('ABCD-1234')).toBe(false);
});
