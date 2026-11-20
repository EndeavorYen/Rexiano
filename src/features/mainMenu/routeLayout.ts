/**
 * Where each station sits on the winding route. Pure geometry: x lives in a
 * fixed 0–1000 coordinate space (stretched to the container width), y is in
 * real pixels, so the SVG route and the buttons always line up.
 */
export const ROUTE_WIDTH = 1000;
export const ROW_PITCH = 220;
export const REGION_HEADER = 100;
/** Extra height reserved under a row while a station card is open. */
export const CARD_SPACE = 176;
/** Measured height of an open station card (cover row + start button). */
export const CARD_HEIGHT = 170;
const TOP_PAD = 150;
const BOTTOM_PAD = 90;

export interface LaidOutStation {
  /** 0–1000 */
  x: number;
  /** Disk centre, px from the top of the map */
  y: number;
  row: number;
  col: number;
  /** Which way this stop's row runs: 1 to the right, -1 to the left */
  heading: 1 | -1;
}

export interface RegionFlag {
  x: number;
  y: number;
}

export interface RegionBand {
  top: number;
  bottom: number;
}

export interface RouteLayout {
  stations: LaidOutStation[];
  /** One finish mark per unit, right after its last station */
  ends: LaidOutStation[];
  /** Every stop in route order: stations and finish marks */
  nodes: LaidOutStation[];
  flags: RegionFlag[];
  regionBands: RegionBand[];
  height: number;
  cols: number;
}

export interface LayoutOptions {
  regionSizes: readonly number[];
  cols: number;
  /** Row whose station has its card open; rows below move down */
  openCardRow?: number | null;
  /** Extra height under the open row; the card height plus a margin */
  cardSpace?: number;
}

function wave(index: number): number {
  return Math.round(Math.sin(index * 1.25) * 14);
}

export function layoutRoute({
  regionSizes,
  cols,
  openCardRow = null,
  cardSpace = CARD_SPACE,
}: LayoutOptions): RouteLayout {
  const colWidth = ROUTE_WIDTH / cols;
  // First pass: assign row/col, regions always start a fresh row.
  const slots: { row: number; col: number; region: number; end: boolean }[] =
    [];
  const regionRows: { first: number; last: number }[] = [];
  let row = -1;
  let colInRow = cols;
  // Which way each row runs; rows alternate, but a unit that starts after a
  // finish mark that is alone on its row continues straight down from it.
  const rowDir: boolean[] = [];
  let lonelyMark = false;
  regionSizes.forEach((size, region) => {
    if (size === 0) return;
    row += 1;
    colInRow = 0;
    rowDir[row] =
      row === 0 ? true : lonelyMark ? rowDir[row - 1] : !rowDir[row - 1];
    const first = row;
    // The last slot of every unit is its finish mark.
    for (let i = 0; i < size + 1; i += 1) {
      if (colInRow === cols) {
        row += 1;
        colInRow = 0;
        rowDir[row] = !rowDir[row - 1];
      }
      const leftToRight = rowDir[row];
      const col = leftToRight ? colInRow : cols - 1 - colInRow;
      slots.push({ row, col, region, end: i === size });
      colInRow += 1;
    }
    lonelyMark = colInRow === 1;
    regionRows.push({ first, last: row });
  });

  // Second pass: rows to pixels. Each region's first row gets a header.
  const rowTop = new Map<number, number>();
  let cursor = TOP_PAD;
  let lastRow = -1;
  const headerRows = new Set(regionRows.map((r) => r.first));
  for (let r = 0; r <= row; r += 1) {
    if (headerRows.has(r) && r > 0) cursor += REGION_HEADER - 24;
    rowTop.set(r, cursor);
    cursor += ROW_PITCH;
    if (openCardRow !== null && r === openCardRow) cursor += cardSpace;
    lastRow = r;
  }

  const nodes: LaidOutStation[] = slots.map((slot, i) => ({
    x: Math.round((slot.col + 0.5) * colWidth),
    y: (rowTop.get(slot.row) ?? 0) + wave(i),
    row: slot.row,
    col: slot.col,
    heading: rowDir[slot.row] ? 1 : -1,
  }));
  const stations = nodes.filter((_, i) => !slots[i].end);
  const ends = nodes.filter((_, i) => slots[i].end);

  const flags: RegionFlag[] = [];
  const regionBands: RegionBand[] = [];
  let firstStation = 0;
  regionSizes.forEach((size) => {
    if (size === 0) return;
    const rr = regionRows[flags.length];
    const first = stations[firstStation];
    flags.push({ x: first.x, y: (rowTop.get(rr.first) ?? 0) - 146 });
    regionBands.push({
      top: flags.length === 1 ? 0 : (rowTop.get(rr.first) ?? 0) - 168,
      bottom: 0,
    });
    firstStation += size;
  });
  regionBands.forEach((band, i) => {
    const next = regionBands[i + 1];
    band.bottom = next ? next.top : cursor + BOTTOM_PAD - ROW_PITCH + 120;
  });

  const height =
    lastRow < 0 ? TOP_PAD + BOTTOM_PAD : cursor - ROW_PITCH + 120 + BOTTOM_PAD;
  return { stations, ends, nodes, flags, regionBands, height, cols };
}

type Point = readonly [number, number];

/** The four points of the cubic that carries the road between two stops. */
export function segmentControls(
  a: LaidOutStation,
  b: LaidOutStation,
  cols: number,
): readonly [Point, Point, Point, Point] {
  if (a.row === b.row) {
    const mx = (a.x + b.x) / 2;
    return [
      [a.x, a.y],
      [mx, a.y],
      [mx, b.y],
      [b.x, b.y],
    ];
  }
  const colWidth = ROUTE_WIDTH / cols;
  const dy = b.y - a.y;
  if ((b.x - a.x) * a.heading >= 0) {
    // U-turn: the road runs on in the direction of its row, where there is
    // room, far enough to clear the song name under the last stop, then
    // comes back to the next row.
    const bulge = Math.min(colWidth * 0.6, 170) * a.heading;
    const edge = a.heading > 0 ? Math.max(a.x, b.x) : Math.min(a.x, b.x);
    return [
      [a.x, a.y],
      [edge + bulge, a.y + dy * 0.05],
      [edge + bulge, b.y - dy * 0.05],
      [b.x, b.y],
    ];
  }
  const my = a.y + dy / 2;
  return [
    [a.x, a.y],
    [a.x, my],
    [b.x, my],
    [b.x, b.y],
  ];
}

/** SVG path for the road between two neighbouring stops. */
export function segmentPath(
  a: LaidOutStation,
  b: LaidOutStation,
  cols: number,
): string {
  const [p0, p1, p2, p3] = segmentControls(a, b, cols);
  return `M${p0[0]} ${p0[1]}C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
}

/** From the top of a "next" station's tag and halo down to its disk centre. */
export const STATION_REACH_ABOVE = 112;

/**
 * Map-relative y of a station's upper edge, the line the home screen scrolls
 * to. A unit's first station brings its flag along, so a new unit starts with
 * its name in view.
 */
export function rowAnchorTop(
  layout: RouteLayout,
  index: number,
  /** Region index when this station opens its unit, otherwise null */
  unitStartOf: number | null,
): number {
  const flag = unitStartOf === null ? undefined : layout.flags[unitStartOf];
  const y = flag ? flag.y : layout.stations[index].y - STATION_REACH_ABOVE;
  return Math.max(0, y);
}

/** Height of the unit flag pill, shadow included. */
export const FLAG_HEIGHT = 44;
/** How much of the row above the next stop shows under the fixed area. */
export const ARRIVAL_PEEK = 96;
export const ARRIVAL_MIN = 24;

/**
 * Keeps a unit flag from being sliced by the top edge of the scroller: it is
 * either shown whole or tucked away completely.
 */
export function snapPastFlags(top: number, flagYs: readonly number[]): number {
  let result = top;
  for (const y of flagYs) {
    if (result > y && result < y + FLAG_HEIGHT) {
      result = result - y < FLAG_HEIGHT / 2 ? y - 8 : y + FLAG_HEIGHT;
    }
  }
  return Math.max(0, result);
}

/**
 * Where to scroll so the next stop arrives with the tail of the row above
 * still showing (stars and song names), as long as the stop's card and start
 * button still fit; otherwise the old tight gap.
 */
export function arrivalScrollTop(args: {
  /** Map-relative top of the next stop's row */
  anchor: number;
  /** Map-relative bottom of the card the stop opens */
  contentBottom: number;
  viewHeight: number;
  flagYs: readonly number[];
}): number {
  const { anchor, contentBottom, viewHeight, flagYs } = args;
  const fits = contentBottom - anchor + ARRIVAL_PEEK + 12 <= viewHeight;
  const gap = fits ? ARRIVAL_PEEK : ARRIVAL_MIN;
  return snapPastFlags(anchor - gap, flagYs);
}

export type TerrainShapeKind = "circle" | "square" | "triangle";

export interface TerrainShape {
  kind: TerrainShapeKind;
  /** 0–1000, centre */
  x: number;
  /** Centre, px below the unit's flag top */
  dy: number;
  size: number;
  rotate: number;
  /** 0.08–0.12 */
  opacity: number;
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SHAPE_KINDS: readonly TerrainShapeKind[] = [
  "circle",
  "square",
  "triangle",
];
const SHAPE_SLOTS = [70, 220, 380, 520, 680, 820, 940];
/** Keep this far (0–1000 units) from the flag so the shapes never sit behind it. */
export const SHAPE_FLAG_CLEARANCE = 190;

/**
 * Two or three big faint shapes that dress the strip around a unit's flag.
 * Positions come from the unit id, so they never jump between renders, and
 * they stay in the empty band above the unit's first row.
 */
export function terrainShapes(seed: string, flagX: number): TerrainShape[] {
  const hash = hashString(seed);
  const free = SHAPE_SLOTS.filter(
    (x) => Math.abs(x - flagX) >= SHAPE_FLAG_CLEARANCE,
  );
  const count = 2 + (hash % 2);
  const shapes: TerrainShape[] = [];
  let pool = free.slice();
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const h = hashString(`${seed}:${i}`);
    const pick = h % pool.length;
    const x = pool[pick];
    // Neighbours of a taken slot are skipped so shapes do not pile up.
    pool = pool.filter((slot) => Math.abs(slot - x) >= 240);
    shapes.push({
      kind: SHAPE_KINDS[(h >>> 4) % SHAPE_KINDS.length],
      x,
      dy: 26 + ((h >>> 8) % 18),
      size: 76 + ((h >>> 12) % 20),
      rotate: ((h >>> 16) % 5) * 9 - 18,
      opacity: 0.08 + ((h >>> 20) % 5) / 100,
    });
  }
  return shapes;
}

/**
 * Height to keep free under the row whose card is open: the card, plus 24px,
 * counted from where the next row's content starts. That is the disk top
 * (about 38px above its centre), or the "next" halo and tag (112px above).
 */
export function cardSpaceFor(args: {
  cardOffset: number;
  nextStopBelow: boolean;
}): number {
  const reach = args.nextStopBelow ? STATION_REACH_ABOVE : 38;
  return Math.max(0, args.cardOffset + CARD_HEIGHT + 24 - (ROW_PITCH - reach));
}
