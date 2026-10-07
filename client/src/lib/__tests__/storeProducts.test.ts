import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { StoreLibraryHarness } from '@/features/adminProducts/storeLibrary/StoreLibraryHarness';
import { PublishStatusBadge } from '@/features/adminProducts/storeLibrary/components/PublishStatusBadge';
import { PLACE_SUBNAV, BUILD_SUBNAV } from '@/components/admin/adminNavConfig';
const mocks=vi.hoisted(()=>({admin:vi.fn(),toast:vi.fn(),search:'',navigate:vi.fn()}));
vi.mock('@/lib/adminFetch',()=>({adminFetch:mocks.admin}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('wouter',()=>({useSearch:()=>mocks.search,useLocation:()=>['/admin/store-library',mocks.navigate]}));
vi.mock('@/features/adminProducts/storeManager/StoreManagerTab',()=>({InstanceCard:({instance,onMoved,onDeleted}:any)=>React.createElement('article',{'data-instance':instance.id},instance.resolved?.title,
 React.createElement('button',{onClick:onMoved},'Move complete'),React.createElement('button',{onClick:onDeleted},'Delete complete'))}));
vi.mock('@/components/ui/custom-dropdown',()=>({CustomDropdown:({options,onChange,value,...props}:any)=>React.createElement('select',{'data-testid':props['data-testid'],value,onChange:(e:any)=>onChange(e.target.value)},options.map((o:any)=>React.createElement('option',{key:o.value,value:o.value},o.label)))}));
let tree:ReactTestRenderer,client:QueryClient;
const flush=()=>new Promise(resolve=>setTimeout(resolve,8));
const render=()=>React.createElement(QueryClientProvider,{client},React.createElement(StoreLibraryHarness));
async function settle(){for(let i=0;i<3;i++)await act(async()=>{await flush();});}
async function mount(element?:any){client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});await act(async()=>{tree=create(element||render());await flush();});await settle();}
const text=()=>JSON.stringify(tree.toJSON());
const button=(label:string)=>tree.root.findAllByType('button').find(b=>b.children.includes(label))!;
beforeEach(()=>{vi.clearAllMocks();mocks.search='storeId=a&channel=Special%20%2F%20Channel';mocks.admin.mockImplementation(async(path:string)=>{
 if(path==='/stores')return [{id:'a',name:'Store A',roleType:'external'}];
 if(path==='/stores/a/channels')return [{id:'c-1',name:'Special / Channel',storeId:'a'}];
 if(path.startsWith('/catalog-instances?'))return {instances:[{id:'i',resolved:{title:'Saved item'}}]};
 throw new Error(`Unexpected endpoint ${path}`);
});});
afterEach(()=>{if(tree)act(()=>tree.unmount());client?.clear();});
it('renames only the Place library',()=>{expect(PLACE_SUBNAV.find(i=>i.href==='/admin/store-library')?.label).toBe('Store Products');expect(BUILD_SUBNAV.find(i=>i.href==='/admin/library')?.label).toBe('Library');});
it('resolves older channel-name links but loads canonical instances by ID',async()=>{await mount();expect(mocks.admin).toHaveBeenCalledWith('/catalog-instances?storeId=a&channelId=c-1');expect(text()).toContain('Saved item');expect(text()).not.toContain('Move to Target');expect(text()).not.toContain('Copy to Target');expect(tree.root.findByProps({'data-testid':'button-type-external'}).props['aria-pressed']).toBe(true);});
it('changing role clears store and channel from the destination URL',async()=>{await mount();act(()=>tree.root.findByProps({'data-testid':'button-type-marketplace'}).props.onClick());expect(mocks.navigate).toHaveBeenCalledWith('/admin/store-library?role=marketplace');});
it('does not turn destination failure into an empty product list',async()=>{mocks.admin.mockRejectedValue(new Error('Offline'));await mount();expect(text()).toContain('Could not load stores.');expect(text()).not.toContain('No products assigned');expect(button('Retry')).toBeDefined();});
it('shows product failures with retry and refreshes the shared instance cache after a move',async()=>{
 let fail=true;mocks.admin.mockImplementation(async(path:string)=>path==='/stores'?[{id:'a',name:'A',roleType:'internal'}]:path==='/stores/a/channels'?[{id:'c-1',name:'Special / Channel'}]:fail?Promise.reject(new Error('Offline')):{instances:[{id:'i',resolved:{title:'Saved item'}}]});
 await mount();expect(text()).toContain('Could not load store products.');fail=false;await act(async()=>{button('Retry').props.onClick();await flush();});await settle();expect(text()).toContain('Saved item');
 mocks.admin.mockClear();await act(async()=>{button('Move complete').props.onClick();await flush();});await settle();expect(mocks.admin).toHaveBeenCalledWith('/catalog-instances?storeId=a&channelId=c-1');
});
it('does not load all products when a linked channel is missing',async()=>{mocks.search='storeId=a&channelId=missing';await mount();expect(text()).toContain('This channel no longer exists');expect(mocks.admin.mock.calls.some(([p])=>p.startsWith('/catalog-instances'))).toBe(false);});
it('late store responses cannot restore a previous URL selection',async()=>{
 let resolve!:(v:any)=>void;mocks.admin.mockImplementation(()=>new Promise(r=>{resolve=r;}));await mount();
 mocks.search='role=member';act(()=>tree.update(render()));await act(async()=>{resolve([{id:'a',name:'A',roleType:'external'}]);await flush();});await settle();
 expect(tree.root.findByProps({'data-testid':'button-type-member'}).props['aria-pressed']).toBe(true);expect(mocks.admin).toHaveBeenCalledTimes(1);
});
it('does not claim synced when the saved status is unknown',async()=>{await mount(React.createElement(PublishStatusBadge,{printifyProductId:'p'}));expect(text()).toContain('Sync status unavailable');expect(text()).not.toContain('"Synced"');});
it('renders saved Firestore timestamps without Invalid Date',async()=>{await mount(React.createElement(PublishStatusBadge,{printifyProductId:'p',publishStatus:'synced',lastPublishedAt:{_seconds:1700000000} as any}));expect(text()).toContain('Synced');expect(text()).not.toContain('Invalid Date');});
