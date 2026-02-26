import { describe, it, expect } from "vitest";
import { buildKeyPositions, type KeyPosition } from "./keyPositions";

const FIRST_NOTE = 21; // A0
const LAST_NOTE = 108; // C8
const TOTAL_KEYS = LAST_NOTE - FIRST_NOTE + 1; // 88
const WHITE_KEY_COUNT = 52;
const BLACK_WIDTH_RATIO = 0.58;

/** Which chromatic notes (mod 12) are black keys */
const IS_BLACK = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];

describe("buildKeyPositions", () => {
  const CANVAS_WIDTH = 1040; // 1040 / 52 = 20px per white key — nice round number
  const positions = buildKeyPositions(CANVAS_WIDTH);
  const whiteKeyWidth = CANVAS_WIDTH / WHITE_KEY_COUNT; // 20

  it("returns positions for all 88 keys", () => {
    expect(positions.size).toBe(TOTAL_KEYS);
    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
      expect(positions.has(midi)).toBe(true);
    }
  });

  it("white keys have equal width = canvasWidth / 52", () => {
    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
      if (IS_BLACK[midi % 12]) continue;
      const pos = positions.get(midi)!;
      expect(pos.width).toBeCloseTo(whiteKeyWidth, 10);
    }
  });

  it("black keys have width = whiteKeyWidth * 0.58", () => {
    const expectedBlackWidth = whiteKeyWidth * BLACK_WIDTH_RATIO;
    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
      if (!IS_BLACK[midi % 12]) continue;
      const pos = positions.get(midi)!;
      expect(pos.width).toBeCloseTo(expectedBlackWidth, 10);
    }
  });

  it("first key (A0, MIDI 21) starts at x=0", () => {
    const a0 = positions.get(21)!;
    expect(a0.x).toBe(0);
  });

  it("last white key ends exactly at canvasWidth", () => {
    // C8 (MIDI 108) is the last key and it's a white key
    const c8 = positions.get(108)!;
    expect(c8.x + c8.width).toBeCloseTo(CANVAS_WIDTH, 10);
  });

  it("white keys tile without gaps or overlaps", () => {
    const whiteKeys: KeyPosition[] = [];
    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
      if (!IS_BLACK[midi % 12]) {
        whiteKeys.push(positions.get(midi)!);
      }
    }

    expect(whiteKeys.length).toBe(WHITE_KEY_COUNT);

    // Each white key should start where the previous one ends
    for (let i = 1; i < whiteKeys.length; i++) {
      const prevEnd = whiteKeys[i - 1].x + whiteKeys[i - 1].width;
      expect(whiteKeys[i].x).toBeCloseTo(prevEnd, 10);
    }
  });

  it("black keys are centered on the boundary between adjacent white keys", () => {
    // For each black key, find the white keys on either side
    // and verify the black key is centered on their boundary
    let whiteIndex = 0;
    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
      if (!IS_BLACK[midi % 12]) {
        whiteIndex++;
        continue;
      }
      // Black key: should be centered at whiteIndex * whiteKeyWidth
      // (whiteIndex here is the count of white keys seen so far, which is
      //  leftWhiteIndex + 1 from PianoKeyboard)
      const pos = positions.get(midi)!;
      const expectedCenter = whiteIndex * whiteKeyWidth;
      const actualCenter = pos.x + pos.width / 2;
      expect(actualCenter).toBeCloseTo(expectedCenter, 10);
    }
  });

  it("all positions have non-negative x and positive width", () => {
    for (let midi = FIRST_NOTE; midi <= LAST_NOTE; midi++) {
      const pos = positions.get(midi)!;
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.width).toBeGreaterThan(0);
    }
  });

  it("works with different canvas widths", () => {
    for (const width of [520, 800, 1920]) {
      const pos = buildKeyPositions(width);
      expect(pos.size).toBe(TOTAL_KEYS);

      const wkw = width / WHITE_KEY_COUNT;
      // Spot-check: first white key width
      expect(pos.get(21)!.width).toBeCloseTo(wkw, 10);
      // Spot-check: last key ends at canvas width
      expect(pos.get(108)!.x + pos.get(108)!.width).toBeCloseTo(width, 10);
    }
  });
});
