import { Container, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type { ParsedSong, ParsedNote } from "@renderer/engines/midi/types";
import { buildKeyPositions, type KeyPosition } from "./keyPositions";
import { getTrackColor } from "./noteColors";
import {
  noteToScreenY,
  durationToHeight,
  getVisibleNotes,
  type Viewport,
} from "./ViewportManager";

function noteKey(trackIdx: number, midi: number, time: number): string {
  // Convert time to microseconds integer to avoid float-to-string instability
  return `${trackIdx}:${midi}:${Math.round(time * 1e6)}`;
}

const INITIAL_POOL_SIZE = 512;

/** Linearly interpolate between two 0xRRGGBB colors by factor t ∈ [0,1]. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | blue;
}

export class NoteRenderer {
  private container: Container;
  private pool: Sprite[] = [];
  private active = new Map<string, Sprite>();
  private nextActive = new Map<string, Sprite>();
  private visibleBuf: ParsedNote[] = [];
  private keyPositions = new Map<number, KeyPosition>();
  private noteTexture!: Texture;

  public activeNotes = new Set<number>();

  constructor(parentContainer: Container) {
    this.container = new Container();
    parentContainer.addChild(this.container);
  }

  init(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth);
    this.noteTexture = Texture.WHITE;

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(this.createSprite());
    }
  }

  resize(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth);
  }

  update(song: ParsedSong, vp: Viewport): void {
    // Double-buffer swap: reuse nextActive map instead of allocating each frame
    const nextActive = this.nextActive;
    nextActive.clear();
    this.activeNotes.clear();

    const hitWindow = 0.05;

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx];
      const color = getTrackColor(trackIdx);
      const visibleNotes = getVisibleNotes(
        track.notes,
        vp,
        hitWindow,
        this.visibleBuf,
      );

      for (const note of visibleNotes) {
        const key = noteKey(trackIdx, note.midi, note.time);
        const kp = this.keyPositions.get(note.midi);
        if (!kp) continue;

        const screenY = noteToScreenY(note.time, vp);
        const h = durationToHeight(note.duration, vp.pps);
        const rectY = screenY - h;

        // Check both active (from last frame) and nextActive (from this frame, for duplicate keys)
        let sprite = this.active.get(key) ?? nextActive.get(key);
        if (!sprite) {
          sprite = this.allocate();
          sprite.tint = color;
        }

        sprite.x = kp.x;
        sprite.y = rectY;
        sprite.width = kp.width;
        sprite.height = Math.max(h, 2);
        sprite.visible = true;
        nextActive.set(key, sprite);

        if (
          note.time <= vp.currentTime + hitWindow &&
          note.time + note.duration >= vp.currentTime - hitWindow
        ) {
          this.activeNotes.add(note.midi);
        }
      }
    }

    for (const [key, sprite] of this.active) {
      if (!nextActive.has(key)) {
        this.release(sprite);
      }
    }

    // Swap buffers: active ↔ nextActive
    this.nextActive = this.active;
    this.active = nextActive;
  }

  destroy(): void {
    this.container.removeChildren();
    this.pool.length = 0;
    this.active.clear();
    this.nextActive.clear();
    this.keyPositions.clear();
  }

  private createSprite(): Sprite {
    const s = new Sprite(this.noteTexture);
    s.visible = false;
    this.container.addChild(s);
    return s;
  }

  private allocate(): Sprite {
    if (this.pool.length === 0) {
      const grow = Math.max(64, Math.floor(this.active.size * 0.5));
      for (let i = 0; i < grow; i++) {
        this.pool.push(this.createSprite());
      }
    }
    return this.pool.pop()!;
  }

  private release(sprite: Sprite): void {
    sprite.visible = false;
    this.pool.push(sprite);
  }

  // ── Practice mode visual feedback ──────────────────────────────────

  /**
   * Flash a bright hit effect on a note sprite.
   * Tint shifts to white and alpha pulses, then restores over ~200ms.
   */
  flashHit(sprite: Sprite): void {
    const originalTint = sprite.tint;
    const originalAlpha = sprite.alpha;
    const duration = 200; // ms
    let start = -1;

    const tick = (now: number): void => {
      if (start < 0) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);

      // Quick flash up then ease back
      const flash = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      sprite.tint = lerpColor(originalTint, 0xffffff, flash * 0.7);
      sprite.alpha = originalAlpha + (1 - originalAlpha) * flash * 0.5;

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        sprite.tint = originalTint;
        sprite.alpha = originalAlpha;
      }
    };
    requestAnimationFrame(tick);
  }

  /**
   * Mark a note sprite as missed: fade to gray and reduce opacity.
   * Transition runs over ~150ms.
   */
  markMiss(sprite: Sprite): void {
    const originalTint = sprite.tint;
    const originalAlpha = sprite.alpha;
    const duration = 150;
    let start = -1;

    const tick = (now: number): void => {
      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);
      const ease = t * (2 - t); // ease-out quad

      sprite.tint = lerpColor(originalTint, 0x888888, ease);
      sprite.alpha = originalAlpha - (originalAlpha - 0.4) * ease;

      if (t < 1) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }

  /**
   * Show a floating combo counter at the given canvas position.
   * The number pops in with scale, drifts upward, then fades out.
   */
  showCombo(count: number, x: number, y: number): void {
    const style = new TextStyle({
      fontFamily: "Nunito Variable, Nunito, sans-serif",
      fontSize: 28,
      fontWeight: "800",
      fill: 0xffffff,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 1,
        alpha: 0.35,
      },
    });
    const label = new Text({ text: `${count}x`, style });
    label.anchor.set(0.5);
    label.x = x;
    label.y = y;
    label.alpha = 0;
    label.scale.set(0.3);
    this.container.addChild(label);

    const duration = 600;
    let start = -1;

    const tick = (now: number): void => {
      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);

      // Phase 1 (0–0.2): pop in
      // Phase 2 (0.2–0.7): hold + drift
      // Phase 3 (0.7–1.0): fade out
      if (t < 0.2) {
        const p = t / 0.2;
        const overshoot = 1 + 0.2 * Math.sin(p * Math.PI);
        label.scale.set(overshoot);
        label.alpha = p;
      } else if (t < 0.7) {
        label.scale.set(1);
        label.alpha = 1;
      } else {
        const p = (t - 0.7) / 0.3;
        label.alpha = 1 - p;
        label.scale.set(1 - p * 0.3);
      }

      label.y = y - 40 * t;

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.container.removeChild(label);
        label.destroy();
      }
    };
    requestAnimationFrame(tick);
  }

  /**
   * Look up the currently active sprite for a specific note.
   * Returns null if the note is not currently visible on screen.
   */
  findSpriteForNote(
    trackIdx: number,
    midi: number,
    time: number,
  ): Sprite | null {
    const key = noteKey(trackIdx, midi, time);
    return this.active.get(key) ?? null;
  }
}
