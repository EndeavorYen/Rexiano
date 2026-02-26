import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { parseMidiFile } from "./engines/midi/MidiFileParser";
import { useSongStore } from "./stores/useSongStore";
import { usePlaybackStore } from "./stores/usePlaybackStore";
import { AudioEngine } from "./engines/audio/AudioEngine";
import { AudioScheduler } from "./engines/audio/AudioScheduler";
import { FallingNotesCanvas } from "./features/fallingNotes/FallingNotesCanvas";
import { PianoKeyboard } from "./features/fallingNotes/PianoKeyboard";
import { TransportBar } from "./features/fallingNotes/TransportBar";
import { ThemePicker } from "./features/settings/ThemePicker";
import { SongLibrary } from "./features/songLibrary/SongLibrary";
import { DeviceSelector } from "./features/midiDevice/DeviceSelector";
import { useMidiDeviceStore } from "./stores/useMidiDeviceStore";
import {
  initPracticeEngines,
  getPracticeEngines,
  disposePracticeEngines,
} from "./engines/practice/practiceManager";
import { usePracticeStore } from "./stores/usePracticeStore";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import type { NoteRenderer } from "./engines/fallingNotes/NoteRenderer";

function App(): React.JSX.Element {
  const song = useSongStore((s) => s.song);
  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes);
  }, []);

  // ─── Phase 4: Audio Engine lifecycle ─────────────────
  const audioRef = useRef<{
    engine: AudioEngine | null;
    scheduler: AudioScheduler | null;
  }>({
    engine: null,
    scheduler: null,
  });

  // Init audio engine when a song is loaded
  useEffect(() => {
    if (!song) return;

    const init = async (): Promise<void> => {
      if (audioRef.current.engine) {
        // Engine already exists, just bind the new song
        audioRef.current.scheduler?.setSong(song);
        return;
      }

      const engine = new AudioEngine();
      const scheduler = new AudioScheduler(engine);
      audioRef.current = { engine, scheduler };

      usePlaybackStore.getState().setAudioStatus("loading");
      try {
        await engine.init();
        engine.setVolume(usePlaybackStore.getState().volume);
        scheduler.setSong(song);
        usePlaybackStore.getState().setAudioStatus("ready");
      } catch (err) {
        console.error("Audio init failed:", err);
        usePlaybackStore.getState().setAudioStatus("error");
      }
    };

    init();
  }, [song]);

  // Sync playback state → AudioScheduler
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { engine, scheduler } = audioRef.current;
      if (!engine || !scheduler) return;

      // Volume sync
      if (state.volume !== prev.volume) {
        engine.setVolume(state.volume);
      }

      // Play / pause
      if (state.isPlaying && !prev.isPlaying) {
        // Resume AudioContext (Chrome suspends until user gesture)
        void engine.resume().then(() => scheduler.start(state.currentTime));
      } else if (!state.isPlaying && prev.isPlaying) {
        scheduler.stop();
      }

      // Seek detection while playing (user dragged slider → large time jump)
      // Debounced to avoid rapid seek calls during slider drag
      if (state.isPlaying && prev.isPlaying) {
        const audioTime = scheduler.getCurrentTime();
        if (
          audioTime !== null &&
          Math.abs(state.currentTime - audioTime) > 0.5
        ) {
          if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
          seekTimeoutRef.current = setTimeout(() => {
            scheduler.seek(usePlaybackStore.getState().currentTime);
            seekTimeoutRef.current = null;
          }, 50);
        }
      }
    });
    return () => {
      unsub();
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    };
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current.scheduler?.dispose();
      audioRef.current.engine?.dispose();
    };
  }, []);

  // Callback for FallingNotesCanvas to sync visual with audio time
  const getAudioCurrentTime = useCallback((): number | null => {
    return audioRef.current.scheduler?.getCurrentTime() ?? null;
  }, []);
  // ─── End Phase 4 ─────────────────────────────────────

  // ─── Phase 6: Practice Engine lifecycle ─────────────────
  const noteRendererRef = useRef<NoteRenderer | null>(null);

  const handleNoteRendererReady = useCallback((renderer: NoteRenderer) => {
    noteRendererRef.current = renderer;
  }, []);

  // Init practice engines when a song loads
  useEffect(() => {
    if (!song) return;

    initPracticeEngines();
    const { waitMode, scoreCalculator } = getPracticeEngines();
    if (!waitMode || !scoreCalculator) return;

    const practiceState = usePracticeStore.getState();
    // Initialize WaitMode with song tracks and active tracks
    const activeTracks =
      practiceState.activeTracks.size > 0
        ? practiceState.activeTracks
        : new Set(song.tracks.map((_, i) => i));
    if (practiceState.activeTracks.size === 0) {
      usePracticeStore.getState().setActiveTracks(activeTracks);
    }
    waitMode.init(song.tracks, activeTracks);

    // Wire callbacks
    waitMode.setCallbacks({
      onHit: (midi, time) => {
        const key = `${midi}:${Math.round(time * 1e6)}`;
        usePracticeStore.getState().recordHit(key);
        scoreCalculator.noteHit(midi, time);
        // Visual feedback
        const nr = noteRendererRef.current;
        if (nr) {
          for (let t = 0; t < song.tracks.length; t++) {
            const sprite = nr.findSpriteForNote(t, midi, time);
            if (sprite) {
              nr.flashHit(sprite);
              break;
            }
          }
        }
        // Show combo at milestones
        const score = usePracticeStore.getState().score;
        if (nr && [5, 10, 25, 50, 100].includes(score.currentStreak)) {
          nr.showCombo(score.currentStreak, 400, 200);
        }
      },
      onMiss: (midi, time) => {
        const key = `${midi}:${Math.round(time * 1e6)}`;
        usePracticeStore.getState().recordMiss(key);
        scoreCalculator.noteMiss(midi, time);
        // Visual feedback
        const nr = noteRendererRef.current;
        if (nr) {
          for (let t = 0; t < song.tracks.length; t++) {
            const sprite = nr.findSpriteForNote(t, midi, time);
            if (sprite) {
              nr.markMiss(sprite);
              break;
            }
          }
        }
      },
      onWait: () => {
        // Pause audio when waiting for input
        audioRef.current.scheduler?.stop();
      },
      onResume: () => {
        // Resume audio after correct input
        const { scheduler } = audioRef.current;
        const time = usePlaybackStore.getState().currentTime;
        if (scheduler) {
          void audioRef.current.engine?.resume().then(() => scheduler.start(time));
        }
      },
    });

    return () => {
      disposePracticeEngines();
    };
  }, [song]);

  // Sync practice store → engine singletons
  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      const { waitMode, speedController, loopController, scoreCalculator } =
        getPracticeEngines();

      // Mode change
      if (state.mode !== prev.mode && waitMode && song) {
        if (state.mode === "wait") {
          waitMode.init(song.tracks, state.activeTracks);
          if (usePlaybackStore.getState().isPlaying) {
            waitMode.start();
          }
        } else {
          waitMode.stop();
        }
        scoreCalculator?.reset();
      }

      // Speed change
      if (state.speed !== prev.speed && speedController) {
        speedController.setSpeed(state.speed);
      }

      // Loop range change
      if (state.loopRange !== prev.loopRange && loopController) {
        if (state.loopRange) {
          loopController.setRange(state.loopRange[0], state.loopRange[1]);
        } else {
          loopController.clear();
        }
      }

      // Active tracks change
      if (state.activeTracks !== prev.activeTracks && waitMode && song) {
        waitMode.init(song.tracks, state.activeTracks);
      }
    });
    return unsub;
  }, [song]);

  // Wire MIDI input → WaitMode.checkInput()
  useEffect(() => {
    const unsub = useMidiDeviceStore.subscribe((state, prev) => {
      if (state.activeNotes !== prev.activeNotes) {
        const { waitMode } = getPracticeEngines();
        const practiceMode = usePracticeStore.getState().mode;
        if (waitMode && practiceMode === "wait") {
          waitMode.checkInput(state.activeNotes);
        }
      }
    });
    return unsub;
  }, []);

  // Start/stop WaitMode with playback
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { waitMode } = getPracticeEngines();
      const practiceMode = usePracticeStore.getState().mode;
      if (!waitMode || practiceMode !== "wait") return;

      if (state.isPlaying && !prev.isPlaying) {
        waitMode.start();
      } else if (!state.isPlaying && prev.isPlaying) {
        waitMode.stop();
      }
    });
    return unsub;
  }, []);

  // Sync loop seek → AudioScheduler
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { loopController } = getPracticeEngines();
      if (!loopController?.isActive) return;
      if (
        state.currentTime < prev.currentTime &&
        Math.abs(state.currentTime - loopController.getLoopStart()) < 0.1
      ) {
        audioRef.current.scheduler?.seek(state.currentTime);
      }
    });
    return unsub;
  }, []);
  // ─── End Phase 6 ─────────────────────────────────────

  const handleOpenFile = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.openMidiFile();
      if (result) {
        const parsed = parseMidiFile(result.fileName, result.data);
        loadSong(parsed);
        reset();
      }
    } catch (e) {
      console.error("Failed to parse MIDI file:", e);
    }
  }, [loadSong, reset]);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {!song ? (
        <div key="library" className="flex-1 flex flex-col animate-page-enter">
          <SongLibrary onOpenFile={handleOpenFile} />
        </div>
      ) : (
        /* Song loaded: header + falling notes + transport + keyboard */
        <div key="playback" className="flex-1 flex flex-col animate-page-enter">
          {/* Song info header */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{
              background: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold font-body truncate">
                {song.fileName}
              </h2>
              <p
                className="text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {song.tracks.length} track{song.tracks.length > 1 ? "s" : ""}{" "}
                &middot; {song.noteCount} notes
                {song.tempos.length > 0 &&
                  ` \u00B7 ${Math.round(song.tempos[0].bpm)} BPM`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <DeviceSelector />
              <div
                className="h-5 w-px shrink-0"
                style={{ background: "var(--color-border)" }}
              />
              <ThemePicker />
              <button
                onClick={() => {
                  useSongStore.getState().clearSong();
                  usePlaybackStore.getState().reset();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-body cursor-pointer btn-surface-themed"
              >
                <ArrowLeft size={14} />
                Library
              </button>
            </div>
          </div>

          {/* Falling notes canvas + score overlay */}
          <div className="flex-1 relative">
            <FallingNotesCanvas
              onActiveNotesChange={handleActiveNotesChange}
              getAudioCurrentTime={getAudioCurrentTime}
              onNoteRendererReady={handleNoteRendererReady}
            />
            <ScoreOverlay />
          </div>

          {/* Transport bar */}
          <TransportBar />

          {/* Practice toolbar */}
          <PracticeToolbar />

          {/* Piano keyboard */}
          <PianoKeyboard
            activeNotes={activeNotes}
            midiActiveNotes={midiActiveNotes}
            height={100}
          />
        </div>
      )}
    </div>
  );
}

export default App;
