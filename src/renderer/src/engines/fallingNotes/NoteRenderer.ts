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
import { getTrackColor } from "./noteColors";
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
  /** R2-01: Tracks combo Text objects currently mid-animation (not yet returned to pool).
   *  destroy() iterates this set to call .destroy() on orphaned labels. */
  private _comboInFlight = new Set<Text>();

  /** R1-02/R1-05: Canonical base tint per sprite, set on allocation, used by all animations.
   *  Prevents mid-animation captures of intermediate tint values. */
  private _baseTint = new Map<Sprite, number>();
  /** R1-02/R1-05: Canonical base alpha per sprite, set on allocation, used by all animations. */
  private _baseAlpha = new Map<Sprite, number>();

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
  /** S9-R1-03: Cache hit line color to match grid line caching pattern */
  private _cachedHitLine = 0x705a87;
  /** Unsubscribe handle for theme store subscription */
  private _themeUnsub: (() => void) | null = null;
  /** S9-R3-03: Cached showFingering to avoid per-frame store access */
  private _cachedShowFingering = false;
  /** S9-R3-03: Unsubscribe handle for settings store subscription */
  private _settingsUnsub: (() => void) | null = null;
  /** S9-R3-03: Cached track color palette (updated on theme change) */
  private _cachedTrackPalette: number[] = [];

  public activeNotes = new Set<number>();
  /** Increments each time the set of active note *objects* changes
   *  (even if the MIDI pitch set stays the same, e.g. consecutive C4→C4). */
  public activeNoteGeneration = 0;
  /** Track which note keys were active last frame to detect note-object changes */
  private _prevActiveNoteKeys = new Set<string>();
  private _activeNoteKeys = new Set<string>();

  /** Key signature (number of sharps/flats) used for note label display.
   *  Positive = sharps, negative = flats. Set from App.tsx. */
  public keySig = 0;

  // ── Beat grid and hit line (R2-006: cached with dirty flag) ──────
  private _gridGraphics: Graphics;
  private _hitLineGraphics: Graphics;
  /** S9-R2-03: Numeric dirty-check fields for grid — avoids string allocation per frame */
  private _lastGridTime = -1;
  private _lastGridPps = -1;
  private _lastGridW = -1;
  private _lastGridH = -1;
  /** S9-R2-03: Numeric dirty-check for hit line */
  private _lastHitLineW = -1;
  private _lastHitLineH = -1;

  // ── Fingering overlay ──────────────────────────────────────────
  private fingeringEngine = new FingeringEngine();
  /** Pool of reusable Text objects for fingering labels */
  private fingeringLabelPool: Text[] = [];
  /** Currently visible fingering labels (key → Text) */
  private activeFingeringLabels = new Map<string, Text>();
  private nextFingeringLabels = new Map<string, Text>();
  /** Cached fingering results per song, keyed by "trackIdx" */
  private fingeringCache = new Map<string, Map<number, Finger>>();
  /** S9-R2-01: Precomputed note→originalIndex map per track for O(1) fingering lookup.
   *  Built in computeFingeringForSong alongside fingeringCache. */
  private _noteIndexMap = new Map<string, Map<ParsedNote, number>>();
  /** ID of the last song we computed fingering for */
  private lastFingeredSong: ParsedSong | null = null;

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
  /** Dynamic keyboard range — stored for resize reuse */
  private _firstNote = 21;
  private _lastNote = 108;

  /** Update the keyboard range used for key position computation. */
  setKeyboardRange(firstNote: number, lastNote: number): void {
    this._firstNote = firstNote;
    this._lastNote = lastNote;
    this.keyPositions = buildKeyPositions(this._canvasWidth, firstNote, lastNote);
  }

  init(canvasWidth: number, firstNote = 21, lastNote = 108): void {
    this._canvasWidth = canvasWidth;
    this._firstNote = firstNote;
    this._lastNote = lastNote;
    this.keyPositions = buildKeyPositions(canvasWidth, firstNote, lastNote);
    this.noteTexture = Texture.WHITE;

    for (let i = 0; i < INITIAL_POOL_SIZE; i++) {
      this.pool.push(this.createSprite());
    }

    // Pre-fill label pool (smaller than sprite pool — not every note needs a label)
    const labelPoolSize = Math.min(256, INITIAL_POOL_SIZE);
    for (let i = 0; i < labelPoolSize; i++) {
      this._labelPool.push(this.createLabel());
    }

    // Cache theme colors and subscribe for theme changes.
    // Guard: disconnect any stale subscription from a prior init() call.
    this._themeUnsub?.();
    this._updateCachedColors();
    this._themeUnsub = useThemeStore.subscribe(() =>
      this._updateCachedColors(),
    );

    // S9-R3-03: Cache settings and subscribe for changes — avoids per-frame getState()
    this._settingsUnsub?.();
    this._cachedShowFingering = useSettingsStore.getState().showFingering;
    this._settingsUnsub = useSettingsStore.subscribe((state) => {
      this._cachedShowFingering = state.showFingering;
    });
  }

  /** Refresh cached PixiJS color values from the current theme. */
  private _updateCachedColors(): void {
    const colors = useThemeStore.getState().theme.colors;
    this._cachedHitGlow = hexToPixi(colors.hitGlow);
    this._cachedMissGray = hexToPixi(colors.missGray);
    this._cachedComboText = hexToPixi(colors.comboText);
    this._cachedGridLine = hexToPixi(colors.gridLine);
    // S9-R1-03: Cache hit line color alongside other theme colors
    this._cachedHitLine = hexToPixi(colors.hitLine);
    // S9-R3-03: Cache track color palette to avoid per-track getState() calls
    this._cachedTrackPalette = [
      hexToPixi(colors.note1),
      hexToPixi(colors.note2),
      hexToPixi(colors.note3),
      hexToPixi(colors.note4),
      hexToPixi(colors.note5),
      hexToPixi(colors.note6),
      hexToPixi(colors.note7),
      hexToPixi(colors.note8),
    ];
    // S9-R2-03: Invalidate numeric dirty flags for grid and hit line redraws
    this._lastGridTime = -1;
    this._lastHitLineW = -1;
    this._comboStyle = null;
  }

  /**
   * Recompute key positions after a canvas resize.
   * @param canvasWidth New canvas pixel width
   */
  resize(canvasWidth: number): void {
    this._canvasWidth = canvasWidth;
    this.keyPositions = buildKeyPositions(canvasWidth, this._firstNote, this._lastNote);
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
    this._activeNoteKeys.clear();

    const hitWindow = 0.05;
    // S9-R3-03: Use cached value instead of per-frame store access
    const showFingering = this._cachedShowFingering;
    const maxVisibleLabels =
      vp.height < 200 ? 14 : vp.height < 280 ? 22 : vp.height < 360 ? 30 : 42;
    let shownLabelCount = 0;

    // Recompute fingering cache when song changes (use object identity
    // so reloading the same file correctly invalidates the cache)
    if (showFingering && song !== this.lastFingeredSong) {
      this.computeFingeringForSong(song);
      this.lastFingeredSong = song;
    }

    // Double-buffer for fingering labels
    const nextFLabels = this.nextFingeringLabels;
    nextFLabels.clear();

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx];
      // S9-R3-03: Use cached palette instead of per-track getTrackColor (store access)
      const palette = this._cachedTrackPalette;
      const color =
        palette.length > 0
          ? palette[trackIdx % palette.length]
          : getTrackColor(trackIdx);
      const visibleNotes = getVisibleNotes(
        track.notes,
        vp,
        hitWindow,
        this.visibleBuf,
      );

      for (let vi = 0; vi < visibleNotes.length; vi++) {
        const note = visibleNotes[vi];
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
          // R1-02/R1-05: Record canonical base values for animation reference
          this._baseTint.set(sprite, color);
          this._baseAlpha.set(sprite, 1);
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
          this._activeNoteKeys.add(key);
        }

        // ── Fingering label overlay ──────────────────────────────
        // S9-R1-01: Look up each note's original index via precomputed map
        // instead of arithmetic offset. getVisibleNotes()'s backward scan
        // produces unsorted results, so sequential indexing was wrong.
        // S9-R2-01: Use _noteIndexMap for O(1) lookup instead of O(n) indexOf.
        if (showFingering && h >= MIN_HEIGHT_FOR_FINGERING) {
          const trackIdxStr = String(trackIdx);
          const noteIdx = this._noteIndexMap.get(trackIdxStr)?.get(note);
          const finger =
            noteIdx != null ? this.getFingerForNote(trackIdx, noteIdx) : null;
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

    // Bump generation when the set of active note *objects* changes.
    // This detects consecutive identical pitches (e.g. C4→C4) where
    // the MIDI Set stays {60} but the note key changes (different time).
    const keysChanged =
      this._activeNoteKeys.size !== this._prevActiveNoteKeys.size ||
      [...this._activeNoteKeys].some((k) => !this._prevActiveNoteKeys.has(k));
    if (keysChanged) {
      this.activeNoteGeneration++;
      // Swap key sets
      const tmp = this._prevActiveNoteKeys;
      this._prevActiveNoteKeys = this._activeNoteKeys;
      this._activeNoteKeys = tmp;
    }

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
    // R1-06/S9-R2-03: Reset numeric dirty-check fields so re-init draws correctly
    this._lastGridTime = -1;
    this._lastGridPps = -1;
    this._lastGridW = -1;
    this._lastGridH = -1;
    this._lastHitLineW = -1;
    this._lastHitLineH = -1;
    this.container.removeChildren();
    this.pool.length = 0;
    this.active.clear();
    this.nextActive.clear();
    this.activeNotes.clear();
    this.keyPositions.clear();
    // R1-02/R1-05: Clear base value maps
    this._baseTint.clear();
    this._baseAlpha.clear();

    // R1-07: Destroy Text objects in label pool to free PixiJS resources
    for (const label of this._labelPool) {
      label.destroy();
    }
    this._labelPool.length = 0;
    // Also destroy labels still attached to sprites
    for (const label of this._spriteLabels.values()) {
      label.destroy();
    }
    this._spriteLabels.clear();

    // Unsubscribe from theme store
    this._themeUnsub?.();
    this._themeUnsub = null;

    // S9-R3-03: Unsubscribe from settings store
    this._settingsUnsub?.();
    this._settingsUnsub = null;

    // R2-01: Destroy in-flight combo labels that were mid-animation
    // (not yet returned to _comboPool). These would otherwise be orphaned
    // because their rAF handles were cancelled above, so releaseComboLabel
    // never runs for them.
    for (const label of this._comboInFlight) {
      label.destroy();
    }
    this._comboInFlight.clear();

    // R1-07: Destroy combo Text objects already returned to pool
    for (const label of this._comboPool) {
      label.destroy();
    }
    this._comboPool.length = 0;
    this._comboStyle = null;

    // R1-07: Destroy fingering Text objects before truncating pool, null the style
    for (const label of this.fingeringLabelPool) {
      label.destroy();
    }
    for (const label of this.activeFingeringLabels.values()) {
      label.destroy();
    }
    for (const label of this.nextFingeringLabels.values()) {
      label.destroy();
    }
    this.fingeringLabelPool.length = 0;
    this._fingeringLabelStyle = null;
    this.activeFingeringLabels.clear();
    this.nextFingeringLabels.clear();
    this.fingeringCache.clear();
    this._noteIndexMap.clear();
    this.lastFingeredSong = null;
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
      // R1-04: Use nextActive.size (current frame's count) instead of
      // active.size (last frame's count) to avoid repeated small grows
      // after song jumps. Fall back to a minimum of 64 sprites.
      const currentFrameCount = this.nextActive.size;
      const grow = Math.max(64, Math.floor(currentFrameCount * 0.5));
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
    // R1-02/R1-05: Clean up base value tracking for released sprite
    this._baseTint.delete(sprite);
    this._baseAlpha.delete(sprite);
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
   * S9-R2-01: Also builds _noteIndexMap for O(1) note→index lookup.
   */
  private computeFingeringForSong(song: ParsedSong): void {
    this.fingeringCache.clear();
    this._noteIndexMap.clear();

    for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
      const track = song.tracks[trackIdx];
      if (track.notes.length === 0) continue;

      // S9-R2-01: Build note→index map for O(1) lookup in hot path
      const indexMap = new Map<ParsedNote, number>();
      for (let i = 0; i < track.notes.length; i++) {
        indexMap.set(track.notes[i], i);
      }
      this._noteIndexMap.set(String(trackIdx), indexMap);

      // Heuristic: tracks with mostly lower notes (avg midi < 60) are left hand
      const avgMidi =
        track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
      const hand = avgMidi < 60 ? "left" : "right";

      const results = this.fingeringEngine.computeFingering(track.notes, hand);
      const trackCache = new Map<number, Finger>();

      for (let i = 0; i < results.length; i++) {
        trackCache.set(i, results[i].finger);
      }

      this.fingeringCache.set(String(trackIdx), trackCache);
    }
  }

  /** Look up the cached finger for a specific note by its index in the track */
  private getFingerForNote(trackIdx: number, noteIndex: number): Finger | null {
    const trackCache = this.fingeringCache.get(String(trackIdx));
    if (!trackCache) return null;
    return trackCache.get(noteIndex) ?? null;
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

    // R1-02: Read canonical base values, not current (potentially mid-animation) values
    const baseTint = this._baseTint.get(sprite) ?? sprite.tint;
    const baseAlpha = this._baseAlpha.get(sprite) ?? sprite.alpha;
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
      sprite.tint = lerpColor(baseTint, hitGlow, flash * 0.7);
      sprite.alpha = baseAlpha + (1 - baseAlpha) * flash * 0.5;

      if (t < 1) {
        this._animHandles.set(sprite, requestAnimationFrame(tick));
      } else {
        this._animHandles.delete(sprite);
        sprite.tint = baseTint;
        sprite.alpha = baseAlpha;
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

    // R1-05: Read canonical base values, not current (potentially mid-animation) values
    const baseTint = this._baseTint.get(sprite) ?? sprite.tint;
    const baseAlpha = this._baseAlpha.get(sprite) ?? sprite.alpha;
    const missGray = this._cachedMissGray;
    const duration = 150;
    let start = -1;

    const tick = (now: number): void => {
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);
      const ease = t * (2 - t); // ease-out quad

      sprite.tint = lerpColor(baseTint, missGray, ease);
      sprite.alpha = baseAlpha - (baseAlpha - 0.4) * ease;

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
    // R2-01: Track in-flight label so destroy() can .destroy() it
    this._comboInFlight.add(label);

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
        // R1-01: Add new handle BEFORE deleting old one to prevent
        // destroy() from clearing the set in the gap between delete and add,
        // which would orphan the label.
        const next = requestAnimationFrame(tick);
        this._comboHandles.add(next);
        if (next !== handle) this._comboHandles.delete(handle);
        handle = next;
      } else {
        this._comboHandles.delete(handle);
        // R2-01: Remove from in-flight tracking before returning to pool
        this._comboInFlight.delete(label);
        // R1-03: releaseComboLabel now handles removeChild internally
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
    // R1-03: Remove from container before returning to pool to prevent
    // duplicate addChild on re-allocation (pool invariant: pooled labels
    // must not be children of the container).
    this.container.removeChild(label);
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
    // S9-R2-03: Numeric dirty check — avoids string allocation + toFixed per frame
    if (
      vp.currentTime === this._lastGridTime &&
      vp.pps === this._lastGridPps &&
      vp.width === this._lastGridW &&
      vp.height === this._lastGridH
    ) {
      return;
    }
    this._lastGridTime = vp.currentTime;
    this._lastGridPps = vp.pps;
    this._lastGridW = vp.width;
    this._lastGridH = vp.height;

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
    // S9-R2-03: Numeric dirty check
    if (vp.width === this._lastHitLineW && vp.height === this._lastHitLineH) {
      return;
    }
    this._lastHitLineW = vp.width;
    this._lastHitLineH = vp.height;

    const g = this._hitLineGraphics;
    g.clear();

    // S9-R1-03: Use cached color instead of store access in render path
    const hitColor = this._cachedHitLine;
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
 * R2-003: Walks the tempo map to accumulate actual beat positions,
 * rather than using a single BPM at startTime. This correctly handles
 * songs with multiple tempo changes.
 *
 * R2-012: Falls back to 120 BPM / 4/4 when tempos or timeSignatures are empty.
 *
 * S9-R1-02: Optimized to skip directly to the tempo segment containing
 * startTime instead of walking from time=0. This reduces per-frame cost
 * from O(total_beats_in_song) to O(visible_beats + tempo_events).
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

  // ── Phase 1: Fast-forward to the tempo segment containing startTime ──
  // Walk through tempo and time-sig events in chronological order to
  // reach the segment containing startTime. This is O(events) not O(beats).
  // S9-R2-02: Interleave tempo and time-sig events to correctly handle
  // time-sig changes that occur between tempo events.
  let currentBpm = defaultBpm;
  let currentNumerator = defaultNumerator;
  let tempoIdx = 0;
  let tsIdx = 0;
  let segmentStartTime = 0;
  let beatInMeasure = 0;

  // Consume events at time 0
  while (tempoIdx < tempos.length && tempos[tempoIdx].time <= 0) {
    currentBpm = tempos[tempoIdx].bpm;
    tempoIdx++;
  }
  while (tsIdx < timeSignatures.length && timeSignatures[tsIdx].time <= 0) {
    currentNumerator = timeSignatures[tsIdx].numerator;
    tsIdx++;
  }

  // Walk through events chronologically until we reach startTime.
  // At each event boundary, count beats in the segment and advance state.
  while (true) {
    // Find the next event (tempo or time-sig) before startTime
    const nextTempoTime =
      tempoIdx < tempos.length && tempos[tempoIdx].time < startTime
        ? tempos[tempoIdx].time
        : Infinity;
    const nextTsTime =
      tsIdx < timeSignatures.length && timeSignatures[tsIdx].time < startTime
        ? timeSignatures[tsIdx].time
        : Infinity;
    const nextEventTime = Math.min(nextTempoTime, nextTsTime);

    if (nextEventTime === Infinity) break; // No more events before startTime

    // Count beats from segmentStartTime to this event
    const secondsPerBeat = 60 / currentBpm;
    const segmentDuration = nextEventTime - segmentStartTime;
    const beatsInSegment = Math.floor(segmentDuration / secondsPerBeat);
    beatInMeasure = (beatInMeasure + beatsInSegment) % currentNumerator;
    segmentStartTime = segmentStartTime + beatsInSegment * secondsPerBeat;

    // Apply the event(s) at this time
    if (nextTempoTime <= nextTsTime) {
      currentBpm = tempos[tempoIdx].bpm;
      tempoIdx++;
    }
    if (nextTsTime <= nextTempoTime) {
      currentNumerator = timeSignatures[tsIdx].numerator;
      beatInMeasure = 0;
      tsIdx++;
    }
  }

  // S9-R3-01: Arithmetic jump to the first beat near startTime instead of
  // walking beat-by-beat. This provides O(1) skip for single-tempo songs
  // (the most common case) and eliminates the O(beats) loop entirely.
  // S9-R3-02: Uses exact arithmetic to avoid floating-point drift.
  let secondsPerBeat = 60 / currentBpm;
  const gap = startTime - segmentStartTime;
  let beatTime: number;
  if (gap > secondsPerBeat) {
    // Jump directly: compute how many full beats fit in the gap
    const beatsToSkip = Math.floor(gap / secondsPerBeat);
    beatTime = segmentStartTime + beatsToSkip * secondsPerBeat;
    beatInMeasure = (beatInMeasure + beatsToSkip) % currentNumerator;
    // Consume any tempo/ts events that we jumped over (between segmentStartTime and beatTime)
    while (tempoIdx < tempos.length && tempos[tempoIdx].time <= beatTime) {
      currentBpm = tempos[tempoIdx].bpm;
      secondsPerBeat = 60 / currentBpm;
      tempoIdx++;
    }
    while (
      tsIdx < timeSignatures.length &&
      timeSignatures[tsIdx].time <= beatTime
    ) {
      currentNumerator = timeSignatures[tsIdx].numerator;
      tsIdx++;
      beatInMeasure = 0;
    }
  } else {
    beatTime = segmentStartTime;
  }

  // ── Phase 2: Emit beats within the visible range ──
  const maxBeats = 2000; // safety cap
  let emitted = 0;

  while (beatTime < endTime + 0.001 && emitted < maxBeats) {
    secondsPerBeat = 60 / currentBpm;

    // Apply any tempo/time-sig changes at this beat position
    while (tempoIdx < tempos.length && tempos[tempoIdx].time <= beatTime) {
      currentBpm = tempos[tempoIdx].bpm;
      secondsPerBeat = 60 / currentBpm;
      tempoIdx++;
    }
    while (
      tsIdx < timeSignatures.length &&
      timeSignatures[tsIdx].time <= beatTime
    ) {
      currentNumerator = timeSignatures[tsIdx].numerator;
      tsIdx++;
      beatInMeasure = 0;
    }

    results.push({ time: beatTime, beatInMeasure });
    emitted++;

    // Advance to next beat
    beatTime += secondsPerBeat;
    beatInMeasure = (beatInMeasure + 1) % currentNumerator;
  }

  return results;
}
