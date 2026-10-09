import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: { isLoading: false, isAuthenticated: false, isAdmin: false } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => m.auth }));
vi.mock('wouter', () => ({ Redirect: ({ to }: { to: string }) => React.createElement('redirect', { to }) }));
import { ProtectedRoute } from '../components/ProtectedRoute';
import StorePage from '../pages/store';
import { PUBLIC_SHOP_PATH } from '../../../shared/navigation';
let tree: ReactTestRenderer;
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });
it('never mounts an admin child for visitors, ordinary users, or an unresolved session', () => {
 const child = vi.fn(() => React.createElement('private-admin'));
 vi.stubGlobal('window', { location: { pathname: '/admin/settings', search: '' } }); vi.stubGlobal('localStorage', { setItem: vi.fn() });
 for (const state of [{isLoading:true,isAuthenticated:false,isAdmin:false},{isLoading:false,isAuthenticated:false,isAdmin:false},{isLoading:false,isAuthenticated:true,isAdmin:false}]) {
  m.auth = state; act(() => { tree=create(React.createElement(ProtectedRoute,null,React.createElement(child))); });
  expect(child).not.toHaveBeenCalled(); act(() => tree.unmount());
 }
});
it('preserves owner access and routes legacy public store links to shopping', () => {
 m.auth = { isLoading: false, isAuthenticated: true, isAdmin: true };
 act(() => { tree=create(React.createElement(ProtectedRoute,null,React.createElement('private-admin'))); });
 expect(tree.root.findAllByType('private-admin')).toHaveLength(1); act(() => tree.unmount());
 act(() => { tree=create(React.createElement(StorePage)); });
 expect(tree.root.findByType('redirect').props.to).toBe(PUBLIC_SHOP_PATH);
});
