import { contourBars } from "./songContour";

interface SongCoverArtProps {
  /** `BuiltinSongMeta.contour`; imported songs pass undefined */
  contour: readonly number[] | undefined;
  /** Stable id used for the fallback pattern and the backdrop circles */
  seed: string;
  /** Background color, usually `lessonGroupColor(groupId)` */
  color: string;
  className?: string;
}

const WIDTH = 180;
const HEIGHT = 240;
const LANES = 8;
const LEFT = 16;
const LANE_WIDTH = (WIDTH - LEFT - 12) / LANES;
const NOTE_WIDTH = LANE_WIDTH - 4;
const TOP = 18;
const BOTTOM = 150;

/**
 * The picture on a song cover: the opening of the song's own melody drawn
 * as a miniature of the falling notes (pitch = lane, length = bar height,
 * first note at the bottom). Decorative only — the card supplies the name.
 */
export function SongCoverArt({
  contour,
  seed,
  color,
  className,
}: SongCoverArtProps): React.JSX.Element {
  const bars = contourBars(contour, seed);
  const span = BOTTOM - TOP;
  const totalLength = bars.reduce((sum, bar) => sum + bar.length, 0);
  const unit = Math.min(30, Math.max(11, span / Math.max(1, totalLength)));
  const flip = seedBit(seed);

  const rects: React.JSX.Element[] = [];
  let y = BOTTOM;
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const height = Math.max(10, bar.length * unit - 3);
    const top = y - height;
    if (top < TOP - 6 && index >= 4) break;
    const lane = Math.round(bar.pitch * (LANES - 1));
    rects.push(
      <rect
        key={index}
        x={LEFT + lane * LANE_WIDTH + 2}
        y={top}
        width={NOTE_WIDTH}
        height={height}
        rx={Math.min(NOTE_WIDTH / 2, height / 2)}
        fill="#fff"
        opacity={index % 2 === 1 ? 0.62 : 1}
      />,
    );
    y = top - 3;
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width={WIDTH} height={HEIGHT} fill={color} />
      <circle cx={flip ? 150 : 30} cy={62} r={64} fill="#fff" opacity={0.13} />
      <circle cx={flip ? 30 : 150} cy={160} r={34} fill="#000" opacity={0.07} />
      {Array.from({ length: LANES + 1 }, (_, lane) => (
        <rect
          key={`lane-${lane}`}
          x={LEFT + lane * LANE_WIDTH - 0.5}
          y={0}
          width={1}
          height={BOTTOM + 14}
          fill="#fff"
          opacity={0.1}
        />
      ))}
      {rects}
    </svg>
  );
}

function seedBit(seed: string): boolean {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i);
  return sum % 2 === 0;
}
