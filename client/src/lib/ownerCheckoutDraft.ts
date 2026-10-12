// Browser continuation only. The saved packet and server remain authoritative.
const STORAGE_KEY = 'qrgear-owner-checkout';

export interface OwnerCheckoutDraft {
  version: 1;
  inputKey: string;
  selection: Record<string, any>;
  prepared: { key: string; build: any; preview: any };
  runningCost: number;
  sessionId?: string;
}

export function readOwnerCheckoutDraft(): OwnerCheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const draft = JSON.parse(raw) as OwnerCheckoutDraft;
  const selection = draft.selection;
  if (draft.version !== 1 || !selection || !selection.selectedProductType ||
      !['qr-basic', 'qr-plus'].includes(selection.qrType) ||
      !Array.isArray(selection.selectedPlacements) || !selection.selectedPlacements.length ||
      !selection.selectedColor || !selection.selectedShirtSize ||
      !selection.headerStyle || !selection.footerStyle || !selection.perPlacementSizes ||
      typeof selection.qrBasicContent !== 'string' || !Number.isFinite(draft.runningCost) ||
      !draft.prepared?.build?.packetId || !draft.prepared.build.buildToken ||
      !draft.prepared.preview?.mockupUrl || draft.prepared.key !== draft.inputKey) {
    throw new Error('Your saved checkout design could not be restored. Please review your selections before continuing.');
  }
  return draft;
}

export function saveOwnerCheckoutDraft(draft: OwnerCheckoutDraft) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    throw new Error('Your browser could not save your design for checkout. Allow browser storage and try again; your current design is still here.');
  }
}

export function clearOwnerCheckoutDraft(sessionId?: string) {
  // A confirmation opened in another tab must not erase a different checkout.
  if (!sessionId || readOwnerCheckoutDraft()?.sessionId === sessionId) window.sessionStorage.removeItem(STORAGE_KEY);
}
