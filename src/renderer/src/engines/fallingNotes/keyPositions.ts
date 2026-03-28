const DEFAULT_FIRST_NOTE = 21;
const DEFAULT_LAST_NOTE = 108;

const IS_BLACK: boolean[] = [
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

const BLACK_WIDTH_RATIO = 0.58;

export interface KeyPosition {
  x: number;
  width: number;
}

export function buildKeyPositions(
  canvasWidth: number,
  firstNote: number = DEFAULT_FIRST_NOTE,
  lastNote: number = DEFAULT_LAST_NOTE,
): Map<number, KeyPosition> {
  const map = new Map<number, KeyPosition>();

  const whiteKeyIndices = new Map<number, number>();
  let whiteCount = 0;
  for (let midi = firstNote; midi <= lastNote; midi++) {
    if (!IS_BLACK[midi % 12]) {
      whiteKeyIndices.set(midi, whiteCount);
      whiteCount++;
    }
  }

  const whiteKeyWidth = canvasWidth / whiteCount;

  let lastWhiteIndex = -1;
  for (let midi = firstNote; midi <= lastNote; midi++) {
    const isBlack = IS_BLACK[midi % 12];
    if (!isBlack) {
      const idx = whiteKeyIndices.get(midi)!;
      lastWhiteIndex = idx;
      map.set(midi, { x: idx * whiteKeyWidth, width: whiteKeyWidth });
    } else {
      const bw = whiteKeyWidth * BLACK_WIDTH_RATIO;
      const centerX = (lastWhiteIndex + 1) * whiteKeyWidth;
      map.set(midi, { x: centerX - bw / 2, width: bw });
    }
  }

  return map;
}
