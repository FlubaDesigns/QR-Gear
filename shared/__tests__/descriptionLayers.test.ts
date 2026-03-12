import { describe, it, expect } from 'vitest';
import {
  resolveDescription,
  resolvePublicDescription,
  buildDescriptionSnapshot,
} from '../descriptionLayers';

describe('descriptionLayers', () => {
  describe('resolveDescription', () => {
    it('prefers memberPacketDescription first', () => {
      expect(resolveDescription({
        providerDescription: 'provider',
        adminCatalogDescription: 'admin',
        memberPacketDescription: 'member',
      })).toBe('member');
    });

    it('falls back to adminCatalogDescription', () => {
      expect(resolveDescription({
        providerDescription: 'provider',
        adminCatalogDescription: 'admin',
        memberPacketDescription: null,
      })).toBe('admin');
    });

    it('falls back to providerDescription', () => {
      expect(resolveDescription({
        providerDescription: 'provider',
        adminCatalogDescription: null,
        memberPacketDescription: null,
      })).toBe('provider');
    });

    it('returns empty string when all null', () => {
      expect(resolveDescription({
        providerDescription: null,
        adminCatalogDescription: null,
        memberPacketDescription: null,
      })).toBe('');
    });

    it('treats empty string as falsy (skips it)', () => {
      expect(resolveDescription({
        providerDescription: 'provider',
        adminCatalogDescription: '',
        memberPacketDescription: '',
      })).toBe('provider');
    });
  });

  describe('resolvePublicDescription', () => {
    it('prefers adminCatalogDescription', () => {
      expect(resolvePublicDescription({
        providerDescription: 'provider',
        adminCatalogDescription: 'admin',
      })).toBe('admin');
    });

    it('falls back to providerDescription', () => {
      expect(resolvePublicDescription({
        providerDescription: 'provider',
        adminCatalogDescription: null,
      })).toBe('provider');
    });

    it('never returns memberPacketDescription', () => {
      expect(resolvePublicDescription({
        providerDescription: 'provider',
        adminCatalogDescription: null,
      })).toBe('provider');
    });

    it('returns empty string when all null', () => {
      expect(resolvePublicDescription({
        providerDescription: null,
        adminCatalogDescription: null,
      })).toBe('');
    });
  });

  describe('buildDescriptionSnapshot', () => {
    it('produces a complete snapshot with effectiveDescription', () => {
      const snapshot = buildDescriptionSnapshot({
        providerDescription: 'from provider',
        adminCatalogDescription: 'admin override',
        memberPacketDescription: null,
      });
      expect(snapshot.effectiveDescription).toBe('admin override');
      expect(snapshot.providerDescription).toBe('from provider');
      expect(snapshot.adminCatalogDescription).toBe('admin override');
      expect(snapshot.memberPacketDescription).toBeNull();
    });

    it('normalizes undefined to null', () => {
      const snapshot = buildDescriptionSnapshot({});
      expect(snapshot.providerDescription).toBeNull();
      expect(snapshot.adminCatalogDescription).toBeNull();
      expect(snapshot.memberPacketDescription).toBeNull();
      expect(snapshot.effectiveDescription).toBe('');
    });
  });
});
