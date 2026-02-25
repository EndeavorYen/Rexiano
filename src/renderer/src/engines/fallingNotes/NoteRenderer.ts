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

function noteKey(trackIdx: number, midi: number, time: number): string {
  // Convert time to microseconds integer to avoid float-to-string instability
  return `${trackIdx}:${midi}:${Math.round(time * 1e6)}`
}

const INITIAL_POOL_SIZE = 512

export class NoteRenderer {
  private container: Container
  private pool: Sprite[] = []
  private active = new Map<string, Sprite>()
  private keyPositions = new Map<number, KeyPosition>()
  private noteTexture!: Texture

  public activeNotes = new Set<number>()

  constructor(parentContainer: Container) {
    this.container = new Container()
    parentContainer.addChild(this.container)
  }

  init(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth)
    this.noteTexture = Texture.WHITE

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(this.createSprite())
    }
  }

  resize(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth)
  }

  update(song: ParsedSong, vp: Viewport): void {
    const nextActive = new Map<string, Sprite>()
    this.activeNotes.clear()

    const hitWindow = 0.05

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx]
      const color = getTrackColor(trackIdx)
      const visibleNotes = getVisibleNotes(track.notes, vp, hitWindow)

      for (const note of visibleNotes) {
        const key = noteKey(trackIdx, note.midi, note.time)
        const kp = this.keyPositions.get(note.midi)
        if (!kp) continue

        const screenY = noteToScreenY(note.time, vp)
        const h = durationToHeight(note.duration, vp.pps)
        const rectY = screenY - h

        let sprite = this.active.get(key)
        if (!sprite) {
          sprite = this.allocate()
          sprite.tint = color
        }

        sprite.x = kp.x
        sprite.y = rectY
        sprite.width = kp.width
        sprite.height = Math.max(h, 2)
        sprite.visible = true
        nextActive.set(key, sprite)

        if (note.time <= vp.currentTime + hitWindow &&
            note.time + note.duration >= vp.currentTime - hitWindow) {
          this.activeNotes.add(note.midi)
        }
      }
    }

    for (const [key, sprite] of this.active) {
      if (!nextActive.has(key)) {
        this.release(sprite)
      }
    }

    this.active = nextActive
  }

  destroy(): void {
    this.container.removeChildren()
    this.pool.length = 0
    this.active.clear()
    this.keyPositions.clear()
  }

  private createSprite(): Sprite {
    const s = new Sprite(this.noteTexture)
    s.visible = false
    this.container.addChild(s)
    return s
  }

  private allocate(): Sprite {
    if (this.pool.length === 0) {
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
