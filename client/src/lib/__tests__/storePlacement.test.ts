import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { AllowedProductsEditor } from '@/features/storeBuilder/AllowedProductsEditor';
import { InstanceCard } from '@/features/adminProducts/storeManager/StoreManagerTab';
import AdminStoreBuilderPage from '@/pages/admin-store-builder';
const mocks = vi.hoisted(() => ({ api:vi.fn(), admin:vi.fn(), toast:vi.fn(), search:'', navigate:vi.fn() }));
vi.mock('@/lib/queryClient',()=>({apiRequest:mocks.api}));
vi.mock('@/lib/adminFetch',()=>({adminFetch:mocks.admin}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('@/features/shared/components/DeleteBuildDialog',()=>({DeleteBuildDialog:()=>null}));
vi.mock('wouter',()=>({useSearch:()=>mocks.search,useLocation:()=>['/admin/store-builder',mocks.navigate]}));
vi.mock('@/components/AdminShell',()=>({default:({tabs,activeTab,onTabChange}:any)=>React.createElement('nav',{'data-active':activeTab},tabs.map((t:any)=>React.createElement('button',{key:t.id,onClick:()=>onTabChange(t.id)},t.label)))}));
vi.mock('@/components/admin/AdminSectionSubNav',()=>({default:()=>null}));
let tree:ReactTestRenderer, client:QueryClient;
const flush=()=>new Promise(resolve=>setTimeout(resolve,5));
async function mount(element:any){client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});await act(async()=>{tree=create(React.createElement(QueryClientProvider,{client},element));await flush();});await act(async()=>{await flush();});}
const text=()=>JSON.stringify(tree.toJSON());
const buttons=()=>tree.root.findAllByType('button');
beforeEach(()=>{vi.clearAllMocks();mocks.search='';mocks.api.mockResolvedValue({json:async()=>[{items:[{docId:'qrg_11101',title:'Shirt',availableColors:[{name:'Black',hex:'#000'}],availableSizes:['M']}]}]});mocks.admin.mockResolvedValue({products:[]});});
afterEach(()=>{if(tree)act(()=>tree.unmount());client?.clear();});
it.each(['catalog','channels','stores','partners'])('old %s links share Placement and preserve packet links when changing tabs',async tab=>{
 mocks.search=`tab=${tab}&packetId=p`;await mount(React.createElement(AdminStoreBuilderPage));expect(tree.root.findByType('nav').props['data-active']).toBe('placement');expect(buttons().map(b=>b.children[0])).toEqual(['Placement','Product Library']);act(()=>buttons()[1].props.onClick());expect(mocks.navigate).toHaveBeenCalledWith('/admin/store-builder?tab=library&packetId=p');
});
it('shows failed product reads instead of an editable empty list',async()=>{mocks.admin.mockRejectedValue(new Error('Offline'));await mount(React.createElement(AllowedProductsEditor,{storeId:'a'}));expect(text()).toContain('Could not load product choices');expect(buttons().map(b=>b.children[0])).toContain('Retry');expect(tree.root.findAllByType('input')).toHaveLength(0);});
it('retains failed edits and blocks duplicate saves',async()=>{
 await mount(React.createElement(AllowedProductsEditor,{storeId:'a'}));act(()=>tree.root.findByProps({type:'checkbox'}).props.onChange());
 let reject!:(e:Error)=>void;mocks.admin.mockImplementation((_path:any,options:any)=>options?.method==='POST'?new Promise((_r,j)=>{reject=j;}):Promise.resolve({products:[]}));
 const save=buttons().find(b=>String(b.children[0]).startsWith('Save ('))!;
 await act(async()=>{save.props.onClick();save.props.onClick();await flush();});expect(mocks.admin.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
 await act(async()=>{reject(new Error('Offline'));await flush();});expect(text()).toContain('Save failed: Offline');expect(tree.root.findByProps({type:'checkbox'}).props.checked).toBe(true);
});
it('keeps explicit empty colors disabled and prevents rapid competing updates',async()=>{
 const instance={id:'i',enabledColors:[],enabledSizes:[],resolved:{title:'Item',colors:['Black'],sizes:['M']}};
 await mount(React.createElement(InstanceCard,{instance,onDeleted:()=>{},onMoved:()=>{}}));
 const color=tree.root.findByProps({'data-testid':'toggle-color-Black'});expect(color.props['aria-pressed']).toBe(false);
 let resolve!:(value:any)=>void;mocks.admin.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 await act(async()=>{color.props.onClick();color.props.onClick();await flush();});expect(mocks.admin).toHaveBeenCalledTimes(1);expect(mocks.admin).toHaveBeenCalledWith('/catalog-instances/i',{method:'PATCH',json:{enabledColors:['Black']}});
 await act(async()=>{resolve({success:true});await flush();});
});
