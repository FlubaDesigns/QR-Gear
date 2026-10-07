import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductSelectCardSkin, type ProductSelectItem } from '@/features/shared/components/skins/ProductSelectCardSkin';

vi.mock('@/components/UsaFlag', () => ({ default: () => null }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => children,
  DialogContent: ({ children, ...props }: any) => React.createElement('section', props, children),
  DialogTitle: ({ children }: any) => React.createElement('h2', null, children),
}));
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open, ...props }: any) => React.createElement('alert-dialog', { ...props, open }, open ? children : null),
  AlertDialogContent: ({ children, ...props }: any) => React.createElement('section', props, children),
  AlertDialogHeader: ({ children }: any) => children,
  AlertDialogTitle: ({ children }: any) => React.createElement('h2', null, children),
  AlertDialogDescription: ({ children }: any) => React.createElement('p', null, children),
  AlertDialogFooter: ({ children }: any) => children,
  AlertDialogCancel: ({ children, ...props }: any) => React.createElement('button', props, children),
  AlertDialogAction: ({ children, ...props }: any) => React.createElement('button', props, children),
}));
const item: ProductSelectItem = {
  id: 'qrg_11111', name: 'Catalog title', providerTitle: 'Master title', adminCatalogTitle: 'Catalog title',
  description: 'Catalog description', providerDescription: 'Master description', adminCatalogDescription: 'Catalog description',
  price: 11.69, cost: null, manufacturer: 'Bella + Canvas', madeInUSA: false,
  primaryImageUrl: null, images: [], availableColors: [], availableSizes: [], defaultColor: null,
};
let tree: ReactTestRenderer;
afterEach(() => { if (tree) act(() => tree.unmount()); });
async function mount(extra: Record<string, any> = {}) {
  const onTitleSave = vi.fn().mockResolvedValue(undefined);
  const onDescriptionSave = vi.fn().mockResolvedValue(undefined);
  await act(async () => { tree = create(React.createElement(ProductSelectCardSkin, {
    item, isSelected: false, onSelect: vi.fn(), editableTitle: true, editableDescription: true,
    textEditScope: 'Catalog: Primary', onTitleSave, onDescriptionSave, ...extra,
  })); });
  return { onTitleSave, onDescriptionSave };
}
const field = (id: string) => tree.root.findAll(n => typeof n.type === 'string' && n.props['data-testid'] === `${id}-qrg_11111`)[0];
const click = async (id: string) => act(async () => { await field(id).props.onClick(); });

describe('Catalog title and description editing', () => {
  it('saves each field independently even when both fields are open', async () => {
    const saves = await mount();
    await click('button-edit-title');
    await click('button-edit-desc');
    await act(async () => { field('input-title').props.onChange({ target: { value: 'New catalog title' } }); });
    await act(async () => { field('textarea-desc').props.onChange({ target: { value: 'New catalog description' } }); });
    await click('button-save-desc');
    expect(saves.onDescriptionSave).toHaveBeenCalledWith(item.id, 'New catalog description');
    expect(saves.onTitleSave).not.toHaveBeenCalled();
    expect(field('input-title').props.value).toBe('New catalog title');
    await click('button-save-title');
    expect(saves.onTitleSave).toHaveBeenCalledWith(item.id, 'New catalog title');
  });
  it('reset removes each override instead of saving master text as a custom copy', async () => {
    const saves = await mount();
    await click('button-edit-title');
    await click('button-reset-to-provider-title');
    await click('button-confirm-yes-reset-title');
    await click('button-edit-desc');
    await click('button-reset-to-provider');
    await click('button-confirm-yes-reset-desc');
    expect(saves.onTitleSave).toHaveBeenCalledWith(item.id, '');
    expect(saves.onDescriptionSave).toHaveBeenCalledWith(item.id, '');
  });
  it('keeps the field open with its draft when saving fails', async () => {
    const saves = await mount();
    saves.onTitleSave.mockRejectedValueOnce(new Error('failed'));
    await click('button-edit-title');
    await act(async () => { field('input-title').props.onChange({ target: { value: 'Keep this draft' } }); });
    await click('button-save-title');
    expect(field('input-title').props.value).toBe('Keep this draft');
    expect(tree.root.findByProps({ role: 'alert' }).children.join('')).toContain('Your edits are still here');
  });
});


describe('Exterior card image removal', () => {
  it('has no catalog-removal link and Cancel leaves the image and product untouched', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn();
    await mount({ item: { ...item, images: ['image-a', 'image-b'] }, onImageDelete: remove, onSelect: select });
    expect(tree.root.findAll(n => n.props['data-testid'] === `button-delete-${item.id}`)).toHaveLength(0);
    await act(async () => { field('button-card-delete-img').props.onClick({ stopPropagation() {} }); });
    expect(remove).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(field('button-cancel-remove-image').children).toContain('Cancel');
    await act(async () => { tree.root.findByType('alert-dialog').props.onOpenChange(false); });
    expect(remove).not.toHaveBeenCalled();
    expect(tree.root.findByType('alert-dialog').props.open).toBe(false);
  });
  it('removes only the confirmed image through the existing callback', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    await mount({ item: { ...item, images: ['image-a', 'image-b'] }, onImageDelete: remove });
    await act(async () => { field('button-card-next').props.onClick({ stopPropagation() {} }); });
    await act(async () => { field('button-card-delete-img').props.onClick({ stopPropagation() {} }); });
    expect(remove).not.toHaveBeenCalled();
    await act(async () => { field('button-confirm-remove-image').props.onClick({ preventDefault() {} }); });
    expect(remove).toHaveBeenCalledExactlyOnceWith(item.id, 'image-b');
    expect(tree.root.findByType('alert-dialog').props.open).toBe(false);
  });
});
