import { useEffect } from "react";
import { shouldExposeE2eFixtures } from "@renderer/e2eFixtureAccess";
import {
  getSheetMusicVisualFixture,
  type SheetMusicVisualFixtureName,
} from "@renderer/features/sheetMusic/sheetMusicVisualFixtures";
import type { NotationData } from "@renderer/features/sheetMusic/types";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import { getMetronome } from "@renderer/engines/metronome/metronomeManager";
import { resetPracticeSession } from "@renderer/features/practice/usePracticeLifecycle";
import { seekPlayback } from "@renderer/engines/transport/playbackDiscontinuity";
import type { AppRoute } from "@renderer/features/routing/appRoute";
import type { PracticeMode, PracticeScore } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";

export interface UseAppE2eFixturesOptions {
  cancelPendingPlaybackStart: () => void;
  reset: () => void;
  loadSong: (song: ParsedSong) => void;
  hidePostSessionFlow: () => void;
  applyRoute: (route: AppRoute) => void;
  showCelebrationForScore: (score: PracticeScore) => void;
  setSheetFixtureNotationData: (data: NotationData | null) => void;
  onTriggerMissingMidiImport?: (path: string) => Promise<void>;
}

export function useAppE2eFixtures({
  cancelPendingPlaybackStart,
  reset,
  loadSong,
  hidePostSessionFlow,
  applyRoute,
  showCelebrationForScore,
  setSheetFixtureNotationData,
  onTriggerMissingMidiImport,
}: UseAppE2eFixturesOptions): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const fixtureAccessEnabled = shouldExposeE2eFixtures({
      isE2eTestMode: window.api?.isE2eTestMode,
    });
    if (!fixtureAccessEnabled) return;

    const e2eWindow = window as typeof window & {
      __rexianoLoadSheetMusicFixture?: (
        fixtureName: SheetMusicVisualFixtureName,
      ) => void;
      __rexianoShowCelebrationFixture?: (fixture: {
        score: PracticeScore;
        mode?: PracticeMode;
        speed?: number;
      }) => void;
      __rexianoForcePlaybackState?: (state: { isPlaying?: boolean }) => void;
      __rexianoPrimePracticeSessionFixture?: () => boolean;
      __rexianoPrepareWaitTargetFixture?: () => Promise<number[] | null>;
      __rexianoSendMidiNoteFixture?: (midi: number) => void;
      __rexianoSetPracticeLifecycleFixtureState?: (state: {
        isPlaying?: boolean;
        mode?: PracticeMode;
        activeTracks?: number[];
      }) => void;
      __rexianoGetPracticeSessionFixtureSnapshot?: () => {
        mode: PracticeMode;
        isPlaying: boolean;
        currentTime: number;
        waitState: string | null;
        waitResultCount: number;
        waitTargetCount: number;
        waitTargets: number[];
        engineScoreTotal: number;
        storeScoreTotal: number;
        storeResultCount: number;
      } | null;
      __rexianoGetMetronomeFixtureSnapshot?: () => {
        isPlaying: boolean;
        currentTime: number;
        countInActive: boolean;
        metronomeEnabled: boolean;
        countInBeats: number;
        isRunning: boolean;
        enabled: boolean;
        countInRemaining: number;
        scheduledClickCount: number;
      } | null;
      __rexianoTriggerMissingMidiImport?: (path: string) => Promise<void>;
    };

    e2eWindow.__rexianoLoadSheetMusicFixture = (fixtureName) => {
      const fixture = getSheetMusicVisualFixture(fixtureName);
      cancelPendingPlaybackStart();
      reset();
      usePracticeStore.getState().setDisplayMode("split");
      usePracticeStore.getState().setMode("watch");
      setSheetFixtureNotationData(fixture.notationData);
      loadSong(fixture.song);
      hidePostSessionFlow();
      applyRoute("playback");
    };

    e2eWindow.__rexianoShowCelebrationFixture = (celebrationFixture) => {
      const fixture = getSheetMusicVisualFixture("dense-sparse");
      cancelPendingPlaybackStart();
      reset();
      setSheetFixtureNotationData(fixture.notationData);
      loadSong(fixture.song);
      usePracticeStore.getState().setMode(celebrationFixture.mode ?? "wait");
      usePracticeStore.getState().setSpeed(celebrationFixture.speed ?? 1);
      usePracticeStore.setState({
        score: celebrationFixture.score,
        activeTracks: new Set([0]),
        noteResults: new Map(),
      });
      showCelebrationForScore(celebrationFixture.score);
      applyRoute("playback");
    };

    e2eWindow.__rexianoForcePlaybackState = (state) => {
      const playback = usePlaybackStore.getState();
      if (typeof state.isPlaying === "boolean") {
        playback.isPlaying = state.isPlaying;
      }
    };

    e2eWindow.__rexianoPrimePracticeSessionFixture = () => {
      const currentSong = useSongStore.getState().song;
      const { waitMode, scoreCalculator } = getPracticeEngines();
      const firstNote = currentSong?.tracks[0]?.notes[0];
      if (!currentSong || !waitMode || !scoreCalculator || !firstNote) {
        return false;
      }

      usePracticeStore.getState().setMode("wait");
      waitMode.reset();
      waitMode.start();
      waitMode.tick(currentSong.duration + 1);
      scoreCalculator.reset();
      scoreCalculator.noteHit(firstNote.midi, firstNote.time);
      usePracticeStore.getState().resetScore();
      usePracticeStore.getState().recordHit("__e2e_practice_fixture__");
      return true;
    };

    e2eWindow.__rexianoPrepareWaitTargetFixture = async () => {
      const currentSong = useSongStore.getState().song;
      const { waitMode, scoreCalculator } = getPracticeEngines();
      const firstNote = currentSong?.tracks[0]?.notes[0];
      if (!currentSong || !waitMode || !scoreCalculator || !firstNote) {
        return null;
      }

      usePlaybackStore.getState().setPlaying(false);
      usePracticeStore.getState().setMode("wait");
      usePracticeStore.getState().setActiveTracks(new Set([0]));
      resetPracticeSession({
        resetWaitMode: () => waitMode.reset(),
        resetScoreCalculator: () => scoreCalculator.reset(),
        resetPracticeScore: usePracticeStore.getState().resetScore,
      });
      seekPlayback(firstNote.time);
      waitMode.start();
      waitMode.tick(firstNote.time);
      const targets = [...waitMode.targetNotes];
      usePlaybackStore.getState().setPlaying(true);
      return targets;
    };

    e2eWindow.__rexianoSendMidiNoteFixture = (midi) => {
      useMidiDeviceStore.setState({ activeNotes: new Set([midi]) });
      useMidiDeviceStore.setState({ activeNotes: new Set() });
    };

    e2eWindow.__rexianoSetPracticeLifecycleFixtureState = (state) => {
      if (typeof state.isPlaying === "boolean") {
        usePlaybackStore.getState().setPlaying(state.isPlaying);
      }
      if (state.mode) {
        usePracticeStore.getState().setMode(state.mode);
      }
      if (state.activeTracks) {
        usePracticeStore
          .getState()
          .setActiveTracks(new Set(state.activeTracks));
      }
    };

    e2eWindow.__rexianoGetPracticeSessionFixtureSnapshot = () => {
      const { waitMode, scoreCalculator } = getPracticeEngines();
      if (!waitMode || !scoreCalculator) return null;
      const practice = usePracticeStore.getState();
      const playback = usePlaybackStore.getState();
      return {
        mode: practice.mode,
        isPlaying: playback.isPlaying,
        currentTime: playback.currentTime,
        waitState: waitMode.state,
        waitResultCount: [...waitMode.noteResults.values()].filter(
          (result) => result !== "pending",
        ).length,
        waitTargetCount: waitMode.targetNotes.size,
        waitTargets: [...waitMode.targetNotes],
        engineScoreTotal: scoreCalculator.getScore().totalNotes,
        storeScoreTotal: practice.score.totalNotes,
        storeResultCount: practice.noteResults.size,
      };
    };

    e2eWindow.__rexianoGetMetronomeFixtureSnapshot = () => {
      const metronome = getMetronome();
      if (!metronome) return null;
      const playback = usePlaybackStore.getState();
      return {
        isPlaying: playback.isPlaying,
        currentTime: playback.currentTime,
        countInActive: playback.countInActive,
        metronomeEnabled: useSettingsStore.getState().metronomeEnabled,
        countInBeats: useSettingsStore.getState().countInBeats,
        ...metronome.getRuntimeSnapshot(),
      };
    };

    if (onTriggerMissingMidiImport) {
      e2eWindow.__rexianoTriggerMissingMidiImport = onTriggerMissingMidiImport;
    }

    return () => {
      delete e2eWindow.__rexianoLoadSheetMusicFixture;
      delete e2eWindow.__rexianoShowCelebrationFixture;
      delete e2eWindow.__rexianoForcePlaybackState;
      delete e2eWindow.__rexianoPrimePracticeSessionFixture;
      delete e2eWindow.__rexianoPrepareWaitTargetFixture;
      delete e2eWindow.__rexianoSendMidiNoteFixture;
      delete e2eWindow.__rexianoSetPracticeLifecycleFixtureState;
      delete e2eWindow.__rexianoGetPracticeSessionFixtureSnapshot;
      delete e2eWindow.__rexianoGetMetronomeFixtureSnapshot;
      delete e2eWindow.__rexianoTriggerMissingMidiImport;
    };
  }, [
    applyRoute,
    cancelPendingPlaybackStart,
    hidePostSessionFlow,
    loadSong,
    onTriggerMissingMidiImport,
    reset,
    setSheetFixtureNotationData,
    showCelebrationForScore,
  ]);
}
