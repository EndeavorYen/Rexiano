// @ts-nocheck
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundFontLoader } from "./SoundFontLoader";

// ─── Mock soundfont2 library ─────────────────────
// The source uses `new SoundFont2(uint8)` so we need a class-like mock.

/**
 * Configurable behaviors for the mock:
 * - "throw": constructor throws (simulates corrupt SF2)
 * - "empty": constructor succeeds, getKeyData returns null for all keys
 * - "preset0": constructor succeeds, getKeyData returns data for preset 0 (only a few keys)
 * - "preset0-fallback": constructor succeeds, preset 0 has no data, but another preset does
 */
let sf2ConstructorBehavior: "throw" | "empty" | "preset0" | "preset0-fallback" =
  "throw";

/** Which MIDI keys return data in "preset0" mode (sparse — tests _fillGaps) */
const PRESET0_KEYS = new Set([60, 72]); // Only C4 and C5

/** For the fallback preset search test */
const FALLBACK_PRESET = 5;
const FALLBACK_KEYS = new Set([60]);

vi.mock("soundfont2", () => {
  return {
    SoundFont2: class MockSoundFont2 {
      presets: Array<{ header: { bank: number; preset: number } }> = [];

      constructor() {
        if (sf2ConstructorBehavior === "throw") {
          throw new Error("mock SF2 parse failure");
        }
        if (sf2ConstructorBehavior === "preset0-fallback") {
          // Bank 0, preset 0 = no data; bank 0, preset 5 = has data
          this.presets = [
            { header: { bank: 0, preset: 0 } },
            { header: { bank: 0, preset: FALLBACK_PRESET } },
            { header: { bank: 1, preset: 10 } }, // bank 1 — should be skipped
          ];
        }
      }

      getKeyData(
        midi: number,
        bank: number,
        preset: number,
      ): {
        sample: {
          data: Int16Array;
          header: { sampleRate: number; originalPitch: number };
        };
        generators: Record<number, { value: number }>;
      } | null {
        if (sf2ConstructorBehavior === "empty") {
          return null;
        }

        if (sf2ConstructorBehavior === "preset0") {
          if (bank === 0 && preset === 0 && PRESET0_KEYS.has(midi)) {
            return {
              sample: {
                data: new Int16Array([0, 16384, 32767, -32768, -16384, 0]),
                header: { sampleRate: 22050, originalPitch: midi },
              },
              generators: {},
            };
          }
          return null;
        }

        if (sf2ConstructorBehavior === "preset0-fallback") {
          // Preset 0 returns nothing; only the fallback preset returns data
          if (
            bank === 0 &&
            preset === FALLBACK_PRESET &&
            FALLBACK_KEYS.has(midi)
          ) {
            return {
              sample: {
                data: new Int16Array([0, 8000, 16000, -8000, 0]),
                header: { sampleRate: 44100, originalPitch: midi },
              },
              generators: {
                // Generator 58 = OverridingRootKey
                58: { value: midi },
                // Generator 51 = CoarseTune (+2 semitones)
                51: { value: 2 },
                // Generator 52 = FineTune (+50 cents)
                52: { value: 50 },
              },
            };
          }
          return null;
        }

        return null;
      }
    },

    // Re-export GeneratorType enum values used by the source
    GeneratorType: {
      OverridingRootKey: 58,
      CoarseTune: 51,
      FineTune: 52,
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

  // ─── SF2 success path: _parseSF2 with direct samples ───────
  describe("SF2 parsing — preset 0 success path", () => {
    test("loads samples from SF2 preset 0 for keys that have data", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      expect(loader.isLoaded).toBe(true);
      // Keys 60 and 72 have direct samples
      const sample60 = loader.getSample(60);
      expect(sample60).toBeDefined();
      expect(sample60!.midi).toBe(60);
      expect(sample60!.sampleRate).toBe(22050); // from mock header

      const sample72 = loader.getSample(72);
      expect(sample72).toBeDefined();
      expect(sample72!.midi).toBe(72);
    });

    test("_int16ToAudioBuffer converts Int16 PCM data to AudioBuffer via createBuffer", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      // createBuffer should have been called for each direct sample (2 keys: 60, 72)
      const createBuffer = ctx.createBuffer as ReturnType<typeof vi.fn>;
      // The mock returns data with 6 Int16 samples, so length=6
      const calls = createBuffer.mock.calls.filter(
        // Filter for calls with sampleRate=22050 (the SF2 mock sample rate)
        (c: [number, number, number]) => c[2] === 22050,
      );
      expect(calls.length).toBe(2); // one for key 60, one for key 72
      // Each call: createBuffer(1, 6, 22050)
      expect(calls[0]).toEqual([1, 6, 22050]);
    });

    test("basePitch falls back to originalPitch when no OverridingRootKey generator", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      // No generators set → basePitch = originalPitch = midi
      const sample60 = loader.getSample(60);
      expect(sample60!.basePitch).toBe(60);
    });
  });

  // ─── _fillGaps: fills missing piano keys with nearest neighbor ───
  describe("_fillGaps — nearest neighbor interpolation", () => {
    test("fills missing keys between two direct samples", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      // Keys 60 and 72 have direct samples; intermediate keys should be filled
      const sample65 = loader.getSample(65);
      expect(sample65).toBeDefined();
      expect(sample65!.midi).toBe(65); // midi field set to the gap key

      // Key 65 is closer to 60 than 72, so its buffer should come from the 60 sample
      const sample60 = loader.getSample(60);
      expect(sample65!.buffer).toBe(sample60!.buffer);
      expect(sample65!.basePitch).toBe(sample60!.basePitch);
    });

    test("fills keys below the lowest direct sample", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      // Key 21 (A0) should be filled from key 60 (the nearest direct sample below)
      const sample21 = loader.getSample(21);
      expect(sample21).toBeDefined();
      expect(sample21!.midi).toBe(21);
      // Should use the nearest direct sample's buffer (key 60)
      const sample60 = loader.getSample(60);
      expect(sample21!.buffer).toBe(sample60!.buffer);
    });

    test("fills keys above the highest direct sample", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      // Key 108 (C8) should be filled from key 72 (the nearest direct sample above)
      const sample108 = loader.getSample(108);
      expect(sample108).toBeDefined();
      expect(sample108!.midi).toBe(108);
      const sample72 = loader.getSample(72);
      expect(sample108!.buffer).toBe(sample72!.buffer);
    });

    test("all piano keys are populated after fillGaps", async () => {
      sf2ConstructorBehavior = "preset0";

      await loader.load(new ArrayBuffer(10), ctx);

      for (let midi = 21; midi <= 108; midi++) {
        expect(loader.getSample(midi)).toBeDefined();
      }
    });
  });

  // ─── Fallback preset search ────────────────────────
  describe("SF2 parsing — fallback preset search", () => {
    test("finds samples from a non-zero preset when preset 0 has no data", async () => {
      sf2ConstructorBehavior = "preset0-fallback";

      await loader.load(new ArrayBuffer(10), ctx);

      expect(loader.isLoaded).toBe(true);
      // Key 60 should be loaded from the fallback preset
      const sample60 = loader.getSample(60);
      expect(sample60).toBeDefined();
      expect(sample60!.midi).toBe(60);
      // sampleRate from fallback mock is 44100
      expect(sample60!.sampleRate).toBe(44100);
    });

    test("applies generator offsets (OverridingRootKey, CoarseTune, FineTune) to basePitch", async () => {
      sf2ConstructorBehavior = "preset0-fallback";

      await loader.load(new ArrayBuffer(10), ctx);

      const sample60 = loader.getSample(60);
      expect(sample60).toBeDefined();
      // From mock generators: OverridingRootKey=60, CoarseTune=2, FineTune=50
      // basePitch = rootKey - coarseTune - fineTune/100 = 60 - 2 - 0.5 = 57.5
      expect(sample60!.basePitch).toBe(57.5);
    });

    test("fills all piano keys via _fillGaps after fallback preset loads", async () => {
      sf2ConstructorBehavior = "preset0-fallback";

      await loader.load(new ArrayBuffer(10), ctx);

      // Only key 60 has a direct sample, but all piano keys should be filled
      for (let midi = 21; midi <= 108; midi++) {
        expect(loader.getSample(midi)).toBeDefined();
      }
    });
  });
});
