import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { AllowedProductsEditor } from '@/features/storeBuilder/AllowedProductsEditor';
import { InstanceCard, MoveDialog } from '@/features/adminProducts/storeManager/StoreManagerTab';
import AdminStoreBuilderPage from '@/pages/admin-store-builder';
const mocks = vi.hoisted(() => ({ api:vi.fn(), admin:vi.fn(), toast:vi.fn(), search:'', navigate:vi.fn() }));
vi.mock('@/lib/queryClient',()=>({apiRequest:mocks.api}));
vi.mock('@/lib/adminFetch',()=>({adminFetch:mocks.admin}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('@/features/shared/components/DeleteBuildDialog',()=>({DeleteBuildDialog:()=>null}));
vi.mock('wouter',()=>({useSearch:()=>mocks.search,useLocation:()=>['/admin/store-builder',mocks.navigate]}));
vi.mock('@/components/AdminShell',()=>({default:({tabs,activeTab,onTabChange}:any)=>React.createElement('nav',{'data-active':activeTab},tabs.map((t:any)=>React.createElement('button',{key:t.id,onClick:()=>onTabChange(t.id)},t.label)))}));
vi.mock('@/components/ui/custom-dropdown',()=>({CustomDropdown:({options,onChange,value}:any)=>React.createElement('select',{value,onChange:(e:any)=>onChange(e.target.value)},options.map((o:any)=>React.createElement('option',{key:o.value,value:o.value},o.label)))}));
vi.mock('@/components/admin/AdminSectionSubNav',()=>({default:()=>null}));
let tree:ReactTestRenderer, client:QueryClient;
const flush=()=>new Promise(resolve=>setTimeout(resolve,5));
async function mount(element:any){client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});await act(async()=>{tree=create(React.createElement(QueryClientProvider,{client},element));await flush();});await act(async()=>{await flush();});}
const text=()=>JSON.stringify(tree.toJSON());
const buttons=()=>tree.root.findAllByType('button');
beforeEach(()=>{vi.clearAllMocks();mocks.search='';mocks.api.mockResolvedValue({json:async()=>[{items:[{docId:'qrg_11101',title:'Shirt',availableColors:[{name:'Black',hex:'#000'}],availableSizes:['M']}]}]});mocks.admin.mockResolvedValue({products:[]});});
afterEach(()=>{if(tree)act(()=>tree.unmount());client?.clear();vi.unstubAllGlobals();});
it.each(['catalog','channels','stores','partners'])('old %s links share Placement and preserve packet links when changing tabs',async tab=>{
 mocks.search=`tab=${tab}&packetId=p`;await mount(React.createElement(AdminStoreBuilderPage));expect(tree.root.findByType('nav').props['data-active']).toBe('placement');expect(buttons().map(b=>b.children[0])).toEqual(['Placement','Products']);act(()=>buttons()[1].props.onClick());expect(mocks.navigate).toHaveBeenCalledWith('/admin/store-builder?tab=library&packetId=p');
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

it('only warns on close when product choices have unsaved changes',async()=>{
 const onClose=vi.fn(),confirm=vi.fn(()=>false);vi.stubGlobal('window',{confirm});
 await mount(React.createElement(AllowedProductsEditor,{storeId:'a',onClose}));
 const close=()=>buttons().find(b=>b.children.includes('Close product choices'))!;
 act(()=>close().props.onClick());expect(onClose).toHaveBeenCalledTimes(1);expect(confirm).not.toHaveBeenCalled();
 act(()=>tree.root.findByProps({type:'checkbox'}).props.onChange());act(()=>close().props.onClick());
 expect(confirm).toHaveBeenCalledOnce();expect(onClose).toHaveBeenCalledTimes(1);expect(tree.root.findByProps({type:'checkbox'}).props.checked).toBe(true);
});
it('cannot close product choices while their save is in flight',async()=>{
 const onClose=vi.fn();await mount(React.createElement(AllowedProductsEditor,{storeId:'a',onClose}));
 act(()=>tree.root.findByProps({type:'checkbox'}).props.onChange());let resolve!:(v:any)=>void;
 mocks.admin.mockImplementation((_p:any,o:any)=>o?.method==='POST'?new Promise(r=>{resolve=r;}):Promise.resolve({products:[]}));
 await act(async()=>{buttons().find(b=>String(b.children[0]).startsWith('Save ('))!.props.onClick();await flush();});
 const close=buttons().find(b=>b.children.includes('Close product choices'))!;expect(close.props.disabled).toBe(true);act(()=>close.props.onClick());expect(onClose).not.toHaveBeenCalled();
 await act(async()=>{resolve({success:true});await flush();});
});
it('sends one destination update for rapid duplicate Move taps',async()=>{
 mocks.admin.mockImplementation(async(path:string)=>path.startsWith('/stores?')?[{id:'s',name:'S'}]:path.endsWith('/collections')?{collections:[]}:[{id:'c',name:'C'}]);
 await mount(React.createElement(MoveDialog,{instance:{id:'i'},onMoved:vi.fn(),onClose:vi.fn()}));
 for(const [index,value] of [[0,'internal'],[1,'s'],[2,'c']] as const){await act(async()=>{tree.root.findAllByType('select')[index].props.onChange({target:{value}});await flush();});await act(async()=>{await flush();});}
 const confirm=tree.root.findByProps({'data-testid':'button-confirm-move'});expect(confirm.props.disabled).toBe(false);
 let resolve!:(v:any)=>void;mocks.admin.mockImplementation((_p:any,o:any)=>o?.method==='PATCH'?new Promise(r=>{resolve=r;}):Promise.resolve([]));
 await act(async()=>{confirm.props.onClick();confirm.props.onClick();await flush();});
 expect(mocks.admin.mock.calls.filter(c=>c[1]?.method==='PATCH')).toHaveLength(1);
 await act(async()=>{resolve({success:true});await flush();});
});
it.each([['12.50',true],['unknown',false]])('safely displays older saved price %s',async(price,shown)=>{
 await mount(React.createElement(InstanceCard,{instance:{id:'i',resolved:{title:'Old product',pricing:{customerPrice:price as any}}},onDeleted:()=>{},onMoved:()=>{}}));
 expect(text().includes('12.50')).toBe(shown);expect(text()).not.toContain('NaN');
});
