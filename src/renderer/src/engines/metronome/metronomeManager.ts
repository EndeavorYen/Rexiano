// ─── metronomeManager.ts — Module-level singleton for MetronomeEngine ───
//
// Same pattern as practiceManager.ts.
// Holds a single MetronomeEngine instance. The engine is initialised once
// the AudioContext is available (i.e. after AudioEngine.init()).

import { MetronomeEngine } from "./MetronomeEngine";

let _engine: MetronomeEngine | null = null;

/**
 * Initialise the metronome singleton.
 * Safe to call multiple times — only the first call creates the instance.
 * @param audioContext The AudioContext for scheduling
 * @param destination  Audio node to route clicks through (e.g. master GainNode)
 */
export function initMetronome(
  audioContext: AudioContext,
  destination?: AudioNode,
): MetronomeEngine {
  if (_engine && _engine.audioContext !== audioContext) {
    _engine.dispose();
    _engine = null;
  }
  if (!_engine) {
    _engine = new MetronomeEngine(audioContext, destination);
  }
  return _engine;
}

/** Return the singleton (may be null before init). */
export function getMetronome(): MetronomeEngine | null {
  return _engine;
}

/** Dispose and clear the singleton. */
export function disposeMetronome(): void {
  _engine?.dispose();
  _engine = null;
}
