import { describe, it, expect } from 'vitest';
import {
  getLookupBlankKey,
  getProductSnapshotKey,
  safeBlankId,
  isProviderPrintful,
  getProviderFromKey,
  getRawIdFromKey,
  isQRGBlankId,
  isPendingBlankId,
  isValidQRGBlankNumber,
} from '../blankKeys';

describe('blankKeys', () => {
  describe('getLookupBlankKey', () => {
    // QRG doc ID takes highest priority — this is the catalog identity law.
    // Note: buildBlankSnapshot() in useAdminBlanksController.ts uses the same
    // priority via getProductKey(p) = p.docId || String(p.id). This means
    // snapshot map keys ARE qrg_STNNN whenever the product has a docId — no
    // special handling needed; the contract flows from the same docId priority.
    it('returns docId directly when product has a qrg_STNNN docId', () => {
      expect(getLookupBlankKey({ id: 71, docId: 'qrg_11001' })).toBe('qrg_11001');
    });

    it('returns docId for product with both id and docId', () => {
      expect(getLookupBlankKey({ id: 999, docId: 'qrg_11001' })).toBe('qrg_11001');
    });

    it('returns docId for Printful product with qrg_STNNN docId', () => {
      expect(getLookupBlankKey({ id: 42, fulfillmentProvider: 'printful', docId: 'qrg_21003' })).toBe('qrg_21003');
    });

    it('returns docId even when only docId is meaningful', () => {
      expect(getLookupBlankKey({ id: 0, docId: 'qrg_61999' })).toBe('qrg_61999');
    });

    // Without docId, falls back to provider key logic (display/lookup reference only,
    // NOT intended for catalog identity persistence — send to server for resolution).
    it('returns plain id for Printify products (no docId)', () => {
      expect(getLookupBlankKey({ id: 71 })).toBe('71');
    });

    it('returns plain id for Printify with explicit provider (no docId)', () => {
      expect(getLookupBlankKey({ id: 71, fulfillmentProvider: 'printify' })).toBe('71');
    });

    it('prefixes pf: for Printful products (no docId)', () => {
      expect(getLookupBlankKey({ id: 42, fulfillmentProvider: 'printful' })).toBe('pf:42');
    });

    it('does not double-prefix Printful IDs', () => {
      expect(getLookupBlankKey({ id: 'pf:42', fulfillmentProvider: 'printful' })).toBe('pf:42');
    });

    it('handles string IDs', () => {
      expect(getLookupBlankKey({ id: '99' })).toBe('99');
    });

    // Provider keys returned on fallback are reference/lookup only.
    // Never persist pf:NN or plain "NN" in catalog.blankIds — server must resolve to qrg_STNNN.
    it('fallback result is NOT a valid QRG blank ID', () => {
      expect(isQRGBlankId(getLookupBlankKey({ id: 71 }))).toBe(false);
      expect(isQRGBlankId(getLookupBlankKey({ id: 42, fulfillmentProvider: 'printful' }))).toBe(false);
    });
  });

  describe('getProductSnapshotKey', () => {
    // Direct test of the buildBlankSnapshot key contract.
    // buildBlankSnapshot() in useAdminBlanksController uses getProductKey(p)
    // which mirrors this exported function: p.docId || String(p.id).
    // When a product has a qrg_STNNN docId, the snapshot map key IS that docId.
    it('returns qrg_STNNN docId when product has a docId', () => {
      expect(getProductSnapshotKey({ id: 71, docId: 'qrg_11001' })).toBe('qrg_11001');
    });

    it('snapshot map key is qrg_STNNN even when numeric id differs', () => {
      expect(getProductSnapshotKey({ id: 999, docId: 'qrg_61001' })).toBe('qrg_61001');
    });

    it('returns String(id) when docId is absent', () => {
      expect(getProductSnapshotKey({ id: 71 })).toBe('71');
    });

    it('returns String(id) when docId is null', () => {
      expect(getProductSnapshotKey({ id: 42, docId: null })).toBe('42');
    });

    it('returns String(id) when docId is empty string', () => {
      expect(getProductSnapshotKey({ id: 55, docId: '' })).toBe('55');
    });
  });

  describe('isQRGBlankId', () => {
    // Current QRG STNNN format: S=1-6, T=1-9, NNN=000-999 (5 digits total)
    it('returns true for valid qrg_STNNN IDs', () => {
      expect(isQRGBlankId('qrg_11001')).toBe(true);
      expect(isQRGBlankId('qrg_12001')).toBe(true);
      expect(isQRGBlankId('qrg_21001')).toBe(true);
      expect(isQRGBlankId('qrg_61999')).toBe(true);
    });

    // Legacy 4-digit format (qrg_STNN, e.g. qrg_1101) is NOT valid under current law.
    it('returns false for legacy 4-digit qrg_STNN IDs', () => {
      expect(isQRGBlankId('qrg_1101')).toBe(false);
      expect(isQRGBlankId('qrg_1201')).toBe(false);
    });

    // Legacy 3-digit format (e.g. qrg_101) is NOT valid.
    it('returns false for legacy 3-digit qrg_NNN IDs', () => {
      expect(isQRGBlankId('qrg_101')).toBe(false);
      expect(isQRGBlankId('qrg_999')).toBe(false);
    });

    // Provider keys are reference/lookup only — never catalog identity.
    it('returns false for provider reference keys (py_, pf_, pf:)', () => {
      expect(isQRGBlankId('py_123')).toBe(false);
      expect(isQRGBlankId('pf_456')).toBe(false);
      expect(isQRGBlankId('pf:789')).toBe(false);
      expect(isQRGBlankId('123')).toBe(false);
    });

    it('returns false for pending migration IDs', () => {
      expect(isQRGBlankId('pending_py_123')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isQRGBlankId('')).toBe(false);
    });

    it('returns false when S digit is out of range (0 or 7+)', () => {
      expect(isQRGBlankId('qrg_01001')).toBe(false);
      expect(isQRGBlankId('qrg_71001')).toBe(false);
    });

    it('returns false when T digit is 0', () => {
      expect(isQRGBlankId('qrg_10001')).toBe(false);
    });
  });

  describe('isValidQRGBlankNumber', () => {
    it('returns true for valid STNNN numbers', () => {
      expect(isValidQRGBlankNumber(11001)).toBe(true);
      expect(isValidQRGBlankNumber('61999')).toBe(true);
    });

    it('returns false for 4-digit numbers (legacy format)', () => {
      expect(isValidQRGBlankNumber(1101)).toBe(false);
    });

    it('returns false for 3-digit numbers (legacy format)', () => {
      expect(isValidQRGBlankNumber(101)).toBe(false);
    });
  });

  describe('isPendingBlankId', () => {
    it('returns true for pending_ prefix', () => {
      expect(isPendingBlankId('pending_py_123')).toBe(true);
      expect(isPendingBlankId('pending_pf_456')).toBe(true);
    });

    it('returns false for canonical QRG IDs', () => {
      expect(isPendingBlankId('qrg_11001')).toBe(false);
    });

    it('returns false for provider reference keys', () => {
      expect(isPendingBlankId('py_123')).toBe(false);
      expect(isPendingBlankId('pf:456')).toBe(false);
    });
  });

  describe('safeBlankId', () => {
    it('converts number to string', () => {
      expect(safeBlankId(42)).toBe('42');
    });

    it('handles null', () => {
      expect(safeBlankId(null)).toBe('');
    });

    it('handles undefined', () => {
      expect(safeBlankId(undefined)).toBe('');
    });

    it('passes through strings', () => {
      expect(safeBlankId('pf:71')).toBe('pf:71');
    });
  });

  describe('isProviderPrintful', () => {
    it('returns true for pf: prefix', () => {
      expect(isProviderPrintful('pf:42')).toBe(true);
    });

    it('returns false for plain id', () => {
      expect(isProviderPrintful('42')).toBe(false);
    });
  });

  describe('getProviderFromKey', () => {
    it('returns printful for pf: prefix', () => {
      expect(getProviderFromKey('pf:42')).toBe('printful');
    });

    it('returns printify for plain id', () => {
      expect(getProviderFromKey('42')).toBe('printify');
    });
  });

  describe('getRawIdFromKey', () => {
    it('strips pf: prefix', () => {
      expect(getRawIdFromKey('pf:42')).toBe('42');
    });

    it('returns plain id unchanged', () => {
      expect(getRawIdFromKey('71')).toBe('71');
    });
  });
});
