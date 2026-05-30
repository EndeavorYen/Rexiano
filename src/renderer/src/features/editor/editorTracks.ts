import type { EditableSong, EditableTrack } from "./editorTypes";

export type TrackPracticeSetupImpact =
  | { kind: "preserved" }
  | { kind: "reset-required"; reason: "Track topology changed." };

export interface AddEditorTrackInput {
  id: string;
  name?: string;
  channel?: number;
  instrument?: number;
}

export type EditableTrackPatch = Partial<
  Pick<EditableTrack, "name" | "channel" | "instrument" | "color">
>;

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeTrack(track: EditableTrack): EditableTrack {
  return {
    ...track,
    name: track.name.trim() || "Track",
    channel: clampInteger(track.channel, 0, 15),
    instrument:
      track.instrument === undefined
        ? undefined
        : clampInteger(track.instrument, 0, 127),
  };
}

function nextDefaultChannel(song: EditableSong): number {
  const usedChannels = new Set(song.tracks.map((track) => track.channel));
  for (let channel = 0; channel <= 15; channel += 1) {
    if (!usedChannels.has(channel)) return channel;
  }
  return 0;
}

export function getTrackPracticeSetupImpact(
  change: "metadata" | "topology",
): TrackPracticeSetupImpact {
  return change === "metadata"
    ? { kind: "preserved" }
    : { kind: "reset-required", reason: "Track topology changed." };
}

export function addEditorTrack(
  song: EditableSong,
  input: AddEditorTrackInput,
): {
  song: EditableSong;
  selectedTrackId: string;
  practiceSetupImpact: TrackPracticeSetupImpact;
} {
  const track = normalizeTrack({
    id: input.id,
    name: input.name ?? `Track ${song.tracks.length + 1}`,
    channel: input.channel ?? nextDefaultChannel(song),
    instrument: input.instrument ?? 0,
  });

  return {
    song: {
      ...song,
      tracks: [...song.tracks, track],
    },
    selectedTrackId: track.id,
    practiceSetupImpact: getTrackPracticeSetupImpact("topology"),
  };
}

export function updateEditorTrack(
  song: EditableSong,
  trackId: string,
  patch: EditableTrackPatch,
): EditableSong {
  return {
    ...song,
    tracks: song.tracks.map((track) =>
      track.id === trackId ? normalizeTrack({ ...track, ...patch }) : track,
    ),
  };
}

export function deleteEditorTrack(
  song: EditableSong,
  trackId: string,
  selectedTrackId: string,
): {
  song: EditableSong;
  selectedTrackId: string | null;
  practiceSetupImpact: TrackPracticeSetupImpact;
} {
  if (
    song.tracks.length <= 1 &&
    song.tracks.some((track) => track.id === trackId)
  ) {
    return {
      song,
      selectedTrackId,
      practiceSetupImpact: getTrackPracticeSetupImpact("metadata"),
    };
  }

  const tracks = song.tracks.filter((track) => track.id !== trackId);
  const nextSelectedTrackId =
    selectedTrackId === trackId ? (tracks[0]?.id ?? null) : selectedTrackId;

  return {
    song: {
      ...song,
      tracks,
      notes: song.notes.filter((note) => note.trackId !== trackId),
    },
    selectedTrackId: nextSelectedTrackId,
    practiceSetupImpact: getTrackPracticeSetupImpact("topology"),
  };
}
