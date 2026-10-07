import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BuilderCommandStrip } from '../modules/BuilderCommandStrip';
import { BuilderBottomBar } from '../modules/BuilderBottomBar';
import { SaveDraftDialog } from '../modules/SaveDraftDialog';
import { LoadSavedModule } from '../modules/LoadSavedModule';
import { CreateGraphicsModule } from '../modules/CreateGraphicsModule';
const m = vi.hoisted(() => ({ context: {} as any, toast: vi.fn(), api: vi.fn(), create: vi.fn(), handled: vi.fn(), packet: {} as any, pricing: {} as any }));
vi.mock('../BuilderContext', () => ({ useBuilderContext: () => m.context }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }));
vi.mock('@/lib/adminFetch', () => ({ adminFetch: m.api }));
vi.mock('@/features/shared/components/views/ModalView', () => ({ ModalView: ({ open, children }: any) => open ? React.createElement('div', null, children) : null, ImageModalView: () => null }));
vi.mock('@/features/shared/components/CollapsibleModule', () => ({ CollapsibleModule: ({ children }: any) => React.createElement('div', null, children) }));
vi.mock('../modules/PacketResultDisplay', () => ({ PacketResultDisplay: () => null }));
vi.mock('../modules/useCreatePacket', () => ({ useCreatePacket: () => m.packet }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => m.pricing }));
vi.mock('wouter', () => ({ useLocation: () => ['/', vi.fn()] }));
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  m.context = { state: { activeSessionId: 'session', sessionStatus: 'working', draftName: 'My draft', activePacketId: null,
    selectedProduct: { docId: 'qrg_11001' }, selectedPlacements: ['front'], content: { graphicLayoutMode: 'freeform', title: 'Name' }, qrProductState: 'qr_basics' },
    busy: null, saveDraft: vi.fn().mockResolvedValue(undefined), resumeSession: vi.fn().mockResolvedValue(undefined),
    selectedCollection: { name: 'Folder' }, setActivePacketId: vi.fn(), setContent: vi.fn() };
  m.pricing = { data: {}, isLoading: false };
  m.packet = { handleCreatePacket: m.create, setPacketResult: vi.fn(), setArtifactError: vi.fn(), handleCommitSession: vi.fn(), packetResult: null };
  m.api.mockResolvedValue({ sessions: [{ id: 'draft', status: 'working', draftName: 'Draft' }, { id: 'packet', status: 'artifact_ready' }, { id: 'saved', status: 'committed' }, { id: 'abandoned', status: 'abandoned' }] });
});
afterEach(() => { if (tree) act(() => tree.unmount()); });
const button = (id: string) => tree.root.findAll(n => n.type === 'button' && n.props['data-testid'] === id)[0];
describe('button wiring and generation handoff', () => {
  it('top and bottom bars call the same Save and Generate actions, and switch to View for existing packets', async () => {
    const props = { onSave: vi.fn(), onNew: vi.fn(), onGenerate: vi.fn(), onOpenSaved: vi.fn(), onOpenTemplates: vi.fn(), onOpenOutput: vi.fn() };
    const render = () => React.createElement(React.Fragment, null, React.createElement(BuilderCommandStrip, props), React.createElement(BuilderBottomBar, props));
    await act(async () => { tree = create(render()); });
    act(() => { button('button-strip-save').props.onClick(); button('button-bottom-bar-save-draft').props.onClick(); button('button-strip-generate').props.onClick(); button('button-bottom-bar-create').props.onClick(); });
    expect(props.onSave).toHaveBeenCalledTimes(2); expect(props.onGenerate).toHaveBeenCalledTimes(2);
    m.context.state.activePacketId = 'packet'; m.context.state.sessionStatus = 'committed';
    await act(async () => { tree.update(render()); });
    act(() => { button('button-strip-generate').props.onClick(); button('button-bottom-bar-view-packet').props.onClick(); });
    expect(props.onOpenOutput).toHaveBeenCalledTimes(2); expect(button('button-strip-save').props.disabled).toBe(true); expect(button('button-bottom-bar-save-draft').props.disabled).toBe(true);
  });
  it('one Save form loads the session name and ignores a double submit', async () => {
    let resolve!: () => void; m.context.saveDraft.mockReturnValue(new Promise<void>(yes => { resolve = yes; }));
    const close = vi.fn(); await act(async () => { tree = create(React.createElement(SaveDraftDialog, { open: true, onOpenChange: close })); });
    expect(tree.root.findByType('input').props.value).toBe('My draft');
    act(() => { tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); tree.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    expect(m.context.saveDraft).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); }); expect(close).toHaveBeenCalledWith(false);
  });
  it('Resume lists ordinary drafts and invokes the shared restore without reloading the page', async () => {
    const close = vi.fn(); await act(async () => { tree = create(React.createElement(LoadSavedModule, { open: true, onOpenChange: close, hideCard: true })); });
    const cards = tree.root.findAll(n => typeof n.type === 'string' && String(n.props['data-testid'] || '').startsWith('load-saved-card-'));
    expect(cards.map(c => c.props['data-testid'])).toEqual(['load-saved-card-draft', 'load-saved-card-packet', 'load-saved-card-saved']);
    await act(async () => { await cards[0].props.onClick(); });
    expect(m.context.resumeSession).toHaveBeenCalledWith('draft'); expect(close).toHaveBeenCalledWith(false);
  });
  it('Generate calls the existing packet creator once and does not repeat on rerender', async () => {
    const render = () => React.createElement(CreateGraphicsModule, { generateRequested: true, onGenerateHandled: m.handled });
    await act(async () => { tree = create(render()); });
    await act(async () => { tree.update(render()); });
    expect(m.create).toHaveBeenCalledTimes(1); expect(m.handled).toHaveBeenCalledTimes(1);
  });
  it('Generate waits for pricing and product options, then uses the same creator', async () => {
    m.pricing = { data: undefined, isLoading: true }; m.context.state.placementsLoading = true;
    const render = () => React.createElement(CreateGraphicsModule, { generateRequested: true, onGenerateHandled: m.handled });
    await act(async () => { tree = create(render()); }); expect(m.create).not.toHaveBeenCalled();
    m.pricing = { data: {}, isLoading: false }; m.context.state.placementsLoading = false;
    await act(async () => { tree.update(render()); }); expect(m.create).toHaveBeenCalledTimes(1);
  });
  it('Generate reports incomplete input and never bypasses validation', async () => {
    m.context.state.selectedPlacements = [];
    await act(async () => { tree = create(React.createElement(CreateGraphicsModule, { generateRequested: true, onGenerateHandled: m.handled })); });
    expect(m.create).not.toHaveBeenCalled(); expect(m.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('print placement') }));
  });
  it('opening an artifact-ready build does not automatically commit it', async () => {
    m.context.state.sessionStatus = 'artifact_ready';
    await act(async () => { tree = create(React.createElement(CreateGraphicsModule)); });
    expect(m.packet.handleCommitSession).not.toHaveBeenCalled();
  });
});
