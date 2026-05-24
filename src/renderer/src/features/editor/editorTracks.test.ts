import { describe, expect, test } from "vitest";
import {
  addEditorTrack,
  deleteEditorTrack,
  getTrackPracticeSetupImpact,
  updateEditorTrack,
} from "./editorTracks";
import type { EditableSong } from "./editorTypes";

const song: EditableSong = {
  id: "song-1",
  title: "Tracks fixture",
  ppq: 480,
  tempoBpm: 120,
  tracks: [
    { id: "track-1", name: "Right Hand", channel: 0, instrument: 0 },
    { id: "track-2", name: "Left Hand", channel: 1, instrument: 0 },
  ],
  notes: [
    {
      id: "note-1",
      trackId: "track-1",
      pitch: 72,
      start: 0,
      duration: 0.5,
      velocity: 90,
    },
    {
      id: "note-2",
      trackId: "track-2",
      pitch: 48,
      start: 0,
      duration: 0.5,
      velocity: 80,
    },
  ],
};

describe("editorTracks", () => {
  test("adds a track with safe default metadata", () => {
    const result = addEditorTrack(song, { id: "track-3" });

    expect(result.song.tracks.at(-1)).toEqual({
      id: "track-3",
      name: "Track 3",
      channel: 2,
      instrument: 0,
    });
    expect(result.selectedTrackId).toBe("track-3");
    expect(result.practiceSetupImpact).toEqual({
      kind: "reset-required",
      reason: "Track topology changed.",
    });
  });

  test("renames and updates channel/instrument metadata", () => {
    const result = updateEditorTrack(song, "track-1", {
      name: "Lead",
      channel: 99,
      instrument: -2,
    });

    expect(result.tracks[0]).toEqual({
      id: "track-1",
      name: "Lead",
      channel: 15,
      instrument: 0,
    });
  });

  test("deletes a track and removes its notes", () => {
    const result = deleteEditorTrack(song, "track-1", "track-1");

    expect(result.song.tracks).toEqual([song.tracks[1]]);
    expect(result.song.notes).toEqual([song.notes[1]]);
    expect(result.selectedTrackId).toBe("track-2");
  });

  test("keeps the final track when delete would leave the song empty", () => {
    const oneTrackSong: EditableSong = {
      ...song,
      tracks: [song.tracks[0]],
      notes: [song.notes[0]],
    };

    const result = deleteEditorTrack(oneTrackSong, "track-1", "track-1");

    expect(result.song).toBe(oneTrackSong);
    expect(result.selectedTrackId).toBe("track-1");
    expect(result.practiceSetupImpact).toEqual({ kind: "preserved" });
  });

  test("keeps practice setup when only metadata changes", () => {
    expect(getTrackPracticeSetupImpact("metadata")).toEqual({
      kind: "preserved",
    });
    expect(getTrackPracticeSetupImpact("topology")).toEqual({
      kind: "reset-required",
      reason: "Track topology changed.",
    });
  });
});
