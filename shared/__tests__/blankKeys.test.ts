import { describe, it, expect } from 'vitest';
import {
  getCanonicalBlankKey,
  safeBlankId,
  isProviderPrintful,
  getProviderFromKey,
  getRawIdFromKey,
} from '../blankKeys';

describe('blankKeys', () => {
  describe('getCanonicalBlankKey', () => {
    it('returns plain id for Printify products', () => {
      expect(getCanonicalBlankKey({ id: 71 })).toBe('71');
    });

    it('returns plain id for Printify with explicit provider', () => {
      expect(getCanonicalBlankKey({ id: 71, fulfillmentProvider: 'printify' })).toBe('71');
    });

    it('prefixes pf: for Printful products', () => {
      expect(getCanonicalBlankKey({ id: 42, fulfillmentProvider: 'printful' })).toBe('pf:42');
    });

    it('does not double-prefix Printful IDs', () => {
      expect(getCanonicalBlankKey({ id: 'pf:42', fulfillmentProvider: 'printful' })).toBe('pf:42');
    });

    it('handles string IDs', () => {
      expect(getCanonicalBlankKey({ id: '99' })).toBe('99');
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
