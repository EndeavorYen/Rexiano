import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock pixi.js before importing NoteRenderer
vi.mock('pixi.js', () => {
  class MockSprite {
    x = 0
    y = 0
    width = 0
    height = 0
    visible = false
    tint = 0xffffff
    constructor() {}
  }
  class MockContainer {
    children: unknown[] = []
    addChild(child: unknown) { this.children.push(child) }
    removeChildren() { this.children.length = 0 }
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Texture: { WHITE: {} },
  }
})

import { NoteRenderer } from './NoteRenderer'
import { Container } from 'pixi.js'
import type { ParsedSong } from '@renderer/engines/midi/types'
import type { Viewport } from './ViewportManager'

function makeSong(tracks: { notes: { midi: number; time: number; duration: number }[] }[]): ParsedSong {
  return {
    fileName: 'test.mid',
    duration: 30,
    noteCount: tracks.reduce((sum, t) => sum + t.notes.length, 0),
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tracks: tracks.map((t, i) => ({
      name: `Track ${i}`,
      instrument: 'Piano',
      channel: i,
      notes: t.notes.map(n => ({
        midi: n.midi,
        name: 'C4',
        time: n.time,
        duration: n.duration,
        velocity: 80,
      })),
    })),
  }
}

function makeViewport(overrides: Partial<Viewport> = {}): Viewport {
  return { width: 1040, height: 600, pps: 200, currentTime: 0, ...overrides }
}

describe('NoteRenderer', () => {
  let renderer: NoteRenderer
  let parent: Container

  beforeEach(() => {
    parent = new Container()
    renderer = new NoteRenderer(parent)
    renderer.init(1040) // 1040 / 52 white keys = 20px each
  })

  test('initializes sprite pool', () => {
    // After init, the renderer should be ready (no errors)
    expect(renderer).toBeDefined()
    expect(renderer.activeNotes.size).toBe(0)
  })

  test('detects active notes at the hit line', () => {
    // Note at t=5, duration=1 → plays from 5 to 6
    // currentTime=5.5 → note is at the hit line
    const song = makeSong([{ notes: [{ midi: 60, time: 5, duration: 1 }] }])
    const vp = makeViewport({ currentTime: 5.5 })

    renderer.update(song, vp)

    expect(renderer.activeNotes.has(60)).toBe(true)
  })

  test('does not mark notes far from hit line as active', () => {
    // Note at t=10, duration=1 → plays from 10 to 11
    // currentTime=5 → note is still far above
    const song = makeSong([{ notes: [{ midi: 60, time: 10, duration: 1 }] }])
    const vp = makeViewport({ currentTime: 5 })

    renderer.update(song, vp)

    expect(renderer.activeNotes.has(60)).toBe(false)
  })

  test('clears active notes each frame', () => {
    const song = makeSong([{ notes: [{ midi: 60, time: 5, duration: 0.5 }] }])

    // Frame 1: note is active
    renderer.update(song, makeViewport({ currentTime: 5.2 }))
    expect(renderer.activeNotes.has(60)).toBe(true)

    // Frame 2: note has passed
    renderer.update(song, makeViewport({ currentTime: 6.0 }))
    expect(renderer.activeNotes.has(60)).toBe(false)
  })

  test('handles multiple tracks with different active notes', () => {
    const song = makeSong([
      { notes: [{ midi: 60, time: 5, duration: 1 }] },  // Track 0
      { notes: [{ midi: 72, time: 5, duration: 1 }] },  // Track 1
    ])
    const vp = makeViewport({ currentTime: 5.5 })

    renderer.update(song, vp)

    expect(renderer.activeNotes.has(60)).toBe(true)
    expect(renderer.activeNotes.has(72)).toBe(true)
  })

  test('handles empty song with no tracks', () => {
    const song = makeSong([])
    const vp = makeViewport({ currentTime: 0 })

    renderer.update(song, vp)

    expect(renderer.activeNotes.size).toBe(0)
  })

  test('handles track with no notes', () => {
    const song = makeSong([{ notes: [] }])
    const vp = makeViewport({ currentTime: 0 })

    renderer.update(song, vp)

    expect(renderer.activeNotes.size).toBe(0)
  })

  test('destroy cleans up resources', () => {
    renderer.destroy()
    expect(renderer.activeNotes.size).toBe(0)
  })

  test('resize updates key positions without error', () => {
    expect(() => renderer.resize(800)).not.toThrow()
  })
})
