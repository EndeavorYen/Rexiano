import { Container, Sprite, Texture } from 'pixi.js'
import type { ParsedSong } from '@renderer/engines/midi/types'
import { buildKeyPositions, type KeyPosition } from './keyPositions'
import { getTrackColor } from './noteColors'
import {
  noteToScreenY,
  durationToHeight,
  getVisibleNotes,
  type Viewport,
} from './ViewportManager'

/** Unique key for a note within the song — avoids indexOf lookup */
function noteKey(trackIdx: number, midi: number, time: number): string {
  return `${trackIdx}:${midi}:${time}`
}

const INITIAL_POOL_SIZE = 512

export class NoteRenderer {
  private container: Container
  private pool: Sprite[] = []
  private active = new Map<string, Sprite>()
  private keyPositions = new Map<number, KeyPosition>()
  private noteTexture!: Texture

  /** Set of MIDI note numbers currently at the hit line (for keyboard highlight) */
  public activeNotes = new Set<number>()

  constructor(parentContainer: Container) {
    this.container = new Container()
    parentContainer.addChild(this.container)
  }

  /**
   * Initialize the sprite pool. Call once after the PixiJS Application is ready.
   * @param canvasWidth Width in pixels, used to pre-compute key positions.
   */
  init(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth)
    this.noteTexture = Texture.WHITE

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(this.createSprite())
    }
  }

  /** Rebuild key positions after canvas resize */
  resize(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth)
  }

  /**
   * Main update loop — call every frame from the PixiJS ticker.
   */
  update(song: ParsedSong, vp: Viewport): void {
    const nextActive = new Map<string, Sprite>()
    this.activeNotes.clear()

    // Hit detection window: notes within ±50ms of currentTime count as "active"
    const hitWindow = 0.05

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx]
      const color = getTrackColor(trackIdx)
      const visibleNotes = getVisibleNotes(track.notes, vp)

      for (const note of visibleNotes) {
        const key = noteKey(trackIdx, note.midi, note.time)
        const kp = this.keyPositions.get(note.midi)
        if (!kp) continue

        const screenY = noteToScreenY(note.time, vp)
        const h = durationToHeight(note.duration, vp.pps)
        // Note rect: top-left is (x, screenY - h) because y increases downward
        const rectY = screenY - h

        // Reuse existing sprite or take from pool
        let sprite = this.active.get(key)
        if (!sprite) {
          sprite = this.allocate()
          sprite.tint = color
        }

        sprite.x = kp.x
        sprite.y = rectY
        sprite.width = kp.width
        sprite.height = Math.max(h, 2) // minimum 2px for very short notes
        sprite.visible = true
        nextActive.set(key, sprite)

        // Check if note is at the hit line (for keyboard highlighting)
        if (note.time <= vp.currentTime + hitWindow &&
            note.time + note.duration >= vp.currentTime - hitWindow) {
          this.activeNotes.add(note.midi)
        }
      }
    }

    // Return sprites no longer in use to the pool
    for (const [key, sprite] of this.active) {
      if (!nextActive.has(key)) {
        this.release(sprite)
      }
    }

    this.active = nextActive
  }

  /** Clean up all resources */
  destroy(): void {
    this.container.removeChildren()
    this.pool.length = 0
    this.active.clear()
  }

  // --- Pool management ---

  private createSprite(): Sprite {
    const s = new Sprite(this.noteTexture)
    s.visible = false
    this.container.addChild(s)
    return s
  }

  private allocate(): Sprite {
    if (this.pool.length === 0) {
      // Grow pool by 50%
      const grow = Math.max(64, Math.floor(this.active.size * 0.5))
      for (let i = 0; i < grow; i++) {
        this.pool.push(this.createSprite())
      }
    }
    return this.pool.pop()!
  }

  private release(sprite: Sprite): void {
    sprite.visible = false
    this.pool.push(sprite)
  }
}
