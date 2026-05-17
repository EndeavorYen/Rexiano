import type { NoteResult } from "@shared/types";

// ── Types ──────────────────────────────────────────────────────────────

export interface WeakSpot {
  /** MIDI note number */
  midi: number;
  /** Human-readable note name (e.g. "C4", "F#5") */
  noteName: string;
  /** Miss rate as a fraction 0-1 */
  missRate: number;
  /** Total number of times this note was encountered */
  totalAttempts: number;
}

export interface WeakSection {
  /** 0-based measure index */
  measureIndex: number;
  /** 1-based measure number for user-facing copy */
  measureNumber: number;
  /** Miss rate as a fraction 0-1 */
  missRate: number;
  /** Total number of note attempts in this measure */
  totalAttempts: number;
}

export interface SessionSummary {
  /** Unique identifier for the song */
  songId: string;
  /** Accuracy percentage (0-100) */
  accuracy: number;
  /** Duration of practice in minutes */
  durationMinutes: number;
  /** Approximate duration of one measure, used to bucket note timing */
  measureDurationSeconds?: number;
  /** Timestamp of the session */
  timestamp: number;
  /** Per-note results from the session */
  noteResults: Map<string, NoteResult>;
}

export interface PracticeInsight {
  /** Song identifier */
  songId: string;
  /** Top 5 weakest notes by miss rate */
  weakSpots: WeakSpot[];
  /** Top weakest measures by miss rate */
  weakSections: WeakSection[];
  /** Accuracy values over sessions, ordered chronologically */
  accuracyTrend: number[];
  /** Total practice time in minutes */
  totalPracticeMinutes: number;
  /** Number of practice sessions */
  sessionsCount: number;
  /** Highest accuracy ever achieved */
  bestAccuracy: number;
  /** Difference between recent average and overall average */
  recentImprovement: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** Number of recent sessions to use for "recent improvement" calculation */
const RECENT_WINDOW = 3;

/** Maximum number of weak spots to report */
const MAX_WEAK_SPOTS = 5;

/** Maximum number of weak sections to report */
const MAX_WEAK_SECTIONS = 5;

/** Minimum attempts before a note is considered for weak spot analysis */
const MIN_ATTEMPTS_FOR_ANALYSIS = 2;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Convert a MIDI note number to a human-readable name.
 * @param midi - MIDI note number (0-127)
 * @returns Name like "C4", "F#5"
 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Extract MIDI note number and timing from a note result key.
 * Current scoring callbacks store "midi:timeUs"; older insight fixtures use
 * "trackIdx:midi:timeUs". Plain "trackIdx:noteIdx" keys cannot be analyzed.
 */
function parseNoteResultKey(key: string): {
  midi: number | null;
  timeSeconds: number | null;
} {
  const parts = key.split(":");
  const parseBoundedMidi = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const midi = parseInt(value, 10);
    if (!isNaN(midi) && midi >= 0 && midi <= 127) return midi;
    return null;
  };
  const parseTimeSeconds = (value: string | undefined): number | null => {
    if (value === undefined) return null;
    const timeUs = Number(value);
    if (!Number.isFinite(timeUs) || timeUs < 0) return null;
    return timeUs / 1_000_000;
  };

  if (parts.length >= 3) {
    return {
      midi: parseBoundedMidi(parts[1]),
      timeSeconds: parseTimeSeconds(parts[2]),
    };
  }

  if (parts.length === 2) {
    return {
      midi: parseBoundedMidi(parts[0]),
      timeSeconds: parseTimeSeconds(parts[1]),
    };
  }

  return { midi: null, timeSeconds: null };
}

// ── Main Analyzer ──────────────────────────────────────────────────────

/**
 * Analyzes practice session data to produce insights:
 * - Identifies weak spots (notes with highest miss rates)
 * - Tracks accuracy trends over time
 * - Computes practice statistics
 *
 * Pure logic — no React or DOM dependencies.
 */
export class WeakSpotAnalyzer {
  /**
   * Analyze a collection of practice sessions for a given song.
   *
   * @param songId - The song identifier
   * @param sessions - Array of session summaries, in chronological order
   * @returns A PracticeInsight summarizing the analysis
   */
  analyze(songId: string, sessions: SessionSummary[]): PracticeInsight {
    if (sessions.length === 0) {
      return this.emptyInsight(songId);
    }

    // Filter sessions for this song
    const songSessions = sessions.filter((s) => s.songId === songId);
    if (songSessions.length === 0) {
      return this.emptyInsight(songId);
    }

    // Sort chronologically
    const sorted = [...songSessions].sort((a, b) => a.timestamp - b.timestamp);

    // Accuracy trend
    const accuracyTrend = sorted.map((s) => s.accuracy);

    // Aggregate note results across all sessions
    const noteStats = new Map<number, { hits: number; misses: number }>();
    const sectionStats = new Map<number, { hits: number; misses: number }>();

    for (const session of sorted) {
      for (const [key, result] of session.noteResults) {
        if (result === "pending") continue;

        const parsed = parseNoteResultKey(key);

        if (parsed.midi !== null) {
          const existing = noteStats.get(parsed.midi) ?? {
            hits: 0,
            misses: 0,
          };
          if (result === "hit") {
            existing.hits++;
          } else if (result === "miss") {
            existing.misses++;
          }
          noteStats.set(parsed.midi, existing);
        }

        if (
          parsed.timeSeconds !== null &&
          session.measureDurationSeconds !== undefined &&
          session.measureDurationSeconds > 0
        ) {
          const measureIndex = Math.floor(
            parsed.timeSeconds / session.measureDurationSeconds,
          );
          const existing = sectionStats.get(measureIndex) ?? {
            hits: 0,
            misses: 0,
          };
          if (result === "hit") {
            existing.hits++;
          } else if (result === "miss") {
            existing.misses++;
          }
          sectionStats.set(measureIndex, existing);
        }
      }
    }

    // Compute weak spots
    const weakSpots = this.computeWeakSpots(noteStats);
    const weakSections = this.computeWeakSections(sectionStats);

    // Statistics
    const totalPracticeMinutes = sorted.reduce(
      (sum, s) => sum + s.durationMinutes,
      0,
    );
    const bestAccuracy = Math.max(...accuracyTrend);

    // Recent improvement: compare last RECENT_WINDOW sessions to the rest
    const recentImprovement = this.computeRecentImprovement(accuracyTrend);

    return {
      songId,
      weakSpots,
      weakSections,
      accuracyTrend,
      totalPracticeMinutes: Math.round(totalPracticeMinutes * 10) / 10,
      sessionsCount: sorted.length,
      bestAccuracy,
      recentImprovement,
    };
  }

  /**
   * Compute the top weak spots from aggregated note statistics.
   */
  private computeWeakSpots(
    noteStats: Map<number, { hits: number; misses: number }>,
  ): WeakSpot[] {
    const candidates: WeakSpot[] = [];

    for (const [midi, stats] of noteStats) {
      const total = stats.hits + stats.misses;
      if (total < MIN_ATTEMPTS_FOR_ANALYSIS) continue;

      const missRate = stats.misses / total;
      candidates.push({
        midi,
        noteName: midiToNoteName(midi),
        missRate: Math.round(missRate * 1000) / 1000,
        totalAttempts: total,
      });
    }

    // Sort by miss rate descending, then by total attempts descending
    candidates.sort((a, b) => {
      if (Math.abs(a.missRate - b.missRate) > 0.001)
        return b.missRate - a.missRate;
      return b.totalAttempts - a.totalAttempts;
    });

    return candidates.slice(0, MAX_WEAK_SPOTS);
  }

  private computeWeakSections(
    sectionStats: Map<number, { hits: number; misses: number }>,
  ): WeakSection[] {
    const candidates: WeakSection[] = [];

    for (const [measureIndex, stats] of sectionStats) {
      const total = stats.hits + stats.misses;
      if (total < MIN_ATTEMPTS_FOR_ANALYSIS) continue;

      const missRate = stats.misses / total;
      candidates.push({
        measureIndex,
        measureNumber: measureIndex + 1,
        missRate: Math.round(missRate * 1000) / 1000,
        totalAttempts: total,
      });
    }

    candidates.sort((a, b) => {
      if (Math.abs(a.missRate - b.missRate) > 0.001)
        return b.missRate - a.missRate;
      return (
        b.totalAttempts - a.totalAttempts || a.measureIndex - b.measureIndex
      );
    });

    return candidates.slice(0, MAX_WEAK_SECTIONS);
  }

  /**
   * Compute improvement: average of recent sessions minus average of older sessions.
   * A positive value means the player is improving.
   */
  private computeRecentImprovement(accuracyTrend: number[]): number {
    if (accuracyTrend.length < 2) return 0;

    const recentCount = Math.min(
      RECENT_WINDOW,
      Math.floor(accuracyTrend.length / 2),
    );
    const recentSlice = accuracyTrend.slice(-recentCount);
    const olderSlice = accuracyTrend.slice(0, -recentCount);

    if (olderSlice.length === 0) return 0;

    const recentAvg =
      recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
    const olderAvg = olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length;

    return Math.round((recentAvg - olderAvg) * 100) / 100;
  }

  private emptyInsight(songId: string): PracticeInsight {
    return {
      songId,
      weakSpots: [],
      weakSections: [],
      accuracyTrend: [],
      totalPracticeMinutes: 0,
      sessionsCount: 0,
      bestAccuracy: 0,
      recentImprovement: 0,
    };
  }
}
