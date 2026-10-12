import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: { sizeUpcharges: { L: 0 }, markupPercent: 0 } }) }));
vi.mock('@/features/shared/graphics/productGraphicRenderer', () => ({ renderProductGraphic: vi.fn(async () => 'test-artwork') }));
vi.mock('@shared/builderSnapshot', () => ({ productGraphicOptions: vi.fn(() => ({})) }));
vi.mock('@/features/shared/components/TextStyleEditor', () => ({ defaultTextStyle: { text: '', enabled: false } }));
import { useOwnerWizardState } from '@/features/owner/useOwnerWizardState';
import { readOwnerCheckoutDraft, clearOwnerCheckoutDraft } from './ownerCheckoutDraft';
let state: ReturnType<typeof useOwnerWizardState>;
let tree: ReactTestRenderer | undefined;
let memory: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };
let events: Map<string, () => void>;
const request = vi.fn();
function mount(guided = false) {
  function Probe() { state = useOwnerWizardState('', guided); return null; }
  act(() => { tree = create(React.createElement(Probe)); });
}
function unmount() { act(() => tree?.unmount()); tree = undefined; }
beforeEach(() => {
  memory = new Map(); events = new Map();
  storage = { getItem: vi.fn(k => memory.get(k) ?? null), setItem: vi.fn((k,v) => memory.set(k,v)), removeItem: vi.fn(k => memory.delete(k)) };
  vi.stubGlobal('window', { sessionStorage: storage, scrollTo: vi.fn(), location: { href: '' },
    addEventListener: (name: string, fn: () => void) => events.set(name, fn), removeEventListener: (name: string) => events.delete(name) });
  vi.stubGlobal('document', { documentElement: {scrollTop: 0}, body: {scrollTop: 0} });
  request.mockReset();
  request.mockImplementation(async (url: string) => ({ ok: true, json: async () => {
    if (url.endsWith('/builds')) return { packetId: 'saved-packet', buildToken: 'a'.repeat(64),
      builderSnapshot: { layoutConfig: { selectedPlacements: ['front'] } }, pricing: { customerPrice: 22.33, sizeUpcharges: { L: 0 } } };
    if (url.endsWith('/preview')) return { mockupUrl: 'https://example.com/mockup.png' };
    if (url.endsWith('/checkout')) return { url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' };
    return { success: true };
  } }));
  vi.stubGlobal('fetch', request);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });
async function prepare(type: 'qr-basic' | 'qr-plus' = 'qr-basic') {
  mount();
  act(() => {
    state.handleProductSelect({ blueprintId: 12, canonicalBlankKey: 'qrg_11001', title: 'Selected Shirt', retailPrice: 22.33,
      availableVariants: [{ color: 'Navy', size: 'L' }], availableSizes: ['L'] });
    state.setSelectedColor('Navy'); state.setSelectedShirtSize('L'); state.setSelectedPlacements(['front']);
    state.setGraphicSize('medium'); state.setPerPlacementSizes({front: 'medium'}); state.setQrType(type);
    state.setWantsHeaderFooter(type === 'qr-plus'); state.setTextLayoutChoice(type === 'qr-plus' ? 'header' : '');
    state.setHeaderStyle({text: 'Keep this text', enabled: true} as any);
    state.setQrBasicInputType('url'); state.setQrBasicContent('https://qrgear.com');
    state.setSimpleStep(type === 'qr-plus' ? 'qr-plus-mockup' : 'qr-basic-mockup');
  });
  await act(async () => { expect(await state.generateRealMockup()).toBe(true); });
}
it.each(['qr-basic', 'qr-plus'] as const)('restores the exact %s review after leaving Stripe and can retry with its saved packet', async type => {
  await prepare(type);
  await act(async () => { await state.handlePublicCheckout(); });
  expect(window.location.href).toContain('checkout.stripe.com');
  unmount(); request.mockClear(); mount(true);
  expect(state.simpleStep).toBe(`${type}-mockup`);
  expect(state.selectedProductType?.title).toBe('Selected Shirt');
  expect(state.selectedColor).toBe('Navy'); expect(state.selectedShirtSize).toBe('L');
  expect(state.qrBasicContent).toBe('https://qrgear.com'); expect(state.headerStyle.text).toBe('Keep this text');
  expect(state.realMockupUrl).toBe('https://example.com/mockup.png'); expect(state.runningCost).toBe(22.33);
  expect(state.guidedQueue).toEqual([]); expect(state.checkoutRestored).toBe(true);
  expect(state.isCheckingOut).toBe(false);
  await act(async () => { await state.handlePublicCheckout(); });
  expect(request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({packetId: 'saved-packet'});
});
it('invalidates the old preview and saved checkout when the restored design changes', async () => {
  await prepare(); await act(async () => { await state.handlePublicCheckout(); }); unmount(); mount();
  act(() => state.setQrBasicContent('https://qrgear.com/shop'));
  expect(state.realMockupUrl).toBeNull(); expect(state.checkoutRestored).toBe(false); expect(readOwnerCheckoutDraft()).toBeNull();
  request.mockClear(); await act(async () => { await state.handlePublicCheckout(); });
  expect(request).not.toHaveBeenCalled(); expect(state.buildError).toContain('Preview your current design');
});
it('keeps the review usable after a browser history restoration', async () => {
  await prepare(); await act(async () => { await state.handlePublicCheckout(); });
  expect(state.isCheckingOut).toBe(true); act(() => events.get('pageshow')?.());
  expect(state.isCheckingOut).toBe(false); expect(state.checkoutRestored).toBe(true);
});
it('does not leave for checkout when browser storage fails', async () => {
  await prepare(); storage.setItem.mockImplementation(() => { throw new Error('quota'); }); request.mockClear();
  await act(async () => { await state.handlePublicCheckout(); });
  expect(request).not.toHaveBeenCalled(); expect(state.buildError).toContain('could not save your design');
  expect(state.realMockupUrl).toBeTruthy(); expect(state.isCheckingOut).toBe(false);
});
it('only clears the matching checkout after payment verification', async () => {
  await prepare(); await act(async () => { await state.handlePublicCheckout(); });
  clearOwnerCheckoutDraft('cs_test_another'); expect(readOwnerCheckoutDraft()).not.toBeNull();
  clearOwnerCheckoutDraft('cs_test_fixture'); expect(readOwnerCheckoutDraft()).toBeNull();
});
it('surfaces malformed stored state rather than rendering a broken review', () => {
  memory.set('qrgear-owner-checkout', '{}'); mount();
  expect(state.buildError).toContain('could not be restored'); expect(state.simpleStep).toBe('product');
});
