import type { NoteResult } from '@shared/types'

// ── Types ──────────────────────────────────────────────────────────────

export interface WeakSpot {
  /** MIDI note number */
  midi: number
  /** Human-readable note name (e.g. "C4", "F#5") */
  noteName: string
  /** Miss rate as a fraction 0-1 */
  missRate: number
  /** Total number of times this note was encountered */
  totalAttempts: number
}

export interface SessionSummary {
  /** Unique identifier for the song */
  songId: string
  /** Accuracy percentage (0-100) */
  accuracy: number
  /** Duration of practice in minutes */
  durationMinutes: number
  /** Timestamp of the session */
  timestamp: number
  /** Per-note results from the session */
  noteResults: Map<string, NoteResult>
}

export interface PracticeInsight {
  /** Song identifier */
  songId: string
  /** Top 5 weakest notes by miss rate */
  weakSpots: WeakSpot[]
  /** Accuracy values over sessions, ordered chronologically */
  accuracyTrend: number[]
  /** Total practice time in minutes */
  totalPracticeMinutes: number
  /** Number of practice sessions */
  sessionsCount: number
  /** Highest accuracy ever achieved */
  bestAccuracy: number
  /** Difference between recent average and overall average */
  recentImprovement: number
}

// ── Constants ──────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Number of recent sessions to use for "recent improvement" calculation */
const RECENT_WINDOW = 3

/** Maximum number of weak spots to report */
const MAX_WEAK_SPOTS = 5

/** Minimum attempts before a note is considered for weak spot analysis */
const MIN_ATTEMPTS_FOR_ANALYSIS = 2

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Convert a MIDI note number to a human-readable name.
 * @param midi - MIDI note number (0-127)
 * @returns Name like "C4", "F#5"
 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1
  const noteIndex = midi % 12
  return `${NOTE_NAMES[noteIndex]}${octave}`
}

/**
 * Extract MIDI note number from a note result key.
 * Keys follow the format "trackIndex:noteIndex" as used by WaitMode,
 * but for analysis we need to parse stored MIDI note data.
 *
 * In practice, noteResults are keyed by "trackIdx:noteIdx" and we need
 * the original MIDI number. This helper parses a richer key format
 * "trackIdx:midi:timeUs" if available, or falls back to the midi portion.
 */
function parseMidiFromKey(key: string): number | null {
  const parts = key.split(':')
  if (parts.length >= 2) {
    const midi = parseInt(parts[1], 10)
    if (!isNaN(midi) && midi >= 0 && midi <= 127) return midi
  }
  return null
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
      return this.emptyInsight(songId)
    }

    // Filter sessions for this song
    const songSessions = sessions.filter((s) => s.songId === songId)
    if (songSessions.length === 0) {
      return this.emptyInsight(songId)
    }

    // Sort chronologically
    const sorted = [...songSessions].sort((a, b) => a.timestamp - b.timestamp)

    // Accuracy trend
    const accuracyTrend = sorted.map((s) => s.accuracy)

    // Aggregate note results across all sessions
    const noteStats = new Map<number, { hits: number; misses: number }>()

    for (const session of sorted) {
      for (const [key, result] of session.noteResults) {
        if (result === 'pending') continue

        const midi = parseMidiFromKey(key)
        if (midi === null) continue

        const existing = noteStats.get(midi) ?? { hits: 0, misses: 0 }
        if (result === 'hit') {
          existing.hits++
        } else if (result === 'miss') {
          existing.misses++
        }
        noteStats.set(midi, existing)
      }
    }

    // Compute weak spots
    const weakSpots = this.computeWeakSpots(noteStats)

    // Statistics
    const totalPracticeMinutes = sorted.reduce((sum, s) => sum + s.durationMinutes, 0)
    const bestAccuracy = Math.max(...accuracyTrend)

    // Recent improvement: compare last RECENT_WINDOW sessions to the rest
    const recentImprovement = this.computeRecentImprovement(accuracyTrend)

    return {
      songId,
      weakSpots,
      accuracyTrend,
      totalPracticeMinutes: Math.round(totalPracticeMinutes * 10) / 10,
      sessionsCount: sorted.length,
      bestAccuracy,
      recentImprovement,
    }
  }

  /**
   * Compute the top weak spots from aggregated note statistics.
   */
  private computeWeakSpots(noteStats: Map<number, { hits: number; misses: number }>): WeakSpot[] {
    const candidates: WeakSpot[] = []

    for (const [midi, stats] of noteStats) {
      const total = stats.hits + stats.misses
      if (total < MIN_ATTEMPTS_FOR_ANALYSIS) continue

      const missRate = stats.misses / total
      candidates.push({
        midi,
        noteName: midiToNoteName(midi),
        missRate: Math.round(missRate * 1000) / 1000,
        totalAttempts: total,
      })
    }

    // Sort by miss rate descending, then by total attempts descending
    candidates.sort((a, b) => {
      if (Math.abs(a.missRate - b.missRate) > 0.001) return b.missRate - a.missRate
      return b.totalAttempts - a.totalAttempts
    })

    return candidates.slice(0, MAX_WEAK_SPOTS)
  }

  /**
   * Compute improvement: average of recent sessions minus average of older sessions.
   * A positive value means the player is improving.
   */
  private computeRecentImprovement(accuracyTrend: number[]): number {
    if (accuracyTrend.length < 2) return 0

    const recentCount = Math.min(RECENT_WINDOW, Math.floor(accuracyTrend.length / 2))
    const recentSlice = accuracyTrend.slice(-recentCount)
    const olderSlice = accuracyTrend.slice(0, -recentCount)

    if (olderSlice.length === 0) return 0

    const recentAvg = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
    const olderAvg = olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length

    return Math.round((recentAvg - olderAvg) * 100) / 100
  }

  private emptyInsight(songId: string): PracticeInsight {
    return {
      songId,
      weakSpots: [],
      accuracyTrend: [],
      totalPracticeMinutes: 0,
      sessionsCount: 0,
      bestAccuracy: 0,
      recentImprovement: 0,
    }
  }
}
