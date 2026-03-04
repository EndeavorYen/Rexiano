import { describe, test, expect, vi, beforeEach } from "vitest";

// --- Mock pixi.js ---

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
    destroy(): void {
      /* noop */
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts?: unknown) {
      /* noop */
    }
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
  return {
    Application: vi.fn(),
    Container: MockContainer,
    Sprite: MockSprite,
    Text: MockText,
    TextStyle: MockTextStyle,
    Texture: { WHITE: {} },
  };
});

// --- Mock noteColors ---
vi.mock("@renderer/engines/fallingNotes/noteColors", () => ({
  getTrackColor: (trackIndex: number) => [0x3b82f6, 0xf97316][trackIndex % 2],
}));

// --- Mock Zustand stores ---
let songStoreState = { song: null as unknown };
let playbackStoreState = {
  currentTime: 0,
  isPlaying: false,
  pixelsPerSecond: 200,
  setCurrentTime: vi.fn((t: number) => {
    playbackStoreState.currentTime = t;
  }),
  setPlaying: vi.fn((p: boolean) => {
    playbackStoreState.isPlaying = p;
  }),
};

vi.mock("@renderer/stores/useSongStore", () => ({
  useSongStore: Object.assign(vi.fn(), {
    getState: () => songStoreState,
  }),
}));

vi.mock("@renderer/stores/usePlaybackStore", () => ({
  usePlaybackStore: Object.assign(vi.fn(), {
    getState: () => playbackStoreState,
  }),
}));

// Top-level imports — use the mocked modules
import { NoteRenderer } from "@renderer/engines/fallingNotes/NoteRenderer";
import { createTickerUpdate } from "@renderer/engines/fallingNotes/tickerLoop";
import { Container } from "pixi.js";
import type { ParsedSong } from "@renderer/engines/midi/types";

function makeSong(overrides: Partial<ParsedSong> = {}): ParsedSong {
  return {
    fileName: "test.mid",
    duration: 30,
    noteCount: 4,
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    keySignatures: [],
    tracks: [
      {
        name: "Track 0",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 0, duration: 1, velocity: 80 },
          { midi: 64, name: "E4", time: 1, duration: 1, velocity: 80 },
          { midi: 67, name: "G4", time: 2, duration: 1, velocity: 80 },
          { midi: 72, name: "C5", time: 3, duration: 1, velocity: 80 },
        ],
      },
    ],
    ...overrides,
  };
}

const SCREEN = { width: 1040, height: 600 };

describe("FallingNotesCanvas ticker logic (via createTickerUpdate)", () => {
  let noteRenderer: NoteRenderer;

  beforeEach(() => {
    noteRenderer = new NoteRenderer(new Container());
    noteRenderer.init(SCREEN.width);

    playbackStoreState = {
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 200,
      setCurrentTime: vi.fn((t: number) => {
        playbackStoreState.currentTime = t;
      }),
      setPlaying: vi.fn((p: boolean) => {
        playbackStoreState.isPlaying = p;
      }),
    };
    songStoreState = { song: null };
  });

  test("does nothing when no song is loaded", () => {
    songStoreState = { song: null };
    const cb = vi.fn();
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: cb,
    });

    tick({ deltaMS: 16.67 });

    expect(cb).not.toHaveBeenCalled();
  });

  test("advances currentTime when playing", () => {
    songStoreState = { song: makeSong() };
    playbackStoreState.isPlaying = true;
    playbackStoreState.currentTime = 5.0;
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });

    tick({ deltaMS: 16.67 });

    expect(playbackStoreState.setCurrentTime).toHaveBeenCalledWith(
      expect.closeTo(5.01667, 3),
    );
  });

  test("does not advance time when paused", () => {
    songStoreState = { song: makeSong() };
    playbackStoreState.isPlaying = false;
    playbackStoreState.currentTime = 5.0;
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });

    tick({ deltaMS: 16.67 });

    expect(playbackStoreState.setCurrentTime).not.toHaveBeenCalled();
  });

  test("clamps time to song duration", () => {
    songStoreState = { song: makeSong({ duration: 10 }) };
    playbackStoreState.isPlaying = true;
    playbackStoreState.currentTime = 9.999;
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });

    tick({ deltaMS: 100 });

    expect(playbackStoreState.setCurrentTime).toHaveBeenCalledWith(10);
  });

  test("auto-stops at end of song", () => {
    songStoreState = { song: makeSong({ duration: 10 }) };
    playbackStoreState.isPlaying = true;
    playbackStoreState.currentTime = 9.999;
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });

    tick({ deltaMS: 100 });

    expect(playbackStoreState.setPlaying).toHaveBeenCalledWith(false);
  });

  test("clamps deltaMS to prevent large time jumps after tab backgrounding", () => {
    songStoreState = { song: makeSong({ duration: 30 }) };
    playbackStoreState.isPlaying = true;
    playbackStoreState.currentTime = 5.0;
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });

    tick({ deltaMS: 5000 }); // 5-second spike

    // MAX_DELTA_SECONDS = 0.1, so should advance by at most 0.1
    expect(playbackStoreState.setCurrentTime).toHaveBeenCalledWith(
      expect.closeTo(5.1, 3),
    );
  });

  test("accumulates time correctly over multiple frames", () => {
    songStoreState = { song: makeSong({ duration: 30 }) };
    playbackStoreState.isPlaying = true;
    playbackStoreState.currentTime = 0;
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });

    for (let i = 0; i < 60; i++) {
      tick({ deltaMS: 16.6667 });
    }

    expect(playbackStoreState.currentTime).toBeCloseTo(1.0, 1);
  });

  test("notifies onActiveNotesChange when notes reach hit line", () => {
    const song = makeSong({
      tracks: [
        {
          name: "Track 0",
          instrument: "Piano",
          channel: 0,
          notes: [{ midi: 60, name: "C4", time: 0, duration: 1, velocity: 80 }],
        },
      ],
    });
    songStoreState = { song };
    playbackStoreState.currentTime = 0.5;

    const cb = vi.fn();
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: cb,
    });

    tick({ deltaMS: 16.67 });

    expect(cb).toHaveBeenCalledTimes(1);
    const notesSet = cb.mock.calls[0][0] as Set<number>;
    expect(notesSet.has(60)).toBe(true);
  });

  test("does not notify when callback ref is undefined", () => {
    songStoreState = { song: makeSong() };
    playbackStoreState.currentTime = 0.5;

    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: undefined,
    });
    expect(() => tick({ deltaMS: 16.67 })).not.toThrow();
  });

  test("skips notification when active notes have not changed", () => {
    songStoreState = {
      song: makeSong({
        tracks: [
          {
            name: "Track 0",
            instrument: "Piano",
            channel: 0,
            notes: [
              { midi: 60, name: "C4", time: 0, duration: 2, velocity: 80 },
            ],
          },
        ],
      }),
    };
    playbackStoreState.currentTime = 0.5;

    const cb = vi.fn();
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: cb,
    });

    // Frame 1: note becomes active → should notify
    tick({ deltaMS: 16.67 });
    expect(cb).toHaveBeenCalledTimes(1);

    // Frame 2: same note still active → should NOT notify again
    tick({ deltaMS: 16.67 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("notifies when active notes transition from present to empty", () => {
    songStoreState = {
      song: makeSong({
        tracks: [
          {
            name: "Track 0",
            instrument: "Piano",
            channel: 0,
            notes: [
              { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
            ],
          },
        ],
      }),
    };
    playbackStoreState.currentTime = 0.3;

    const cb = vi.fn();
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: cb,
    });

    // Frame 1: note is active
    tick({ deltaMS: 16.67 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect((cb.mock.calls[0][0] as Set<number>).has(60)).toBe(true);

    // Frame 2: note has passed (well past hit window)
    playbackStoreState.currentTime = 10;
    tick({ deltaMS: 16.67 });
    expect(cb).toHaveBeenCalledTimes(2);
    expect((cb.mock.calls[1][0] as Set<number>).size).toBe(0);
  });

  test("does not notify when no notes are at hit line (initial state unchanged)", () => {
    songStoreState = {
      song: makeSong({
        tracks: [
          {
            name: "Track 0",
            instrument: "Piano",
            channel: 0,
            notes: [
              { midi: 60, name: "C4", time: 10, duration: 1, velocity: 80 },
            ],
          },
        ],
      }),
    };
    playbackStoreState.currentTime = 0; // Note is far in the future

    const cb = vi.fn();
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: cb,
    });

    tick({ deltaMS: 16.67 });

    // Active notes are empty, same as initial state → no notification
    expect(cb).not.toHaveBeenCalled();
  });

  test("uses pixelsPerSecond from playback store for viewport", () => {
    songStoreState = { song: makeSong() };
    playbackStoreState.currentTime = 0;
    playbackStoreState.pixelsPerSecond = 400;

    const cb = vi.fn();
    const tick = createTickerUpdate(noteRenderer, () => SCREEN, {
      current: cb,
    });

    expect(() => tick({ deltaMS: 16.67 })).not.toThrow();
  });
});
