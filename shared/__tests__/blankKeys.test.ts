import { describe, it, expect } from 'vitest';
import {
  getCanonicalBlankKey,
  safeBlankId,
  isProviderPrintful,
  getProviderFromKey,
  getRawIdFromKey,
  isQRGBlankId,
  isPendingBlankId,
  isValidQRGBlankNumber,
} from '../blankKeys';

describe('blankKeys', () => {
  describe('getCanonicalBlankKey', () => {
    // QRG doc ID takes highest priority — this is the catalog identity law.
    it('returns docId directly when product has a qrg_STNNN docId', () => {
      expect(getCanonicalBlankKey({ id: 71, docId: 'qrg_11001' })).toBe('qrg_11001');
    });

    it('returns docId for Printful product with qrg_STNNN docId', () => {
      expect(getCanonicalBlankKey({ id: 42, fulfillmentProvider: 'printful', docId: 'qrg_21003' })).toBe('qrg_21003');
    });

    it('returns docId even when only docId is meaningful', () => {
      expect(getCanonicalBlankKey({ id: 0, docId: 'qrg_61999' })).toBe('qrg_61999');
    });

    // Without docId, falls back to provider key logic (display/lookup reference only,
    // NOT intended for catalog identity persistence — send to server for resolution).
    it('returns plain id for Printify products (no docId)', () => {
      expect(getCanonicalBlankKey({ id: 71 })).toBe('71');
    });

    it('returns plain id for Printify with explicit provider (no docId)', () => {
      expect(getCanonicalBlankKey({ id: 71, fulfillmentProvider: 'printify' })).toBe('71');
    });

    it('prefixes pf: for Printful products (no docId)', () => {
      expect(getCanonicalBlankKey({ id: 42, fulfillmentProvider: 'printful' })).toBe('pf:42');
    });

    it('does not double-prefix Printful IDs', () => {
      expect(getCanonicalBlankKey({ id: 'pf:42', fulfillmentProvider: 'printful' })).toBe('pf:42');
    });

    it('handles string IDs', () => {
      expect(getCanonicalBlankKey({ id: '99' })).toBe('99');
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
