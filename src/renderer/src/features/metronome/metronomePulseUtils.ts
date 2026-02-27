// ─── MetronomePulse utility functions ───
//
// Pure functions for computing dot appearance (color, opacity, size).
// Extracted to a separate file so MetronomePulse.tsx only exports
// React components (required by react-refresh/only-export-components).

/** Size of an inactive dot in pixels */
const DOT_SIZE = 6;
/** Size of the active (current beat) dot in pixels */
const DOT_SIZE_ACTIVE = 10;

/**
 * Determine the color for a given beat dot.
 * - Active strong beat (beat 0): accent color
 * - Active weak beat: standard text color
 * - Inactive: muted text color
 */
export function getDotColor(beatIndex: number, isActive: boolean): string {
  if (!isActive) return "var(--color-text-muted)";
  if (beatIndex === 0) return "var(--color-accent)";
  return "var(--color-text)";
}

/**
 * Determine the opacity for a given beat dot.
 * Active dots are fully opaque; inactive dots are dimmed.
 */
export function getDotOpacity(isActive: boolean): number {
  return isActive ? 1 : 0.3;
}

/**
 * Determine the size (in pixels) for a given beat dot.
 * Active dots are larger than inactive dots.
 */
export function getDotSize(isActive: boolean): number {
  return isActive ? DOT_SIZE_ACTIVE : DOT_SIZE;
}
