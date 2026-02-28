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
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { SongLibrary } from "./features/songLibrary/SongLibrary";
import { DeviceSelector } from "./features/midiDevice/DeviceSelector";
import { useMidiDeviceStore } from "./stores/useMidiDeviceStore";
import { usePracticeLifecycle } from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

/** Accepted file extensions for drag-and-drop MIDI import */
const MIDI_EXTENSIONS = [".mid", ".midi"];

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
        // Start scheduler synchronously so the ticker loop gets valid
        // audioTime immediately. AudioContext.resume() can happen in the
        // background — ctx.currentTime is valid (just frozen) while
        // suspended, and the math (currentTime - startAudioTime + offset)
        // still works once it unfreezes.
        scheduler.start(state.currentTime);
        void engine.resume();
      } else if (!state.isPlaying && prev.isPlaying) {
        scheduler.stop();
      }

      // Seek detection while playing (user dragged slider → large time jump)
      // Only check forward time movement — backward jumps are intentional (loop/seek)
      if (
        state.isPlaying &&
        prev.isPlaying &&
        state.currentTime >= prev.currentTime
      ) {
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

  // ─── Phase 6: Practice Engine lifecycle (extracted to hook) ──
  const { handleNoteRendererReady } = usePracticeLifecycle(song, audioRef);
  // ─── End Phase 6 ─────────────────────────────────────

  const handleOpenFile = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.openMidiFile();
      if (result) {
        const parsed = parseMidiFile(result.fileName, result.data);
        loadSong(parsed);
        reset();
        // Save to recent files if we have the full path
        if (result.path) {
          void window.api.saveRecentFile({
            path: result.path,
            name: result.fileName,
            timestamp: Date.now(),
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse MIDI file:", e);
    }
  }, [loadSong, reset]);

  // ─── Phase 6.5: Mute toggle ────────────────────────────
  const muteRef = useRef({ prevVolume: 0.8 });
  const handleToggleMute = useCallback(() => {
    const pb = usePlaybackStore.getState();
    if (pb.volume > 0) {
      muteRef.current.prevVolume = pb.volume;
      pb.setVolume(0);
    } else {
      pb.setVolume(muteRef.current.prevVolume || 0.8);
    }
  }, []);

  // ─── Phase 6.5: Keyboard shortcuts ─────────────────────
  useKeyboardShortcuts({
    onOpenFile: handleOpenFile,
    onToggleMute: handleToggleMute,
  });

  // ─── Phase 6.5: Drag-and-drop MIDI import ──────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const dragCountRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    setIsDragging(true);
    setDragError(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setIsDragging(false);
      setDragError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!MIDI_EXTENSIONS.includes(ext)) {
        setDragError(`Invalid file type: ${ext}. Only .mid and .midi files are accepted.`);
        setTimeout(() => setDragError(null), 3000);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuf = reader.result as ArrayBuffer;
          const data = Array.from(new Uint8Array(arrayBuf));
          const parsed = parseMidiFile(file.name, data);
          loadSong(parsed);
          reset();
        } catch (err) {
          console.error("Failed to parse dropped MIDI file:", err);
          setDragError("Failed to parse MIDI file.");
          setTimeout(() => setDragError(null), 3000);
        }
      };
      reader.onerror = () => {
        setDragError("Failed to read file.");
        setTimeout(() => setDragError(null), 3000);
      };
      reader.readAsArrayBuffer(file);
    },
    [loadSong, reset],
  );
  // ─── End Phase 6.5 ─────────────────────────────────────

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="rounded-2xl px-10 py-8 text-center"
            style={{
              background: "var(--color-surface)",
              border: "3px dashed var(--color-accent)",
            }}
          >
            <p className="text-lg font-semibold font-body" style={{ color: "var(--color-text)" }}>
              Drop .mid file here
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
              Supported formats: .mid, .midi
            </p>
          </div>
        </div>
      )}

      {/* Drag error toast */}
      {dragError && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-body"
          style={{
            background: "#dc2626",
            color: "#ffffff",
          }}
        >
          {dragError}
        </div>
      )}

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
              <SettingsPanel />
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
