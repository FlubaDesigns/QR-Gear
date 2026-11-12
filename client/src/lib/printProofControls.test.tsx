import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { PrintTextBackgroundContext, PrintTextColorControl } from '@/features/shared/components/PrintTextColorControl';
import { ProductProofDialog } from '@/features/shared/components/ProductProofApproval';
vi.mock('@/components/ui/dialog', () => ({ Dialog:({children}:any)=><div>{children}</div>, DialogContent:({children}:any)=><div>{children}</div>, DialogTitle:({children}:any)=><h2>{children}</h2> }));
it('shows shared Automatic results and manual low-contrast warnings',()=>{
  let tree:any;const onChange=vi.fn();
  const render=(colorMode:any,hex:string)=><PrintTextBackgroundContext.Provider value={{hex}}><PrintTextColorControl id="header" style={{text:'Example',color:'#000000',colorMode}} onChange={onChange}/></PrintTextBackgroundContext.Provider>;
  act(()=>{tree=create(render('auto','#000000'));});expect(JSON.stringify(tree.toJSON())).toContain('uses white');
  act(()=>tree.update(render('auto','#FFFFFF')));expect(JSON.stringify(tree.toJSON())).toContain('uses black');
  act(()=>tree.root.findByType('select').props.onChange({target:{value:'dark'}}));expect(onChange).toHaveBeenCalledWith({colorMode:'dark',color:'#000000'});
  act(()=>tree.update(render('dark','#000000')));expect(JSON.stringify(tree.toJSON())).toContain('difficult to read');act(()=>tree.unmount());
});
it('requires the checkbox and clears it when the exact proof changes',()=>{
  const onClose=vi.fn(),proof={proofId:'one',mockupUrl:'https://files.test/front.png',mockupUrls:{front:'https://files.test/front.png',back:'https://files.test/back.png'},selectedColor:'Black',selectedSize:'M',warnings:['Low contrast warning']};let tree:any;
  act(()=>{tree=create(<ProductProofDialog proof={proof} onClose={onClose}/>);});
  const approve=()=>tree.root.findAllByType('button').find((b:any)=>b.children.includes('Approve and continue'));
  expect(tree.root.findAllByType('img')).toHaveLength(2);expect(approve().props.disabled).toBe(true);
  act(()=>tree.root.findByType('input').props.onChange({target:{checked:true}}));expect(approve().props.disabled).toBe(false);
  act(()=>tree.update(<ProductProofDialog proof={{...proof,proofId:'two',selectedSize:'L'}} onClose={onClose}/>));expect(approve().props.disabled).toBe(true);
  act(()=>tree.root.findByType('input').props.onChange({target:{checked:true}}));act(()=>approve().props.onClick());expect(onClose).toHaveBeenCalledWith(true);act(()=>tree.unmount());
});
