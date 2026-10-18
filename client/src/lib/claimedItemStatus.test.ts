import { expect, it } from 'vitest';
import { claimedItemStatus } from './claimedItemStatus';
it('keeps static items active without a term and treats missing hosted expiry as unavailable', () => {
  expect(claimedItemStatus({ status: 'static', hostingExpiresAt: null })).toMatchObject({ isActive: true, isStatic: true, hasTerm: false, daysRemaining: null, label: 'Static QR' });
  expect(claimedItemStatus({ status: 'active', hostingExpiresAt: 'invalid' })).toMatchObject({ isActive: false, daysRemaining: null, label: 'Inactive' });
});
it('distinguishes active and expired hosted items', () => {
  const now = Date.parse('2026-10-18');
  expect(claimedItemStatus({ status: 'active', hostingExpiresAt: '2026-10-20' }, now)).toMatchObject({ isActive: true, daysRemaining: 2 });
  expect(claimedItemStatus({ status: 'active', hostingExpiresAt: '2026-10-17' }, now)).toMatchObject({ isActive: false, daysRemaining: 0, label: 'Expired' });
});
