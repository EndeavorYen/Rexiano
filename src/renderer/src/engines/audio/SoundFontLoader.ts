// ─── Phase 4: SoundFontLoader — SF2 parsing & sample management ───
//
// Responsibilities:
// - Parse SF2 binary format using soundfont2 library
// - Decode audio data into Web Audio AudioBuffers
// - Provide O(1) lookup: MIDI note number → AudioBuffer
// - Fallback to oscillator-based synthesis if no SF2 available
//
// SoundFont strategy (from DESIGN.md):
// - Default: lightweight piano SF2 (~5MB) bundled in resources/
// - SF2 loaded from Electron resources/ dir via IPC
// - Fallback: generate sine-based piano tones for all 88 keys

import { SoundFont2, GeneratorType } from "soundfont2";
import type { Generator } from "soundfont2";
import type { ISoundFontLoader, NoteSample } from "./types";

/** Piano key range: A0 (21) to C8 (108) */
const PIANO_MIN = 21;
const PIANO_MAX = 108;

export class SoundFontLoader implements ISoundFontLoader {
  /** Map of MIDI note number → decoded sample */
  private _samples = new Map<number, NoteSample>();

  get isLoaded(): boolean {
    return this._samples.size > 0;
  }

  async load(
    source: string | ArrayBuffer,
    audioContext: AudioContext,
  ): Promise<void> {
    this._samples.clear();

    let arrayBuffer: ArrayBuffer | null = null;

    if (typeof source === "string") {
      // Load via IPC from Electron main process
      const result = await window.api.loadSoundFont(source);
      if (result) {
        arrayBuffer = new Uint8Array(result.data).buffer;
      }
    } else {
      arrayBuffer = source;
    }

    if (arrayBuffer) {
      try {
        await this._parseSF2(arrayBuffer, audioContext);
        return;
      } catch (err) {
        console.warn(
          "SoundFontLoader: SF2 parsing failed, falling back to synthesis",
          err,
        );
      }
    }

    // Fallback: generate oscillator-based samples
    this._generateSynthSamples(audioContext);
  }

  getSample(midi: number): NoteSample | undefined {
    return this._samples.get(midi);
  }

  dispose(): void {
    this._samples.clear();
  }

  // ─── SF2 Parsing ─────────────────────────────────────

  /**
   * Compute the effective base pitch for a key, respecting SF2 generators.
   * Priority: OverridingRootKey > originalPitch > target midi number.
   * CoarseTune (semitones) and FineTune (cents) are folded in so the
   * AudioEngine formula `2^((target - basePitch) / 12)` stays unchanged.
   */
  private static _effectiveBasePitch(
    generators: Partial<Record<GeneratorType, Generator | undefined>>,
    originalPitch: number,
    midi: number,
  ): number {
    // OverridingRootKey (generator #58) takes precedence over sample header
    const overrideGen = generators[GeneratorType.OverridingRootKey];
    const rootKey =
      overrideGen?.value != null && overrideGen.value >= 0
        ? overrideGen.value
        : originalPitch === 255
          ? midi
          : originalPitch;

    // Pitch offset generators (additive)
    const coarseTune = generators[GeneratorType.CoarseTune]?.value ?? 0;
    const fineTune = generators[GeneratorType.FineTune]?.value ?? 0;

    // Fold offsets into basePitch so AudioEngine's existing formula works:
    //   playbackRate = 2^((targetMidi - basePitch) / 12)
    // With tune:  2^((targetMidi - rootKey + coarseTune + fineTune/100) / 12)
    // → basePitch = rootKey - coarseTune - fineTune/100
    return rootKey - coarseTune - fineTune / 100;
  }

  private async _parseSF2(
    arrayBuffer: ArrayBuffer,
    audioContext: AudioContext,
  ): Promise<void> {
    const uint8 = new Uint8Array(arrayBuffer);
    const sf2 = new SoundFont2(uint8);

    // Collect which MIDI notes have direct samples from the SF2
    const directSamples = new Map<
      number,
      { data: Int16Array; sampleRate: number; basePitch: number }
    >();

    // Use getKeyData to find the best sample for each piano key
    // Bank 0, Preset 0 = Acoustic Grand Piano (General MIDI standard)
    for (let midi = PIANO_MIN; midi <= PIANO_MAX; midi++) {
      const keyData = sf2.getKeyData(midi, 0, 0);
      if (!keyData) continue;

      const sample = keyData.sample;
      const header = sample.header;

      // Skip EOS or ROM samples
      if (header.sampleRate === 0) continue;

      directSamples.set(midi, {
        data: sample.data,
        sampleRate: header.sampleRate,
        basePitch: SoundFontLoader._effectiveBasePitch(
          keyData.generators,
          header.originalPitch,
          midi,
        ),
      });
    }

    // If preset 0 had no samples, try iterating all presets to find a piano-like one
    if (directSamples.size === 0) {
      for (const preset of sf2.presets) {
        // Try bank 0, any preset that has data
        if (preset.header.bank !== 0) continue;
        for (let midi = PIANO_MIN; midi <= PIANO_MAX; midi++) {
          const keyData = sf2.getKeyData(
            midi,
            preset.header.bank,
            preset.header.preset,
          );
          if (!keyData) continue;

          const sample = keyData.sample;
          const header = sample.header;
          if (header.sampleRate === 0) continue;

          directSamples.set(midi, {
            data: sample.data,
            sampleRate: header.sampleRate,
            basePitch: SoundFontLoader._effectiveBasePitch(
              keyData.generators,
              header.originalPitch,
              midi,
            ),
          });
        }
        if (directSamples.size > 0) break;
      }
    }

    if (directSamples.size === 0) {
      throw new Error("No usable samples found in SF2");
    }

    // Convert Int16 PCM samples to AudioBuffers
    for (const [midi, raw] of directSamples) {
      const audioBuffer = this._int16ToAudioBuffer(
        raw.data,
        raw.sampleRate,
        audioContext,
      );
      this._samples.set(midi, {
        midi,
        buffer: audioBuffer,
        sampleRate: raw.sampleRate,
        basePitch: raw.basePitch,
      });
    }

    // Fill gaps: for any piano key without a direct sample, use nearest neighbor
    this._fillGaps();
  }

  /** Convert Int16Array PCM to a mono AudioBuffer with Float32 samples */
  private _int16ToAudioBuffer(
    int16Data: Int16Array,
    sampleRate: number,
    audioContext: AudioContext,
  ): AudioBuffer {
    const length = int16Data.length;
    const audioBuffer = audioContext.createBuffer(1, length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      // Int16 range [-32768, 32767] → Float32 range [-1.0, 1.0]
      channelData[i] = int16Data[i] / 32768;
    }

    return audioBuffer;
  }

  /** Fill missing piano keys by copying the nearest available sample */
  private _fillGaps(): void {
    for (let midi = PIANO_MIN; midi <= PIANO_MAX; midi++) {
      if (this._samples.has(midi)) continue;

      // Search outward for nearest sample
      let nearest: NoteSample | undefined;
      let minDist = Infinity;

      for (const [key, sample] of this._samples) {
        const dist = Math.abs(key - midi);
        if (dist < minDist) {
          minDist = dist;
          nearest = sample;
        }
      }

      if (nearest) {
        // Reuse the same AudioBuffer; pitch shift is handled by AudioEngine via playbackRate
        this._samples.set(midi, {
          midi,
          buffer: nearest.buffer,
          sampleRate: nearest.sampleRate,
          basePitch: nearest.basePitch,
        });
      }
    }
  }

  // ─── Oscillator Fallback ─────────────────────────────

  /** Generate simple piano-like tones using additive synthesis for all 88 keys */
  private _generateSynthSamples(audioContext: AudioContext): void {
    const sampleRate = audioContext.sampleRate;
    // Generate 2 seconds of audio per sample
    const duration = 2.0;
    const length = Math.floor(sampleRate * duration);

    for (let midi = PIANO_MIN; midi <= PIANO_MAX; midi++) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const audioBuffer = audioContext.createBuffer(1, length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // Exponential decay envelope
        const envelope = Math.exp(-t * 3.0);

        // Additive synthesis: fundamental + harmonics for a piano-like timbre
        let sample = 0;
        sample += Math.sin(2 * Math.PI * freq * t) * 1.0; // fundamental
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.5; // 2nd harmonic
        sample += Math.sin(2 * Math.PI * freq * 3 * t) * 0.25; // 3rd harmonic
        sample += Math.sin(2 * Math.PI * freq * 4 * t) * 0.125; // 4th harmonic
        sample += Math.sin(2 * Math.PI * freq * 6 * t) * 0.0625; // 6th harmonic

        // Normalize and apply envelope
        channelData[i] = sample * envelope * 0.4;
      }

      this._samples.set(midi, {
        midi,
        buffer: audioBuffer,
        sampleRate,
        basePitch: midi, // synth samples are pitched exactly
      });
    }
  }
}
