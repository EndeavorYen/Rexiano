/** The big star is this wide; the HUD star it flies to is 28. */
export const STAR_TOAST_SIZE = 96;
/** Rest ~0.9 s in the middle, then fly to the HUD: 1.3 s in all. */
export const STAR_TOAST_MS = 1300;
export const STAR_TOAST_REDUCED_MS = 600;
/** Where the star sits in the falling-notes panel: share of its height. */
export const STAR_TOAST_TOP_SHARE = 0.15;

/**
 * Keyframes for the fly-away: the toast is measured against the HUD star it
 * lands on. Exported for tests; the values are plain numbers.
 */
export function buildToastKeyframes(
  fly: { dx: number; dy: number; scale: number } | null,
  reduced: boolean,
): Keyframe[] {
  if (reduced || !fly) {
    return [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.25 },
      { opacity: 1, offset: 0.75 },
      { opacity: 0, offset: 1 },
    ];
  }
  const base = `translate(-50%, -${STAR_TOAST_SIZE / 2}px)`;
  return [
    { opacity: 0, transform: `${base} scale(0.4)`, offset: 0 },
    { opacity: 1, transform: `${base} scale(1.12)`, offset: 0.1 },
    { opacity: 1, transform: `${base} scale(1)`, offset: 0.18 },
    { opacity: 1, transform: `${base} scale(1)`, offset: 0.69 },
    {
      opacity: 1,
      transform: `translate(calc(-50% + ${fly.dx}px), calc(-${STAR_TOAST_SIZE / 2}px + ${fly.dy}px)) scale(${fly.scale})`,
      offset: 0.97,
    },
    {
      opacity: 0,
      transform: `translate(calc(-50% + ${fly.dx}px), calc(-${STAR_TOAST_SIZE / 2}px + ${fly.dy}px)) scale(${fly.scale})`,
      offset: 1,
    },
  ];
}
