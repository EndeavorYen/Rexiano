import { describe, it, expect, beforeEach } from 'vitest'
import { FingeringEngine, type FingeringResult, type Finger } from './FingeringEngine'
import type { ParsedNote } from '../midi/types'

/** Helper to build a ParsedNote with only midi and time */
function note(midi: number, time: number, duration = 0.5): ParsedNote {
  return { midi, time, duration, velocity: 80, name: '' }
}

/** Helper to extract just finger numbers from results */
function fingers(results: FingeringResult[]): Finger[] {
  return results.map((r) => r.finger)
}

describe('FingeringEngine', () => {
  let engine: FingeringEngine

  beforeEach(() => {
    engine = new FingeringEngine()
  })

  // ── Scale Pattern Tests ────────────────────────────────────────

  describe('C major scale — right hand ascending', () => {
    it('assigns standard 1-2-3-1-2-3-4-5 pattern', () => {
      // C4 D4 E4 F4 G4 A4 B4 C5
      const notes = [60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => note(m, i * 0.5))
      const results = engine.computeFingering(notes, 'right')

      expect(results).toHaveLength(8)
      expect(fingers(results)).toEqual([1, 2, 3, 1, 2, 3, 4, 5])
      results.forEach((r) => expect(r.hand).toBe('right'))
    })
  })

  describe('C major scale — right hand descending', () => {
    it('assigns standard 5-4-3-2-1-3-2-1 pattern', () => {
      // C5 B4 A4 G4 F4 E4 D4 C4
      const notes = [72, 71, 69, 67, 65, 64, 62, 60].map((m, i) => note(m, i * 0.5))
      const results = engine.computeFingering(notes, 'right')

      expect(results).toHaveLength(8)
      expect(fingers(results)).toEqual([5, 4, 3, 2, 1, 3, 2, 1])
    })
  })

  describe('C major scale — left hand ascending', () => {
    it('assigns standard 5-4-3-2-1-3-2-1 pattern', () => {
      const notes = [48, 50, 52, 53, 55, 57, 59, 60].map((m, i) => note(m, i * 0.5))
      const results = engine.computeFingering(notes, 'left')

      expect(results).toHaveLength(8)
      expect(fingers(results)).toEqual([5, 4, 3, 2, 1, 3, 2, 1])
      results.forEach((r) => expect(r.hand).toBe('left'))
    })
  })

  describe('C major scale — left hand descending', () => {
    it('assigns standard 1-2-3-1-2-3-4-5 pattern', () => {
      const notes = [60, 59, 57, 55, 53, 52, 50, 48].map((m, i) => note(m, i * 0.5))
      const results = engine.computeFingering(notes, 'left')

      expect(results).toHaveLength(8)
      expect(fingers(results)).toEqual([1, 2, 3, 1, 2, 3, 4, 5])
    })
  })

  // ── Chord Fingering Tests ──────────────────────────────────────

  describe('C major triad — right hand', () => {
    it('assigns 1-3-5 for root position triad', () => {
      // C4-E4-G4 (semitones: 0-4-7)
      const results = engine.computeChordFingering([60, 64, 67], 'right')

      expect(results).toHaveLength(3)
      expect(fingers(results)).toEqual([1, 3, 5])
    })
  })

  describe('G major triad — right hand', () => {
    it('assigns 1-3-5 for G-B-D', () => {
      // G4-B4-D5 (midi 67-71-74)
      const results = engine.computeChordFingering([67, 71, 74], 'right')

      expect(results).toHaveLength(3)
      expect(fingers(results)).toEqual([1, 3, 5])
    })
  })

  describe('F major triad — right hand', () => {
    it('assigns 1-3-5 for F-A-C', () => {
      // F4-A4-C5 (midi 65-69-72)
      const results = engine.computeChordFingering([65, 69, 72], 'right')

      expect(results).toHaveLength(3)
      expect(fingers(results)).toEqual([1, 3, 5])
    })
  })

  describe('C major triad — left hand', () => {
    it('assigns 5-3-1 from bottom to top', () => {
      // C3-E3-G3 (midi 48-52-55)
      const results = engine.computeChordFingering([48, 52, 55], 'left')

      expect(results).toHaveLength(3)
      expect(fingers(results)).toEqual([5, 3, 1])
    })
  })

  // ── Octave Jump Tests ──────────────────────────────────────────

  describe('octave interval — right hand', () => {
    it('assigns 1-5 for octave', () => {
      const results = engine.computeChordFingering([60, 72], 'right')

      expect(results).toHaveLength(2)
      expect(fingers(results)).toEqual([1, 5])
    })
  })

  describe('octave interval — left hand', () => {
    it('assigns 5-1 for octave', () => {
      const results = engine.computeChordFingering([48, 60], 'left')

      expect(results).toHaveLength(2)
      expect(fingers(results)).toEqual([5, 1])
    })
  })

  // ── Third Interval Tests ───────────────────────────────────────

  describe('third interval — right hand', () => {
    it('assigns 1-3 for a third', () => {
      // C4-E4 (4 semitones)
      const results = engine.computeChordFingering([60, 64], 'right')

      expect(results).toHaveLength(2)
      expect(fingers(results)).toEqual([1, 3])
    })
  })

  describe('third interval — left hand', () => {
    it('assigns 3-1 for a third', () => {
      const results = engine.computeChordFingering([48, 52], 'left')

      expect(results).toHaveLength(2)
      expect(fingers(results)).toEqual([3, 1])
    })
  })

  // ── Large Leap Sequential Tests ────────────────────────────────

  describe('large leap sequence — right hand', () => {
    it('resets fingering on leaps beyond an octave', () => {
      // C4 → C6 (large leap up), then D6
      const notes = [note(60, 0), note(84, 0.5), note(86, 1.0)]
      const results = engine.computeFingering(notes, 'right')

      expect(results).toHaveLength(3)
      // After large leap, should restart from 1
      expect(results[1].finger).toBe(1)
    })
  })

  // ── Edge Cases ─────────────────────────────────────────────────

  describe('empty input', () => {
    it('returns empty array for no notes', () => {
      const results = engine.computeFingering([], 'right')
      expect(results).toHaveLength(0)
    })

    it('returns empty array for empty chord', () => {
      const results = engine.computeChordFingering([], 'right')
      expect(results).toHaveLength(0)
    })
  })

  describe('single note', () => {
    it('returns a valid finger assignment', () => {
      const results = engine.computeChordFingering([60], 'right')
      expect(results).toHaveLength(1)
      expect(results[0].midi).toBe(60)
      expect(results[0].finger).toBeGreaterThanOrEqual(1)
      expect(results[0].finger).toBeLessThanOrEqual(5)
    })
  })

  describe('4-note chord — right hand', () => {
    it('assigns 1-2-3-5', () => {
      // C-E-G-Bb (dominant 7th)
      const results = engine.computeChordFingering([60, 64, 67, 70], 'right')

      expect(results).toHaveLength(4)
      expect(fingers(results)).toEqual([1, 2, 3, 5])
    })
  })

  describe('4-note chord — left hand', () => {
    it('assigns 5-3-2-1', () => {
      const results = engine.computeChordFingering([48, 52, 55, 58], 'left')

      expect(results).toHaveLength(4)
      expect(fingers(results)).toEqual([5, 3, 2, 1])
    })
  })

  describe('stepwise short passage — right hand ascending', () => {
    it('assigns incrementing fingers for 3 notes', () => {
      const notes = [note(60, 0), note(62, 0.5), note(64, 1.0)]
      const results = engine.computeFingering(notes, 'right')

      expect(results).toHaveLength(3)
      // Should be ascending finger numbers
      expect(results[0].finger).toBe(1)
      expect(results[1].finger).toBe(2)
      expect(results[2].finger).toBe(3)
    })
  })

  describe('midi values are preserved', () => {
    it('result midi values match input', () => {
      const inputMidis = [60, 64, 67]
      const results = engine.computeChordFingering(inputMidis, 'right')

      expect(results.map((r) => r.midi)).toEqual([60, 64, 67])
    })
  })

  describe('unsorted chord input', () => {
    it('handles unsorted midi notes correctly', () => {
      // G4-C4-E4 (unsorted) should still produce valid fingering
      const results = engine.computeChordFingering([67, 60, 64], 'right')

      expect(results).toHaveLength(3)
      // Should be sorted in results: C4(1) E4(3) G4(5)
      expect(results[0].midi).toBe(60)
      expect(results[1].midi).toBe(64)
      expect(results[2].midi).toBe(67)
      expect(fingers(results)).toEqual([1, 3, 5])
    })
  })
})
