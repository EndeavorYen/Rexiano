import { Midi } from "@tonejs/midi";
import type { EditableSong } from "./editorTypes";

export interface MusicXmlExportBoundary {
  status: "deferred";
  reason: string;
  followUp: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function serializeEditableSongToMidiData(song: EditableSong): number[] {
  const midi = new Midi();
  midi.header.name = song.title;
  midi.header.setTempo(song.tempoBpm);

  for (const editableTrack of song.tracks) {
    const track = midi.addTrack();
    track.name = editableTrack.name;
    track.channel = clamp(Math.round(editableTrack.channel), 0, 15);
    if (editableTrack.instrument !== undefined) {
      track.instrument.number = clamp(
        Math.round(editableTrack.instrument),
        0,
        127,
      );
    }

    const trackNotes = song.notes
      .filter((note) => note.trackId === editableTrack.id)
      .sort((a, b) => a.start - b.start || a.pitch - b.pitch);

    for (const note of trackNotes) {
      track.addNote({
        midi: clamp(Math.round(note.pitch), 0, 127),
        time: Math.max(0, note.start),
        duration: Math.max(0.03125, note.duration),
        velocity: clamp(Math.round(note.velocity), 1, 127) / 127,
      });
    }
  }

  return Array.from(midi.toArray());
}

export function buildMidiExportFileName(title: string): string {
  const baseName = title
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${baseName || "rexiano-export"}.mid`;
}

export function getMusicXmlExportBoundary(): MusicXmlExportBoundary {
  return {
    status: "deferred",
    reason:
      "MusicXML export needs notation-specific measure, voice, tie, and rest semantics beyond the piano-roll MIDI model.",
    followUp:
      "Track as a later notation-export issue after MIDI editing stabilizes.",
  };
}
