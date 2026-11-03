/**
 * Pickup (anacrusis) measures, encoded the common MIDI way: a short time
 * signature for the first measure, followed by the song's real one at the
 * end of that measure (#333).
 */

export interface MeterAt {
  ticks: number;
  numerator: number;
  denominator: number;
}

export interface Pickup {
  /** Length of the pickup measure in ticks */
  ticks: number;
  /** The song's real meter, which the pickup is written under */
  numerator: number;
  denominator: number;
}

function measureTicks(meter: MeterAt, ppq: number): number {
  return (ppq * 4 * meter.numerator) / meter.denominator;
}

/**
 * Time signature for a pickup `quarters` long under a meter with the given
 * beat unit: a one-beat pickup in 3/4 is 1/4, an eighth in 3/8 is 1/8, a
 * dotted-eighth + sixteenth in 6/8 is 2/8.
 */
export function pickupTimeSignature(
  quarters: number,
  beatType: number,
): [number, number] {
  let denominator = beatType;
  while (denominator < 64) {
    const numerator = (quarters * denominator) / 4;
    if (Math.abs(numerator - Math.round(numerator)) < 1e-9) {
      return [Math.round(numerator), denominator];
    }
    denominator *= 2;
  }
  return [Math.max(1, Math.round((quarters * denominator) / 4)), denominator];
}

/**
 * A song starts with a pickup when its first meter lasts exactly one
 * measure, is shorter than the meter that follows, and is the only meter
 * before it.
 */
export function findPickup(
  meters: readonly MeterAt[],
  ppq: number,
): Pickup | null {
  const sorted = [...meters].sort((a, b) => a.ticks - b.ticks);
  const [first, next] = sorted;
  if (!first || !next || first.ticks !== 0) return null;
  const length = measureTicks(first, ppq);
  if (Math.abs(next.ticks - length) > 0.5) return null;
  if (length >= measureTicks(next, ppq)) return null;
  return {
    ticks: next.ticks,
    numerator: next.numerator,
    denominator: next.denominator,
  };
}
