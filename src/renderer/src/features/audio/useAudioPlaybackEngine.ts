import { useCallback, useEffect, useRef } from "react";
import { AudioEngine } from "@renderer/engines/audio/AudioEngine";
import { AudioScheduler } from "@renderer/engines/audio/AudioScheduler";
import {
  AUDIO_DEVICECHANGE_DEBOUNCE_MS,
  AUDIO_RECOVERY_MAX_ATTEMPTS,
  computeRecoveryBackoffMs,
  delay,
  extractAudioOutputIds,
  hasAudioOutputChanged,
} from "@renderer/engines/audio/recoveryUtils";
import { recoverLatestPlaybackIntent } from "@renderer/engines/audio/audioRecoveryIntent";
import {
  AudioInitializationOwner,
  runOwnedAudioInitialization,
  type AudioInitializationOutcome,
} from "@renderer/engines/audio/audioInitializationOwnership";
import {
  initMetronome,
  disposeMetronome,
  getMetronome,
} from "@renderer/engines/metronome/metronomeManager";
import {
  beginMetronomePlayback,
  rebaseMetronomeDiscontinuity,
  syncMetronomeToPlayback,
} from "@renderer/engines/metronome/metronomeRuntime";
import { resolveMetronomeSegmentKey } from "@renderer/engines/metronome/metronomeTiming";
import { TransportClock } from "@renderer/engines/transport/TransportClock";
import { registerPlaybackDiscontinuityHandler } from "@renderer/engines/transport/playbackDiscontinuity";
import {
  resetPracticeSession,
  shouldStartPracticeScheduler,
} from "@renderer/features/practice/usePracticeLifecycle";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import { getMutedTrackIndices } from "@renderer/features/practice/splitLayoutMath";
import { getMidiPlaybackOutputSender } from "@renderer/stores/useMidiDeviceStore";
import { initAutoSave } from "@renderer/stores/useProgressStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import {
  mapSessionIntentToMode,
  type PracticeSessionIntent,
} from "@renderer/features/practice/sessionIntent";
import { resolveSongPracticeSetupForSong } from "@renderer/features/practice/songPracticeSetup";
import type { ParsedSong } from "@renderer/engines/midi/types";

export interface UseAudioPlaybackEngineOptions {
  song: ParsedSong | null;
  sessionIntentRef: React.MutableRefObject<PracticeSessionIntent>;
  audioInitializationOwnerRef: React.MutableRefObject<AudioInitializationOwner | null>;
  audioReadySongRef: React.MutableRefObject<ParsedSong | null>;
  pendingPlaybackStartSongRef: React.MutableRefObject<ParsedSong | null>;
  attemptPendingPlaybackStart: () => boolean;
}

export interface UseAudioPlaybackEngineResult {
  audioRef: React.MutableRefObject<{
    engine: AudioEngine | null;
    scheduler: AudioScheduler | null;
  }>;
  getAudioCurrentTime: () => number | null;
  syncCurrentMetronome: () => void;
  rebuildAudioStack: (
    targetSong: ParsedSong,
  ) => Promise<AudioInitializationOutcome>;
}

export function shouldSyncMetronomeSegment(
  currentSegment: string | null,
  nextSegment: string,
): boolean {
  return currentSegment !== null && currentSegment !== nextSegment;
}

export function extractPlaybackIntent(
  isPlaying: boolean,
  countInActive: boolean,
  currentTime: number,
): { isPlaying: boolean; currentTime: number } {
  return {
    isPlaying: isPlaying && !countInActive,
    currentTime,
  };
}

export function resolveAudioEngineLatencyHint(
  audioCompatibilityMode: boolean,
): "playback" | "interactive" {
  return audioCompatibilityMode ? "playback" : "interactive";
}

export function useAudioPlaybackEngine({
  song,
  sessionIntentRef,
  audioInitializationOwnerRef,
  audioReadySongRef,
  pendingPlaybackStartSongRef,
  attemptPendingPlaybackStart,
}: UseAudioPlaybackEngineOptions): UseAudioPlaybackEngineResult {
  const audioRef = useRef<{
    engine: AudioEngine | null;
    scheduler: AudioScheduler | null;
  }>({
    engine: null,
    scheduler: null,
  });
  const recoveryInFlightRef = useRef<Promise<void> | null>(null);
  const deviceChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audioOutputSnapshotRef = useRef<string[] | null>(null);
  const metronomeSegmentRef = useRef<string | null>(null);
  const e2eAudioRecoveryDelayMsRef = useRef(0);
  const triggerRecoveryRef = useRef<(reason: string, error?: unknown) => void>(
    () => {},
  );

  const syncCurrentMetronome = useCallback((): void => {
    const engine = getMetronome();
    const liveSong = useSongStore.getState().song;
    const playback = usePlaybackStore.getState();
    if (playback.countInActive) return;
    if (!engine || !liveSong || !playback.isPlaying) {
      engine?.stop();
      metronomeSegmentRef.current = null;
      return;
    }

    syncMetronomeToPlayback({
      engine,
      song: liveSong,
      currentTime: playback.currentTime,
      speed: usePracticeStore.getState().speed,
      enabled: useSettingsStore.getState().metronomeEnabled,
    });
    metronomeSegmentRef.current = resolveMetronomeSegmentKey(
      liveSong,
      playback.currentTime,
      usePracticeStore.getState().speed,
    );
  }, []);

  const readAudioOutputSnapshot = useCallback(async (): Promise<
    string[] | null
  > => {
    if (typeof navigator === "undefined") return null;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return null;
    try {
      const devices = await mediaDevices.enumerateDevices();
      return extractAudioOutputIds(devices);
    } catch (err) {
      console.warn("Failed to enumerate media devices:", err);
      return null;
    }
  }, []);

  const startOwnedPlayback = useCallback((): void => {
    const { engine, scheduler } = audioRef.current;
    if (!engine || !scheduler) return;

    const playback = usePlaybackStore.getState();
    if (!playback.isPlaying) return;

    const { waitMode } = getPracticeEngines();
    if (
      !shouldStartPracticeScheduler({
        mode: usePracticeStore.getState().mode,
        waitState: waitMode?.state ?? null,
      })
    ) {
      return;
    }

    const currentSong = useSongStore.getState().song;
    const metronome = getMetronome();
    const startTransport = (songTime: number): void => {
      scheduler.start(songTime);
      void engine.resume().catch((err) => {
        scheduler.stop();
        getMetronome()?.stop();
        usePlaybackStore.getState().setCountInActive(false);
        triggerRecoveryRef.current("resume-failed", err);
      });
    };

    if (currentSong && metronome) {
      const settings = useSettingsStore.getState();
      const outcome = beginMetronomePlayback({
        engine: metronome,
        song: currentSong,
        currentTime: playback.currentTime,
        speed: usePracticeStore.getState().speed,
        metronomeEnabled: settings.metronomeEnabled,
        countInBeats: settings.countInBeats,
        setCountInActive: playback.setCountInActive,
        startTransport,
        getLiveState: () => {
          const livePlayback = usePlaybackStore.getState();
          return {
            song: useSongStore.getState().song,
            isPlaying: livePlayback.isPlaying,
            countInActive: livePlayback.countInActive,
            currentTime: livePlayback.currentTime,
            speed: usePracticeStore.getState().speed,
            metronomeEnabled: useSettingsStore.getState().metronomeEnabled,
          };
        },
      });
      if (window.api.isE2eTestMode) {
        (
          window as typeof window & {
            __rexianoLastPlaybackStart?: {
              outcome: typeof outcome;
              currentTime: number;
              countInBeats: number;
            };
          }
        ).__rexianoLastPlaybackStart = {
          outcome,
          currentTime: playback.currentTime,
          countInBeats: settings.countInBeats,
        };
      }
      return;
    }

    startTransport(playback.currentTime);
  }, []);

  const rebuildAudioStack = useCallback(
    async (targetSong: ParsedSong): Promise<AudioInitializationOutcome> => {
      const { audioCompatibilityMode } = useSettingsStore.getState();
      const engine = new AudioEngine({
        latencyHint: audioCompatibilityMode ? "playback" : "interactive",
        onRuntimeError: (error) => {
          triggerRecoveryRef.current("runtime-device-failure", error);
        },
      });
      const scheduler = new AudioScheduler(engine);
      scheduler.setMidiOutput(getMidiPlaybackOutputSender());
      const stack = { engine, scheduler };
      const owner = audioInitializationOwnerRef.current;
      if (!owner) {
        throw new Error("Audio initialization owner is unavailable");
      }

      return runOwnedAudioInitialization(owner, {
        activate: () => {
          audioReadySongRef.current = null;
          audioRef.current.engine?.setRuntimeErrorHandler(null);
          audioRef.current.scheduler?.dispose();
          audioRef.current.engine?.dispose();
          audioRef.current = stack;
          usePlaybackStore.getState().setAudioStatus("loading");
        },
        initialize: async () => {
          await engine.init();
          if (e2eAudioRecoveryDelayMsRef.current > 0) {
            await delay(e2eAudioRecoveryDelayMsRef.current);
          }
        },
        commit: () => {
          const { muted } = useSettingsStore.getState();
          engine.setVolume(muted ? 0 : usePlaybackStore.getState().volume);

          disposeMetronome();
          if (engine.audioContext) {
            initMetronome(engine.audioContext);
          }

          scheduler.setSong(targetSong);
          scheduler.setSpeed(usePracticeStore.getState().speed);
          scheduler.setMutedTracks(
            getMutedTrackIndices(usePracticeStore.getState().trackPreferences),
          );
          audioReadySongRef.current = targetSong;
          usePlaybackStore.getState().setAudioStatus("ready");
          usePlaybackStore.getState().clearAudioRecovery();
          attemptPendingPlaybackStart();
          startOwnedPlayback();
        },
        cleanupStale: () => {
          engine.setRuntimeErrorHandler(null);
          scheduler.dispose();
          engine.dispose();
          if (audioRef.current === stack) {
            audioRef.current = { engine: null, scheduler: null };
          }
        },
      });
    },
    [
      attemptPendingPlaybackStart,
      audioInitializationOwnerRef,
      audioReadySongRef,
      startOwnedPlayback,
    ],
  );

  const recoverAudio = useCallback(
    (reason: string, error?: unknown): void => {
      const activeSong = useSongStore.getState().song;
      if (!activeSong || recoveryInFlightRef.current) return;

      if (error) {
        console.error(
          `Audio runtime error (${reason}), rebuilding audio stack:`,
          error,
        );
      }

      const recovery = (async () => {
        for (
          let attempt = 1;
          attempt <= AUDIO_RECOVERY_MAX_ATTEMPTS;
          attempt++
        ) {
          usePlaybackStore
            .getState()
            .setAudioRecovering(attempt, AUDIO_RECOVERY_MAX_ATTEMPTS);

          try {
            const liveSong = useSongStore.getState().song;
            if (!liveSong) {
              usePlaybackStore.getState().clearAudioRecovery();
              return;
            }

            const outcome = await recoverLatestPlaybackIntent({
              targetSong: liveSong,
              rebuild: rebuildAudioStack,
              getCurrentSong: () => useSongStore.getState().song,
              getPlaybackIntent: () => {
                const { isPlaying, countInActive, currentTime } =
                  usePlaybackStore.getState();
                return {
                  isPlaying: isPlaying && !countInActive,
                  currentTime,
                };
              },
              getRuntime: () => {
                const { engine, scheduler } = audioRef.current;
                return engine && scheduler ? { engine, scheduler } : null;
              },
            });
            if (outcome === "stale") return;
            const playback = usePlaybackStore.getState();
            if (playback.countInActive) {
              playback.setCountInActive(false);
              playback.setPlaying(false);
              playback.setPlaying(true);
            } else {
              syncCurrentMetronome();
            }
            usePlaybackStore.getState().setAudioRecoverySucceeded();
            return;
          } catch (err) {
            console.error(
              `Audio recovery attempt ${attempt}/${AUDIO_RECOVERY_MAX_ATTEMPTS} failed:`,
              err,
            );
            if (attempt >= AUDIO_RECOVERY_MAX_ATTEMPTS) {
              throw err;
            }
            await delay(computeRecoveryBackoffMs(attempt));
          }
        }
      })()
        .catch((err) => {
          console.error("Audio recovery failed:", err);
          const playback = usePlaybackStore.getState();
          playback.setAudioStatus("error");
          playback.setAudioRecoveryFailed(AUDIO_RECOVERY_MAX_ATTEMPTS);
          playback.setPlaying(false);
        })
        .finally(() => {
          recoveryInFlightRef.current = null;
        });

      recoveryInFlightRef.current = recovery;
    },
    [rebuildAudioStack, syncCurrentMetronome],
  );

  useEffect(() => {
    triggerRecoveryRef.current = recoverAudio;
  }, [recoverAudio]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.api.isE2eTestMode) return;
    const e2eWindow = window as typeof window & {
      __rexianoSetAudioRecoveryDelayFixture?: (delayMs: number) => void;
    };
    e2eWindow.__rexianoSetAudioRecoveryDelayFixture = (delayMs) => {
      e2eAudioRecoveryDelayMsRef.current = Math.max(0, delayMs);
    };
    return () => {
      e2eAudioRecoveryDelayMsRef.current = 0;
      delete e2eWindow.__rexianoSetAudioRecoveryDelayFixture;
    };
  }, []);

  // Manual retry from UI
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (state.audioRecoverySignal !== prev.audioRecoverySignal) {
        triggerRecoveryRef.current("manual-retry");
      }
    });
    return unsub;
  }, []);

  // Compatibility mode changes
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.audioCompatibilityMode === prev.audioCompatibilityMode) return;
      if (!useSongStore.getState().song) return;
      triggerRecoveryRef.current("compatibility-mode-change");
    });
    return unsub;
  }, []);

  // Output device topology changes
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;

    let disposed = false;

    void readAudioOutputSnapshot().then((snapshot) => {
      if (!disposed) {
        audioOutputSnapshotRef.current = snapshot;
      }
    });

    const onDeviceChange = (): void => {
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
      }
      deviceChangeDebounceRef.current = setTimeout(() => {
        void readAudioOutputSnapshot().then((nextSnapshot) => {
          if (!nextSnapshot || disposed) return;
          const changed = hasAudioOutputChanged(
            audioOutputSnapshotRef.current,
            nextSnapshot,
          );
          audioOutputSnapshotRef.current = nextSnapshot;

          if (!changed) return;
          if (!useSongStore.getState().song) return;
          triggerRecoveryRef.current("media-device-change");
        });
      }, AUDIO_DEVICECHANGE_DEBOUNCE_MS);
    };

    if (mediaDevices.addEventListener) {
      mediaDevices.addEventListener("devicechange", onDeviceChange);
    } else {
      mediaDevices.ondevicechange = onDeviceChange;
    }

    return () => {
      disposed = true;
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
        deviceChangeDebounceRef.current = null;
      }
      if (mediaDevices.removeEventListener) {
        mediaDevices.removeEventListener("devicechange", onDeviceChange);
      } else {
        mediaDevices.ondevicechange = null;
      }
    };
  }, [readAudioOutputSnapshot]);

  // Init audio engine when a song is loaded
  useEffect(() => {
    if (!song) return;

    let cancelled = false;

    const init = async (): Promise<void> => {
      if (recoveryInFlightRef.current) {
        await recoveryInFlightRef.current;
      }
      if (cancelled) return;

      const { engine, scheduler } = audioRef.current;
      if (engine && scheduler && engine.status === "ready") {
        scheduler.setSong(song);
        scheduler.setSpeed(usePracticeStore.getState().speed);
        scheduler.setMutedTracks(
          getMutedTrackIndices(usePracticeStore.getState().trackPreferences),
        );
        audioReadySongRef.current = song;
        usePlaybackStore.getState().setAudioStatus("ready");
        attemptPendingPlaybackStart();
        return;
      }

      try {
        const outcome = await rebuildAudioStack(song);
        if (outcome === "stale") return;
      } catch (err) {
        if (cancelled) return;
        console.error("Audio init failed:", err);
        usePlaybackStore.getState().setAudioStatus("error");
      }
    };

    const { defaultMode, defaultSpeed } = useSettingsStore.getState();
    const setup = resolveSongPracticeSetupForSong(song, {
      defaultMode,
      defaultSpeed,
    });
    usePracticeStore
      .getState()
      .setMode(
        mapSessionIntentToMode(sessionIntentRef.current, setup.defaultMode),
      );
    usePracticeStore.getState().setSpeed(setup.defaultSpeed);
    usePracticeStore.getState().setActiveTracks(new Set(setup.activeTracks));
    usePracticeStore.getState().setSongPracticeSetup({
      handAssignments: setup.handAssignments,
      trackPreferences: setup.trackPreferences,
    });

    void init();

    return () => {
      cancelled = true;
    };
  }, [
    attemptPendingPlaybackStart,
    audioReadySongRef,
    rebuildAudioStack,
    sessionIntentRef,
    song,
  ]);

  // Sync playback state → AudioScheduler
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { engine, scheduler } = audioRef.current;
      if (!engine || !scheduler) return;

      if (state.volume !== prev.volume) {
        engine.setVolume(state.volume);
      }

      if (state.isPlaying && !prev.isPlaying) {
        startOwnedPlayback();
      } else if (!state.isPlaying && prev.isPlaying) {
        scheduler.stop();
        getMetronome()?.stop();
        if (state.countInActive) {
          usePlaybackStore.getState().setCountInActive(false);
        }
      }
    });
    return unsub;
  }, [startOwnedPlayback]);

  // Handle seeking / discontinuity
  useEffect(() => {
    return registerPlaybackDiscontinuityHandler(({ targetTime, reason }) => {
      const { scheduler, engine } = audioRef.current;
      scheduler?.seek(targetTime);
      const playback = usePlaybackStore.getState();
      rebaseMetronomeDiscontinuity({
        reason,
        targetTime,
        countInActive: playback.countInActive,
        stopCountIn: () => getMetronome()?.stop(),
        setCountInActive: playback.setCountInActive,
        startTransport: (songTime) => {
          if (!scheduler || !engine) return;
          scheduler.start(songTime);
          void engine.resume().catch((err) => {
            scheduler.stop();
            triggerRecoveryRef.current("seek-resume-failed", err);
          });
        },
        syncMetronome: syncCurrentMetronome,
      });
      if (reason === "manual-reset") {
        const { waitMode, scoreCalculator } = getPracticeEngines();
        resetPracticeSession({
          resetWaitMode: () => waitMode?.reset(),
          resetScoreCalculator: () => scoreCalculator?.reset(),
          resetPracticeScore: usePracticeStore.getState().resetScore,
        });
      }
    });
  }, [syncCurrentMetronome]);

  // Cleanup audio on unmount
  useEffect(() => {
    const audioInitOwner = audioInitializationOwnerRef.current;
    return () => {
      audioInitOwner?.invalidate();
      audioRef.current.engine?.setRuntimeErrorHandler(null);
      audioRef.current.scheduler?.dispose();
      audioRef.current.engine?.dispose();
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
        deviceChangeDebounceRef.current = null;
      }
      disposeMetronome();
      triggerRecoveryRef.current = () => {};
      pendingPlaybackStartSongRef.current = null;
      audioReadySongRef.current = null;
    };
  }, [
    audioInitializationOwnerRef,
    audioReadySongRef,
    pendingPlaybackStartSongRef,
  ]);

  const getAudioCurrentTime = useCallback((): number | null => {
    return audioRef.current.scheduler?.getCurrentTime() ?? null;
  }, []);

  useEffect(() => {
    const clock = new TransportClock(getAudioCurrentTime);
    clock.start();
    return () => clock.dispose();
  }, [getAudioCurrentTime]);

  useEffect(() => {
    const cleanup = initAutoSave();
    return cleanup;
  }, []);

  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.muted === prev.muted) return;
      const { engine } = audioRef.current;
      if (!engine) return;
      engine.setVolume(state.muted ? 0 : usePlaybackStore.getState().volume);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.metronomeEnabled === prev.metronomeEnabled) return;
      const engine = getMetronome();
      if (!engine) return;
      const playback = usePlaybackStore.getState();
      if (playback.countInActive) {
        engine.setEnabled(state.metronomeEnabled);
      } else if (playback.isPlaying) {
        syncCurrentMetronome();
      } else {
        engine.setEnabled(state.metronomeEnabled);
        engine.stop();
      }
    });
    return unsub;
  }, [syncCurrentMetronome]);

  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (!state.isPlaying || state.countInActive) {
        metronomeSegmentRef.current = null;
        return;
      }
      if (state.currentTime === prev.currentTime) return;
      const currentSong = useSongStore.getState().song;
      if (!currentSong || !useSettingsStore.getState().metronomeEnabled) return;

      const segment = resolveMetronomeSegmentKey(
        currentSong,
        state.currentTime,
        usePracticeStore.getState().speed,
      );
      if (metronomeSegmentRef.current === null) {
        metronomeSegmentRef.current = segment;
      } else if (metronomeSegmentRef.current !== segment) {
        syncCurrentMetronome();
      }
    });
    return unsub;
  }, [syncCurrentMetronome]);

  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      if (state.speed === prev.speed) return;
      audioRef.current.scheduler?.setSpeed(state.speed);
      syncCurrentMetronome();
    });
    return unsub;
  }, [syncCurrentMetronome]);

  return {
    audioRef,
    getAudioCurrentTime,
    syncCurrentMetronome,
    rebuildAudioStack,
  };
}
