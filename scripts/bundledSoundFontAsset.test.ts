import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, test, vi } from "vitest";
import { SoundFont2 } from "soundfont2";
import { SoundFontLoader } from "../src/renderer/src/engines/audio/SoundFontLoader";

const EXPECTED_SF2_SIZE_BYTES = 9_456_310;
const EXPECTED_SF2_SHA256 =
  "cf2a98eb38a32c4954b4b6e2caae4112d62dd8e892eceefdd7942b0e7d01ac2f";

const PIANO_MIN = 21;
const PIANO_MAX = 108;

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

function createMockAudioContext(): AudioContext {
  return {
    sampleRate: 44_100,
    createBuffer: vi.fn(
      (channels: number, length: number, sampleRate: number) => {
        return {
          length,
          sampleRate,
          duration: length / sampleRate,
          numberOfChannels: channels,
          getChannelData: vi.fn(() => new Float32Array(length)),
          copyFromChannel: vi.fn(),
          copyToChannel: vi.fn(),
        } as unknown as AudioBuffer;
      },
    ),
  } as unknown as AudioContext;
}

describe("bundled piano SoundFont asset", () => {
  test("matches the validated FreePats Upright Piano KW replacement", () => {
    const data = readFileSync(resolve(process.cwd(), "resources", "piano.sf2"));

    expect(data.length).toBe(EXPECTED_SF2_SIZE_BYTES);
    expect(sha256(data)).toBe(EXPECTED_SF2_SHA256);

    const sf2 = new SoundFont2(new Uint8Array(data));
    expect(sf2.presets[0]?.header).toMatchObject({
      bank: 0,
      preset: 0,
      name: "Upright piano KW",
    });

    const missingPianoKeys: number[] = [];

    for (let midi = PIANO_MIN; midi <= PIANO_MAX; midi++) {
      const keyData = sf2.getKeyData(midi, 0, 0);
      if (!keyData || keyData.sample.header.sampleRate === 0) {
        missingPianoKeys.push(midi);
      }
    }

    expect(missingPianoKeys).toEqual([]);
  });

  test("loads through the app SoundFontLoader path without synthesis fallback", async () => {
    const data = readFileSync(resolve(process.cwd(), "resources", "piano.sf2"));
    const audioContext = createMockAudioContext();
    const loader = new SoundFontLoader();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await loader.load(toArrayBuffer(data), audioContext);

      expect(loader.isLoaded).toBe(true);
      for (let midi = PIANO_MIN; midi <= PIANO_MAX; midi++) {
        expect(loader.getSample(midi)).toBeDefined();
      }
      expect(audioContext.createBuffer).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalledWith(
        "SoundFontLoader: SF2 parsing failed, falling back to synthesis",
        expect.anything(),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
