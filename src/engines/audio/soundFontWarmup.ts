// Phase 4: piano SoundFont warm-up — move the 9 MB SF2 read off the play path.
//
// Opening a song used to pay for fetching piano.sf2, boxing it into a
// 9 M-element `number[]` and parsing it before the first note could sound
// (~0.4 s in Chrome, more on phones). The decoded samples live in the
// SoundFontLoader cache, so warming it up while the app is idle makes the
// first song open as fast as the later ones.

import { SoundFontLoader } from "./SoundFontLoader";

/** Sound source shipped in `public/` and precached by the service worker. */
export const DEFAULT_SOUNDFONT = "piano.sf2";

let warmupPromise: Promise<void> | null = null;
let warmupScheduled = false;

/**
 * AudioBuffer is not bound to the context that created it, so the SF2 can be
 * decoded through an OfflineAudioContext before any user gesture exists.
 */
function idleAudioContext(): AudioContext | null {
  const OfflineCtor =
    window.OfflineAudioContext ??
    (
      window as unknown as {
        webkitOfflineAudioContext?: new (
          channels: number,
          length: number,
          sampleRate: number,
        ) => OfflineAudioContext;
      }
    ).webkitOfflineAudioContext;
  if (!OfflineCtor) return null;
  try {
    return new OfflineCtor(1, 1, 44_100) as unknown as AudioContext;
  } catch {
    return null;
  }
}

/** Decode the SoundFont once; later loads hit the shared sample cache. */
export function warmUpSoundFont(fileName = DEFAULT_SOUNDFONT): Promise<void> {
  if (warmupPromise) return warmupPromise;

  const audioContext = idleAudioContext();
  if (!audioContext) return Promise.resolve();

  warmupPromise = new SoundFontLoader()
    .load(fileName, audioContext)
    .catch((err: unknown) => {
      // Best effort: a failed warm-up must not block or poison playback.
      warmupPromise = null;
      console.warn("SoundFont warm-up failed; loading it during playback", err);
    });
  return warmupPromise;
}

/** Queue the warm-up on an idle slice so app start-up stays responsive. */
export function scheduleSoundFontWarmup(
  fileName = DEFAULT_SOUNDFONT,
  schedule: (run: () => void) => void = (run) => {
    const idle = (
      window as unknown as {
        requestIdleCallback?: (
          cb: () => void,
          opts: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    if (idle) idle(run, { timeout: 4000 });
    else setTimeout(run, 1500);
  },
): void {
  if (warmupPromise || warmupScheduled) return;
  warmupScheduled = true;
  schedule(() => {
    void warmUpSoundFont(fileName);
  });
}

/** Drop the in-flight marker (tests, or a deliberate sound reload). */
export function resetSoundFontWarmup(): void {
  warmupPromise = null;
  warmupScheduled = false;
}
