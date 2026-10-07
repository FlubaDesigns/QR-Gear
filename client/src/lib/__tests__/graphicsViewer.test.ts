import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkinHorizontalViewer } from '@/features/shared/components/SkinHorizontalViewer';
import { AdminGraphicCardSkin } from '@/features/shared/components/skins/AdminGraphicSkins';
const state = vi.hoisted(() => ({ selected: null as string | null }));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [state.selected, (id: string | null) => { state.selected = id; }],
  useEffect: (callback: () => void) => callback(),
}));
vi.mock('@/features/shared/components/views/SkinHorizontalView', () => ({ SkinHorizontalView: 'gallery' }));
const Shape = () => null;
const items = [
  { id: 'GRF-21111-000001', name: 'First' },
  { id: 'GRF-21111-000002', name: 'Second' },
];
function find(node: any, match: (node: any) => boolean): any {
  if (!node || typeof node !== 'object') return undefined;
  if (match(node)) return node;
  for (const child of [node.props?.children].flat()) {
    const result = find(child, match); if (result) return result;
  }
}
function viewer(list = items, onDelete = vi.fn()) {
  return SkinHorizontalViewer({ items: list, CardSkin: AdminGraphicCardSkin, Shape, actions: { onDelete } });
}
beforeEach(() => { state.selected = null; });
describe('Graphics delete targeting and selection', () => {
  it('deletes the tapped card even with no detail selection', () => {
    const onDelete = vi.fn(); const tree = viewer(items, onDelete);
    const gallery = find(tree, n => n.type === 'gallery');
    const card = AdminGraphicCardSkin({ item: items[1], actions: gallery.props.actions });
    find(card, n => n.props?.['data-testid'] === `button-delete-graphic-${items[1].id}`).props.onClick();
    expect(onDelete).toHaveBeenCalledWith(items[1].id);
    expect(state.selected).toBeNull();
  });
  it('keeps the detail open when delete is requested, for confirmation or retry', () => {
    state.selected = items[1].id; const onDelete = vi.fn();
    const detail = find(viewer(items, onDelete), n => n.type === Shape);
    detail.props.actions.onDelete(detail.props.item.id);
    expect(onDelete).toHaveBeenCalledWith(items[1].id);
    expect(find(viewer(), n => n.type === Shape).props.open).toBe(true);
  });
  it('keeps the same selected asset when an earlier card disappears', () => {
    state.selected = items[1].id;
    const detail = find(viewer([items[1]]), n => n.type === Shape);
    expect(detail.props.item.id).toBe(items[1].id);
    expect(detail.props.itemIndex).toBe(0);
  });
  it('closes when the selected asset disappears without selecting a different asset', () => {
    state.selected = items[0].id;
    const detail = find(viewer([items[1]]), n => n.type === Shape);
    expect(detail.props.open).toBe(false); expect(detail.props.item).toBeNull();
    expect(state.selected).toBeNull();
  });
});
