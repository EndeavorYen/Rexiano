import { describe, test, expect, beforeEach } from 'vitest'
import { usePracticeStore } from './usePracticeStore'

describe('usePracticeStore', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      mode: 'watch',
      speed: 1.0,
      loopRange: null,
      activeTracks: new Set(),
      score: { totalNotes: 0, hitNotes: 0, missedNotes: 0, accuracy: 0, currentStreak: 0, bestStreak: 0 },
      noteResults: new Map(),
    })
  })

  // ─── Initial state ────────────────────────────────────
  test('has correct initial state', () => {
    const s = usePracticeStore.getState()
    expect(s.mode).toBe('watch')
    expect(s.speed).toBe(1.0)
    expect(s.loopRange).toBeNull()
    expect(s.activeTracks.size).toBe(0)
    expect(s.score.totalNotes).toBe(0)
    expect(s.score.accuracy).toBe(0)
    expect(s.noteResults.size).toBe(0)
  })

  // ─── setMode() ────────────────────────────────────────
  test('setMode() changes mode and resets score', () => {
    // Accumulate some score first
    usePracticeStore.getState().recordHit('n1')
    expect(usePracticeStore.getState().score.totalNotes).toBe(1)

    usePracticeStore.getState().setMode('wait')
    const s = usePracticeStore.getState()
    expect(s.mode).toBe('wait')
    expect(s.score.totalNotes).toBe(0)
    expect(s.noteResults.size).toBe(0)
  })

  test('setMode() can set all three modes', () => {
    usePracticeStore.getState().setMode('free')
    expect(usePracticeStore.getState().mode).toBe('free')

    usePracticeStore.getState().setMode('watch')
    expect(usePracticeStore.getState().mode).toBe('watch')

    usePracticeStore.getState().setMode('wait')
    expect(usePracticeStore.getState().mode).toBe('wait')
  })

  // ─── setSpeed() ───────────────────────────────────────
  test('setSpeed() updates speed within bounds', () => {
    usePracticeStore.getState().setSpeed(0.5)
    expect(usePracticeStore.getState().speed).toBe(0.5)

    usePracticeStore.getState().setSpeed(1.5)
    expect(usePracticeStore.getState().speed).toBe(1.5)
  })

  test('setSpeed() clamps to minimum 0.25', () => {
    usePracticeStore.getState().setSpeed(0.1)
    expect(usePracticeStore.getState().speed).toBe(0.25)

    usePracticeStore.getState().setSpeed(-1)
    expect(usePracticeStore.getState().speed).toBe(0.25)
  })

  test('setSpeed() clamps to maximum 2.0', () => {
    usePracticeStore.getState().setSpeed(5.0)
    expect(usePracticeStore.getState().speed).toBe(2.0)
  })

  // ─── setLoopRange() ───────────────────────────────────
  test('setLoopRange() sets and clears loop', () => {
    usePracticeStore.getState().setLoopRange([10, 20])
    expect(usePracticeStore.getState().loopRange).toEqual([10, 20])

    usePracticeStore.getState().setLoopRange(null)
    expect(usePracticeStore.getState().loopRange).toBeNull()
  })

  // ─── setActiveTracks() ────────────────────────────────
  test('setActiveTracks() updates the active track set', () => {
    usePracticeStore.getState().setActiveTracks(new Set([0, 2]))
    expect(usePracticeStore.getState().activeTracks).toEqual(new Set([0, 2]))
  })

  // ─── recordHit() ──────────────────────────────────────
  test('recordHit() increments hit count and accuracy', () => {
    usePracticeStore.getState().recordHit('note-0')
    const s = usePracticeStore.getState()
    expect(s.score.totalNotes).toBe(1)
    expect(s.score.hitNotes).toBe(1)
    expect(s.score.missedNotes).toBe(0)
    expect(s.score.accuracy).toBe(100)
    expect(s.score.currentStreak).toBe(1)
    expect(s.noteResults.get('note-0')).toBe('hit')
  })

  test('recordHit() builds combo streak', () => {
    usePracticeStore.getState().recordHit('n1')
    usePracticeStore.getState().recordHit('n2')
    usePracticeStore.getState().recordHit('n3')
    const s = usePracticeStore.getState()
    expect(s.score.currentStreak).toBe(3)
    expect(s.score.bestStreak).toBe(3)
  })

  // ─── recordMiss() ─────────────────────────────────────
  test('recordMiss() increments miss count and resets streak', () => {
    usePracticeStore.getState().recordHit('n1')
    usePracticeStore.getState().recordHit('n2')
    usePracticeStore.getState().recordMiss('n3')
    const s = usePracticeStore.getState()
    expect(s.score.totalNotes).toBe(3)
    expect(s.score.hitNotes).toBe(2)
    expect(s.score.missedNotes).toBe(1)
    expect(s.score.currentStreak).toBe(0)
    expect(s.score.bestStreak).toBe(2)
    expect(s.noteResults.get('n3')).toBe('miss')
  })

  test('recordMiss() computes accuracy correctly', () => {
    usePracticeStore.getState().recordHit('n1')
    usePracticeStore.getState().recordMiss('n2')
    // 1 hit / 2 total = 50%
    expect(usePracticeStore.getState().score.accuracy).toBe(50)
  })

  // ─── bestStreak preservation ──────────────────────────
  test('bestStreak is preserved across miss events', () => {
    usePracticeStore.getState().recordHit('n1')
    usePracticeStore.getState().recordHit('n2')
    usePracticeStore.getState().recordHit('n3')
    usePracticeStore.getState().recordMiss('n4')
    usePracticeStore.getState().recordHit('n5')
    const s = usePracticeStore.getState()
    expect(s.score.currentStreak).toBe(1)
    expect(s.score.bestStreak).toBe(3)
  })

  // ─── resetScore() ─────────────────────────────────────
  test('resetScore() zeroes all score fields and clears noteResults', () => {
    usePracticeStore.getState().recordHit('n1')
    usePracticeStore.getState().recordHit('n2')
    usePracticeStore.getState().recordMiss('n3')

    usePracticeStore.getState().resetScore()
    const s = usePracticeStore.getState()
    expect(s.score.totalNotes).toBe(0)
    expect(s.score.hitNotes).toBe(0)
    expect(s.score.missedNotes).toBe(0)
    expect(s.score.accuracy).toBe(0)
    expect(s.score.currentStreak).toBe(0)
    expect(s.score.bestStreak).toBe(0)
    expect(s.noteResults.size).toBe(0)
  })

  // ─── Edge cases ───────────────────────────────────────
  test('accuracy is 0 when no notes have been recorded', () => {
    expect(usePracticeStore.getState().score.accuracy).toBe(0)
  })

  test('accuracy after all misses is 0', () => {
    usePracticeStore.getState().recordMiss('n1')
    usePracticeStore.getState().recordMiss('n2')
    expect(usePracticeStore.getState().score.accuracy).toBe(0)
  })
})
