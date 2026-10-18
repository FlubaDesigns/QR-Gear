import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ loading: false, runtime: { isLoading: false, isAuthenticated: false, userId: '', onboardingComplete: false, profileError: false, refreshProfile: () => {} }, mounts: 0, setDraft: null as any }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ isLoading: m.loading }) }));
vi.mock('@/features/members/useMemberRuntimeState', () => ({ useMemberRuntimeState: () => m.runtime }));
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('wouter', () => ({ useLocation: () => ['/members', vi.fn()], Link: ({ children }: any) => children }));
vi.mock('@/components/SEO', () => ({ default: () => null }));
vi.mock('@/features/members/MemberOnboarding', () => ({ MemberOnboarding: () => React.createElement('div', { 'data-testid': 'onboarding' }) }));
vi.mock('@/features/members/MemberDynamics', () => ({ MemberDynamics: () => null }));
vi.mock('@/features/members/member-index-view', () => ({ MemberIndexView: () => null }));
vi.mock('@/features/members/member-channels-view', () => ({ ChannelsView: () => null }));
vi.mock('@/features/members/PayoutsView', () => ({ PayoutsView: () => null }));
vi.mock('@/features/members/WizardContext', () => ({
 WizardProvider: ({ children }: any) => { const [draft, set] = React.useState(''); m.setDraft = set; React.useEffect(() => { m.mounts++; }, []); return React.createElement('div', { 'data-testid': 'draft', draft }, children); },
 useWizardContext: () => ({ user: null, viewMode: 'index', wizardTier: 'simple', setViewMode: vi.fn(), setWizardTier: vi.fn(), setSelectedColor: vi.fn(), setQrType: vi.fn(), setSelectedPlacements: vi.fn(), setGraphicSize: vi.fn() })
}));
import { MembersShell } from '@/features/members/MembersPage';
let tree: ReactTestRenderer;
afterEach(() => { act(() => tree?.unmount()); vi.unstubAllGlobals(); });
it('keeps the draft provider mounted through auth loading and inline onboarding', async () => {
 vi.stubGlobal('window', { location: { search: '' } }); vi.stubGlobal('localStorage', { getItem: () => null });
 await act(async () => { tree = create(React.createElement(MembersShell)); });
 await act(async () => m.setDraft('unsaved design'));
 m.loading = true; await act(async () => tree.update(React.createElement(MembersShell)));
 m.loading = false; Object.assign(m.runtime, { isAuthenticated: true, userId: 'new-buyer' }); await act(async () => tree.update(React.createElement(MembersShell)));
 expect(tree.root.findAllByProps({ 'data-testid': 'onboarding' })).toHaveLength(1);
 expect(tree.root.findByProps({ 'data-testid': 'draft' }).props.draft).toBe('unsaved design'); expect(m.mounts).toBe(1);
 m.runtime.onboardingComplete = true; await act(async () => tree.update(React.createElement(MembersShell)));
 expect(tree.root.findByProps({ 'data-testid': 'draft' }).props.draft).toBe('unsaved design'); expect(m.mounts).toBe(1);
});
