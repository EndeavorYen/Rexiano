/**
 * Pure bookkeeping for the spark that bursts up from the hit line when the
 * child plays a note right. A fixed pool: a hit takes a free slot (or recycles
 * the oldest one), so a fast run of notes never allocates per hit. The
 * renderer owns the drawing; this owns when a burst starts, how far along it
 * is, and when its slot is free again.
 */

export const BURST_DURATION_MS = 460;
export const BURST_POOL_SIZE = 12;

export interface BurstSlot {
  active: boolean;
  midi: number;
  startMs: number;
}

export class HitBurstPool {
  readonly slots: BurstSlot[] = Array.from({ length: BURST_POOL_SIZE }, () => ({
    active: false,
    midi: 0,
    startMs: 0,
  }));

  /** Start a burst; returns the slot index it took. */
  trigger(midi: number, nowMs: number): number {
    let index = this.slots.findIndex((slot) => !slot.active);
    if (index < 0) {
      index = 0;
      for (let i = 1; i < this.slots.length; i++) {
        if (this.slots[i].startMs < this.slots[index].startMs) index = i;
      }
    }
    const slot = this.slots[index];
    slot.active = true;
    slot.midi = midi;
    slot.startMs = nowMs;
    return index;
  }

  /** 0 at the start of the burst, 1 once it is over. */
  progress(index: number, nowMs: number): number {
    const slot = this.slots[index];
    return Math.min(1, Math.max(0, (nowMs - slot.startMs) / BURST_DURATION_MS));
  }

  /** Free the slots whose burst has finished. */
  expire(nowMs: number): void {
    for (const slot of this.slots) {
      if (slot.active && nowMs - slot.startMs >= BURST_DURATION_MS) {
        slot.active = false;
      }
    }
  }

  /** Cheap check for the per-frame loop: is any burst still flagged live? */
  hasLive(): boolean {
    for (const slot of this.slots) if (slot.active) return true;
    return false;
  }

  activeCount(nowMs: number): number {
    let count = 0;
    for (const slot of this.slots) {
      if (slot.active && nowMs - slot.startMs < BURST_DURATION_MS) count++;
    }
    return count;
  }

  reset(): void {
    for (const slot of this.slots) slot.active = false;
  }
}

/** Ring size: starts small, ends wide (ease-out). */
export function burstScale(t: number): number {
  const eased = 1 - (1 - t) * (1 - t);
  return 0.35 + eased * 1.25;
}

/** Bright for the first moment, then a smooth fade to nothing. */
export function burstAlpha(t: number): number {
  return Math.max(0, 1 - t * t);
}
