import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAdminBlanksController } from './useAdminBlanksController';
import { BlankPickerModal } from '../builder/modules/BlankPickerModal';
import { queryClient } from '@/lib/queryClient';
import AdminBlanks from '@/pages/admin-blanks';

const m = vi.hoisted(() => ({ data: {} as Record<string, any>, api: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { apiRequest: m.api, queryClient: new QueryClient({ defaultOptions: { queries: {
    retry: false, staleTime: Infinity, queryFn: ({ queryKey }) => m.data[String(queryKey[0])],
  }, mutations: { retry: false } } }) };
});
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: (p: any) => React.createElement('dialog', null, p.children),
  DialogContent: (p: any) => React.createElement('div', null, p.children),
  DialogTitle: (p: any) => React.createElement('h2', null, p.children),
}));
vi.mock('@/features/shared/components/skins/BlankPickerRowSkin', () => ({
  BlankPickerRowSkin: (p: any) => React.createElement('blank-row', p),
}));

vi.mock('@/components/AdminShell', () => ({ default: (p: any) => React.createElement('main', null, p.children) }));
vi.mock('@/components/admin/AdminSectionSubNav', () => ({ default: () => null }));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: (p: any) => React.createElement('div', null, p.children), ScrollBar: () => null }));
vi.mock('@/components/ui/alert-dialog', () => {
  const part = (p: any) => React.createElement('div', null, p.children);
  return { AlertDialog: (p: any) => p.open ? part(p) : null, AlertDialogContent: part, AlertDialogHeader: part, AlertDialogTitle: part, AlertDialogDescription: part, AlertDialogFooter: part };
});
vi.mock('@/features/shared/components/skins/AdminSourceBlankSkin', () => ({ AdminSourceBlankSkin: (p: any) => React.createElement('source-card', p) }));
vi.mock('@/features/shared/components/skins/AdminCatalogBlankSkin', () => ({ AdminCatalogBlankSkin: (p: any) => React.createElement('catalog-card', p) }));
vi.mock('@/features/shared/components/views/ScrollGridView', () => ({ ScrollGridView: (p: any) => React.createElement('div', null, ...p.items.map((item: any) => React.createElement(React.Fragment, { key: item.id }, p.renderItem(item)))) }));

let tree: ReactTestRenderer;
let controller: ReturnType<typeof useAdminBlanksController>;
function Probe({ target }: { target?: string | null }) {
  controller = useAdminBlanksController(target === undefined ? {} : { targetCatalogId: target });
  return null;
}
async function mount(target?: string | null, popup = false) {
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client: queryClient },
    popup ? React.createElement(BlankPickerModal, { targetCatalogId: target!, open: true, onOpenChange: vi.fn() })
      : React.createElement(Probe, { target }))); });
}

beforeEach(() => {
  vi.clearAllMocks(); queryClient.clear();
  const product = (id: number, provider: string) => ({ id, docId: `qrg_1100${id}`, title: `Blank ${id}`, fulfillmentProvider: provider, availableVia: [provider], images: [], availableColors: [], availableSizes: [] });
  m.data = {
    '/api/master-catalog/taxonomy': [],
    '/api/master-catalog': [{ name: 'T-Shirts', count: 2, items: [product(1, 'printify'), product(2, 'printful')] }],
    '/api/admin/catalog/printful-mappings': { firestoreMappings: [], hardcodedMappings: [] },
    '/api/admin/catalogs': { catalogs: [
      { id: 'primary', name: 'Primary', blankIds: [] },
      { id: 'members', name: 'Members', blankIds: ['qrg_11001'] },
      { id: 'empty', name: 'Empty', blankIds: [] },
    ] },
    '/api/admin/catalog-defaults': { defaultCatalogId: 'members' },
    '/api/admin/pricing-settings': { markupPercent: 25, markupFixed: 0, memberProfitShare: 0.25 },
  };
  for (const [key, data] of Object.entries(m.data)) queryClient.setQueryData([key], data);
  m.api.mockImplementation(async (method: string, url: string, body: any) => {
    if (method === 'POST') {
      m.data['/api/admin/catalogs'] = { catalogs: m.data['/api/admin/catalogs'].catalogs.map((c: any) =>
        url === `/api/admin/catalogs/${c.id}/blanks` ? { ...c, blankIds: [...c.blankIds, ...body.blankIds] } : c) };
      return { json: async () => ({ total: 1 }) };
    }
    if (method === 'DELETE') {
      m.data['/api/admin/catalogs'].catalogs = m.data['/api/admin/catalogs'].catalogs.map((c: any) =>
        url === `/api/admin/catalogs/${c.id}/blanks` ? { ...c, blankIds: c.blankIds.filter((id: string) => !body.blankIds.includes(id)) } : c);
      return { json: async () => ({ total: 0 }) };
    }
    return { json: async () => m.data[url] };
  });
});
afterEach(() => { act(() => tree?.unmount()); queryClient.clear(); });

it('uses the Products destination immediately and browses both providers without a hidden default source', async () => {
  await mount('primary');
  expect(controller.selectedCatalogId).toBe('primary');
  expect(controller.sourceCatalogId).toBeNull();
  expect(controller.scrollItems.map(p => p.id)).toEqual(['qrg_11001', 'qrg_11002']);
});

it('uses the shared canonical add endpoint and refreshes catalog membership', async () => {
  await mount('primary');
  await act(async () => { controller.onAddToCatalog('qrg_11001'); });
  await vi.waitFor(() => expect(controller.catalogBlankSet.has('qrg_11001')).toBe(true));
  expect(m.api).toHaveBeenCalledWith('POST', '/api/admin/catalogs/primary/blanks', expect.objectContaining({ blankIds: ['qrg_11001'] }));
  expect(m.data['/api/admin/catalogs'].catalogs.find((c: any) => c.id === 'members').blankIds).toEqual(['qrg_11001']);
});

it('changing source cannot change destination and an empty source stays empty', async () => {
  await mount('primary');
  act(() => controller.setSourceCatalogId('members'));
  expect(controller.scrollItems.map(p => p.id)).toEqual(['qrg_11001']);
  expect(controller.selectedCatalogId).toBe('primary');
  act(() => controller.setSourceCatalogId('empty'));
  expect(controller.scrollItems).toEqual([]);
});

it('does not add to a missing destination', async () => {
  await mount('deleted');
  act(() => controller.onAddToCatalog('qrg_11001'));
  expect(m.api).not.toHaveBeenCalled();
});

it('preserves standalone Blanks destination selection and provider controls', async () => {
  await mount();
  expect(controller.selectedCatalogId).toBeNull();
  expect(controller.sourceCatalogId).toBe('members');
  act(() => { controller.setSelectedCatalogId('members'); controller.setSourceCatalogId(null); });
  expect(controller.scrollItems.map(p => p.id)).toEqual(['qrg_11002']);
  act(() => controller.setProviderFilter('printify'));
  expect(controller.scrollItems.map(p => p.id)).toEqual(['qrg_11001']);
  expect(controller.selectedCatalogId).toBe('members');
});

it('popup shows its inherited destination in the title with only a source selector', async () => {
  await mount('primary', true);
  expect(tree.root.findByType('h2').children.join('')).toBe('Add Blank to Primary');
  const selects = tree.root.findAllByType('select');
  expect(selects).toHaveLength(1);
  expect(selects[0].props['data-testid']).toBe('modal-select-source-catalog');
  expect(selects[0].findAllByType('option').map(o => o.props.value)).toEqual(['', 'members', 'empty']);
});

it('uses saved images and actual cost, exposes missing members and keeps provider tables out of writes', async () => {
  const product = m.data['/api/master-catalog'][0].items[0];
  product.minPrice = '12.50'; product.images = ['https://images/original.png'];
  const catalog = m.data['/api/admin/catalogs'].catalogs[1];
  catalog.blankImages = { qrg_11001: [] }; catalog.blankIds.push('qrg_11999');
  await mount('members');
  expect(controller.sourceItemMap.get('qrg_11001')).toMatchObject({ price: 12.5, cost: null, images: [], primaryImageUrl: null });
  expect(controller.catalogItems.find(item => item.catalogKey === 'qrg_11999')).toMatchObject({ unavailable: true });
  await act(async () => { await controller.onImagesBulkSave('qrg_11001', []); });
  expect(m.api).toHaveBeenCalledWith('PUT', '/api/admin/catalogs/members/blank-images', { blankId: 'qrg_11001', images: [], restore: false });
  expect(m.api.mock.calls.every(([, url]) => String(url).startsWith('/api/admin/catalogs/'))).toBe(true);
});

it('adds from the selected source without sending provider snapshots', async () => {
  await mount('primary'); act(() => controller.setSourceCatalogId('members'));
  await act(async () => controller.onAddToCatalog('qrg_11001'));
  expect(m.api).toHaveBeenCalledWith('POST', '/api/admin/catalogs/primary/blanks', { blankIds: ['qrg_11001'], sourceCatalogId: 'members' });
});

it('shows a read failure instead of treating it as an empty catalog', async () => {
  queryClient.removeQueries({ queryKey: ['/api/master-catalog'] }); m.api.mockRejectedValueOnce(new Error('Catalog offline'));
  await mount('primary'); await vi.waitFor(() => expect(controller.loadError).toContain('Catalog offline'));
});

async function mountPage() {
  await act(async () => { tree = create(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(AdminBlanks))); });
}
const byTestId = (id: string) => tree.root.findAll(n => n.type === 'button' || n.type === 'select').find(n => n.props['data-testid'] === id)!;
it('confirms removal, clears confirmation on destination changes, and includes unavailable references in Clear All', async () => {
  m.data['/api/admin/catalogs'].catalogs[1].blankIds.push('qrg_11999');
  await mountPage();
  act(() => byTestId('select-target-catalog').props.onChange({ target: { value: 'members' } }));
  const card = tree.root.findAllByType('catalog-card')[0];
  act(() => card.props.onRemove(card.props.item.catalogKey));
  expect(m.api).not.toHaveBeenCalled(); expect(byTestId('button-confirm-remove-blanks')).toBeDefined();
  act(() => byTestId('select-target-catalog').props.onChange({ target: { value: 'empty' } }));
  expect(byTestId('button-confirm-remove-blanks')).toBeUndefined(); expect(m.api).not.toHaveBeenCalled();
  act(() => byTestId('select-target-catalog').props.onChange({ target: { value: 'members' } }));
  act(() => byTestId('button-clear-all').props.onClick());
  await act(async () => byTestId('button-confirm-remove-blanks').props.onClick());
  expect(m.api).toHaveBeenCalledWith('DELETE', '/api/admin/catalogs/members/blanks', { blankIds: ['qrg_11001', 'qrg_11999'] });
});
