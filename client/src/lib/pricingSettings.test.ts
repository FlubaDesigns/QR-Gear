import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ query: {} as any, mutations: [] as any[], save: vi.fn(), toast: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => m.query, useMutation: (options: any) => { m.mutations.push(options); return { mutate: m.save, isPending: false }; } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('@/lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() }, apiRequest: vi.fn() }));
vi.mock('@/components/AdminShell', () => ({ default: ({children,actions}: any) => React.createElement('main', null, actions, children) }));
vi.mock('@/components/admin/AdminSectionSubNav', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminSectionCard', () => ({ default: ({children}: any) => React.createElement('section', null, children) }));
vi.mock('@/components/admin/StickyActionBar', () => ({ default: ({children}: any) => React.createElement('footer', null, children) }));
vi.mock('@/pages/admin-pricing-coupons', () => ({ CouponsSection: () => null }));
vi.mock('@/components/ui/switch', () => ({ Switch: () => null }));
import AdminPricing from '../pages/admin-pricing';
let tree: ReactTestRenderer;
beforeEach(() => { vi.clearAllMocks(); m.mutations = []; m.query = { data: { markupPercent:0, markupFixed:0, additionalPlacementCost:0,
 textLineUpcharge:0, centerGraphicUpcharge:0, memberProfitShare:0, builtInShippingCost:0, sizeUpcharges:{S:0}, hostingTiers:[{code:'year',name:'Year',price:0}],
 brandLabelPricing:{printifyInside:0,printifyOutside:0,printfulInside:0,printfulOutside:0}, preferredLabelPosition:'outside' }, isLoading:false }; });
afterEach(() => { if (tree) act(() => tree.unmount()); });
it('loads and submits zeros without substituting default charges', () => {
 act(() => { tree = create(React.createElement(AdminPricing)); });
 for (const id of ['input-built-in-shipping','input-member-profit-share','input-center-graphic-upcharge']) {
   expect(tree.root.findAllByType('input').find(i => i.props['data-testid']===id)?.props.value).toBe('0');
 }
 act(() => tree.root.findByProps({'data-testid':'button-save'}).props.onClick());
 expect(m.save).toHaveBeenCalledWith(m.query.data);
});
it('blocks a blank charge instead of silently turning it into zero or a default', () => {
 act(() => { tree = create(React.createElement(AdminPricing)); });
 const input = tree.root.findAllByType('input').find(i => i.props['data-testid']==='input-built-in-shipping')!;
 act(() => input.props.onChange({target:{value:''}}));
 act(() => tree.root.findByProps({'data-testid':'button-save'}).props.onClick());
 expect(m.save).not.toHaveBeenCalled(); expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive'}));
});
it('shows a load failure and disables saving rather than exposing fallback settings', () => {
 m.query = { data:undefined, isLoading:false, error:new Error('Unavailable'), refetch:vi.fn() };
 act(() => { tree = create(React.createElement(AdminPricing)); });
 expect(tree.root.findByProps({role:'alert'})).toBeTruthy();
 expect(tree.root.findAllByType('button').find(b => b.props['data-testid']==='button-save-pricing-header')?.props.disabled).toBe(true);
 expect(tree.root.findAllByType('input')).toHaveLength(0);
});
it('keeps missing configuration editable with blank amounts instead of inventing defaults', () => {
 m.query.data = {};
 act(() => { tree = create(React.createElement(AdminPricing)); });
 expect(tree.root.findAllByType('input').find(i => i.props['data-testid']==='input-built-in-shipping')?.props.value).toBe('');
 act(() => tree.root.findByProps({'data-testid':'button-save'}).props.onClick());
 expect(m.save).not.toHaveBeenCalled();
});
