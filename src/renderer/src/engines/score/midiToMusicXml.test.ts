import { Midi } from "@tonejs/midi";
import { describe, expect, test } from "vitest";
import { parseMidiFile } from "../midi/MidiFileParser";
import { midiToMusicXml } from "./midiToMusicXml";
import { musicXmlToMidi } from "./musicXmlToMidi";

describe("midiToMusicXml", () => {
  test("round-trips a monophonic melody through MusicXML", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    const track = midi.addTrack();
    track.name = "Melody";
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.7 });
    track.addNote({ midi: 64, time: 0.5, duration: 0.5, velocity: 0.7 });

    const xml = midiToMusicXml(midi, { title: "Test", composer: "Anon" });
    const parsed = parseMidiFile(
      "roundtrip.mid",
      Array.from(musicXmlToMidi(xml).toArray()),
    );
    const notes = parsed.tracks.flatMap((entry) => entry.notes);
    expect(notes.map((note) => note.midi)).toEqual([60, 64]);
    expect(notes[0].ticks).toBe(0);
    expect(notes[1].ticks).toBe(parsed.ppq);
  });

  test("writes two staves and reads them back as Right / Left Hand tracks", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    const right = midi.addTrack();
    right.name = "Right Hand";
    right.addNote({ midi: 72, time: 0, duration: 0.5, velocity: 0.7 });
    const left = midi.addTrack();
    left.name = "Left Hand";
    left.addNote({ midi: 48, time: 0, duration: 0.5, velocity: 0.7 });

    const xml = midiToMusicXml(midi, { title: "Hands" });
    expect(xml).toContain("<staves>2</staves>");
    expect(xml).toContain("<staff>2</staff>");

    const parsed = parseMidiFile(
      "hands.mid",
      Array.from(musicXmlToMidi(xml).toArray()),
    );
    const names = parsed.tracks.map((track) => track.name);
    expect(names).toEqual(expect.arrayContaining(["Right Hand", "Left Hand"]));
    const rightNotes = parsed.tracks.find((track) => track.name === "Right Hand")
      ?.notes;
    const leftNotes = parsed.tracks.find((track) => track.name === "Left Hand")
      ?.notes;
    expect(rightNotes?.map((note) => note.midi)).toEqual([72]);
    expect(leftNotes?.map((note) => note.midi)).toEqual([48]);
  });
});
