import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock pixi.js before importing NoteRenderer

vi.mock("pixi.js", () => {
  class MockSprite {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    visible = false;
    tint = 0xffffff;
    alpha = 1;
    _scale = {
      x: 1,
      y: 1,
      set(v: number): void {
        this.x = v;
        this.y = v;
      },
    };
    get scale(): { x: number; y: number; set(v: number): void } {
      return this._scale;
    }
    anchor = {
      set(_x: number, _y?: number): void {
        void _x;
        void _y;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    destroy(): void {}
  }
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown): void {
      this.children.push(child);
    }
    removeChild(child: unknown): void {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
    }
    removeChildren(): void {
      this.children.length = 0;
    }
  }
  class MockText extends MockSprite {
    text = "";
    style: unknown;
    constructor(opts?: { text?: string; style?: unknown }) {
      super();
      if (opts) {
        this.text = opts.text ?? "";
        this.style = opts.style;
      }
    }
  }
  class MockTextStyle {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    constructor(_opts?: unknown) {}
  }
  return {
    Container: MockContainer,
    Sprite: MockSprite,
    Text: MockText,
    TextStyle: MockTextStyle,
    Texture: { WHITE: {} },
  };
});

// Mock noteColors to avoid pulling in useThemeStore (which accesses document)
vi.mock("./noteColors", () => ({
  getTrackColor: (trackIndex: number) =>
    [0x9b7fd4, 0xc084cf, 0x7ba4d9, 0xa8d4a0][trackIndex % 4],
}));

import { NoteRenderer } from "./NoteRenderer";
import { Container } from "pixi.js";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { Viewport } from "./ViewportManager";

function makeSong(
  tracks: { notes: { midi: number; time: number; duration: number }[] }[],
): ParsedSong {
  return {
    fileName: "test.mid",
    duration: 30,
    noteCount: tracks.reduce((sum, t) => sum + t.notes.length, 0),
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tracks: tracks.map((t, i) => ({
      name: `Track ${i}`,
      instrument: "Piano",
      channel: i,
      notes: t.notes.map((n) => ({
        midi: n.midi,
        name: "C4",
        time: n.time,
        duration: n.duration,
        velocity: 80,
      })),
    })),
  };
}

function makeViewport(overrides: Partial<Viewport> = {}): Viewport {
  return { width: 1040, height: 600, pps: 200, currentTime: 0, ...overrides };
}

describe("NoteRenderer", () => {
  let renderer: NoteRenderer;
  let parent: Container;

  beforeEach(() => {
    parent = new Container();
    renderer = new NoteRenderer(parent);
    renderer.init(1040); // 1040 / 52 white keys = 20px each
  });

  test("initializes sprite pool", () => {
    // After init, the renderer should be ready (no errors)
    expect(renderer).toBeDefined();
    expect(renderer.activeNotes.size).toBe(0);
  });

  test("detects active notes at the hit line", () => {
    // Note at t=5, duration=1 → plays from 5 to 6
    // currentTime=5.5 → note is at the hit line
    const song = makeSong([{ notes: [{ midi: 60, time: 5, duration: 1 }] }]);
    const vp = makeViewport({ currentTime: 5.5 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.has(60)).toBe(true);
  });

  test("does not mark notes far from hit line as active", () => {
    // Note at t=10, duration=1 → plays from 10 to 11
    // currentTime=5 → note is still far above
    const song = makeSong([{ notes: [{ midi: 60, time: 10, duration: 1 }] }]);
    const vp = makeViewport({ currentTime: 5 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.has(60)).toBe(false);
  });

  test("clears active notes each frame", () => {
    const song = makeSong([{ notes: [{ midi: 60, time: 5, duration: 0.5 }] }]);

    // Frame 1: note is active
    renderer.update(song, makeViewport({ currentTime: 5.2 }));
    expect(renderer.activeNotes.has(60)).toBe(true);

    // Frame 2: note has passed
    renderer.update(song, makeViewport({ currentTime: 6.0 }));
    expect(renderer.activeNotes.has(60)).toBe(false);
  });

  test("handles multiple tracks with different active notes", () => {
    const song = makeSong([
      { notes: [{ midi: 60, time: 5, duration: 1 }] }, // Track 0
      { notes: [{ midi: 72, time: 5, duration: 1 }] }, // Track 1
    ]);
    const vp = makeViewport({ currentTime: 5.5 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.has(60)).toBe(true);
    expect(renderer.activeNotes.has(72)).toBe(true);
  });

  test("handles empty song with no tracks", () => {
    const song = makeSong([]);
    const vp = makeViewport({ currentTime: 0 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.size).toBe(0);
  });

  test("handles track with no notes", () => {
    const song = makeSong([{ notes: [] }]);
    const vp = makeViewport({ currentTime: 0 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.size).toBe(0);
  });

  test("positions sprites correctly based on note time and duration", () => {
    // Note at midi 60 (C4), time=0, duration=0.5
    // Viewport: height=600, pps=200, currentTime=0
    // screenY = 600 - (0 - 0)*200 = 600 (hit line)
    // h = 0.5 * 200 = 100
    // rectY = 600 - 100 = 500
    const song = makeSong([{ notes: [{ midi: 60, time: 0, duration: 0.5 }] }]);
    const vp = makeViewport({ currentTime: 0, height: 600, pps: 200 });

    renderer.update(song, vp);

    // Access the container's children to check sprite positioning
    const sprites = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children as {
      x: number;
      y: number;
      width: number;
      height: number;
      visible: boolean;
    }[];
    const visible = sprites.filter((s) => s.visible);
    expect(visible.length).toBe(1);
    expect(visible[0].y).toBe(500);
    expect(visible[0].height).toBe(100);
  });

  test("reuses sprites across frames for the same note", () => {
    const song = makeSong([{ notes: [{ midi: 60, time: 0, duration: 3 }] }]);

    // Frame 1
    renderer.update(song, makeViewport({ currentTime: 0 }));
    const containerChildren = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children;
    const count1 = containerChildren.length;

    // Frame 2 — same note still visible, pool should not grow
    renderer.update(song, makeViewport({ currentTime: 0.5 }));
    const count2 = containerChildren.length;
    expect(count2).toBe(count1);
  });

  test("releases sprites when notes leave viewport", () => {
    const song = makeSong([{ notes: [{ midi: 60, time: 0, duration: 0.1 }] }]);

    // Frame 1: note visible at currentTime=0
    renderer.update(song, makeViewport({ currentTime: 0 }));
    const sprites = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children as {
      visible: boolean;
    }[];
    const visibleCount1 = sprites.filter((s) => s.visible).length;
    expect(visibleCount1).toBe(1);

    // Frame 2: note has scrolled past (currentTime=10, well past the note)
    renderer.update(song, makeViewport({ currentTime: 10 }));
    const visibleCount2 = sprites.filter((s) => s.visible).length;
    expect(visibleCount2).toBe(0);
  });

  test("assigns different tint colors to different tracks", () => {
    const song = makeSong([
      { notes: [{ midi: 60, time: 0, duration: 1 }] },
      { notes: [{ midi: 72, time: 0, duration: 1 }] },
    ]);
    const vp = makeViewport({ currentTime: 0 });

    renderer.update(song, vp);

    const sprites = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children as {
      visible: boolean;
      tint: number;
    }[];
    const visible = sprites.filter((s) => s.visible);
    expect(visible.length).toBe(2);
    // Track 0 and Track 1 should have different colors
    const tints = new Set(visible.map((s) => s.tint));
    expect(tints.size).toBe(2);
  });

  test("skips notes with MIDI values outside piano range (21-108)", () => {
    // MIDI 20 is below A0, MIDI 109 is above C8 — no keyPositions for these
    const song = makeSong([
      {
        notes: [
          { midi: 20, time: 0, duration: 1 },
          { midi: 60, time: 0, duration: 1 },
          { midi: 109, time: 0, duration: 1 },
        ],
      },
    ]);
    const vp = makeViewport({ currentTime: 0 });

    renderer.update(song, vp);

    const sprites = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children as {
      visible: boolean;
    }[];
    const visible = sprites.filter((s) => s.visible);
    // Only midi 60 should render; 20 and 109 are out of range
    expect(visible.length).toBe(1);
  });

  test("detects notes that just passed the hit line (within grace period)", () => {
    // Note at t=5, duration=0.5 → ends at 5.5
    // currentTime=5.53 → note ended 30ms ago, within 50ms grace window
    const song = makeSong([{ notes: [{ midi: 60, time: 5, duration: 0.5 }] }]);
    const vp = makeViewport({ currentTime: 5.53 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.has(60)).toBe(true);
  });

  test("does not detect notes beyond the grace period", () => {
    // Note at t=5, duration=0.5 → ends at 5.5
    // currentTime=5.6 → note ended 100ms ago, beyond 50ms grace window
    const song = makeSong([{ notes: [{ midi: 60, time: 5, duration: 0.5 }] }]);
    const vp = makeViewport({ currentTime: 5.6 });

    renderer.update(song, vp);

    expect(renderer.activeNotes.has(60)).toBe(false);
  });

  test("enforces minimum 2px height for very short notes", () => {
    // duration=0.001 at pps=200 → h = 0.2px, should clamp to 2
    const song = makeSong([
      { notes: [{ midi: 60, time: 0, duration: 0.001 }] },
    ]);
    const vp = makeViewport({ currentTime: 0, pps: 200 });

    renderer.update(song, vp);

    const sprites = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children as {
      visible: boolean;
      height: number;
    }[];
    const visible = sprites.filter((s) => s.visible);
    expect(visible.length).toBe(1);
    expect(visible[0].height).toBe(2);
  });

  test("destroy cleans up resources", () => {
    renderer.destroy();
    expect(renderer.activeNotes.size).toBe(0);
  });

  test("resize updates key positions without error", () => {
    expect(() => renderer.resize(800)).not.toThrow();
  });

  test("handles duplicate notes at same track/midi/time (last one wins)", () => {
    // Two notes at exact same midi and time on the same track — noteKey collides.
    // The second note's sprite should overwrite the first in nextActive.
    // Only one sprite should be visible (no duplicates, no crash).
    const song = makeSong([
      {
        notes: [
          { midi: 60, time: 1, duration: 0.5 },
          { midi: 60, time: 1, duration: 1.0 },
        ],
      },
    ]);
    const vp = makeViewport({ currentTime: 1 });

    renderer.update(song, vp);

    const sprites = (
      parent as unknown as { children: { children: unknown[] }[] }
    ).children[0].children as {
      visible: boolean;
      height: number;
    }[];
    const visible = sprites.filter((s) => s.visible);
    // Both notes share the same key, so only one sprite is used
    expect(visible.length).toBe(1);
    // The second note (duration=1.0) overwrites the first, so height = max(1.0 * 200, 2) = 200
    expect(visible[0].height).toBe(200);
  });

  // ── Practice mode visual feedback tests ──

  describe("flashHit", () => {
    test("modifies sprite tint toward white on first animation frame", () => {
      // Provide a fake rAF that invokes callback immediately
      let rafCb: ((time: number) => void) | null = null;
      vi.stubGlobal("requestAnimationFrame", (cb: (time: number) => void) => {
        rafCb = cb;
        return 0;
      });

      const song = makeSong([{ notes: [{ midi: 60, time: 0, duration: 1 }] }]);
      renderer.update(song, makeViewport({ currentTime: 0 }));

      const sprites = (
        parent as unknown as { children: { children: unknown[] }[] }
      ).children[0].children as {
        visible: boolean;
        tint: number;
        alpha: number;
      }[];
      const sprite = sprites.find((s) => s.visible)!;
      const originalTint = sprite.tint;

      renderer.flashHit(sprite as unknown as Sprite);
      // First rAF registers; fire it at t=0
      expect(rafCb).not.toBeNull();
      rafCb!(0);
      // Second rAF is queued; fire it partway through animation
      rafCb!(60); // 60ms into 200ms animation — in the flash-up phase (t<0.3 → t/0.3 = 1.0)

      // Tint should have shifted toward white
      expect(sprite.tint).not.toBe(originalTint);

      vi.unstubAllGlobals();
    });
  });

  describe("markMiss", () => {
    test("transitions sprite tint toward gray and reduces alpha", () => {
      let rafCb: ((time: number) => void) | null = null;
      vi.stubGlobal("requestAnimationFrame", (cb: (time: number) => void) => {
        rafCb = cb;
        return 0;
      });

      const song = makeSong([{ notes: [{ midi: 60, time: 0, duration: 1 }] }]);
      renderer.update(song, makeViewport({ currentTime: 0 }));

      const sprites = (
        parent as unknown as { children: { children: unknown[] }[] }
      ).children[0].children as {
        visible: boolean;
        tint: number;
        alpha: number;
      }[];
      const sprite = sprites.find((s) => s.visible)!;
      const originalAlpha = sprite.alpha;

      renderer.markMiss(sprite as unknown as Sprite);
      expect(rafCb).not.toBeNull();
      // Fire first frame at t=0
      rafCb!(0);
      // Fire at end of animation (150ms)
      rafCb!(150);

      // At the end, tint should be 0x888888 and alpha ~0.4
      expect(sprite.tint).toBe(0x888888);
      expect(sprite.alpha).toBeCloseTo(0.4, 1);
      // Alpha decreased from original
      expect(sprite.alpha).toBeLessThan(originalAlpha);

      vi.unstubAllGlobals();
    });
  });

  describe("showCombo", () => {
    test("adds a Text child to the container and removes it after animation", () => {
      const calls: ((time: number) => void)[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: (time: number) => void) => {
        calls.push(cb);
        return 0;
      });

      const containerChildren = (
        parent as unknown as { children: { children: unknown[] }[] }
      ).children[0].children;

      const countBefore = containerChildren.length;
      renderer.showCombo(5, 100, 200);

      // A Text object was added to the container
      expect(containerChildren.length).toBe(countBefore + 1);
      const textObj = containerChildren[containerChildren.length - 1] as {
        text: string;
        alpha: number;
      };
      expect(textObj.text).toBe("5x");

      // Run animation to completion
      // First call registers the tick
      calls[0](0); // start
      calls[1](600); // end

      // Text removed after animation completes
      expect(containerChildren.length).toBe(countBefore);

      vi.unstubAllGlobals();
    });
  });
});
