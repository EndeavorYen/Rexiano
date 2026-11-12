import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundFontLoader } from "./SoundFontLoader";
import {
  DEFAULT_SOUNDFONT,
  resetSoundFontWarmup,
  scheduleSoundFontWarmup,
  warmUpSoundFont,
} from "./soundFontWarmup";

// A minimal SF2 mock that yields one sample per piano key.
vi.mock("soundfont2", () => ({
  GeneratorType: { OverridingRootKey: 58, CoarseTune: 61, FineTune: 6 },
  SoundFont2: class MockSoundFont2 {
    presets: unknown[] = [];
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    getKeyData(midi: number) {
      return {
        sample: {
          data: new Int16Array([0, 40, -40, 80, -80]),
          header: { sampleRate: 8000, originalPitch: midi },
        },
        generators: {},
      };
    }
  },
}));

class FakeOfflineAudioContext {
  sampleRate = 44100;
  createBuffer(
    _channels: number,
    length: number,
    sampleRate: number,
  ): AudioBuffer {
    return {
      length,
      sampleRate,
      duration: length / sampleRate,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(length),
      copyFromChannel: () => undefined,
      copyToChannel: () => undefined,
    } as AudioBuffer;
  }
}

function liveAudioContext(): AudioContext {
  return {
    sampleRate: 44100,
    createBuffer: (channels: number, length: number, sampleRate: number) =>
      new FakeOfflineAudioContext().createBuffer(channels, length, sampleRate),
  } as unknown as AudioContext;
}

function stubWindow(loadSoundFont: ReturnType<typeof vi.fn>): void {
  vi.stubGlobal("window", {
    api: { loadSoundFont },
    OfflineAudioContext: FakeOfflineAudioContext,
  });
}

describe("soundFontWarmup", () => {
  beforeEach(() => {
    SoundFontLoader.clearSampleCache();
    resetSoundFontWarmup();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("warming up means the first song open does not read the SF2 again", async () => {
    const loadSoundFont = vi.fn().mockResolvedValue({
      fileName: DEFAULT_SOUNDFONT,
      data: Array.from(new Uint8Array(64)),
    });
    stubWindow(loadSoundFont);

    await warmUpSoundFont();

    const loader = new SoundFontLoader();
    await loader.load(DEFAULT_SOUNDFONT, liveAudioContext());

    expect(loadSoundFont).toHaveBeenCalledTimes(1);
    expect(loader.isLoaded).toBe(true);
    expect(loader.getSample(60)).toBeDefined();
  });

  test("concurrent warm-ups share a single SF2 read", async () => {
    const loadSoundFont = vi.fn().mockResolvedValue({
      fileName: DEFAULT_SOUNDFONT,
      data: Array.from(new Uint8Array(64)),
    });
    stubWindow(loadSoundFont);

    await Promise.all([warmUpSoundFont(), warmUpSoundFont()]);

    expect(loadSoundFont).toHaveBeenCalledTimes(1);
  });

  test("a failed warm-up is not cached, so the next attempt retries", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("offline"));
    stubWindow(failing);

    await warmUpSoundFont();

    expect(failing).toHaveBeenCalledTimes(1);

    stubWindow(
      vi.fn().mockResolvedValue({
        fileName: DEFAULT_SOUNDFONT,
        data: Array.from(new Uint8Array(64)),
      }),
    );
    await warmUpSoundFont();

    expect(failing).toHaveBeenCalledTimes(1);
    const loader = new SoundFontLoader();
    await loader.load(DEFAULT_SOUNDFONT, liveAudioContext());
    expect(loader.getSample(60)).toBeDefined();
  });

  test("scheduling defers the SF2 read to the idle callback and queues it once", async () => {
    const loadSoundFont = vi.fn().mockResolvedValue({
      fileName: DEFAULT_SOUNDFONT,
      data: Array.from(new Uint8Array(64)),
    });
    stubWindow(loadSoundFont);
    const queued: Array<() => void> = [];

    scheduleSoundFontWarmup(DEFAULT_SOUNDFONT, (run) => queued.push(run));
    scheduleSoundFontWarmup(DEFAULT_SOUNDFONT, (run) => queued.push(run));

    expect(loadSoundFont).not.toHaveBeenCalled();
    queued.forEach((run) => run());
    await warmUpSoundFont();

    expect(queued).toHaveLength(1);
    expect(loadSoundFont).toHaveBeenCalledTimes(1);
  });
});
