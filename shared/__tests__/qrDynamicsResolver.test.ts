import { describe, it, expect } from 'vitest';
import { resolveActiveSlot, type DynamicsSlot } from '../qrDynamicsResolver';

describe('QR Dynamics Resolver', () => {
  const baseSlots: DynamicsSlot[] = [
    { order: 0, packetId: 'packet-a', durationSeconds: 3600 },
    { order: 1, packetId: 'packet-b', durationSeconds: 7200 },
    { order: 2, packetId: 'packet-c', durationSeconds: 3600 },
  ];

  const startTimestamp = 1000000;

  it('returns error for empty slots', () => {
    const result = resolveActiveSlot([], startTimestamp, startTimestamp + 100);
    expect(result).toEqual({ error: 'No slots configured' });
  });

  it('returns error for zero-duration slots', () => {
    const zeroSlots: DynamicsSlot[] = [
      { order: 0, packetId: 'p1', durationSeconds: 0 },
    ];
    const result = resolveActiveSlot(zeroSlots, startTimestamp, startTimestamp + 100);
    expect(result).toEqual({ error: 'Invalid cycle length' });
  });

  it('resolves first slot at start', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 1);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-a');
    expect(result.activeIndex).toBe(0);
    expect(result.cycleLength).toBe(14400);
  });

  it('resolves second slot after first expires', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 3601);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-b');
    expect(result.activeIndex).toBe(1);
  });

  it('resolves third slot near end of cycle', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 11000);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-c');
    expect(result.activeIndex).toBe(2);
  });

  it('wraps around to first slot after full cycle', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 14401);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-a');
    expect(result.activeIndex).toBe(0);
  });

  it('handles multiple full cycles correctly', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + (14400 * 5) + 3601);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-b');
    expect(result.activeIndex).toBe(1);
  });

  it('calculates time remaining correctly', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 1800);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-a');
    expect(result.timeRemainingSeconds).toBe(1800);
  });

  it('calculates nextSlotIndex with wrap', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 11000);
    if ('error' in result) return;
    expect(result.activeIndex).toBe(2);
    expect(result.nextSlotIndex).toBe(0);
  });

  it('sorts slots by order regardless of input order', () => {
    const unordered: DynamicsSlot[] = [
      { order: 2, packetId: 'packet-c', durationSeconds: 3600 },
      { order: 0, packetId: 'packet-a', durationSeconds: 3600 },
      { order: 1, packetId: 'packet-b', durationSeconds: 7200 },
    ];
    const result = resolveActiveSlot(unordered, startTimestamp, startTimestamp + 1);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-a');
  });

  it('handles single slot correctly', () => {
    const single: DynamicsSlot[] = [
      { order: 0, packetId: 'only-one', durationSeconds: 86400 },
    ];
    const result = resolveActiveSlot(single, startTimestamp, startTimestamp + 43200);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('only-one');
    expect(result.activeIndex).toBe(0);
    expect(result.nextSlotIndex).toBe(0);
    expect(result.timeRemainingSeconds).toBe(43200);
  });

  it('handles negative elapsed time (future start)', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp + 100000, startTimestamp);
    if ('error' in result) return;
    expect(result.activeSlot).not.toBeNull();
    expect(result.position).toBeGreaterThanOrEqual(0);
    expect(result.position).toBeLessThan(result.cycleLength);
  });

  it('handles exact boundary between slots', () => {
    const result = resolveActiveSlot(baseSlots, startTimestamp, startTimestamp + 3600);
    if ('error' in result) return;
    expect(result.activeSlot?.packetId).toBe('packet-b');
    expect(result.activeIndex).toBe(1);
  });
});
