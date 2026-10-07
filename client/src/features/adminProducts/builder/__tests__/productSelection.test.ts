import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderProvider, useBuilderContext } from '../BuilderContext';
import { ProductsModule } from '../modules/ProductsModule';
import type { CatalogProduct } from '../types';

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(), apiRequest: vi.fn(), toast: vi.fn(),
  queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn() },
  context: {} as any, catalogData: {} as any, categories: [] as any[],
}));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: mocks.adminFetch }));
vi.mock('@/lib/queryClient', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} } }));
vi.mock('../../ProductsContext', () => ({ useProductsContext: () => mocks.context }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
  useQuery: ({ queryKey }: any) => ({ data:
    queryKey[0] === '/api/admin/catalogs' ? mocks.catalogData :
    queryKey[0] === '/api/master-catalog' ? mocks.categories : undefined,
  }),
}));
vi.mock('@/features/shared/components/skins/ProductSelectCardSkin', () => ({
  ProductSelectCardSkin: (props: any) => React.createElement('product-card', props),
}));
vi.mock('@/features/shared/components/views/ScrollVerticalView', () => ({
  ScrollVerticalView: ({ items, renderItem }: any) => React.createElement(React.Fragment, null,
    ...items.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem(item)))),
}));
vi.mock('../modules/BlankPickerModal', () => ({ BlankPickerModal: () => null }));

function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const blank = (docId = 'qrg_11001', provider: 'printify' | 'printful' = 'printify'): CatalogProduct => ({
  id: 71, docId, title: `Provider ${docId}`, description: 'Provider description', brand: 'Test', model: 'Test',
  imageUrl: null, madeInUSA: true, minPrice: null, maxPrice: null, colorCount: 1,
  availableColors: [{ name: 'Black', hex: '#000000' }], availableSizes: ['S'],
  blueprintId: 71, printProviderId: 1, fulfillmentProvider: provider,
  printifyBlueprintId: 71, printifyProviderId: 1, printfulProductId: 71,
} as CatalogProduct);
const options = (provider = 'printify', location = 'front', width = 1000) => ({
  availableColors: [{ name: provider === 'printify' ? 'Red' : 'Blue', hex: '#123456' }],
  availableSizes: [{ code: '105', label: 'XL' }],
  schemaFamily: 'apparel', schemaType: 'tshirt', canonicalProfilePath: 'layout_profiles/apparel/tshirts',
  printLocations: [{ id: location, label: location, provider, providerPlacement: location,
    providerPlacementId: `${provider}-${location}`, dimensions: { widthPx: width, heightPx: 2000 } }],
});
let current: ReturnType<typeof useBuilderContext>;
let tree: ReactTestRenderer;
let requests: Array<ReturnType<typeof deferred>>;
function Probe() { current = useBuilderContext(); return null; }
function Harness({ cards = false }: { cards?: boolean }) {
  const [selectedProviders, setSelectedProviders] = React.useState(['printify']);
  mocks.context = { ...mocks.context, selectedProviders, setSelectedProviders };
  return React.createElement(BuilderProvider, null, React.createElement(Probe), cards ? React.createElement(ProductsModule) : null);
}
async function mount(cards = false) {
  await act(async () => { tree = create(React.createElement(Harness, { cards })); });
}
async function resolveOptions(index: number, data = options()) {
  await act(async () => { requests[index].resolve(data); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  mocks.context = { api: {}, selectedRole: null, selectedStore: null, selectedChannel: null, selectedCollection: null,
    setSelectedRole: vi.fn(), setSelectedStore: vi.fn(), setSelectedChannel: vi.fn(), setSelectedCollection: vi.fn() };
  requests = [];
  mocks.adminFetch.mockImplementation(() => { const request = deferred(); requests.push(request); return request.promise; });
  mocks.catalogData = { catalogs: [{ id: 'catalog', name: 'Catalog', blankIds: ['qrg_11001', 'qrg_11002'],
    blankTitles: { qrg_11001: 'Catalog title' }, blankDescriptions: { qrg_11001: 'Catalog description' } }] };
  mocks.categories = [{ name: 'T-Shirts', items: [blank(), blank('qrg_11002')], count: 2 }];
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Product selection through the real builder context', () => {
  it('loads sizes and colors, then clears blank-specific state when selecting another QRG blank with the same provider ID', async () => {
    await mount();
    await act(async () => { current.selectProduct(blank()); });
    await resolveOptions(0);
    expect(current.state.selectedProduct?.availableSizes).toEqual(['XL']);
    await act(async () => {
      current.setSelectedColor({ name: 'Red', hex: '#123456' });
      current.togglePlacement('front');
      current.setActiveSession('session-a', 'artifact_ready', 'instance-a');
      current.setActivePacketId('packet-a');
      current.loadGraphic({ compositeUrl: 'old.png', qrOnlyUrl: 'old-qr.png' });
      current.setContent({ title: 'Reusable design' });
    });
    expect(current.state.providerLayout?.dimensions?.widthPx).toBe(1000);
    await act(async () => { current.selectProduct(blank('qrg_11002')); });
    expect(current.state.selectedProduct?.docId).toBe('qrg_11002');
    expect(current.state.selectedColor).toBeNull();
    expect(current.state.selectedPlacements).toEqual([]);
    expect(current.state.placementConfig).toEqual({});
    expect(current.state.providerLayout).toBeNull();
    expect(current.state.activeSessionId).toBeNull();
    expect(current.state.activePacketId).toBeNull();
    expect(current.state.loadedGraphic).toBeNull();
    expect(current.state.content.title).toBe('Reusable design');
  });

  it('ignores old options after A → B → A and invalidates the old session handoff', async () => {
    await mount();
    let first!: () => boolean;
    await act(async () => { first = current.selectProduct(blank()); });
    await act(async () => { current.selectProduct(blank('qrg_11002')); });
    await act(async () => { current.selectProduct(blank()); });
    expect(first()).toBe(false);
    await resolveOptions(2, options('printify', 'back', 4000));
    await resolveOptions(0, options('printify', 'front', 500));
    await resolveOptions(1);
    expect(current.state.selectedProduct?.placements?.map(p => p.id)).toEqual(['back']);
  });

  it('queries the newly selected provider even while the old options are still loading', async () => {
    await mount();
    await act(async () => { current.selectProduct(blank()); });
    await act(async () => { mocks.context.setSelectedProviders(['printful']); });
    expect(mocks.adminFetch.mock.calls.at(-1)?.[0]).toContain('provider=printful');
    await resolveOptions(1, options('printful', 'back', 5000));
    await resolveOptions(0);
    expect(current.state.fulfillmentProvider).toBe('printful');
    expect(current.state.selectedProduct?.fulfillmentProvider).toBe('printful');
    expect(current.state.selectedProduct?.availableColors[0].name).toBe('Blue');
    expect(current.state.selectedProduct?.placements?.map(p => p.id)).toEqual(['back']);
  });

  it('restores a draft using fresh dimensions and removes unavailable print-area settings', async () => {
    await mount();
    await act(async () => { current.loadFromWorkingState({
      metadata: { fulfillmentProvider: 'printful' }, qrConfig: { selectedColor: { name: 'Red', hex: '#FF0000' } },
      layoutConfig: { selectedPlacements: ['back', 'sleeve'], placementConfig: { back: 'qr', sleeve: 'qr' },
        placementSizes: { sleeve: 'small' }, placementMethods: { sleeve: 'dtg' } },
      providerLayout: { dimensions: { widthPx: 5 } },
    }, blank()); });
    await resolveOptions(0, options('printful', 'back', 7000));
    expect(current.state.selectedPlacements).toEqual(['back']);
    expect(current.state.placementConfig).toEqual({ back: 'qr' });
    expect(current.state.placementSizes).toEqual({});
    expect(current.state.placementMethods).toEqual({});
    expect(current.state.selectedColor).toBeNull();
    expect(current.state.masterTitle).toBe('Provider qrg_11001');
    expect(current.state.providerLayout?.dimensions?.widthPx).toBe(7000);
    await act(async () => { current.togglePlacement('back'); });
    expect(current.state.providerLayout).toBeNull();
  });

  it('keeps the selected build while browsing filters, and reset invalidates pending selection work', async () => {
    await mount();
    let ownsSelection!: () => boolean;
    await act(async () => { ownsSelection = current.selectProduct(blank()); current.setActiveSession('session-a', 'working', null); });
    await act(async () => { current.setCategory('Hoodies'); current.setGenderFilter('all'); });
    expect(current.state.selectedProduct?.docId).toBe('qrg_11001');
    expect(current.state.activeSessionId).toBe('session-a');
    mocks.adminFetch.mockResolvedValueOnce({ success: true });
    await act(async () => { await current.resetBuilder(); });
    expect(ownsSelection()).toBe(false);
    await resolveOptions(0);
    expect(current.state.selectedProduct).toBeNull();
  });
});

describe('Product cards and draft handoff', () => {
  async function cards() {
    await mount(true);
    await act(async () => { current.setSelectedCatalogId('catalog'); });
    return () => tree.root.findAllByType('product-card');
  }
  it('highlights the QRG card, keeps provider copy distinct, and binds only the latest selected draft', async () => {
    const sessions = [deferred(), deferred()];
    mocks.apiRequest.mockImplementationOnce(() => sessions[0].promise).mockImplementationOnce(() => sessions[1].promise);
    const getCards = await cards();
    expect(getCards()).toHaveLength(2);
    await act(async () => { const card = getCards()[0]; card.props.onSelect(card.props.item.id, card.props.item); });
    expect(getCards()[0].props.isSelected).toBe(true);
    expect(current.state.selectedProduct?.title).toBe('Provider qrg_11001');
    expect(current.state.masterDescription).toBe('Provider description');
    expect(current.state.adminCatalogTitle).toBe('Catalog title');
    expect(current.state.productDescription).toBe('Catalog description');
    await act(async () => { const card = getCards()[1]; card.props.onSelect(card.props.item.id, card.props.item); });
    await act(async () => { sessions[1].resolve({ json: async () => ({ sessionId: 'session-b', session: { status: 'working' } }) }); });
    await act(async () => { sessions[0].resolve({ json: async () => ({ sessionId: 'session-a', isExisting: true,
      session: { working: { title: 'Old draft' }, generated: { packetId: 'old-packet' } } }) }); });
    expect(current.state.activeSessionId).toBe('session-b');
    expect(current.state.selectedProduct?.docId).toBe('qrg_11002');
    expect(current.state.activePacketId).toBeNull();
    expect(getCards()[0].props.isSelected).toBe(false);
    expect(getCards()[1].props.isSelected).toBe(true);
    expect(mocks.apiRequest.mock.calls[1][2].sourceMasterId).toBe('qrg_11002');
  });

  it('New tells the existing product route to create a fresh session, then consumes that intent', async () => {
    mocks.apiRequest.mockResolvedValue({ json: async () => ({ sessionId: 'fresh', isExisting: false, session: { status: 'working' } }) });
    const getCards = await cards();
    await act(async () => { await current.resetBuilder(); current.setSelectedCatalogId('catalog'); });
    await act(async () => { const card = getCards()[0]; card.props.onSelect(card.props.item.id, card.props.item); });
    expect(mocks.apiRequest.mock.calls[0][2].forceNew).toBe(true);
    expect(current.state.activeSessionId).toBe('fresh'); expect(current.state.forceNewSession).toBe(false);
  });

  it('editing another catalog card does not replace the active product or session', async () => {
    mocks.apiRequest.mockResolvedValue({ json: async () => ({ sessionId: 'session-a', session: { status: 'working' } }) });
    const getCards = await cards();
    await act(async () => { const card = getCards()[0]; card.props.onSelect(card.props.item.id, card.props.item); });
    await act(async () => { await getCards()[1].props.onTitleSave('qrg_11002', 'Other catalog title'); });
    expect(current.state.selectedProduct?.docId).toBe('qrg_11001');
    expect(current.state.activeSessionId).toBe('session-a');
    expect(current.state.adminCatalogTitle).toBe('Catalog title');
    expect(mocks.apiRequest.mock.calls.at(-1)?.[2]).toEqual({ blankId: 'qrg_11002', title: 'Other catalog title' });
  });
});
