import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({mutation:null as any,mutate:vi.fn(),query:{} as any,request:vi.fn()}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>m.query,useMutation:(options:any)=>{m.mutation=options;return {mutate:m.mutate,isPending:false};}}));
vi.mock('@/lib/queryClient',()=>({apiRequest:m.request,queryClient:{invalidateQueries:vi.fn()}}));
import {RepricingTabContent} from '../pages/orchestration-repricing-tab';
import {ProfitTabContent} from '../pages/orchestration-profit-tab';
let tree:ReactTestRenderer;
beforeEach(()=>{vi.clearAllMocks();m.query={};});afterEach(()=>{if(tree)act(()=>tree.unmount());});
it('uses canonical pricing and requires a reviewed unblocked preview before applying',async()=>{
 act(()=>{tree=create(React.createElement(RepricingTabContent));});
 expect(tree.root.findAllByProps({'data-testid':'button-run-repricing'})).toHaveLength(0);
 const data={dryRun:true,previewToken:'reviewed',markupPercent:25,markupFixed:0,productsToUpdate:1,products:[],blocked:[{id:'a',title:'Army',reason:'Missing label'}]};
 act(()=>m.mutation.onSuccess(data));expect(tree.root.findByProps({'data-testid':'button-run-repricing'}).props.disabled).toBe(true);
 act(()=>m.mutation.onSuccess({...data,blocked:[]}));act(()=>tree.root.findByProps({'data-testid':'button-run-repricing'}).props.onClick());expect(m.mutate).toHaveBeenCalledWith('reviewed');
 m.request.mockResolvedValue({json:async()=>({})});await m.mutation.mutationFn('reviewed');expect(m.request).toHaveBeenCalledWith('POST','/api/admin/pricing-settings/sync',{previewToken:'reviewed'});
 act(()=>m.mutation.onError());expect(tree.root.findAllByProps({'data-testid':'button-run-repricing'})).toHaveLength(0);
});
it('shows unknown realized profit without disguising it as zero',()=>{
 m.query={data:{paidOrders:1,revenue:43.58,netProfit:null,note:'Unreconciled',products:[]}};
 act(()=>{tree=create(React.createElement(ProfitTabContent));});expect(tree.root.findByProps({'data-testid':'text-net-profit'}).children).toEqual(['Not recorded']);
});
it('shows failed profit reads explicitly',()=>{
 m.query={error:Error('Offline')};act(()=>{tree=create(React.createElement(ProfitTabContent));});expect(tree.root.findByProps({role:'alert'}).children.join('')).toContain('Offline');
});
