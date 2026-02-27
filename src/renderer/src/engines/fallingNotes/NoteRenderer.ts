/**
 * Phase 2: PixiJS sprite renderer for falling note visualization.
 * Manages a double-buffered sprite pool, per-frame viewport updates, and
 * practice mode visual feedback (hit flash, miss fade, combo text pop).
 */
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

/** Minimum note rectangle height (px) to show a label inside it. */
const MIN_HEIGHT_FOR_LABEL = 16;

/** Chromatic note names indexed by (midi % 12). */
const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** Convert a MIDI note number to a short display name (e.g. "C4", "F#5"). */
function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** Shared text style for note labels on falling note sprites. */
let _labelStyle: TextStyle | null = null;
function getLabelStyle(): TextStyle {
  if (!_labelStyle) {
    _labelStyle = new TextStyle({
      fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
      fontSize: 12,
      fontWeight: "bold",
      fill: 0xffffff,
    });
  }
  return _labelStyle;
}

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
  private noteTexture: Texture = Texture.EMPTY;

  /** Tracks in-flight rAF animation handles per sprite to cancel on recycle */
  private _animHandles = new Map<Sprite, number>();
  /** Tracks in-flight rAF handles for showCombo text animations (cancelled on destroy) */
  private _comboHandles = new Set<number>();

  // ── Note label pool (parallel to sprite pool) ──
  /** Text pool for reusable note labels */
  private _labelPool: Text[] = [];
  /** Maps each active sprite to its associated label Text object */
  private _spriteLabels = new Map<Sprite, Text>();
  /** Whether note labels on falling notes are enabled */
  public showNoteLabels = true;

  public activeNotes = new Set<number>();

  constructor(parentContainer: Container) {
    this.container = new Container();
    parentContainer.addChild(this.container);
  }

  /**
   * Initialize the renderer with canvas width and pre-fill the sprite pool.
   * Must be called once before any `update()` or `resize()` calls.
   * @param canvasWidth Canvas pixel width, used to compute key positions
   */
  init(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth);
    this.noteTexture = Texture.WHITE;

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(this.createSprite());
    }

    // Pre-fill label pool (smaller than sprite pool — not every note needs a label)
    const labelPoolSize = Math.min(256, INITIAL_POOL_SIZE);
    for (let i = 0; i < labelPoolSize; i++) {
      this._labelPool.push(this.createLabel());
    }
  }

  /**
   * Recompute key positions after a canvas resize.
   * @param canvasWidth New canvas pixel width
   */
  resize(canvasWidth: number): void {
    this.keyPositions = buildKeyPositions(canvasWidth);
  }

  /**
   * Main per-frame update. Positions and shows sprites for all notes
   * visible in the given viewport, and returns stale sprites to the pool.
   * Called ~60 times/sec by the ticker loop.
   * @param song Currently loaded parsed song
   * @param vp   Current viewport (position + dimensions)
   */
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

        // ── Note label management ──
        if (this.showNoteLabels && h >= MIN_HEIGHT_FOR_LABEL) {
          let label = this._spriteLabels.get(sprite);
          if (!label) {
            label = this.allocateLabel();
            this._spriteLabels.set(sprite, label);
          }
          label.text = midiToNoteName(note.midi);
          label.x = kp.x + kp.width / 2;
          label.y = rectY + Math.max(h, 2) / 2;
          label.visible = true;
        } else {
          // Hide label if note is too small or labels are disabled
          const existingLabel = this._spriteLabels.get(sprite);
          if (existingLabel) {
            this.releaseLabel(existingLabel);
            this._spriteLabels.delete(sprite);
          }
        }

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

  /**
   * Cancel all animations and release all sprites.
   * Call when the canvas is unmounted or a new song is loaded.
   */
  destroy(): void {
    // Cancel all in-flight animations
    for (const handle of this._animHandles.values()) {
      cancelAnimationFrame(handle);
    }
    this._animHandles.clear();
    for (const handle of this._comboHandles) {
      cancelAnimationFrame(handle);
    }
    this._comboHandles.clear();

    this.container.removeChildren();
    this.pool.length = 0;
    this.active.clear();
    this.nextActive.clear();
    this.activeNotes.clear();
    this.keyPositions.clear();

    // Clean up label pool
    this._labelPool.length = 0;
    this._spriteLabels.clear();
  }

  private createSprite(): Sprite {
    const s = new Sprite(this.noteTexture);
    s.visible = false;
    this.container.addChild(s);
    return s;
  }

  private createLabel(): Text {
    const t = new Text({ text: "", style: getLabelStyle() });
    t.anchor.set(0.5);
    t.visible = false;
    t.alpha = 0.85;
    this.container.addChild(t);
    return t;
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

  private allocateLabel(): Text {
    if (this._labelPool.length === 0) {
      const grow = Math.max(32, Math.floor(this._spriteLabels.size * 0.5));
      for (let i = 0; i < grow; i++) {
        this._labelPool.push(this.createLabel());
      }
    }
    return this._labelPool.pop()!;
  }

  private releaseLabel(label: Text): void {
    label.visible = false;
    this._labelPool.push(label);
  }

  private release(sprite: Sprite): void {
    // Cancel any in-flight animation before returning sprite to pool
    const handle = this._animHandles.get(sprite);
    if (handle !== undefined) {
      cancelAnimationFrame(handle);
      this._animHandles.delete(sprite);
    }
    sprite.alpha = 1;
    sprite.visible = false;
    this.pool.push(sprite);

    // Release the associated label if present
    const label = this._spriteLabels.get(sprite);
    if (label) {
      this.releaseLabel(label);
      this._spriteLabels.delete(sprite);
    }
  }

  // ── Practice mode visual feedback ──────────────────────────────────

  /**
   * Flash a bright hit effect on a note sprite.
   * Tint shifts to white and alpha pulses, then restores over ~200ms.
   * Animation is automatically cancelled if the sprite is recycled.
   */
  flashHit(sprite: Sprite): void {
    // Cancel any existing animation on this sprite
    const existing = this._animHandles.get(sprite);
    if (existing !== undefined) cancelAnimationFrame(existing);

    const originalTint = sprite.tint;
    const originalAlpha = sprite.alpha;
    const duration = 200; // ms
    let start = -1;

    const tick = (now: number): void => {
      // Sprite was recycled — stop animating
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);

      // Quick flash up then ease back
      const flash = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      sprite.tint = lerpColor(originalTint, 0xffffff, flash * 0.7);
      sprite.alpha = originalAlpha + (1 - originalAlpha) * flash * 0.5;

      if (t < 1) {
        this._animHandles.set(sprite, requestAnimationFrame(tick));
      } else {
        this._animHandles.delete(sprite);
        sprite.tint = originalTint;
        sprite.alpha = originalAlpha;
      }
    };
    this._animHandles.set(sprite, requestAnimationFrame(tick));
  }

  /**
   * Mark a note sprite as missed: fade to gray and reduce opacity.
   * Transition runs over ~150ms. Cancelled if sprite is recycled.
   */
  markMiss(sprite: Sprite): void {
    const existing = this._animHandles.get(sprite);
    if (existing !== undefined) cancelAnimationFrame(existing);

    const originalTint = sprite.tint;
    const originalAlpha = sprite.alpha;
    const duration = 150;
    let start = -1;

    const tick = (now: number): void => {
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);
      const ease = t * (2 - t); // ease-out quad

      sprite.tint = lerpColor(originalTint, 0x888888, ease);
      sprite.alpha = originalAlpha - (originalAlpha - 0.4) * ease;

      if (t < 1) {
        this._animHandles.set(sprite, requestAnimationFrame(tick));
      } else {
        this._animHandles.delete(sprite);
      }
    };
    this._animHandles.set(sprite, requestAnimationFrame(tick));
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
      // Animation was cancelled by destroy() — stop writing to removed label
      if (!this._comboHandles.has(handle)) return;

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
        this._comboHandles.delete(handle);
        const next = requestAnimationFrame(tick);
        this._comboHandles.add(next);
        handle = next;
      } else {
        this._comboHandles.delete(handle);
        this.container.removeChild(label);
        label.destroy();
      }
    };
    let handle = requestAnimationFrame(tick);
    this._comboHandles.add(handle);
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
