import { TempoMap } from "@renderer/engines/midi/TempoMap";
import type { ParsedSong } from "@renderer/engines/midi/types";

const POSITION_EPSILON_SECONDS = 0.01;
const BEAT_EPSILON = 1e-7;

export interface MetronomeTiming {
  /** Wall-clock click rate after applying the playback speed. */
  bpm: number;
  beatsPerMeasure: number;
  currentBeat: number;
  firstClickBeat: number;
  firstClickDelaySeconds: number;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

/** Resolve tempo, meter, beat, and next wall-clock click at a song position. */
export function resolveMetronomeTiming(
  song: ParsedSong,
  currentTime: number,
  speed: number,
): MetronomeTiming {
  const safeTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
  const safeSpeed = Number.isFinite(speed) ? Math.max(0.01, speed) : 1;
  const tempoMap = TempoMap.fromSong(song);
  const ticks = tempoMap.secondsToTicks(safeTime);
  const position = tempoMap.measureAtTicks(ticks);
  const measures = tempoMap.buildMeasures(
    Math.max(ticks + tempoMap.ppq * 4, tempoMap.ppq * 4),
  );
  const measure = measures[position.measureIndex] ?? measures.at(-1)!;
  const beatsPerMeasure = Math.max(1, measure.numerator);
  const beatFloor = Math.floor(position.beat + BEAT_EPSILON);
  const beatFraction = Math.max(0, position.beat - beatFloor);
  const currentBeat = beatFloor % beatsPerMeasure;
  const onBeat = beatFraction <= BEAT_EPSILON;
  const firstClickBeat = onBeat
    ? currentBeat
    : (currentBeat + 1) % beatsPerMeasure;
  const ticksPerBeat = measure.ticksPerMeasure / beatsPerMeasure;
  const nextClickTicks = onBeat
    ? ticks
    : ticks + (1 - beatFraction) * ticksPerBeat;
  const songDelay = Math.max(
    0,
    tempoMap.ticksToSeconds(nextClickTicks) - safeTime,
  );
  const beatUnitMultiplier = measure.denominator / 4;

  return {
    bpm: rounded(tempoMap.bpmAtTicks(ticks) * beatUnitMultiplier * safeSpeed),
    beatsPerMeasure,
    currentBeat,
    firstClickBeat,
    firstClickDelaySeconds: rounded(songDelay / safeSpeed),
  };
}

export function shouldRunPlaybackCountIn({
  currentTime,
  countInBeats,
}: {
  currentTime: number;
  countInBeats: number;
}): boolean {
  return (
    Number.isFinite(currentTime) &&
    currentTime <= POSITION_EPSILON_SECONDS &&
    Number.isFinite(countInBeats) &&
    countInBeats > 0
  );
}

/** Stable key for detecting continuous tempo, meter, or speed boundaries. */
export function resolveMetronomeSegmentKey(
  song: ParsedSong,
  currentTime: number,
  speed: number,
): string {
  const timing = resolveMetronomeTiming(song, currentTime, speed);
  return `${timing.bpm}:${timing.beatsPerMeasure}`;
}
