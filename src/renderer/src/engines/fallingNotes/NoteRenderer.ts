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
import {
  FingeringEngine,
  type Finger,
} from "@renderer/engines/practice/FingeringEngine";
import { spellNote } from "../../utils/enharmonicSpelling";

function noteKey(trackIdx: number, midi: number, time: number): string {
  // Convert time to microseconds integer to avoid float-to-string instability
  return `${trackIdx}:${midi}:${Math.round(time * 1e6)}`;
}

const INITIAL_POOL_SIZE = 512;

/** Minimum note rectangle height (px) to show a label inside it. */
const MIN_HEIGHT_FOR_LABEL = 16;

/** Minimum note height (px) at which we show the fingering label */
const MIN_HEIGHT_FOR_FINGERING = 14;

/** Time window (seconds) before the hit line in which small notes get labels */
const SMALL_NOTE_LABEL_WINDOW = 2.0;

/** Font size for small note labels shown above short notes near hit line */
const SMALL_NOTE_LABEL_SIZE = 8;

/** Circled digit characters for finger numbers 1-5 */
const CIRCLED_DIGITS: Record<Finger, string> = {
  1: "\u2460",
  2: "\u2461",
  3: "\u2462",
  4: "\u2463",
  5: "\u2464",
};


/**
 * Assign hand based on track convention for 2-track songs (track 0 = right,
 * track 1 = left). Falls back to average MIDI pitch heuristic otherwise.
 */
function assignHand(
  trackIndex: number,
  trackCount: number,
  avgMidi: number,
): "left" | "right" {
  if (trackCount === 2) {
    return trackIndex === 0 ? "right" : "left";
  }
  return avgMidi < 60 ? "left" : "right";
}

/** Cached TextStyle for combo counter text. */
let _comboStyle: TextStyle | null = null;
function getComboStyle(): TextStyle {
  if (!_comboStyle) {
    _comboStyle = new TextStyle({
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
  }
  return _comboStyle;
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

/** Larger text style for Watch mode prominent note labels at the hit line. */
let _watchLabelStyle: TextStyle | null = null;
function getWatchLabelStyle(): TextStyle {
  if (!_watchLabelStyle) {
    _watchLabelStyle = new TextStyle({
      fontFamily: "Nunito Variable, Nunito, sans-serif",
      fontSize: 22,
      fontWeight: "800",
      fill: 0xffffff,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 1,
        alpha: 0.45,
      },
    });
  }
  return _watchLabelStyle;
}

/** Text style for small labels shown above short notes near the hit line. */
let _smallLabelStyle: TextStyle | null = null;
function getSmallLabelStyle(): TextStyle {
  if (!_smallLabelStyle) {
    _smallLabelStyle = new TextStyle({
      fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
      fontSize: SMALL_NOTE_LABEL_SIZE,
      fontWeight: "bold",
      fill: 0xffffff,
    });
  }
  return _smallLabelStyle;
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
  /** Key signature (negative = flats, positive = sharps, 0 = C major) */
  public keySig = 0;

  // ── Small note label pool (for notes too short for inline labels) ──
  /** Text pool for small labels shown above short notes near hit line */
  private _smallLabelPool: Text[] = [];
  /** Maps each active sprite to its associated small label Text object */
  private _spriteSmallLabels = new Map<Sprite, Text>();

  public activeNotes = new Set<number>();

  // ── Watch mode hit-line label pool ───────────────────────────────
  /** Pool of reusable Text objects for Watch mode prominent labels */
  private _watchLabelPool: Text[] = [];
  /** Currently visible Watch mode labels (noteKey → Text) */
  private _activeWatchLabels = new Map<string, Text>();
  /** Double-buffer for Watch mode labels */
  private _nextWatchLabels = new Map<string, Text>();
  /** Set of note keys that already had a Watch glow triggered (avoid re-triggering) */
  private _watchGlowedKeys = new Set<string>();

  // ── Fingering overlay ──────────────────────────────────────────
  private fingeringEngine = new FingeringEngine();
  /** Pool of reusable Text objects for fingering labels */
  private fingeringLabelPool: Text[] = [];
  /** Currently visible fingering labels (key → Text) */
  private activeFingeringLabels = new Map<string, Text>();
  private nextFingeringLabels = new Map<string, Text>();
  /** Cached fingering results per song, keyed by "trackIdx" → composite "midi:time" → Finger */
  private fingeringCache = new Map<string, Map<string, Finger>>();
  /** ID of the last song we computed fingering for */
  private lastSongFileName = "";

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
  update(
    song: ParsedSong,
    vp: Viewport,
    showFingering: boolean,
    watchMode = false,
  ): void {
    // Double-buffer swap: reuse nextActive map instead of allocating each frame
    const nextActive = this.nextActive;
    nextActive.clear();
    this.activeNotes.clear();

    const hitWindow = 0.05;
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

    // Double-buffer for Watch mode labels
    const nextWLabels = this._nextWatchLabels;
    nextWLabels.clear();

    /**
     * Watch mode hit-line detection: a note is "at" the hit line when
     * its time range overlaps the current time within a small window.
     * We use a slightly wider window than hitWindow so the glow starts
     * just before the note reaches the line and lingers briefly.
     */
    const watchHitWindow = 0.12; // seconds

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

        // Vary alpha based on velocity (0-127 -> 0.4-1.0) for dynamics visualization
        if (note.velocity > 0) {
          sprite.alpha = 0.4 + (note.velocity / 127) * 0.6;
        }

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
          label.text = spellNote(note.midi, this.keySig);
          label.x = kp.x + kp.width / 2;
          label.y = rectY + Math.max(h, 2) / 2;
          label.visible = true;
          shownLabelCount += 1;
        } else if (
          this.showNoteLabels &&
          h < MIN_HEIGHT_FOR_LABEL &&
          shownLabelCount < maxVisibleLabels &&
          note.time - vp.currentTime <= SMALL_NOTE_LABEL_WINDOW &&
          note.time - vp.currentTime >= -0.1
        ) {
          // Small note near hit line — show a small label above the note
          let smallLabel = this._spriteSmallLabels.get(sprite);
          if (!smallLabel) {
            smallLabel = this.allocateSmallLabel();
            this._spriteSmallLabels.set(sprite, smallLabel);
          }
          smallLabel.text = spellNote(note.midi, this.keySig);
          smallLabel.x = kp.x + kp.width / 2;
          smallLabel.y = rectY - 4;
          smallLabel.visible = true;
          shownLabelCount += 1;

          // Hide inline label if present
          const existingLabel = this._spriteLabels.get(sprite);
          if (existingLabel) {
            this.releaseLabel(existingLabel);
            this._spriteLabels.delete(sprite);
          }
        } else {
          // Hide label if note is too small or labels are disabled
          const existingLabel = this._spriteLabels.get(sprite);
          if (existingLabel) {
            this.releaseLabel(existingLabel);
            this._spriteLabels.delete(sprite);
          }
          // Hide small label if present
          const existingSmall = this._spriteSmallLabels.get(sprite);
          if (existingSmall) {
            this.releaseSmallLabel(existingSmall);
            this._spriteSmallLabels.delete(sprite);
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

        // ── Watch mode: glow + prominent note name at hit line ──
        if (watchMode) {
          const noteAtHitLine =
            note.time <= vp.currentTime + watchHitWindow &&
            note.time + note.duration >= vp.currentTime - watchHitWindow;

          if (noteAtHitLine) {
            // Subtle glow: brighten sprite tint toward white (30%)
            // Only trigger once per note to avoid re-brightening every frame
            if (!this._watchGlowedKeys.has(key)) {
              this._watchGlowedKeys.add(key);
              this.glowWatch(sprite);
            }

            // Prominent note name label above the note at the hit line
            let wLabel =
              this._activeWatchLabels.get(key) ?? nextWLabels.get(key);
            if (!wLabel) {
              wLabel = this.allocateWatchLabel();
            }
            wLabel.text = spellNote(note.midi, this.keySig);
            wLabel.x = kp.x + kp.width / 2;
            // Position the label centered on the note at the hit line area
            wLabel.y = vp.height - 6;
            wLabel.visible = true;
            nextWLabels.set(key, wLabel);
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

    // Hide all labels if fingering is disabled
    if (!showFingering) {
      for (const [, label] of this.activeFingeringLabels) {
        this.releaseFingeringLabel(label);
      }
    }

    // Release unused Watch mode labels
    for (const [key, label] of this._activeWatchLabels) {
      if (!nextWLabels.has(key)) {
        this.releaseWatchLabel(label);
      }
    }
    // Hide all Watch labels if not in Watch mode
    if (!watchMode) {
      for (const [, label] of this._activeWatchLabels) {
        this.releaseWatchLabel(label);
      }
      this._watchGlowedKeys.clear();
    }

    // Swap buffers: active ↔ nextActive
    this.nextActive = this.active;
    this.active = nextActive;

    // Swap fingering label buffers
    this.nextFingeringLabels = this.activeFingeringLabels;
    this.activeFingeringLabels = nextFLabels;

    // Swap Watch mode label buffers
    this._nextWatchLabels = this._activeWatchLabels;
    this._activeWatchLabels = nextWLabels;
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

    // Clean up label pools
    this._labelPool.length = 0;
    this._spriteLabels.clear();
    this._smallLabelPool.length = 0;
    this._spriteSmallLabels.clear();

    // Clean up fingering overlay
    this.fingeringLabelPool.length = 0;
    this.activeFingeringLabels.clear();
    this.nextFingeringLabels.clear();
    this.fingeringCache.clear();
    this.lastSongFileName = "";

    // Clean up Watch mode overlay
    this._watchLabelPool.length = 0;
    this._activeWatchLabels.clear();
    this._nextWatchLabels.clear();
    this._watchGlowedKeys.clear();
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

  // ── Small note label pool (above short notes near hit line) ──

  private createSmallLabel(): Text {
    const t = new Text({ text: "", style: getSmallLabelStyle() });
    t.anchor.set(0.5, 1); // bottom-center anchor (label sits above the note)
    t.visible = false;
    t.alpha = 0.85;
    this.container.addChild(t);
    return t;
  }

  private allocateSmallLabel(): Text {
    if (this._smallLabelPool.length === 0) {
      const grow = 16;
      for (let i = 0; i < grow; i++) {
        this._smallLabelPool.push(this.createSmallLabel());
      }
    }
    return this._smallLabelPool.pop()!;
  }

  private releaseSmallLabel(label: Text): void {
    label.visible = false;
    this._smallLabelPool.push(label);
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

    // Release the associated small label if present
    const smallLabel = this._spriteSmallLabels.get(sprite);
    if (smallLabel) {
      this.releaseSmallLabel(smallLabel);
      this._spriteSmallLabels.delete(sprite);
    }
  }

  // ── Watch mode label pool ────────────────────────────────────────

  private createWatchLabel(): Text {
    const t = new Text({ text: "", style: getWatchLabelStyle() });
    t.anchor.set(0.5);
    t.visible = false;
    this.container.addChild(t);
    return t;
  }

  private allocateWatchLabel(): Text {
    if (this._watchLabelPool.length === 0) {
      const grow = 16;
      for (let i = 0; i < grow; i++) {
        this._watchLabelPool.push(this.createWatchLabel());
      }
    }
    return this._watchLabelPool.pop()!;
  }

  private releaseWatchLabel(label: Text): void {
    label.visible = false;
    this._watchLabelPool.push(label);
  }

  /**
   * Apply a subtle glow to a note sprite in Watch mode.
   * Brightens the tint toward white (30%) with a gentle pulse over 350ms,
   * then eases back to the original tint. Designed to be noticeable but
   * not distracting — purely educational highlight.
   */
  private glowWatch(sprite: Sprite): void {
    const existing = this._animHandles.get(sprite);
    if (existing !== undefined) cancelAnimationFrame(existing);

    const originalTint = sprite.tint;
    const duration = 350; // ms
    let start = -1;

    const tick = (now: number): void => {
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);

      // Ease in-out: brighten to 30% white then back
      const brightness = t < 0.4
        ? (t / 0.4) * 0.3
        : 0.3 * (1 - (t - 0.4) / 0.6);
      sprite.tint = lerpColor(originalTint, 0xffffff, brightness);

      if (t < 1) {
        this._animHandles.set(sprite, requestAnimationFrame(tick));
      } else {
        this._animHandles.delete(sprite);
        sprite.tint = originalTint;
      }
    };
    this._animHandles.set(sprite, requestAnimationFrame(tick));
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

      const avgMidi =
        track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
      const hand = assignHand(trackIdx, song.tracks.length, avgMidi);

      const results = this.fingeringEngine.computeFingering(track.notes, hand);
      const trackCache = new Map<string, Finger>();

      for (let i = 0; i < results.length; i++) {
        // Use the original note's time for the composite key so lookups
        // by ParsedNote (midi + time) work correctly even when the same
        // pitch appears multiple times with different fingerings.
        const note = track.notes[i];
        const key = `${note.midi}:${Math.round(note.time * 1e6)}`;
        trackCache.set(key, results[i].finger);
      }

      this.fingeringCache.set(String(trackIdx), trackCache);
    }
  }

  /** Look up the cached finger for a specific note */
  private getFingerForNote(trackIdx: number, note: ParsedNote): Finger | null {
    const trackCache = this.fingeringCache.get(String(trackIdx));
    if (!trackCache) return null;
    const key = `${note.midi}:${Math.round(note.time * 1e6)}`;
    return trackCache.get(key) ?? null;
  }

  // ── Practice mode visual feedback ──────────────────────────────────

  /**
   * Flash a bright hit effect on a note sprite.
   * Tint pulses from white → bright accent color over ~400ms with a
   * more dramatic effect so young children can easily notice it.
   * Animation is automatically cancelled if the sprite is recycled.
   */
  flashHit(sprite: Sprite): void {
    // Cancel any existing animation on this sprite
    const existing = this._animHandles.get(sprite);
    if (existing !== undefined) cancelAnimationFrame(existing);

    const originalTint = sprite.tint;
    const originalAlpha = sprite.alpha;
    /** Bright accent color to pulse toward after the initial white flash */
    const accentColor = 0x66ffcc;
    const duration = 400; // ms (increased from 200 for child visibility)
    let start = -1;

    const tick = (now: number): void => {
      // Sprite was recycled — stop animating
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);

      // Phase 1 (0–0.2): flash to white
      // Phase 2 (0.2–0.5): transition white → accent color
      // Phase 3 (0.5–1.0): ease accent → original tint
      if (t < 0.2) {
        const p = t / 0.2;
        sprite.tint = lerpColor(originalTint, 0xffffff, p * 0.85);
        sprite.alpha = originalAlpha + (1 - originalAlpha) * p * 0.6;
      } else if (t < 0.5) {
        const p = (t - 0.2) / 0.3;
        sprite.tint = lerpColor(0xffffff, accentColor, p * 0.7);
        sprite.alpha = originalAlpha + (1 - originalAlpha) * 0.6 * (1 - p * 0.3);
      } else {
        const p = (t - 0.5) / 0.5;
        const easeOut = p * (2 - p); // ease-out quad
        sprite.tint = lerpColor(
          lerpColor(0xffffff, accentColor, 0.7),
          originalTint,
          easeOut,
        );
        sprite.alpha = originalAlpha + (1 - originalAlpha) * 0.42 * (1 - easeOut);
      }

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
   * Mark a note sprite as missed: brief red tint flash (300ms), then
   * fade to gray with reduced opacity. More visible than a plain fade
   * so children clearly notice they missed the note.
   * Cancelled if sprite is recycled.
   */
  markMiss(sprite: Sprite): void {
    const existing = this._animHandles.get(sprite);
    if (existing !== undefined) cancelAnimationFrame(existing);

    const originalTint = sprite.tint;
    const originalAlpha = sprite.alpha;
    /** Red tint color for the initial miss flash */
    const missRedTint = 0xff4444;
    const redDuration = 300; // ms — red flash phase
    const fadeDuration = 150; // ms — gray fade phase
    const totalDuration = redDuration + fadeDuration;
    let start = -1;

    const tick = (now: number): void => {
      if (!this._animHandles.has(sprite)) return;

      if (start < 0) start = now;
      const elapsed = now - start;
      const t = Math.min(elapsed / totalDuration, 1);

      if (elapsed < redDuration) {
        // Phase 1: flash red then ease back toward original
        const p = elapsed / redDuration;
        const flash = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
        sprite.tint = lerpColor(originalTint, missRedTint, flash * 0.8);
        sprite.alpha = originalAlpha;
      } else {
        // Phase 2: fade to gray + reduce opacity
        const p = (elapsed - redDuration) / fadeDuration;
        const ease = p * (2 - p); // ease-out quad
        sprite.tint = lerpColor(originalTint, 0x888888, ease);
        sprite.alpha = originalAlpha - (originalAlpha - 0.4) * ease;
      }

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
   * The number pops in with a scale bounce (1.0 → 1.3 → 1.0),
   * drifts upward, then fades out over 1200ms total so children
   * can clearly see their streak count.
   */
  showCombo(count: number, x: number, y: number): void {
    const style = getComboStyle();
    const label = new Text({ text: `${count}x`, style });
    label.anchor.set(0.5);
    label.x = x;
    label.y = y;
    label.alpha = 0;
    label.scale.set(0.3);
    this.container.addChild(label);

    const duration = 1200; // ms (increased from 600 for child visibility)
    let start = -1;

    const tick = (now: number): void => {
      // Animation was cancelled by destroy() — stop writing to removed label
      if (!this._comboHandles.has(handle)) return;

      if (start < 0) start = now;
      const t = Math.min((now - start) / duration, 1);

      // Phase 1 (0–0.12): pop in with overshoot to 1.3x
      // Phase 2 (0.12–0.25): bounce back from 1.3x → 1.0x
      // Phase 3 (0.25–0.7): hold at full scale + drift
      // Phase 4 (0.7–1.0): fade out
      if (t < 0.12) {
        const p = t / 0.12;
        label.scale.set(0.3 + p * 1.0); // 0.3 → 1.3
        label.alpha = Math.min(p * 1.5, 1);
      } else if (t < 0.25) {
        const p = (t - 0.12) / 0.13;
        const easeOut = p * (2 - p);
        label.scale.set(1.3 - 0.3 * easeOut); // 1.3 → 1.0
        label.alpha = 1;
      } else if (t < 0.7) {
        label.scale.set(1);
        label.alpha = 1;
      } else {
        const p = (t - 0.7) / 0.3;
        label.alpha = 1 - p;
        label.scale.set(1 - p * 0.3);
      }

      label.y = y - 60 * t; // drift further (40 → 60) given longer duration

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
