import { describe, expect, test } from "vitest";
import { layoutRoute, ROUTE_WIDTH, segmentPath } from "./routeLayout";

describe("layoutRoute", () => {
  test("snakes: the second row runs right to left", () => {
    const l = layoutRoute({ regionSizes: [8], cols: 4 });
    expect(l.stations).toHaveLength(8);
    expect(l.stations[0].x).toBeLessThan(l.stations[3].x);
    expect(l.stations[4].x).toBeGreaterThan(l.stations[7].x);
    // The U-turn happens on the same column.
    expect(l.stations[3].x).toBe(l.stations[4].x);
    expect(l.stations[4].y).toBeGreaterThan(l.stations[3].y);
  });

  test("every region starts on its own row, with a flag above it", () => {
    const l = layoutRoute({ regionSizes: [3, 5], cols: 4 });
    expect(l.stations[3].row).toBeGreaterThan(l.stations[2].row);
    expect(l.flags).toHaveLength(2);
    expect(l.flags[1].y).toBeLessThan(l.stations[3].y);
    expect(l.regionBands[1].top).toBeLessThanOrEqual(l.flags[1].y);
  });

  test("stations never leave the map and never sit closer than a column apart in a row", () => {
    const l = layoutRoute({ regionSizes: [12, 12], cols: 3 });
    for (const s of l.stations) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(ROUTE_WIDTH);
    }
    const first = l.stations.filter((s) => s.row === l.stations[0].row);
    expect(first[1].x - first[0].x).toBeGreaterThanOrEqual(ROUTE_WIDTH / 3 - 1);
  });

  test("an open card pushes later rows down but not earlier ones", () => {
    const closed = layoutRoute({ regionSizes: [12], cols: 4 });
    const open = layoutRoute({ regionSizes: [12], cols: 4, openCardRow: 1 });
    expect(open.stations[0].y).toBe(closed.stations[0].y);
    expect(open.stations[4].y).toBe(closed.stations[4].y);
    expect(open.stations[8].y).toBeGreaterThan(closed.stations[8].y);
    expect(open.height).toBeGreaterThan(closed.height);
  });

  test("handles no stations", () => {
    const l = layoutRoute({ regionSizes: [], cols: 4 });
    expect(l.stations).toEqual([]);
    expect(l.height).toBeGreaterThan(0);
  });

  test("segmentPath goes from one station to the next", () => {
    const l = layoutRoute({ regionSizes: [8], cols: 4 });
    const same = segmentPath(l.stations[0], l.stations[1], 4);
    expect(same.startsWith(`M${l.stations[0].x} ${l.stations[0].y}C`)).toBe(
      true,
    );
    expect(same.endsWith(`${l.stations[1].x} ${l.stations[1].y}`)).toBe(true);
    const turn = segmentPath(l.stations[3], l.stations[4], 4);
    expect(turn.endsWith(`${l.stations[4].x} ${l.stations[4].y}`)).toBe(true);
  });
});
