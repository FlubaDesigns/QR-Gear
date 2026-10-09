import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, it, expect } from 'vitest';
import { AdminImagePreview } from '@/features/shared/components/skins/AdminImageSkin';
describe('image thumbnail rendering', () => {
  it('shows the saved image, explains load failures, and resets for a different image', () => {
    let tree: ReturnType<typeof create>;
    act(() => { tree = create(React.createElement(AdminImagePreview, { url: 'first.png', name: 'First' })); });
    expect(tree!.root.findByType('img').props.src).toBe('first.png');
    act(() => tree!.root.findByType('img').props.onError());
    expect(tree!.root.findAllByType('img')).toHaveLength(0);
    expect(JSON.stringify(tree!.toJSON())).toContain('Preview unavailable');
    act(() => tree!.update(React.createElement(AdminImagePreview, { url: 'second.png', name: 'Second' })));
    expect(tree!.root.findByType('img').props.src).toBe('second.png');
    act(() => tree!.unmount());
  });
});
