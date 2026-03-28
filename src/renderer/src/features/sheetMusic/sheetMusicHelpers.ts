/**
 * Pure utility functions for sheet music rendering.
 *
 * These functions have no React or DOM dependencies and can be unit tested
 * independently.
 */

/** Regex for validating hex color strings (#RGB, #RRGGBB, #RRGGBBAA) */
const HEX_COLOR_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Convert a hex color to rgba string for SVG use.
 *
 * FIX (R1-06): Validates input format and provides a fallback color
 * if the input is not a valid hex string (e.g. an rgb() or named color).
 */
export function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    // Fallback: return a safe semi-transparent black
    return `rgba(0, 0, 0, ${alpha})`;
  }

  let cleaned = trimmed.replace("#", "");

  // Expand shorthand (#RGB -> #RRGGBB)
  if (cleaned.length === 3) {
    cleaned =
      cleaned[0] +
      cleaned[0] +
      cleaned[1] +
      cleaned[1] +
      cleaned[2] +
      cleaned[2];
  }

  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);

  // R2-04 FIX: Parse alpha byte from 8-digit hex (#RRGGBBAA).
  // The embedded alpha (0-255) is multiplied with the caller's alpha parameter.
  let effectiveAlpha = alpha;
  if (cleaned.length === 8) {
    const hexAlpha = parseInt(cleaned.substring(6, 8), 16) / 255;
    effectiveAlpha = alpha * hexAlpha;
  }

  return `rgba(${r}, ${g}, ${b}, ${effectiveAlpha})`;
}
