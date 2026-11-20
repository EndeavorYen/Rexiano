import { describe, expect, test } from "vitest";
import {
  BURST_DURATION_MS,
  BURST_POOL_SIZE,
  HitBurstPool,
  burstScale,
  burstAlpha,
} from "./hitBurst";

describe("HitBurstPool", () => {
  test("starts with no active slots", () => {
    const pool = new HitBurstPool();
    expect(pool.activeCount(0)).toBe(0);
    expect(pool.slots).toHaveLength(BURST_POOL_SIZE);
  });

  test("trigger activates a slot with the midi and start time", () => {
    const pool = new HitBurstPool();
    const index = pool.trigger(60, 1000);
    expect(pool.slots[index]).toMatchObject({
      active: true,
      midi: 60,
      startMs: 1000,
    });
    expect(pool.activeCount(1000)).toBe(1);
  });

  test("progress runs 0 to 1 over the burst duration", () => {
    const pool = new HitBurstPool();
    const index = pool.trigger(60, 1000);
    expect(pool.progress(index, 1000)).toBe(0);
    expect(pool.progress(index, 1000 + BURST_DURATION_MS / 2)).toBeCloseTo(0.5);
    expect(pool.progress(index, 1000 + BURST_DURATION_MS)).toBe(1);
  });

  test("expire frees slots that finished and keeps the rest", () => {
    const pool = new HitBurstPool();
    pool.trigger(60, 1000);
    pool.trigger(62, 1300);
    pool.expire(1000 + BURST_DURATION_MS + 1);
    expect(pool.activeCount(1000 + BURST_DURATION_MS + 1)).toBe(1);
    pool.expire(1300 + BURST_DURATION_MS + 1);
    expect(pool.activeCount(1300 + BURST_DURATION_MS + 1)).toBe(0);
  });

  test("a full pool recycles the oldest burst and never grows", () => {
    const pool = new HitBurstPool();
    for (let i = 0; i < BURST_POOL_SIZE; i++) pool.trigger(60 + i, 1000 + i);
    const reused = pool.trigger(100, 1100);
    expect(pool.slots).toHaveLength(BURST_POOL_SIZE);
    expect(reused).toBe(0);
    expect(pool.slots[0].midi).toBe(100);
    expect(pool.activeCount(1100)).toBe(BURST_POOL_SIZE);
  });

  test("a free slot is preferred over recycling", () => {
    const pool = new HitBurstPool();
    pool.trigger(60, 1000);
    const second = pool.trigger(61, 1010);
    expect(second).toBe(1);
  });

  test("reset clears everything", () => {
    const pool = new HitBurstPool();
    pool.trigger(60, 1000);
    pool.reset();
    expect(pool.activeCount(1000)).toBe(0);
  });
});

describe("burst curves", () => {
  test("scale grows and alpha fades monotonically", () => {
    expect(burstScale(0)).toBeLessThan(burstScale(0.5));
    expect(burstScale(0.5)).toBeLessThan(burstScale(1));
    expect(burstAlpha(0)).toBeGreaterThan(burstAlpha(0.5));
    expect(burstAlpha(1)).toBe(0);
  });
});
