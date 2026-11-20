import { describe, expect, test } from "vitest";
import {
  arrivalScrollTop,
  CARD_HEIGHT,
  cardSpaceFor,
  FLAG_HEIGHT,
  layoutRoute,
  rowAnchorTop,
  ROUTE_WIDTH,
  SHAPE_FLAG_CLEARANCE,
  segmentControls,
  segmentPath,
  snapPastFlags,
  terrainShapes,
} from "./routeLayout";

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

describe("rowAnchorTop", () => {
  const l = layoutRoute({ regionSizes: [3, 5], cols: 4 });

  test("the first station of a unit anchors to its flag", () => {
    expect(rowAnchorTop(l, 3, 1)).toBe(l.flags[1].y);
    expect(rowAnchorTop(l, 0, 0)).toBe(l.flags[0].y);
  });

  test("any other station anchors a fixed reach above its disk", () => {
    expect(rowAnchorTop(l, 1, null)).toBe(l.stations[1].y - 112);
  });

  test("never above the top of the map", () => {
    expect(rowAnchorTop(l, 0, null)).toBeGreaterThanOrEqual(0);
  });
});

describe("unit finish marks", () => {
  test("every unit gets one mark that follows its last station on the route", () => {
    const l = layoutRoute({ regionSizes: [3, 5], cols: 4 });
    expect(l.ends).toHaveLength(2);
    expect(l.stations).toHaveLength(8);
    expect(l.nodes).toHaveLength(10);
    // Unit one: stations 0-2 then its mark in the next slot of the same row.
    expect(l.ends[0].row).toBe(l.stations[2].row);
    expect(l.ends[0].col).toBe(l.stations[2].col + 1);
    // The next unit still starts on a fresh row below the mark.
    expect(l.stations[3].row).toBeGreaterThan(l.ends[0].row);
  });

  test("a mark that does not fit the row wraps like a station", () => {
    const l = layoutRoute({ regionSizes: [4], cols: 4 });
    expect(l.ends[0].row).toBe(l.stations[3].row + 1);
    expect(l.ends[0].col).toBe(l.stations[3].col);
  });

  test("the unit band reaches down past its mark", () => {
    const l = layoutRoute({ regionSizes: [4, 4], cols: 4 });
    expect(l.regionBands[0].bottom).toBeGreaterThan(l.ends[0].y);
  });
});

describe("the road between units stays on the edge it reached", () => {
  test("a mark alone on the near edge hands over to a unit that starts on that edge", () => {
    // 12 stations from the right edge end on the left; the mark wraps to a
    // new row on the left, and the next unit starts right under it.
    const l = layoutRoute({ regionSizes: [3, 12, 5], cols: 4 });
    const end = l.ends[1];
    const next = l.stations[15];
    expect(end.col).toBe(0);
    expect(next.col).toBe(0);
    expect(next.row).toBe(end.row + 1);
  });

  test("a mark on the far edge keeps the old U-turn", () => {
    const l = layoutRoute({ regionSizes: [3, 5], cols: 4 });
    expect(l.stations[3].col).toBe(l.ends[0].col);
  });
});

describe("U-turn roads clear the song name under the last stop", () => {
  test.each([3, 4])("%i columns, name half-width 64px", (cols) => {
    const l = layoutRoute({ regionSizes: [12], cols });
    // Narrowest map the route is drawn in: 788px wide at 3 columns.
    const scale = (cols === 3 ? 788 : 1290) / ROUTE_WIDTH;
    for (let i = 0; i < l.stations.length - 1; i += 1) {
      const a = l.stations[i];
      const b = l.stations[i + 1];
      if (a.row === b.row) continue;
      const [p0, p1, p2, p3] = segmentControls(a, b, cols);
      for (let t = 0; t <= 1; t += 0.02) {
        const u = 1 - t;
        const x =
          u ** 3 * p0[0] +
          3 * u * u * t * p1[0] +
          3 * u * t * t * p2[0] +
          t ** 3 * p3[0];
        const y =
          u ** 3 * p0[1] +
          3 * u * u * t * p1[1] +
          3 * u * t * t * p2[1] +
          t ** 3 * p3[1];
        const inName = y >= a.y + 56 && y <= a.y + 120;
        if (inName) {
          expect(Math.abs(x - a.x) * scale).toBeGreaterThanOrEqual(64 + 8);
        }
        expect(x).toBeLessThan(ROUTE_WIDTH);
        expect(x).toBeGreaterThan(0);
      }
    }
  });
});

describe("open card space", () => {
  test("cardSpace sets how far later rows move", () => {
    const small = layoutRoute({
      regionSizes: [12],
      cols: 4,
      openCardRow: 0,
      cardSpace: 100,
    });
    const big = layoutRoute({
      regionSizes: [12],
      cols: 4,
      openCardRow: 0,
      cardSpace: 150,
    });
    expect(big.stations[4].y - small.stations[4].y).toBe(50);
  });
});

describe("snapPastFlags", () => {
  test("leaves a top that does not touch a flag alone", () => {
    expect(snapPastFlags(300, [100, 500])).toBe(300);
  });

  test("a flag cut near its top is shown whole", () => {
    expect(snapPastFlags(110, [100])).toBe(92);
  });

  test("a flag cut near its bottom is hidden", () => {
    expect(snapPastFlags(100 + FLAG_HEIGHT - 6, [100])).toBe(100 + FLAG_HEIGHT);
  });

  test("never scrolls above the map", () => {
    expect(snapPastFlags(4, [0])).toBe(0);
  });
});

describe("arrivalScrollTop", () => {
  test("shows the tail of the row above when the card still fits", () => {
    expect(
      arrivalScrollTop({
        anchor: 1000,
        contentBottom: 1400,
        viewHeight: 700,
        flagYs: [],
      }),
    ).toBe(904);
  });

  test("falls back to the tight gap when the card would be pushed out", () => {
    expect(
      arrivalScrollTop({
        anchor: 1000,
        contentBottom: 1560,
        viewHeight: 620,
        flagYs: [],
      }),
    ).toBe(976);
  });

  test("never leaves half a flag at the top", () => {
    const top = arrivalScrollTop({
      anchor: 1000,
      contentBottom: 1400,
      viewHeight: 700,
      flagYs: [890],
    });
    expect(top <= 890 || top >= 890 + FLAG_HEIGHT).toBe(true);
  });
});

describe("terrainShapes", () => {
  test("the same unit always gets the same shapes", () => {
    expect(terrainShapes("first-notes", 125)).toEqual(
      terrainShapes("first-notes", 125),
    );
  });

  test("two or three faint shapes, clear of the flag", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      for (const flagX of [125, 875, 167, 833]) {
        const shapes = terrainShapes(seed, flagX);
        expect(shapes.length).toBeGreaterThanOrEqual(2);
        expect(shapes.length).toBeLessThanOrEqual(3);
        for (const shape of shapes) {
          expect(Math.abs(shape.x - flagX)).toBeGreaterThanOrEqual(
            SHAPE_FLAG_CLEARANCE,
          );
          expect(shape.opacity).toBeGreaterThanOrEqual(0.08);
          expect(shape.opacity).toBeLessThanOrEqual(0.12);
        }
      }
    }
  });

  test("different units look different", () => {
    const a = JSON.stringify(terrainShapes("first-notes", 125));
    const b = JSON.stringify(terrainShapes("right-hand-melodies", 875));
    expect(a).not.toBe(b);
  });
});

describe("cardSpaceFor", () => {
  test("keeps the card height plus 24px clear of the next row's disk", () => {
    const space = cardSpaceFor({ cardOffset: 128, nextStopBelow: false });
    // Card bottom + 24 lands on the next disk's top (38px above its centre).
    expect(128 + CARD_HEIGHT + 24).toBe(220 + space - 38);
  });

  test("leaves more room when the next stop's halo is in the row below", () => {
    const plain = cardSpaceFor({ cardOffset: 128, nextStopBelow: false });
    const halo = cardSpaceFor({ cardOffset: 128, nextStopBelow: true });
    expect(halo - plain).toBe(112 - 38);
  });
});
