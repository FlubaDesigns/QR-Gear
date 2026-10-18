import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ context: {} as any }));
vi.mock('@/features/members/WizardContext', () => ({ useWizardContext: () => m.context }));
import { StudioMode } from '@/features/members/StudioMode';
it('publishes with canonical product state and routes product/channel controls to the actual Advanced step', async () => {
  m.context = { selectedProduct: null, selectedProductType: { title: 'Canonical shirt', imageUrl: '' }, selectedChannel: { id: 'channel', name: 'Channel' }, qrType: 'qr-basic', simpleTitle: 'Title', qrBasicContent: 'https://example.test', selectedColor: 'Black', selectedShirtSize: 'M', selectedPlacements: ['back'], composeItems: [], isPublishing: false,
    setSimpleStep: vi.fn(), setWizardTier: vi.fn(), handlePublish: vi.fn(), setQrBasicContent: vi.fn(), setQrBasicInputType: vi.fn() };
  let tree: any; await act(async () => { tree = create(React.createElement(StudioMode)); });
  const button = (id: string) => tree.root.findAllByType('button').find((node: any) => node.props['data-testid'] === id);
  expect(button('power-publish').props.disabled).toBe(false);
  await act(async () => button('power-publish').props.onClick()); expect(m.context.handlePublish).toHaveBeenCalledOnce();
  await act(async () => button('studio-select-product').props.onClick()); expect(m.context.setSimpleStep).toHaveBeenCalledWith('product'); expect(m.context.setWizardTier).toHaveBeenCalledWith('advanced');
  await act(async () => button('studio-select-channel').props.onClick()); expect(m.context.setSimpleStep).toHaveBeenCalledWith('channel');
  m.context.selectedPlacements = []; await act(async () => tree.update(React.createElement(StudioMode))); expect(button('power-publish').props.disabled).toBe(true);
  act(() => tree.unmount());
});
