import type { IAudioEngine } from "../../engines/audio/types";
import type { ParsedSong } from "../../engines/midi/types";

export const DEFAULT_SONG_AUDIO_PREVIEW_SECONDS = 8;

const DEFAULT_PREVIEW_LEAD_IN_SECONDS = 0.03;
const DEFAULT_RELEASE_PADDING_SECONDS = 0.2;

export interface SongAudioPreviewNote {
  midi: number;
  velocity: number;
  startOffsetSeconds: number;
  durationSeconds: number;
  trackIndex: number;
}

export interface SongAudioPreviewPlan {
  startTimeSeconds: number;
  durationSeconds: number;
  notes: SongAudioPreviewNote[];
}

export interface SongAudioPreviewPlanOptions {
  startTimeSeconds?: number;
  durationSeconds?: number;
}

export interface SongAudioPreviewPlaybackOptions extends SongAudioPreviewPlanOptions {
  leadInSeconds?: number;
  releasePaddingSeconds?: number;
  volume?: number;
  onEnded?: () => void;
}

export interface SongAudioPreviewHandle {
  durationSeconds: number;
  stop: () => void;
}

export function buildSongAudioPreviewPlan(
  song: ParsedSong,
  options: SongAudioPreviewPlanOptions = {},
): SongAudioPreviewPlan {
  const durationSeconds =
    options.durationSeconds ?? DEFAULT_SONG_AUDIO_PREVIEW_SECONDS;
  const allNotes = song.tracks.flatMap((track, trackIndex) =>
    track.notes.map((note) => ({ note, trackIndex })),
  );
  const firstNoteTime =
    allNotes.length > 0
      ? Math.min(...allNotes.map(({ note }) => note.time))
      : 0;
  const startTimeSeconds = options.startTimeSeconds ?? firstNoteTime;
  const endTimeSeconds = startTimeSeconds + durationSeconds;

  const notes = allNotes
    .filter(({ note }) => {
      const noteEnd = note.time + note.duration;
      return note.time < endTimeSeconds && noteEnd > startTimeSeconds;
    })
    .map(({ note, trackIndex }) => {
      const noteEnd = note.time + note.duration;
      const clampedStart = Math.max(note.time, startTimeSeconds);
      const clampedEnd = Math.min(noteEnd, endTimeSeconds);

      return {
        midi: note.midi,
        velocity: note.velocity,
        startOffsetSeconds: clampedStart - startTimeSeconds,
        durationSeconds: clampedEnd - clampedStart,
        trackIndex,
      };
    })
    .filter((note) => note.durationSeconds > 0)
    .sort(
      (a, b) =>
        a.startOffsetSeconds - b.startOffsetSeconds ||
        a.trackIndex - b.trackIndex ||
        a.midi - b.midi,
    );

  return {
    startTimeSeconds,
    durationSeconds,
    notes,
  };
}

export async function startSongAudioPreview(
  engine: IAudioEngine,
  song: ParsedSong,
  options: SongAudioPreviewPlaybackOptions = {},
): Promise<SongAudioPreviewHandle> {
  const plan = buildSongAudioPreviewPlan(song, options);
  const leadInSeconds =
    options.leadInSeconds ?? DEFAULT_PREVIEW_LEAD_IN_SECONDS;
  const releasePaddingSeconds =
    options.releasePaddingSeconds ?? DEFAULT_RELEASE_PADDING_SECONDS;

  engine.allNotesOff();
  await engine.init();
  if (options.volume !== undefined) {
    engine.setVolume(options.volume);
  }
  await engine.resume();

  const ctx = engine.audioContext;
  if (!ctx) {
    throw new Error("Audio preview requires an initialized AudioContext.");
  }

  const previewStartAudioTime = ctx.currentTime + leadInSeconds;
  for (const note of plan.notes) {
    const onTime = previewStartAudioTime + note.startOffsetSeconds;
    const offTime = onTime + note.durationSeconds;
    engine.noteOn(note.midi, note.velocity, onTime);
    engine.noteOff(note.midi, offTime);
  }

  let stopped = false;
  const timeoutMs = Math.ceil(
    (leadInSeconds + plan.durationSeconds + releasePaddingSeconds) * 1000,
  );
  const timeoutId = setTimeout(() => {
    if (stopped) return;
    stopped = true;
    engine.allNotesOff();
    options.onEnded?.();
  }, timeoutMs);

  return {
    durationSeconds: plan.durationSeconds,
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timeoutId);
      engine.allNotesOff();
    },
  };
}

export class SongAudioPreviewPlayer {
  private _currentPreview: SongAudioPreviewHandle | null = null;
  private _playVersion = 0;

  constructor(private readonly _engine: IAudioEngine) {}

  async play(
    song: ParsedSong,
    options: SongAudioPreviewPlaybackOptions = {},
  ): Promise<void> {
    const version = ++this._playVersion;
    this._stopCurrentPreview();
    const preview = await startSongAudioPreview(this._engine, song, options);
    if (this._playVersion !== version) {
      preview.stop();
      return;
    }
    this._currentPreview = preview;
  }

  stop(): void {
    this._playVersion++;
    this._stopCurrentPreview();
  }

  private _stopCurrentPreview(): void {
    this._currentPreview?.stop();
    this._currentPreview = null;
  }

  dispose(): void {
    this.stop();
    this._engine.dispose();
  }
}
