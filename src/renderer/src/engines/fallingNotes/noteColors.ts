/** Track colors for falling notes on a light background. */
const TRACK_COLORS: number[] = [
  0x3b82f6, // blue   — Track 1 (typically right hand)
  0xf97316, // orange — Track 2 (typically left hand)
  0x8b5cf6, // purple — Track 3
  0x10b981, // green  — Track 4
  0xef4444, // red    — Track 5
  0x06b6d4, // cyan   — Track 6
]

/** Get the PixiJS tint color for a given track index. */
export function getTrackColor(trackIndex: number): number {
  return TRACK_COLORS[trackIndex % TRACK_COLORS.length]
}
