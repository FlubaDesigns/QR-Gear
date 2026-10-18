import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
import { loginReturnPath } from './loginReturn';
import { ContentRightsCheckbox } from '@/features/shared/components/ContentRightsCheckbox';
import { CollapsibleModule } from '@/features/shared/components/CollapsibleModule';
import { mergeCategoryTiers } from '@/features/shared/components/wizardSteps/ProductSteps';
it('returns checkout and claim sign-ins to current intent, rejects unsafe/stale redirects', () => {
 expect(loginReturnPath('?redirect=/checkout', '/old')).toBe('/checkout');
 expect(loginReturnPath('?redirect=%2Fclaim%2FAbc123', '/old')).toBe('/claim/Abc123');
 for (const bad of ['https://evil.test', '//evil.test', '/%2f%2fevil.test', '/\\evil.test', '/api/logout', '/login']) expect(loginReturnPath(`?redirect=${encodeURIComponent(bad)}`, '/old')).toBe('/');
 expect(loginReturnPath('', '/account')).toBe('/account');
});
it('retains every category in a tier while deduplicating canonical QRG choices', () => {
 const group = (key: string) => ({ tier: 'good', displayName: 'Good', description: '', tagline: '', products: [{ canonicalBlankKey: key }] } as any);
 const tiers = mergeCategoryTiers({ Shirts: { good: group('qrg_11111') }, Mugs: { good: group('qrg_22111') }, Duplicate: { good: group('qrg_11111') } });
 expect(tiers.good.products.map(p => p.canonicalBlankKey)).toEqual(['qrg_11111', 'qrg_22111']);
});
it('supports keyboard rights toggling and separates header actions from collapse controls', () => {
 const toggle = vi.fn(); let tree: any;
 act(() => { tree = create(React.createElement(ContentRightsCheckbox, { confirmed: false, onToggle: toggle })); });
 act(() => tree.root.findByProps({ role: 'checkbox' }).props.onKeyDown({ key: ' ', preventDefault: vi.fn() })); expect(toggle).toHaveBeenCalledTimes(1); act(() => tree.unmount());
 act(() => { tree = create(React.createElement(CollapsibleModule, { title: 'Artwork', headerRight: React.createElement('button', {}, 'Save'), children: 'Settings' })); });
 const button = tree.root.findByProps({ 'data-testid': 'collapsible-header-artwork' }); expect(button.type).toBe('button'); expect(button.props['aria-expanded']).toBe(true); expect(button.findAllByType('button')).toHaveLength(1);
 act(() => button.props.onClick()); expect(button.props['aria-expanded']).toBe(false); act(() => tree.unmount());
});

import { useOwnerWizardNav } from '@/features/owner/useOwnerWizardNav';
import { ComposeHostingStep } from '@/features/shared/components/wizardSteps/ComposeSteps';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
it('uses configured full-term Compose hosting prices without invented included prices', () => {
 const query = new QueryClient({ defaultOptions: { queries: { retry: false } } }); query.setQueryData(['/api/pricing-settings'], {hostingTiers:[{code:'3_year',name:'Three years',price:13.42},{code:'2_year',name:'Unsupported two years',price:8}]});
 const select=vi.fn(); let tree:any;
 act(()=>{tree=create(React.createElement(QueryClientProvider,{client:query},React.createElement(ComposeHostingStep,{selected:'',onSelect:select})));});
 expect(tree.root.findAllByProps({'data-testid':'button-hosting-2-year'})).toHaveLength(0);
 expect(JSON.stringify(tree.toJSON())).toContain('$13.42');expect(JSON.stringify(tree.toJSON())).not.toContain('$3.99/yr');
 act(()=>tree.root.findByProps({'data-testid':'button-hosting-3-year'}).props.onClick());expect(select).toHaveBeenCalledWith('3-year');act(()=>tree.unmount());query.clear();
});
it.each(Object.entries({ 'product-congrats':'product',color:'product-congrats',size:'color',type:'size','compose-explain':'type','placement-count':'type','graphic-size':'placement-count',generate:'graphic-size','layout-mode':'generate','text-choice':'layout-mode','text-edit-header':'text-choice','text-edit-footer':'text-edit-header','placement-config':'text-edit-footer','shirt-preview':'text-edit-footer','qr-basic-type':'generate','qr-basic-input':'qr-basic-type','qr-basic-mockup':'qr-basic-input','qr-plus-mockup':'qr-basic-input' }))('owner Back reverses %s to %s', (step, previous) => {
 let nav:any,tree:any;const setStep=vi.fn();const noop=vi.fn();
 function Probe(){nav=useOwnerWizardNav({simpleStep:step,qrBasicContent:'',currentPlacementIndex:0,selectedPlacements:['front'],perPlacementSizes:{},textLayoutChoice:'both',headerStyle:{text:''},footerStyle:{text:''},sizeCostBonuses:{}} as any,new Proxy({setSimpleStep:setStep},{get:(target:any,key)=>target[key]||noop}) as any);return null;}
 act(()=>{tree=create(React.createElement(Probe));});act(()=>nav.handleBack());expect(setStep).toHaveBeenCalledWith(previous);act(()=>tree.unmount());
});
