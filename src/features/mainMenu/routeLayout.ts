/**
 * Where each station sits on the winding route. Pure geometry: x lives in a
 * fixed 0–1000 coordinate space (stretched to the container width), y is in
 * real pixels, so the SVG route and the buttons always line up.
 */
export const ROUTE_WIDTH = 1000;
export const ROW_PITCH = 232;
export const REGION_HEADER = 64;
/** Extra height reserved under a row while a station card is open. */
export const CARD_SPACE = 176;
const TOP_PAD = 70;
const BOTTOM_PAD = 90;

export interface LaidOutStation {
  /** 0–1000 */
  x: number;
  /** Disk centre, px from the top of the map */
  y: number;
  row: number;
  col: number;
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
}

function wave(index: number): number {
  return Math.round(Math.sin(index * 1.25) * 14);
}

export function layoutRoute({
  regionSizes,
  cols,
  openCardRow = null,
}: LayoutOptions): RouteLayout {
  const colWidth = ROUTE_WIDTH / cols;
  // First pass: assign row/col, regions always start a fresh row.
  const slots: { row: number; col: number; region: number }[] = [];
  const regionRows: { first: number; last: number }[] = [];
  let row = -1;
  let colInRow = cols;
  regionSizes.forEach((size, region) => {
    if (size === 0) return;
    row += 1;
    colInRow = 0;
    const first = row;
    for (let i = 0; i < size; i += 1) {
      if (colInRow === cols) {
        row += 1;
        colInRow = 0;
      }
      const leftToRight = row % 2 === 0;
      const col = leftToRight ? colInRow : cols - 1 - colInRow;
      slots.push({ row, col, region });
      colInRow += 1;
    }
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
    if (openCardRow !== null && r === openCardRow) cursor += CARD_SPACE;
    lastRow = r;
  }

  const stations = slots.map((slot, i) => ({
    x: Math.round((slot.col + 0.5) * colWidth),
    y: (rowTop.get(slot.row) ?? 0) + wave(i),
    row: slot.row,
    col: slot.col,
  }));

  const flags: RegionFlag[] = [];
  const regionBands: RegionBand[] = [];
  let firstStation = 0;
  regionSizes.forEach((size) => {
    if (size === 0) return;
    const rr = regionRows[flags.length];
    const first = stations[firstStation];
    flags.push({ x: first.x, y: (rowTop.get(rr.first) ?? 0) - 62 });
    regionBands.push({
      top: flags.length === 1 ? 0 : (rowTop.get(rr.first) ?? 0) - 90,
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
  return { stations, flags, regionBands, height, cols };
}

/** SVG path for the road between two neighbouring stations. */
export function segmentPath(
  a: LaidOutStation,
  b: LaidOutStation,
  cols: number,
): string {
  if (a.row === b.row) {
    const mx = (a.x + b.x) / 2;
    return `M${a.x} ${a.y}C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  }
  const colWidth = ROUTE_WIDTH / cols;
  const dy = b.y - a.y;
  if (Math.abs(b.x - a.x) <= colWidth * 1.5) {
    // U-turn at the edge: bulge outwards on the side the row ran toward.
    const out = a.col >= cols / 2 ? 1 : -1;
    const bulge = Math.min(colWidth * 0.38, 110) * out;
    const outerX = Math.max(a.x, b.x);
    const innerX = Math.min(a.x, b.x);
    const edge = out > 0 ? outerX : innerX;
    return `M${a.x} ${a.y}C${edge + bulge} ${a.y + dy * 0.05} ${edge + bulge} ${b.y - dy * 0.05} ${b.x} ${b.y}`;
  }
  const my = a.y + dy / 2;
  return `M${a.x} ${a.y}C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
}
