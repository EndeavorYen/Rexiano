import { describe, expect, test } from "vitest";
import { findPickup, pickupTimeSignature } from "./pickup";

const PPQ = 480;

describe("pickupTimeSignature (#333)", () => {
  test.each([
    [1, 4, [1, 4]],
    [0.5, 8, [1, 8]],
    [1, 8, [2, 8]],
    [0.5, 4, [1, 8]],
    [0.75, 4, [3, 16]],
  ])("%f quarters under x/%i is %j", (quarters, beatType, expected) => {
    expect(pickupTimeSignature(quarters, beatType)).toEqual(expected);
  });
});

describe("findPickup (#333)", () => {
  test("a one-beat 1/4 bar before 3/4 is a pickup", () => {
    expect(
      findPickup(
        [
          { ticks: 0, numerator: 1, denominator: 4 },
          { ticks: PPQ, numerator: 3, denominator: 4 },
        ],
        PPQ,
      ),
    ).toEqual({ ticks: PPQ, numerator: 3, denominator: 4 });
  });

  test("a single meter has no pickup", () => {
    expect(findPickup([{ ticks: 0, numerator: 3, denominator: 4 }], PPQ)).toBe(
      null,
    );
  });

  test("a real meter change after several bars is not a pickup", () => {
    expect(
      findPickup(
        [
          { ticks: 0, numerator: 2, denominator: 4 },
          { ticks: PPQ * 8, numerator: 3, denominator: 4 },
        ],
        PPQ,
      ),
    ).toBe(null);
  });

  test("a longer first bar is not a pickup", () => {
    expect(
      findPickup(
        [
          { ticks: 0, numerator: 4, denominator: 4 },
          { ticks: PPQ * 4, numerator: 3, denominator: 4 },
        ],
        PPQ,
      ),
    ).toBe(null);
  });
});
