import type { CSSProperties } from "react";

/**
 * Percent of a range input's track that is filled, as a CSS length.
 * Read by the `--range-progress` track gradient in `main.css`.
 */
export function rangeProgress(value: number, min: number, max: number): string {
  if (!(max > min) || !Number.isFinite(value)) return "0%";
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return `${Math.round(ratio * 1000) / 10}%`;
}

/** Inline style that feeds `rangeProgress` to a range input. */
export function rangeProgressStyle(
  value: number,
  min: number,
  max: number,
): CSSProperties {
  return {
    "--range-progress": rangeProgress(value, min, max),
  } as CSSProperties;
}
