import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundFontLoader } from "./SoundFontLoader";

// ─── Mock soundfont2 library ─────────────────────
// The source uses `new SoundFont2(uint8)` so we need a class-like mock.

let sf2ConstructorBehavior: "throw" | "empty" = "throw";

vi.mock("soundfont2", () => {
  return {
    SoundFont2: class MockSoundFont2 {
      presets: Array<{ header: { bank: number; preset: number } }> = [];
      constructor() {
        if (sf2ConstructorBehavior === "throw") {
          throw new Error("mock SF2 parse failure");
        }
      }
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      getKeyData() {
        return null;
      }
    },
  };
});

// ─── Mock Web Audio API ──────────────────────────

function createMockAudioContext(): AudioContext {
  const mockBuffer = {
    length: 1000,
    sampleRate: 44100,
    duration: 1,
    numberOfChannels: 1,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1000)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;

  return {
    sampleRate: 44100,
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
  } as unknown as AudioContext;
}

// ─── Tests ───────────────────────────────────────

describe("SoundFontLoader", () => {
  let loader: SoundFontLoader;
  let ctx: AudioContext;

  beforeEach(() => {
    loader = new SoundFontLoader();
    ctx = createMockAudioContext();
    sf2ConstructorBehavior = "throw"; // default: SF2 parsing fails → synth fallback
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    test("isLoaded is false initially", () => {
      expect(loader.isLoaded).toBe(false);
    });

    test("getSample returns undefined when not loaded", () => {
      expect(loader.getSample(60)).toBeUndefined();
      expect(loader.getSample(0)).toBeUndefined();
      expect(loader.getSample(127)).toBeUndefined();
    });
  });

  describe("dispose", () => {
    test("clears samples map", () => {
      loader.dispose();
      expect(loader.isLoaded).toBe(false);
    });

    test("getSample returns undefined after dispose", () => {
      loader.dispose();
      expect(loader.getSample(60)).toBeUndefined();
    });

    test("dispose is safe to call multiple times", () => {
      loader.dispose();
      loader.dispose();
      expect(loader.isLoaded).toBe(false);
    });
  });

  describe("load with string source (IPC)", () => {
    test("calls window.api.loadSoundFont when source is a string", async () => {
      const mockLoadSoundFont = vi.fn().mockResolvedValue({
        data: Array.from(new Uint8Array(100)),
      });
      vi.stubGlobal("window", {
        api: { loadSoundFont: mockLoadSoundFont },
      });

      await loader.load("path/to/soundfont.sf2", ctx);

      expect(mockLoadSoundFont).toHaveBeenCalledWith("path/to/soundfont.sf2");
      // Fallback to synth means samples are generated
      expect(loader.isLoaded).toBe(true);
    });

    test("falls back to synth when IPC returns null", async () => {
      vi.stubGlobal("window", {
        api: { loadSoundFont: vi.fn().mockResolvedValue(null) },
      });

      await loader.load("nonexistent.sf2", ctx);

      // Should still have samples (synth fallback)
      expect(loader.isLoaded).toBe(true);
      // Piano range A0 (21) to C8 (108)
      expect(loader.getSample(60)).toBeDefined();
    });
  });

  describe("load with ArrayBuffer source", () => {
    test("falls back to synth when SF2 parsing fails", async () => {
      const buffer = new ArrayBuffer(100);
      await loader.load(buffer, ctx);

      // Synth fallback should produce samples
      expect(loader.isLoaded).toBe(true);
      expect(loader.getSample(60)).toBeDefined();
    });

    test("falls back to synth when SF2 has no usable samples", async () => {
      // SF2 constructor succeeds but getKeyData returns null for all keys
      sf2ConstructorBehavior = "empty";

      const buffer = new ArrayBuffer(100);
      await loader.load(buffer, ctx);

      // Should still be loaded via synth fallback
      expect(loader.isLoaded).toBe(true);
      expect(loader.getSample(60)).toBeDefined();
    });
  });

  describe("synth fallback samples", () => {
    test("generates samples for full piano range (MIDI 21-108)", async () => {
      await loader.load(new ArrayBuffer(10), ctx);

      // Every piano key should have a sample
      for (let midi = 21; midi <= 108; midi++) {
        expect(loader.getSample(midi)).toBeDefined();
      }
    });

    test("does not generate samples outside piano range", async () => {
      await loader.load(new ArrayBuffer(10), ctx);

      expect(loader.getSample(20)).toBeUndefined();
      expect(loader.getSample(109)).toBeUndefined();
    });

    test("synth samples have correct structure", async () => {
      await loader.load(new ArrayBuffer(10), ctx);

      const sample = loader.getSample(60);
      expect(sample).toBeDefined();
      expect(sample!.midi).toBe(60);
      expect(sample!.sampleRate).toBe(44100); // ctx.sampleRate
      expect(sample!.basePitch).toBe(60); // synth uses exact pitch
      expect(sample!.buffer).toBeDefined();
    });
  });

  describe("dispose after load", () => {
    test("clears all samples after load", async () => {
      await loader.load(new ArrayBuffer(10), ctx);
      expect(loader.isLoaded).toBe(true);

      loader.dispose();
      expect(loader.isLoaded).toBe(false);
      expect(loader.getSample(60)).toBeUndefined();
    });
  });

  describe("load replaces previous samples", () => {
    test("calling load again clears old samples first", async () => {
      await loader.load(new ArrayBuffer(10), ctx);
      const firstSample = loader.getSample(60);

      await loader.load(new ArrayBuffer(10), ctx);
      const secondSample = loader.getSample(60);

      // Both should exist (synth fallback regenerates)
      expect(firstSample).toBeDefined();
      expect(secondSample).toBeDefined();
    });
  });
});
