import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { StoreManagerTab } from '@/features/adminProducts/storeManager/StoreManagerTab';
import LegacyStoreProductsPage from '@/pages/admin-store-library';
import { PublishStatusBadge } from '@/features/adminProducts/storeManager/PublishStatusBadge';
import { PLACE_SUBNAV, BUILD_SUBNAV } from '@/components/admin/adminNavConfig';
const mocks=vi.hoisted(()=>({admin:vi.fn(),toast:vi.fn(),search:'',navigate:vi.fn()}));
vi.mock('@/lib/adminFetch',()=>({adminFetch:mocks.admin}));
vi.mock('@/lib/queryClient',()=>({apiRequest:vi.fn()}));
vi.mock('@/hooks/use-toast',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('@/features/shared/components/DeleteBuildDialog',()=>({DeleteBuildDialog:()=>null}));
vi.mock('wouter',()=>({useSearch:()=>mocks.search,useLocation:()=>['/admin/store-library',mocks.navigate]}));
vi.mock('@/components/ui/custom-dropdown',()=>({CustomDropdown:({options,onChange,value,...props}:any)=>React.createElement('select',{'data-testid':props['data-testid'],value,onChange:(e:any)=>onChange(e.target.value)},options.map((o:any)=>React.createElement('option',{key:o.value,value:o.value},o.label)))}));
let tree:ReactTestRenderer,client:QueryClient;
const flush=()=>new Promise(resolve=>setTimeout(resolve,8));
const page=(props:any={initialStoreId:'a',initialChannelKey:'Special / Channel'})=>React.createElement(QueryClientProvider,{client},React.createElement(StoreManagerTab,props));
async function settle(){for(let i=0;i<6;i++)await act(async()=>{await flush();});}
async function mount(element?:any,props?:any){client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});await act(async()=>{tree=create(element||page(props));await flush();});await settle();}
const text=()=>JSON.stringify(tree.toJSON());
const button=(label:string)=>tree.root.findAllByType('button').find(b=>b.children.includes(label))!;
beforeEach(()=>{vi.clearAllMocks();mocks.search='storeId=a&channel=Special%20%2F%20Channel';mocks.admin.mockImplementation(async(path:string)=>{
 if(path==='/stores'||path.startsWith('/stores?'))return [{id:'a',name:'Store A',roleType:'external'}];
 if(path==='/stores/a/channels')return [{id:'c-1',name:'Special / Channel',storeId:'a'}];
 if(path.endsWith('/collections'))return {collections:[]};
 if(path==='/channels')return [];
 if(path.includes('unplaced=true'))return {instances:[]};
 if(path.startsWith('/catalog-instances?'))return {instances:[{id:'i',resolved:{title:'Saved item'}}]};
 throw new Error(`Unexpected endpoint ${path}`);
});});
afterEach(()=>{if(tree)act(()=>tree.unmount());client?.clear();});
it('removes only the duplicate Place tab and preserves Build Library',()=>{expect(PLACE_SUBNAV.some(i=>i.href==='/admin/store-library')).toBe(false);expect(BUILD_SUBNAV.find(i=>i.href==='/admin/library')?.label).toBe('Library');});
it('redirects older links into Placement with their store and channel intact',async()=>{
 await mount(React.createElement(LegacyStoreProductsPage));expect(mocks.navigate).toHaveBeenCalledWith('/admin/store-builder?storeId=a&channel=Special+%2F+Channel&tab=placement',{replace:true});
});
it('resolves channel-name links but requests canonical instances by ID',async()=>{await mount();expect(mocks.admin).toHaveBeenCalledWith('/catalog-instances?storeId=a&channelId=c-1');expect(mocks.admin).not.toHaveBeenCalledWith('/catalog-instances?storeId=a');expect(text()).toContain('Saved item');expect(text()).not.toContain('Copy to Target');});
it('keeps search, manual refresh and all-channel browsing in Placement',async()=>{
 await mount();act(()=>tree.root.findByProps({'aria-label':'Find store products'}).props.onChange({target:{value:'missing'}}));expect(text()).toContain('No products match your search.');
 mocks.admin.mockClear();await act(async()=>{button('Refresh').props.onClick();await flush();});await settle();expect(mocks.admin).toHaveBeenCalledWith('/catalog-instances?storeId=a&channelId=c-1');
 await act(async()=>{button('All channels').props.onClick();await flush();});await settle();expect(mocks.admin).toHaveBeenCalledWith('/catalog-instances?storeId=a');
});
it('does not turn destination failure into an empty product list',async()=>{mocks.admin.mockRejectedValue(new Error('Offline'));await mount();expect(text()).toContain('Offline');expect(button('Retry linked destination')).toBeDefined();expect(mocks.admin.mock.calls.some(([p])=>p==='/catalog-instances?storeId=a')).toBe(false);});
it('does not load all products when a linked channel is missing',async()=>{await mount(undefined,{initialStoreId:'a',initialChannelKey:'missing'});expect(text()).toContain('This channel no longer exists');expect(mocks.admin.mock.calls.some(([p])=>p==='/catalog-instances?storeId=a')).toBe(false);});
it('late store responses cannot replace manual role selection',async()=>{
 const resolvers:Array<(v:any)=>void>=[];const implementation=mocks.admin.getMockImplementation()!;mocks.admin.mockImplementation((path:string)=>path==='/stores'?new Promise(r=>{resolvers.push(r);}):implementation(path));
 await mount();act(()=>tree.root.findByProps({'data-testid':'select-role-manager'}).props.onChange('member'));await act(async()=>{resolvers.forEach(resolve=>resolve([{id:'a',name:'A',roleType:'external'}]));await flush();});await settle();
 expect(tree.root.findByProps({'data-testid':'select-role-manager'}).props.value).toBe('member');
});
it('preserves publication status in the shared product card',async()=>{
 const implementation=mocks.admin.getMockImplementation()!;mocks.admin.mockImplementation((path:string)=>path==='/catalog-instances?storeId=a&channelId=c-1'?Promise.resolve({instances:[{id:'i',resolved:{title:'Saved item'},printifyProductId:'p',publishStatus:'synced'}]}):implementation(path));
 await mount();expect(text()).toContain('Synced');
});
it('does not claim synced when the saved status is unknown',async()=>{await mount(React.createElement(PublishStatusBadge,{printifyProductId:'p'}));expect(text()).toContain('Sync status unavailable');expect(text()).not.toContain('"Synced"');});
it('renders saved Firestore timestamps without Invalid Date',async()=>{await mount(React.createElement(PublishStatusBadge,{printifyProductId:'p',publishStatus:'synced',lastPublishedAt:{_seconds:1700000000} as any}));expect(text()).toContain('Synced');expect(text()).not.toContain('Invalid Date');});
