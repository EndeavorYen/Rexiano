import { describe, test, expect, beforeEach } from 'vitest'
import { usePracticeStore } from '@renderer/stores/usePracticeStore'

describe('TrackSelector logic', () => {
  beforeEach(() => {
    usePracticeStore.setState({
      activeTracks: new Set(),
    })
  })

  test('activeTracks starts empty', () => {
    expect(usePracticeStore.getState().activeTracks.size).toBe(0)
  })

  test('setActiveTracks replaces the entire set', () => {
    usePracticeStore.getState().setActiveTracks(new Set([0, 1, 2]))
    expect(usePracticeStore.getState().activeTracks).toEqual(new Set([0, 1, 2]))
  })

  test('toggling a track on and off works correctly', () => {
    // Simulate the toggle logic from TrackSelector component
    const toggle = (index: number): void => {
      const current = usePracticeStore.getState().activeTracks
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      usePracticeStore.getState().setActiveTracks(next)
    }

    toggle(0)
    expect(usePracticeStore.getState().activeTracks.has(0)).toBe(true)

    toggle(1)
    expect(usePracticeStore.getState().activeTracks).toEqual(new Set([0, 1]))

    toggle(0)
    expect(usePracticeStore.getState().activeTracks).toEqual(new Set([1]))
  })

  test('setActiveTracks with empty set clears all', () => {
    usePracticeStore.getState().setActiveTracks(new Set([0, 1]))
    usePracticeStore.getState().setActiveTracks(new Set())
    expect(usePracticeStore.getState().activeTracks.size).toBe(0)
  })
})
