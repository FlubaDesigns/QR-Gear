import { afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ preview: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/memberBuild', () => ({ previewMemberBuild: m.preview, publishMemberBuild: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('@/lib/memberFetch', () => ({ memberFetch: m.fetch }));
import { executeGenerateProductMockup } from '@/features/members/wizard-context-actions';
import { executeSimpleNext } from '@/features/members/wizard-context-navigation';
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it('passes hosted artwork and placement inputs through the canonical preview and never substitutes a QR for failed mockups', async () => {
 const setMockup = vi.fn(); const ctx: any = { user: { id: 'owner' }, qrType: 'qr-canvas', selectedChannel: { id: 'channel' }, selectedProductType: { canonicalBlankKey: 'qrg_11111', fulfillmentProvider: 'printful' }, selectedPlacements: ['back'], perPlacementConfigs: { back: { graphicChoice: 'qr-only', qrPositionX: 12 } }, perPlacementSizes: { back: 'large' }, headerStyle: { text: 'Saved', enabled: true }, footerStyle: { enabled: false }, areaImageUrl: 'https://example.test/art.png', setProductGraphic: vi.fn(), toast: vi.fn() };
 m.preview.mockResolvedValue({ mockupUrl: 'https://example.test/actual.png', productGraphic: 'saved-art' });
 expect(await executeGenerateProductMockup(ctx, 'qr-canvas', setMockup)).toBe(true);
 const input = m.preview.mock.calls[0][1]; expect(input).toMatchObject({ selectedPlacements: ['back'], perPlacementConfigs: ctx.perPlacementConfigs, areaImageUrl: ctx.areaImageUrl, headerStyle: ctx.headerStyle });
 expect(setMockup).toHaveBeenCalledWith('https://example.test/actual.png');
 m.preview.mockRejectedValue(new Error('Supplier unavailable')); expect(await executeGenerateProductMockup(ctx, 'qr-canvas', setMockup)).toBe(false); expect(setMockup).toHaveBeenLastCalledWith(''); expect(ctx.toast).toHaveBeenCalledWith(expect.objectContaining({title:'Preview failed'}));
});
it('keeps the current hosted step when preview fails and keeps video library failure recoverable', async () => {
 vi.stubGlobal('window', { scrollTo: vi.fn() }); vi.stubGlobal('document', { documentElement: {}, body: {} });
 const ctx: any = { user: {id:'owner'}, simpleStep: 'play-preview', setIsGeneratingPlayMockup: vi.fn(), setSimpleStep: vi.fn(), generateProductMockupForType: vi.fn(async () => false) };
 await executeSimpleNext(ctx); expect(ctx.setSimpleStep).not.toHaveBeenCalled();
 ctx.simpleStep='play-save-choice';ctx.savePlayToLibrary=vi.fn(async()=>{throw Error('offline');});ctx.handlePlayDone=vi.fn();await executeSimpleNext(ctx);expect(ctx.handlePlayDone).not.toHaveBeenCalled();
});
