export interface DynamicsSlot {
  order: number;
  packetId: string;
  durationSeconds: number;
  label?: string;
}

export interface ResolvedSlot {
  activeSlot: DynamicsSlot | null;
  activeIndex: number;
  position: number;
  cycleLength: number;
  timeRemainingSeconds: number;
  nextSlotIndex: number;
}

export function resolveActiveSlot(
  slots: DynamicsSlot[],
  startTimestamp: number,
  nowEpoch: number
): ResolvedSlot | { error: string } {
  if (slots.length === 0) {
    return { error: 'No slots configured' };
  }

  const sortedSlots = [...slots].sort((a, b) => a.order - b.order);

  let cycleLength = 0;
  for (const slot of sortedSlots) {
    cycleLength += slot.durationSeconds;
  }

  if (cycleLength <= 0) {
    return { error: 'Invalid cycle length' };
  }

  const elapsed = nowEpoch - startTimestamp;
  const position = ((elapsed % cycleLength) + cycleLength) % cycleLength;

  let running = 0;
  let activeSlot: DynamicsSlot | null = null;
  let activeIndex = 0;

  for (let i = 0; i < sortedSlots.length; i++) {
    running += sortedSlots[i].durationSeconds;
    if (position < running) {
      activeSlot = sortedSlots[i];
      activeIndex = i;
      break;
    }
  }

  let timeRemainingSeconds = 0;
  if (activeSlot) {
    const slotStart = running - activeSlot.durationSeconds;
    timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart);
  }

  return {
    activeSlot,
    activeIndex,
    position,
    cycleLength,
    timeRemainingSeconds,
    nextSlotIndex: (activeIndex + 1) % sortedSlots.length,
  };
}
