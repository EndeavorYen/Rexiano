/**
 * Phase 2: PixiJS sprite renderer for falling note visualization.
 * Manages a double-buffered sprite pool, per-frame viewport updates, and
 * practice mode visual feedback (hit flash, miss fade, combo text pop).
 */
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import type {
  ParsedSong,
  ParsedNote,
  TempoEvent,
  TimeSignatureEvent,
} from "@renderer/engines/midi/types";
import { buildKeyPositions, type KeyPosition } from "./keyPositions";
import { getTrackColor, getHitLineColor } from "./noteColors";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { hexToPixi } from "@renderer/themes/tokens";
import {
  noteToScreenY,
  durationToHeight,
  getVisibleNotes,
  getVisibleTimeRange,
  type Viewport,
} from "./ViewportManager";
import {
  FingeringEngine,
  type Finger,
} from "@renderer/engines/practice/FingeringEngine";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";

function noteKey(trackIdx: number, midi: number, time: number): string {
  // Convert time to microseconds integer to avoid float-to-string instability
  return `${trackIdx}:${midi}:${Math.round(time * 1e6)}`;
}

const INITIAL_POOL_SIZE = 512;

/** Minimum note rectangle height (px) to show a label inside it. */
const MIN_HEIGHT_FOR_LABEL = 16;

/** Minimum note height (px) at which we show the fingering label */
const MIN_HEIGHT_FOR_FINGERING = 14;

/** Circled digit characters for finger numbers 1-5 */
const CIRCLED_DIGITS: Record<Finger, string> = {
  1: "\u2460",
  2: "\u2461",
  3: "\u2462",
  4: "\u2463",
  5: "\u2464",
};

/** Chromatic note names indexed by (midi % 12) — sharps variant. */
const NOTE_NAMES_SHARP = [
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
] as const;

/** Chromatic note names indexed by (midi % 12) — flats variant. */
const NOTE_NAMES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

/** Convert a MIDI note number to a short display name (e.g. "C4", "F#5").
 *  Uses flats when keySig < 0. */
function midiToNoteName(midi: number, keySig: number): string {
  const names = keySig < 0 ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const name = names[midi % 12];
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

  /** Cached canvas width for responsive positioning (updated on init/resize) */
  private _canvasWidth = 800;

  /** Cached PixiJS-format theme colors to avoid hexToPixi calls per animation frame */
  private _cachedHitGlow = 0xffffff;
  private _cachedMissGray = 0x888888;
  private _cachedComboText = 0xffffff;
  private _cachedGridLine = 0x444444;
  /** Unsubscribe handle for theme store subscription */
  private _themeUnsub: (() => void) | null = null;

  public activeNotes = new Set<number>();

  /** Key signature (number of sharps/flats) used for note label display.
   *  Positive = sharps, negative = flats. Set from App.tsx. */
  public keySig = 0;

  // ── Beat grid and hit line (R2-006: cached with dirty flag) ──────
  private _gridGraphics: Graphics;
  private _hitLineGraphics: Graphics;
  /** R2-006: Last viewport state used to draw grid -- skip redraw if unchanged */
  private _lastGridVpKey = "";
  /** Last viewport width+height used for hit line — skip redraw if unchanged */
  private _lastHitLineKey = "";

  // ── Fingering overlay ──────────────────────────────────────────
  private fingeringEngine = new FingeringEngine();
  /** Pool of reusable Text objects for fingering labels */
  private fingeringLabelPool: Text[] = [];
  /** Currently visible fingering labels (key → Text) */
  private activeFingeringLabels = new Map<string, Text>();
  private nextFingeringLabels = new Map<string, Text>();
  /** Cached fingering results per song, keyed by "trackIdx" */
  private fingeringCache = new Map<string, Map<number, Finger>>();
  /** ID of the last song we computed fingering for */
  private lastSongFileName = "";

  constructor(parentContainer: Container) {
    // Grid lines go behind notes
    this._gridGraphics = new Graphics();
    parentContainer.addChild(this._gridGraphics);

    this.container = new Container();
    parentContainer.addChild(this.container);

    // Hit line goes on top of notes
    this._hitLineGraphics = new Graphics();
    parentContainer.addChild(this._hitLineGraphics);
  }

  /**
   * Initialize the renderer with canvas width and pre-fill the sprite pool.
   * Must be called once before any `update()` or `resize()` calls.
   * @param canvasWidth Canvas pixel width, used to compute key positions
   */
  init(canvasWidth: number): void {
    this._canvasWidth = canvasWidth;
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

    // Cache theme colors and subscribe for theme changes
    this._updateCachedColors();
    this._themeUnsub = useThemeStore.subscribe(() =>
      this._updateCachedColors(),
    );
  }

  /** Refresh cached PixiJS color values from the current theme. */
  private _updateCachedColors(): void {
    const colors = useThemeStore.getState().theme.colors;
    this._cachedHitGlow = hexToPixi(colors.hitGlow);
    this._cachedMissGray = hexToPixi(colors.missGray);
    this._cachedComboText = hexToPixi(colors.comboText);
    this._cachedGridLine = hexToPixi(colors.gridLine);
    // Invalidate dirty flags so hit line and combo style pick up new colors
    this._lastHitLineKey = "";
    this._comboStyle = null;
  }

  /**
   * Recompute key positions after a canvas resize.
   * @param canvasWidth New canvas pixel width
   */
  resize(canvasWidth: number): void {
    this._canvasWidth = canvasWidth;
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
    const showFingering = useSettingsStore.getState().showFingering;
    const maxVisibleLabels =
      vp.height < 200 ? 14 : vp.height < 280 ? 22 : vp.height < 360 ? 30 : 42;
    let shownLabelCount = 0;

    // Recompute fingering cache when song changes
    if (showFingering && song.fileName !== this.lastSongFileName) {
      this.computeFingeringForSong(song);
      this.lastSongFileName = song.fileName;
    }

    // Double-buffer for fingering labels
    const nextFLabels = this.nextFingeringLabels;
    nextFLabels.clear();

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
        if (
          this.showNoteLabels &&
          h >= MIN_HEIGHT_FOR_LABEL &&
          shownLabelCount < maxVisibleLabels
        ) {
          let label = this._spriteLabels.get(sprite);
          if (!label) {
            label = this.allocateLabel();
            this._spriteLabels.set(sprite, label);
          }
          label.text = midiToNoteName(note.midi, this.keySig);
          label.x = kp.x + kp.width / 2;
          label.y = rectY + Math.max(h, 2) / 2;
          label.visible = true;
          shownLabelCount += 1;
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

        // ── Fingering label overlay ──────────────────────────────
        if (showFingering && h >= MIN_HEIGHT_FOR_FINGERING) {
          const finger = this.getFingerForNote(trackIdx, note);
          if (finger) {
            let label =
              this.activeFingeringLabels.get(key) ?? nextFLabels.get(key);
            if (!label) {
              label = this.allocateFingeringLabel();
            }
            label.text = CIRCLED_DIGITS[finger];
            label.x = kp.x + kp.width / 2;
            label.y = rectY + Math.min(h, 20) / 2 + 1;
            label.visible = true;
            nextFLabels.set(key, label);
          }
        }
      }
    }

    for (const [key, sprite] of this.active) {
      if (!nextActive.has(key)) {
        this.release(sprite);
      }
    }

    // Release unused fingering labels
    for (const [key, label] of this.activeFingeringLabels) {
      if (!nextFLabels.has(key)) {
        this.releaseFingeringLabel(label);
      }
    }

    // NOTE: When showFingering is false, nextFLabels is empty, so the loop
    // above already releases all labels. No second release needed.

    // Swap buffers: active ↔ nextActive
    this.nextActive = this.active;
    this.active = nextActive;

    // Swap fingering label buffers
    this.nextFingeringLabels = this.activeFingeringLabels;
    this.activeFingeringLabels = nextFLabels;

    // Draw beat grid lines and hit line
    this._drawBeatGrid(song, vp);
    this._drawHitLine(vp);
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

    this._gridGraphics.clear();
    this._hitLineGraphics.clear();
    this.container.removeChildren();
    this.pool.length = 0;
    this.active.clear();
    this.nextActive.clear();
    this.activeNotes.clear();
    this.keyPositions.clear();

    // Clean up label pool
    this._labelPool.length = 0;
    this._spriteLabels.clear();

    // Unsubscribe from theme store
    this._themeUnsub?.();
    this._themeUnsub = null;

    // Clean up combo pool
    this._comboPool.length = 0;
    this._comboStyle = null;

    // Clean up fingering overlay
    this.fingeringLabelPool.length = 0;
    this.activeFingeringLabels.clear();
    this.nextFingeringLabels.clear();
    this.fingeringCache.clear();
    this.lastSongFileName = "";
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
    sprite.tint = 0xffffff; // Reset tint to prevent color leak into pool
    sprite.visible = false;
    this.pool.push(sprite);

    // Release the associated label if present
    const label = this._spriteLabels.get(sprite);
    if (label) {
      this.releaseLabel(label);
      this._spriteLabels.delete(sprite);
    }
  }

  // ── Fingering label pool ──────────────────────────────────────────

  /** Lazily created TextStyle for fingering labels */
  private _fingeringLabelStyle: TextStyle | null = null;
  private getFingeringLabelStyle(): TextStyle {
    if (!this._fingeringLabelStyle) {
      this._fingeringLabelStyle = new TextStyle({
        fontFamily: "Nunito Variable, Nunito, sans-serif",
        fontSize: 12,
        fontWeight: "700",
        fill: 0xffffff,
        align: "center",
      });
    }
    return this._fingeringLabelStyle;
  }

  private createFingeringLabel(): Text {
    const label = new Text({ text: "", style: this.getFingeringLabelStyle() });
    label.anchor.set(0.5);
    label.visible = false;
    this.container.addChild(label);
    return label;
  }

  private allocateFingeringLabel(): Text {
    if (this.fingeringLabelPool.length === 0) {
      const grow = 32;
      for (let i = 0; i < grow; i++) {
        this.fingeringLabelPool.push(this.createFingeringLabel());
      }
    }
    return this.fingeringLabelPool.pop()!;
  }

  private releaseFingeringLabel(label: Text): void {
    label.visible = false;
    this.fingeringLabelPool.push(label);
  }

  /**
   * Pre-compute fingering for all tracks in a song.
   */
  private computeFingeringForSong(song: ParsedSong): void {
    this.fingeringCache.clear();

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx];
      if (track.notes.length === 0) continue;

      // Heuristic: tracks with mostly lower notes (avg midi < 60) are left hand
      const avgMidi =
        track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
      const hand = avgMidi < 60 ? "left" : "right";

      const results = this.fingeringEngine.computeFingering(track.notes, hand);
      const trackCache = new Map<number, Finger>();

      for (const result of results) {
        trackCache.set(result.midi, result.finger);
      }

      this.fingeringCache.set(String(trackIdx), trackCache);
    }
  }

  /** Look up the cached finger for a specific note */
  private getFingerForNote(trackIdx: number, note: ParsedNote): Finger | null {
    const trackCache = this.fingeringCache.get(String(trackIdx));
    if (!trackCache) return null;
    return trackCache.get(note.midi) ?? null;
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
    const hitGlow = this._cachedHitGlow;
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
      sprite.tint = lerpColor(originalTint, hitGlow, flash * 0.7);
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
    const missGray = this._cachedMissGray;
    const duration = 150;
    let start = -1;

    const tick = (now: number): void => {
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);
      const ease = t * (2 - t); // ease-out quad

      sprite.tint = lerpColor(originalTint, missGray, ease);
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
  showCombo(count: number, x?: number, y?: number): void {
    const cx = x ?? this._canvasWidth / 2;
    const cy = y ?? 200;
    const label = this.allocateComboLabel(`${count}x`);
    label.x = cx;
    label.y = cy;
    label.alpha = 0;
    label.scale.set(0.3);
    label.visible = true;
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

      label.y = cy - 40 * t;

      if (t < 1) {
        this._comboHandles.delete(handle);
        const next = requestAnimationFrame(tick);
        this._comboHandles.add(next);
        handle = next;
      } else {
        this._comboHandles.delete(handle);
        this.container.removeChild(label);
        this.releaseComboLabel(label);
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

  // ── Combo text pool (avoids TextStyle + Text allocation per combo) ──────
  private _comboStyle: TextStyle | null = null;
  private _comboPool: Text[] = [];

  private getComboStyle(): TextStyle {
    if (!this._comboStyle) {
      this._comboStyle = new TextStyle({
        fontFamily: "Nunito Variable, Nunito, sans-serif",
        fontSize: 28,
        fontWeight: "800",
        fill: this._cachedComboText,
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 1,
          alpha: 0.35,
        },
      });
    }
    return this._comboStyle;
  }

  private allocateComboLabel(text: string): Text {
    let label: Text;
    if (this._comboPool.length > 0) {
      label = this._comboPool.pop()!;
      label.text = text;
      label.style = this.getComboStyle();
    } else {
      label = new Text({ text, style: this.getComboStyle() });
      label.anchor.set(0.5);
    }
    return label;
  }

  private releaseComboLabel(label: Text): void {
    label.visible = false;
    this._comboPool.push(label);
  }

  // ── Beat grid lines (measure lines thick, beat lines thin) ──────

  /**
   * Draw horizontal lines at each beat and measure boundary within the visible
   * time range. Measure lines are thicker and more opaque than beat lines.
   * R2-006: Skips redraw if the viewport key hasn't changed.
   */
  private _drawBeatGrid(song: ParsedSong, vp: Viewport): void {
    // R2-006: Build a key from the viewport state that affects the grid
    const vpKey = `${vp.currentTime.toFixed(4)}:${vp.pps}:${vp.width}:${vp.height}`;
    if (vpKey === this._lastGridVpKey) return;
    this._lastGridVpKey = vpKey;

    const g = this._gridGraphics;
    g.clear();

    const [startTime, endTime] = getVisibleTimeRange(vp);
    const gridColor = this._cachedGridLine;

    const beats = computeBeatTimesInRange(
      startTime,
      endTime,
      song.tempos,
      song.timeSignatures,
    );

    for (const beat of beats) {
      const screenY = noteToScreenY(beat.time, vp);
      if (screenY < -2 || screenY > vp.height + 2) continue;

      const isMeasure = beat.beatInMeasure === 0;
      const thickness = isMeasure ? 2 : 1;
      const alpha = isMeasure ? 0.5 : 0.2;

      g.rect(0, screenY - thickness / 2, vp.width, thickness);
      g.fill({ color: gridColor, alpha });
    }
  }

  // ── Hit line (horizontal line at the bottom where notes are hit) ──

  private _drawHitLine(vp: Viewport): void {
    const hlKey = `${vp.width}:${vp.height}`;
    if (hlKey === this._lastHitLineKey) return;
    this._lastHitLineKey = hlKey;

    const g = this._hitLineGraphics;
    g.clear();

    const hitColor = getHitLineColor();
    const hitY = vp.height;

    // Glow layer
    g.rect(0, hitY - 2, vp.width, 4);
    g.fill({ color: hitColor, alpha: 0.15 });

    // Main line
    g.rect(0, hitY - 1, vp.width, 2);
    g.fill({ color: hitColor, alpha: 0.7 });
  }
}

// ── Beat time computation helper ──────────────────────────────────────

interface BeatInfo {
  time: number;
  /** 0 = first beat of the measure (downbeat) */
  beatInMeasure: number;
}

/**
 * Compute beat times within a given time range, respecting tempo and
 * time signature changes. Used for rendering beat grid lines.
 *
 * R2-003: Walks the full tempo map to accumulate actual beat positions,
 * rather than using a single BPM at startTime. This correctly handles
 * songs with multiple tempo changes.
 *
 * R2-012: Falls back to 120 BPM / 4/4 when tempos or timeSignatures are empty.
 */
function computeBeatTimesInRange(
  startTime: number,
  endTime: number,
  tempos: TempoEvent[],
  timeSignatures: TimeSignatureEvent[],
): BeatInfo[] {
  const results: BeatInfo[] = [];

  // R2-012: Safe defaults when arrays are empty
  const defaultBpm = tempos.length > 0 ? tempos[0].bpm : 120;
  const defaultNumerator =
    timeSignatures.length > 0 ? timeSignatures[0].numerator : 4;

  // R2-003: Walk from time=0 through the tempo map, accumulating beat positions.
  let currentBpm = defaultBpm;
  let currentNumerator = defaultNumerator;
  let tempoIdx = 0;
  let tsIdx = 0;
  let beatTime = 0;
  let beatInMeasure = 0;

  // Skip past tempo/time-sig events that are at time 0
  while (tempoIdx < tempos.length && tempos[tempoIdx].time <= 0) {
    currentBpm = tempos[tempoIdx].bpm;
    tempoIdx++;
  }
  while (tsIdx < timeSignatures.length && timeSignatures[tsIdx].time <= 0) {
    currentNumerator = timeSignatures[tsIdx].numerator;
    tsIdx++;
  }

  const maxBeats = 2000; // safety cap
  let emitted = 0;

  while (beatTime < endTime + 0.001 && emitted < maxBeats) {
    let secondsPerBeat = 60 / currentBpm;

    // Apply any tempo/time-sig changes at this beat position
    let changed = false;
    while (tempoIdx < tempos.length && tempos[tempoIdx].time <= beatTime) {
      currentBpm = tempos[tempoIdx].bpm;
      secondsPerBeat = 60 / currentBpm;
      tempoIdx++;
      changed = true;
    }
    while (
      tsIdx < timeSignatures.length &&
      timeSignatures[tsIdx].time <= beatTime
    ) {
      currentNumerator = timeSignatures[tsIdx].numerator;
      tsIdx++;
      beatInMeasure = 0;
      changed = true;
    }
    if (changed) {
      secondsPerBeat = 60 / currentBpm;
    }

    // Emit this beat if it's in the visible range
    if (beatTime >= startTime - 0.01) {
      results.push({ time: beatTime, beatInMeasure });
      emitted++;
    }

    // Advance to next beat
    beatTime += secondsPerBeat;
    beatInMeasure = (beatInMeasure + 1) % currentNumerator;
  }

  return results;
}
