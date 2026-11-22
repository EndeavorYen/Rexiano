import "./coverArt.css";
import { contourBars } from "./songContour";
import { coverStyle } from "./coverStyle";

interface SongCoverArtProps {
  /** `BuiltinSongMeta.contour`; imported songs pass undefined */
  contour: readonly number[] | undefined;
  /** Stable id used for the fallback pattern and the backdrop circles */
  seed: string;
  /** Background color, usually `lessonGroupColor(groupId)` */
  color: string;
  /**
   * Position in the song's unit. Given, neighbours are guaranteed to differ;
   * left out, the look comes from the seed alone.
   */
  variant?: number;
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
  variant,
  className,
}: SongCoverArtProps): React.JSX.Element {
  const bars = contourBars(contour, seed);
  const span = BOTTOM - TOP;
  const totalLength = bars.reduce((sum, bar) => sum + bar.length, 0);
  const unit = Math.min(30, Math.max(11, span / Math.max(1, totalLength)));
  const { tone, shape, flip } = coverStyle(seed, variant);

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
      <rect
        width={WIDTH}
        height={HEIGHT}
        style={{
          fill: `color-mix(in srgb, ${color} var(--cover-tone-${tone}), #000)`,
        }}
      />
      <g transform={flip ? `translate(${WIDTH} 0) scale(-1 1)` : undefined}>
        <CoverBackdrop shape={shape} />
      </g>
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

/** Four big, quiet shapes behind the notes; `shape` picks one. */
function CoverBackdrop({ shape }: { shape: number }): React.JSX.Element {
  switch (shape) {
    case 1:
      // a wide diagonal band
      return (
        <polygon
          points="-10,200 -10,120 190,10 190,90"
          fill="#fff"
          opacity={0.12}
        />
      );
    case 2:
      // a big quarter circle in the lower-left corner
      return <circle cx={0} cy={HEIGHT} r={120} fill="#fff" opacity={0.12} />;
    case 3:
      // a row of three small arcs along the top
      return (
        <g fill="#fff" opacity={0.14}>
          <circle cx={36} cy={-4} r={30} />
          <circle cx={90} cy={-4} r={30} />
          <circle cx={144} cy={-4} r={30} />
        </g>
      );
    default:
      // two big circles
      return (
        <>
          <circle cx={30} cy={62} r={64} fill="#fff" opacity={0.13} />
          <circle cx={150} cy={160} r={34} fill="#000" opacity={0.07} />
        </>
      );
  }
}
