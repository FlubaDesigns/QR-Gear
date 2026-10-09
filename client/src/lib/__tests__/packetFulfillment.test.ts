import React from 'react';
import { create, act } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/adminFetch', () => ({ adminFetch: vi.fn() }));
vi.mock('@/features/shared/components/DeleteBuildDialog', () => ({ DeleteBuildDialog: () => null }));
vi.mock('@/components/PhoneMockupCard', () => ({ default: () => null }));
import { PacketFulfillmentSection } from '@/features/adminProducts/builder/modules/PacketResultDisplay';
describe('saved packet provider controls', () => {
  for (const provider of ['printful', 'printify', null]) it(`shows only the controls for ${provider}`, () => {
    let tree: any;
    act(() => { tree = create(React.createElement(PacketFulfillmentSection, { packetResult: { packetId: 'p', fulfillmentProvider: provider, compositeUrl: 'art', assemblyId: 'asm' } as any })); });
    const text = JSON.stringify(tree.toJSON());
    expect(text.includes('Publish to Printify')).toBe(provider === 'printify');
    expect(text.includes('Printful fulfillment')).toBe(provider === 'printful');
    expect(text.includes('no supported fulfillment provider')).toBe(provider === null);
    act(() => tree.unmount());
  });
});
