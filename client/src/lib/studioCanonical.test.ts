import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ ctx: {} as any }));
vi.mock('@/features/members/WizardContext', () => ({ useWizardContext: () => m.ctx }));
import { StudioMode } from '@/features/members/StudioMode';
import { claimedItemLifecycle } from '@shared/claimedItems';
it('enables Studio with a complete canonical product and navigates using the Advanced step', () => {
 m.ctx = { selectedProduct: null, selectedProductType: { title: 'Canonical Shirt' }, selectedChannel: { id: 'c', name: 'Channel' }, selectedColor: 'Black', selectedShirtSize: 'M', selectedPlacements: ['front'], simpleTitle: 'My QR', qrType: 'qr-plus', qrBasicContent: 'hello', setSimpleStep: vi.fn(), setWizardTier: vi.fn(), handlePublish: vi.fn() };
 let tree: any; act(() => { tree = create(React.createElement(StudioMode)); });
 const button = (id: string) => tree.root.find((n: any) => n.type === 'button' && n.props['data-testid'] === id);
 expect(button('power-publish').props.disabled).toBe(false); act(() => button('power-publish').props.onClick()); expect(m.ctx.handlePublish).toHaveBeenCalled();
 act(() => button('studio-select-product').props.onClick()); expect(m.ctx.setSimpleStep).toHaveBeenCalledWith('product'); expect(m.ctx.setWizardTier).toHaveBeenCalledWith('advanced'); act(() => tree.unmount());
 expect(claimedItemLifecycle({ status: 'static' })).toMatchObject({ isActive: true, daysRemaining: null });
 expect(claimedItemLifecycle({ status: 'active', hostingExpiresAt: 'invalid' }).isActive).toBe(false);
});
