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
    const rightNotes = parsed.tracks.find(
      (track) => track.name === "Right Hand",
    )?.notes;
    const leftNotes = parsed.tracks.find(
      (track) => track.name === "Left Hand",
    )?.notes;
    expect(rightNotes?.map((note) => note.midi)).toEqual([72]);
    expect(leftNotes?.map((note) => note.midi)).toEqual([48]);
  });

  test("writes a pickup as an implicit measure 0 and reads it back (#333)", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    const ppq = midi.header.ppq;
    midi.header.timeSignatures = [
      { ticks: 0, timeSignature: [1, 4] },
      { ticks: ppq, timeSignature: [3, 4] },
    ];
    const track = midi.addTrack();
    track.name = "Melody";
    // One-beat pickup, then a full 3/4 bar.
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.7 });
    track.addNote({ midi: 62, time: 0.5, duration: 0.5, velocity: 0.7 });
    track.addNote({ midi: 60, time: 1, duration: 0.5, velocity: 0.7 });
    track.addNote({ midi: 65, time: 1.5, duration: 0.5, velocity: 0.7 });

    const xml = midiToMusicXml(midi);
    expect(xml).toContain('<measure number="0" implicit="yes">');
    expect(xml).toContain("<beats>3</beats>");
    expect(xml).not.toContain("<beats>1</beats>");
    expect(xml.match(/<measure /g)).toHaveLength(2);

    const back = musicXmlToMidi(xml);
    expect(
      back.header.timeSignatures.map((ts) => [ts.ticks, ts.timeSignature]),
    ).toEqual([
      [0, [1, 4]],
      [back.header.ppq, [3, 4]],
    ]);
  });

  test("a note across a barline is tied, not re-struck (#333)", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    midi.header.timeSignatures = [{ ticks: 0, timeSignature: [2, 4] }];
    const track = midi.addTrack();
    track.name = "Melody";
    track.addNote({ midi: 64, time: 0, duration: 0.5, velocity: 0.7 });
    // Two beats starting on beat 2 of bar 1.
    track.addNote({ midi: 67, time: 0.5, duration: 1, velocity: 0.7 });

    const xml = midiToMusicXml(midi);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
    expect(xml).toContain('<tied type="start"/>');

    const parsed = parseMidiFile(
      "tied.mid",
      Array.from(musicXmlToMidi(xml).toArray()),
    );
    const notes = parsed.tracks.flatMap((entry) => entry.notes);
    expect(notes.map((n) => [n.midi, n.durationTicks])).toEqual([
      [64, parsed.ppq],
      [67, (parsed.ppq ?? 0) * 2],
    ]);
  });

  test("a held bass under moving notes in one hand keeps its timing (#334)", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    midi.header.timeSignatures = [{ ticks: 0, timeSignature: [3, 4] }];
    const right = midi.addTrack();
    right.name = "Right Hand";
    const left = midi.addTrack();
    left.name = "Left Hand";
    for (let bar = 0; bar < 2; bar++) {
      const t = bar * 1.5;
      right.addNote({ midi: 69, time: t, duration: 1.5, velocity: 0.7 });
      // Waltz bass: A2 held for the bar, chords on beats 2 and 3.
      left.addNote({ midi: 45, time: t, duration: 1.5, velocity: 0.6 });
      for (const beat of [1, 2]) {
        left.addNote({
          midi: 52,
          time: t + beat * 0.5,
          duration: 0.5,
          velocity: 0.6,
        });
        left.addNote({
          midi: 57,
          time: t + beat * 0.5,
          duration: 0.5,
          velocity: 0.6,
        });
      }
    }

    const xml = midiToMusicXml(midi);
    expect(xml).toContain("<voice>2</voice>");
    const parsed = parseMidiFile(
      "waltz.mid",
      Array.from(musicXmlToMidi(xml).toArray()),
    );
    const ppq = parsed.ppq ?? 0;
    const lh = parsed.tracks.find((t) => t.name === "Left Hand")?.notes ?? [];
    expect(
      lh.map((n) => [
        n.midi,
        (n.ticks ?? 0) / ppq,
        (n.durationTicks ?? 0) / ppq,
      ]),
    ).toEqual([
      [45, 0, 3],
      [52, 1, 1],
      [57, 1, 1],
      [52, 2, 1],
      [57, 2, 1],
      [45, 3, 3],
      [52, 4, 1],
      [57, 4, 1],
      [52, 5, 1],
      [57, 5, 1],
    ]);
  });
});
