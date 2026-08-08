/**
 * TempoMap — exact conversion between wall-clock seconds and musical ticks,
 * plus the measure map derived from time-signature changes.
 *
 * Rexiano's playback layer works in seconds (the audio clock is the master
 * clock), while notation must work in musical time. Converting between the two
 * with a single constant BPM is only correct for songs that never change tempo;
 * any tempo change makes note values and barlines wrong from that point on.
 * This class does the piecewise-exact conversion instead.
 *
 * Pure logic — no React or DOM dependencies.
 */

import type { ParsedSong, TempoEvent, TimeSignatureEvent } from "./types";

/** MIDI's default tempo when a file declares none before the first event. */
export const DEFAULT_BPM = 120;

/** MIDI's default meter when a file declares none before the first event. */
export const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 };

/** Fallback resolution when a song carries no native PPQ. */
export const DEFAULT_PPQ = 480;

/** One constant-tempo span. */
interface TempoSegment {
  startSeconds: number;
  startTicks: number;
  bpm: number;
  /** Ticks advanced per second of wall-clock time within this span. */
  ticksPerSecond: number;
}

/** One constant-meter span, measured in whole measures. */
interface MeterSegment {
  startTicks: number;
  /** Index of the first measure in this span. */
  startMeasureIndex: number;
  ticksPerMeasure: number;
  ticksPerBeat: number;
  numerator: number;
  denominator: number;
}

/** A measure's position in musical time. */
export interface MeasureInfo {
  index: number;
  startTick: number;
  endTick: number;
  ticksPerMeasure: number;
  numerator: number;
  denominator: number;
}

/** A cursor position resolved against the measure map. */
export interface MeasurePosition {
  measureIndex: number;
  /** Ticks elapsed since the start of this measure. */
  tickInMeasure: number;
  /** Beat within the measure (0-based, fractional). */
  beat: number;
}

function ticksPerSecondFor(bpm: number, ppq: number): number {
  return (ppq * bpm) / 60;
}

/**
 * Exact seconds ↔ ticks conversion and measure lookup for one song.
 *
 * Build with {@link TempoMap.fromSong}; the constructor is available for tests
 * that want to supply tempo/meter events directly.
 */
export class TempoMap {
  private readonly _ppq: number;
  private readonly _tempoSegments: TempoSegment[];
  private readonly _meterSegments: MeterSegment[];

  constructor(
    tempos: readonly TempoEvent[],
    timeSignatures: readonly TimeSignatureEvent[],
    ppq: number = DEFAULT_PPQ,
  ) {
    this._ppq = ppq > 0 ? ppq : DEFAULT_PPQ;
    this._tempoSegments = this._buildTempoSegments(tempos);
    this._meterSegments = this._buildMeterSegments(timeSignatures);
  }

  /** Build the map for a parsed song, honouring its native PPQ when present. */
  static fromSong(song: ParsedSong): TempoMap {
    return new TempoMap(
      song.tempos,
      song.timeSignatures,
      song.ppq ?? DEFAULT_PPQ,
    );
  }

  get ppq(): number {
    return this._ppq;
  }

  /** True when the song changes tempo at least once after its first event. */
  get hasTempoChanges(): boolean {
    return this._tempoSegments.length > 1;
  }

  /** True when the song changes meter at least once after its first event. */
  get hasTimeSignatureChanges(): boolean {
    return this._meterSegments.length > 1;
  }

  /**
   * Convert wall-clock seconds to musical ticks.
   * Exact across any number of tempo changes.
   */
  secondsToTicks(seconds: number): number {
    if (!Number.isFinite(seconds)) return 0;
    const clamped = Math.max(0, seconds);
    const segment = this._tempoSegmentAtSeconds(clamped);
    return (
      segment.startTicks +
      (clamped - segment.startSeconds) * segment.ticksPerSecond
    );
  }

  /** Convert musical ticks to wall-clock seconds. */
  ticksToSeconds(ticks: number): number {
    if (!Number.isFinite(ticks)) return 0;
    const clamped = Math.max(0, ticks);
    const segment = this._tempoSegmentAtTicks(clamped);
    return (
      segment.startSeconds +
      (clamped - segment.startTicks) / segment.ticksPerSecond
    );
  }

  /** The tempo in effect at a given tick. */
  bpmAtTicks(ticks: number): number {
    return this._tempoSegmentAtTicks(Math.max(0, ticks)).bpm;
  }

  /** The measure containing a given tick. */
  measureAtTicks(ticks: number): MeasurePosition {
    const clamped = Math.max(0, ticks);
    const segment = this._meterSegmentAtTicks(clamped);
    const offset = clamped - segment.startTicks;
    const measuresIn = Math.floor(offset / segment.ticksPerMeasure);
    const tickInMeasure = offset - measuresIn * segment.ticksPerMeasure;

    return {
      measureIndex: segment.startMeasureIndex + measuresIn,
      tickInMeasure,
      beat: tickInMeasure / segment.ticksPerBeat,
    };
  }

  /**
   * Enumerate every measure needed to cover `totalTicks` of music.
   * Always returns at least one measure so an empty score still renders a staff.
   */
  buildMeasures(totalTicks: number): MeasureInfo[] {
    const target = Math.max(0, totalTicks);
    const measures: MeasureInfo[] = [];

    for (let i = 0; i < this._meterSegments.length; i++) {
      const segment = this._meterSegments[i];
      const next = this._meterSegments[i + 1];
      // A meter span ends at the next meter change, or at the end of the music.
      const segmentEnd = next ? next.startTicks : Math.max(target, 1);
      const spanTicks = Math.max(0, segmentEnd - segment.startTicks);
      // Meter changes land on barlines, so a partial trailing measure still
      // occupies a whole measure slot in the score.
      const count = Math.max(
        next ? Math.round(spanTicks / segment.ticksPerMeasure) : 0,
        Math.ceil(spanTicks / segment.ticksPerMeasure),
      );

      for (let m = 0; m < count; m++) {
        const startTick = segment.startTicks + m * segment.ticksPerMeasure;
        measures.push({
          index: measures.length,
          startTick,
          endTick: startTick + segment.ticksPerMeasure,
          ticksPerMeasure: segment.ticksPerMeasure,
          numerator: segment.numerator,
          denominator: segment.denominator,
        });
      }
    }

    if (measures.length === 0) {
      const segment = this._meterSegments[0];
      measures.push({
        index: 0,
        startTick: segment.startTicks,
        endTick: segment.startTicks + segment.ticksPerMeasure,
        ticksPerMeasure: segment.ticksPerMeasure,
        numerator: segment.numerator,
        denominator: segment.denominator,
      });
    }

    return measures;
  }

  // ─── Private ────────────────────────────

  private _buildTempoSegments(tempos: readonly TempoEvent[]): TempoSegment[] {
    const usable = tempos.filter(
      (tempo) => Number.isFinite(tempo.bpm) && tempo.bpm > 0,
    );

    if (usable.length === 0) {
      return [
        {
          startSeconds: 0,
          startTicks: 0,
          bpm: DEFAULT_BPM,
          ticksPerSecond: ticksPerSecondFor(DEFAULT_BPM, this._ppq),
        },
      ];
    }

    // Ticks are the authority when the parser preserved them: that is what the
    // MIDI file actually stores. Seconds are a derived view.
    const hasTicks = usable.every((tempo) => tempo.ticks !== undefined);
    const ordered = [...usable].sort((a, b) =>
      hasTicks ? (a.ticks ?? 0) - (b.ticks ?? 0) : a.time - b.time,
    );

    const segments: TempoSegment[] = [];

    // Before the first declared tempo, MIDI's default of 120 BPM applies.
    const firstTicks = hasTicks ? (ordered[0].ticks ?? 0) : undefined;
    const firstSeconds = ordered[0].time;
    if ((hasTicks ? (firstTicks ?? 0) : firstSeconds) > 0) {
      segments.push({
        startSeconds: 0,
        startTicks: 0,
        bpm: DEFAULT_BPM,
        ticksPerSecond: ticksPerSecondFor(DEFAULT_BPM, this._ppq),
      });
    }

    for (const tempo of ordered) {
      const ticksPerSecond = ticksPerSecondFor(tempo.bpm, this._ppq);
      const previous = segments[segments.length - 1];

      let startTicks: number;
      let startSeconds: number;

      if (hasTicks) {
        startTicks = tempo.ticks ?? 0;
        startSeconds = previous
          ? previous.startSeconds +
            (startTicks - previous.startTicks) / previous.ticksPerSecond
          : 0;
      } else {
        startSeconds = Math.max(0, tempo.time);
        startTicks = previous
          ? previous.startTicks +
            (startSeconds - previous.startSeconds) * previous.ticksPerSecond
          : 0;
      }

      // Two events at the same position: the later one wins.
      if (previous && startTicks <= previous.startTicks) {
        segments[segments.length - 1] = {
          startSeconds: previous.startSeconds,
          startTicks: previous.startTicks,
          bpm: tempo.bpm,
          ticksPerSecond,
        };
        continue;
      }

      segments.push({
        startSeconds,
        startTicks,
        bpm: tempo.bpm,
        ticksPerSecond,
      });
    }

    return segments;
  }

  private _buildMeterSegments(
    timeSignatures: readonly TimeSignatureEvent[],
  ): MeterSegment[] {
    const usable = timeSignatures.filter(
      (ts) => ts.numerator > 0 && ts.denominator > 0,
    );

    const makeSegment = (
      startTicks: number,
      startMeasureIndex: number,
      numerator: number,
      denominator: number,
    ): MeterSegment => {
      const ticksPerBeat = this._ppq * (4 / denominator);
      return {
        startTicks,
        startMeasureIndex,
        ticksPerMeasure: ticksPerBeat * numerator,
        ticksPerBeat,
        numerator,
        denominator,
      };
    };

    if (usable.length === 0) {
      return [
        makeSegment(
          0,
          0,
          DEFAULT_TIME_SIGNATURE.numerator,
          DEFAULT_TIME_SIGNATURE.denominator,
        ),
      ];
    }

    const ordered = [...usable].sort((a, b) => {
      const aTicks = a.ticks ?? this.secondsToTicks(a.time);
      const bTicks = b.ticks ?? this.secondsToTicks(b.time);
      return aTicks - bTicks;
    });

    const segments: MeterSegment[] = [];

    const firstTicks = ordered[0].ticks ?? this.secondsToTicks(ordered[0].time);
    if (firstTicks > 0) {
      segments.push(
        makeSegment(
          0,
          0,
          DEFAULT_TIME_SIGNATURE.numerator,
          DEFAULT_TIME_SIGNATURE.denominator,
        ),
      );
    }

    for (const ts of ordered) {
      const startTicks = Math.max(
        0,
        Math.round(ts.ticks ?? this.secondsToTicks(ts.time)),
      );
      const previous = segments[segments.length - 1];

      if (previous && startTicks <= previous.startTicks) {
        // Same barline: the later declaration wins, measure numbering unchanged.
        segments[segments.length - 1] = makeSegment(
          previous.startTicks,
          previous.startMeasureIndex,
          ts.numerator,
          ts.denominator,
        );
        continue;
      }

      const startMeasureIndex = previous
        ? previous.startMeasureIndex +
          Math.max(
            1,
            Math.round(
              (startTicks - previous.startTicks) / previous.ticksPerMeasure,
            ),
          )
        : 0;

      segments.push(
        makeSegment(
          startTicks,
          startMeasureIndex,
          ts.numerator,
          ts.denominator,
        ),
      );
    }

    return segments;
  }

  private _tempoSegmentAtSeconds(seconds: number): TempoSegment {
    let match = this._tempoSegments[0];
    for (const segment of this._tempoSegments) {
      if (segment.startSeconds > seconds) break;
      match = segment;
    }
    return match;
  }

  private _tempoSegmentAtTicks(ticks: number): TempoSegment {
    let match = this._tempoSegments[0];
    for (const segment of this._tempoSegments) {
      if (segment.startTicks > ticks) break;
      match = segment;
    }
    return match;
  }

  private _meterSegmentAtTicks(ticks: number): MeterSegment {
    let match = this._meterSegments[0];
    for (const segment of this._meterSegments) {
      if (segment.startTicks > ticks) break;
      match = segment;
    }
    return match;
  }
}
