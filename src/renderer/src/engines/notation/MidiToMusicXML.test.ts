import { describe, it, expect } from "vitest";
import {
  midiToPitch,
  durationToMusicXML,
  convertToMusicXML,
} from "./MidiToMusicXML";
import type { ParsedNote } from "@renderer/engines/midi/types";

// ---------------------------------------------------------------------------
// Helper: create a ParsedNote at a given time with quarter-note BPM=120
// At 120 BPM, 1 beat = 0.5s, so quarter = 0.5s
// ---------------------------------------------------------------------------
function makeNote(
  midi: number,
  time: number,
  duration: number,
  velocity = 80,
): ParsedNote {
  return {
    midi,
    name: "",
    time,
    duration,
    velocity,
  };
}

// ---------------------------------------------------------------------------
// Task 3: midiToPitch
// ---------------------------------------------------------------------------
describe("midiToPitch", () => {
  it("converts C4 (MIDI 60)", () => {
    expect(midiToPitch(60)).toEqual({ step: "C", octave: 4 });
  });

  it("converts C#4 (MIDI 61)", () => {
    expect(midiToPitch(61)).toEqual({ step: "C", alter: 1, octave: 4 });
  });

  it("converts Bb3 (MIDI 58)", () => {
    expect(midiToPitch(58)).toEqual({ step: "B", alter: -1, octave: 3 });
  });

  it("converts A4 (MIDI 69)", () => {
    expect(midiToPitch(69)).toEqual({ step: "A", octave: 4 });
  });

  it("converts C2 (MIDI 36)", () => {
    expect(midiToPitch(36)).toEqual({ step: "C", octave: 2 });
  });

  it("converts C7 (MIDI 96)", () => {
    expect(midiToPitch(96)).toEqual({ step: "C", octave: 7 });
  });
});

// ---------------------------------------------------------------------------
// Task 3: durationToMusicXML
// ---------------------------------------------------------------------------
describe("durationToMusicXML", () => {
  const TPQ = 480;

  it("quarter note (480 ticks)", () => {
    const d = durationToMusicXML(480, TPQ);
    expect(d.type).toBe("quarter");
    expect(d.duration).toBe(480);
    expect(d.dots).toBeUndefined();
  });

  it("half note (960 ticks)", () => {
    const d = durationToMusicXML(960, TPQ);
    expect(d.type).toBe("half");
    expect(d.duration).toBe(960);
  });

  it("whole note (1920 ticks)", () => {
    const d = durationToMusicXML(1920, TPQ);
    expect(d.type).toBe("whole");
    expect(d.duration).toBe(1920);
  });

  it("eighth note (240 ticks)", () => {
    const d = durationToMusicXML(240, TPQ);
    expect(d.type).toBe("eighth");
    expect(d.duration).toBe(240);
  });

  it("16th note (120 ticks)", () => {
    const d = durationToMusicXML(120, TPQ);
    expect(d.type).toBe("16th");
    expect(d.duration).toBe(120);
  });

  it("dotted quarter (720 ticks)", () => {
    const d = durationToMusicXML(720, TPQ);
    expect(d.type).toBe("quarter");
    expect(d.dots).toBe(1);
  });

  it("dotted half (1440 ticks)", () => {
    const d = durationToMusicXML(1440, TPQ);
    expect(d.type).toBe("half");
    expect(d.dots).toBe(1);
  });

  it("non-standard duration falls back to nearest type", () => {
    // 500 ticks at TPQ=480 => ratio ~1.04, nearest is quarter (1.0)
    const d = durationToMusicXML(500, TPQ);
    expect(d.type).toBe("quarter");
    expect(d.duration).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Task 4: convertToMusicXML
// ---------------------------------------------------------------------------
describe("convertToMusicXML", () => {
  const TPQ = 480;
  const BPM = 120;
  // At 120 BPM: 1 quarter note = 0.5s

  it("produces valid XML structure for a simple C major scale (4 quarter notes)", () => {
    // C4, D4, E4, F4 — each a quarter note, sequential
    const notes: ParsedNote[] = [
      makeNote(60, 0.0, 0.5), // C4 at beat 1
      makeNote(62, 0.5, 0.5), // D4 at beat 2
      makeNote(64, 1.0, 0.5), // E4 at beat 3
      makeNote(65, 1.5, 0.5), // F4 at beat 4
    ];

    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    // Basic structure
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain('<part id="P1">');
    expect(xml).toContain("<part-name>Piano</part-name>");
    expect(xml).toContain(`<divisions>${TPQ}</divisions>`);

    // Time signature
    expect(xml).toContain("<beats>4</beats>");
    expect(xml).toContain("<beat-type>4</beat-type>");

    // Staves and clefs
    expect(xml).toContain("<staves>2</staves>");
    expect(xml).toContain(
      '<clef number="1"><sign>G</sign><line>2</line></clef>',
    );
    expect(xml).toContain(
      '<clef number="2"><sign>F</sign><line>4</line></clef>',
    );

    // Notes should have pitch elements
    expect(xml).toContain("<step>C</step>");
    expect(xml).toContain("<step>D</step>");
    expect(xml).toContain("<step>E</step>");
    expect(xml).toContain("<step>F</step>");

    // Quarter note durations
    expect(xml).toContain(`<duration>${TPQ}</duration>`);
    expect(xml).toContain("<type>quarter</type>");

    // Staff and voice for treble
    expect(xml).toContain("<staff>1</staff>");
    expect(xml).toContain("<voice>1</voice>");

    // Backup for bass voice
    expect(xml).toContain("<backup>");
  });

  it("handles parallel octaves (Hanon-style, single track) with staff/voice/backup", () => {
    // Simultaneous C3 + C4 — should split into bass and treble
    const notes: ParsedNote[] = [
      makeNote(48, 0.0, 0.5), // C3 (should go to bass)
      makeNote(60, 0.0, 0.5), // C4 (should go to treble)
      makeNote(50, 0.5, 0.5), // D3
      makeNote(62, 0.5, 0.5), // D4
    ];

    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    // Should have both staves
    expect(xml).toContain("<staff>1</staff>");
    expect(xml).toContain("<staff>2</staff>");
    expect(xml).toContain("<voice>1</voice>");
    expect(xml).toContain("<voice>2</voice>");

    // Backup element between voices
    expect(xml).toContain("<backup>");
  });

  it("renders key signature with 2 sharps", () => {
    const notes: ParsedNote[] = [makeNote(62, 0.0, 0.5)]; // D4
    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 2, 0, 1);

    expect(xml).toContain("<fifths>2</fifths>");
  });

  it("renders 3/4 time signature", () => {
    const notes: ParsedNote[] = [makeNote(60, 0.0, 0.5)]; // C4
    const xml = convertToMusicXML(notes, BPM, TPQ, 3, 4, 0, 0, 1);

    expect(xml).toContain("<beats>3</beats>");
    expect(xml).toContain("<beat-type>4</beat-type>");
  });

  it("generates tied notes across measure boundaries", () => {
    // A note that spans from beat 4 into the next measure
    // At 120 BPM, beat 4 starts at 1.5s, a whole note lasts 2s
    // In 4/4 with TPQ=480: measure = 1920 ticks
    // Note at 1.5s = tick 1440, duration 2s = 1920 ticks → end tick 3360
    // Measure 1 ends at 1920, so note splits at measure boundary
    const notes: ParsedNote[] = [
      makeNote(60, 1.5, 1.0), // C4 starting on beat 4, lasting 2 beats
    ];

    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    // Should have tie elements
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
    expect(xml).toContain('<tied type="start"/>');
    expect(xml).toContain('<tied type="stop"/>');
  });

  it("produces whole rests for empty input", () => {
    const xml = convertToMusicXML([], BPM, TPQ, 4, 4, 0, 0, 1);

    expect(xml).toContain("<rest/>");
    // Whole rest duration = 1920 (4 quarters * 480)
    expect(xml).toContain(`<duration>${TPQ * 4}</duration>`);
    expect(xml).toContain("<type>whole</type>");
  });

  it("outputs MusicXML note elements in DTD-compliant order (voice → type → staff)", () => {
    const notes: ParsedNote[] = [makeNote(60, 0.0, 0.5)]; // C4 quarter
    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    // MusicXML DTD requires: pitch → duration → voice → type → staff
    const voiceIdx = xml.indexOf("<voice>");
    const typeIdx = xml.indexOf("<type>");
    const staffIdx = xml.indexOf("<staff>");

    expect(voiceIdx).toBeGreaterThan(-1);
    expect(typeIdx).toBeGreaterThan(-1);
    expect(staffIdx).toBeGreaterThan(-1);

    // voice must come before type, type before staff
    expect(voiceIdx).toBeLessThan(typeIdx);
    expect(typeIdx).toBeLessThan(staffIdx);
  });

  it("produces well-formed XML with all required MusicXML elements", () => {
    const notes: ParsedNote[] = [
      makeNote(60, 0.0, 0.5), // C4
      makeNote(48, 0.0, 0.5), // C3 (bass)
      makeNote(62, 0.5, 0.5), // D4
      makeNote(50, 0.5, 0.5), // D3 (bass)
    ];
    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    // Root structure
    expect(xml).toContain('<score-partwise version="4.0">');
    expect(xml).toContain("</score-partwise>");

    // Part list
    expect(xml).toContain("<part-list>");
    expect(xml).toContain('<score-part id="P1">');
    expect(xml).toContain("</part-list>");

    // Part with measures
    expect(xml).toContain('<part id="P1">');
    expect(xml).toContain('<measure number="1">');

    // First measure attributes
    expect(xml).toContain(`<divisions>${TPQ}</divisions>`);
    expect(xml).toContain("<key><fifths>0</fifths></key>");
    expect(xml).toContain("<staves>2</staves>");
    expect(xml).toContain(
      '<clef number="1"><sign>G</sign><line>2</line></clef>',
    );
    expect(xml).toContain(
      '<clef number="2"><sign>F</sign><line>4</line></clef>',
    );

    // Every <note> must have <duration>, <voice>, <type>, <staff>
    // and either <pitch> or <rest/>
    const noteBlocks = xml.split("<note>").slice(1); // skip text before first <note>
    expect(noteBlocks.length).toBeGreaterThan(0);
    for (const block of noteBlocks) {
      const noteXml = block.split("</note>")[0];
      expect(noteXml).toMatch(/<duration>\d+<\/duration>/);
      expect(noteXml).toMatch(/<voice>[12]<\/voice>/);
      expect(noteXml).toMatch(/<type>\w+<\/type>/);
      expect(noteXml).toMatch(/<staff>[12]<\/staff>/);
      const hasPitch = noteXml.includes("<pitch>");
      const hasRest = noteXml.includes("<rest/>");
      expect(hasPitch || hasRest).toBe(true);
    }

    // Backup elements for bass voice
    expect(xml).toContain("<backup><duration>");

    // XML must be well-formed: all opened tags must close
    // (basic check — count matching open/close for key elements)
    const countTag = (tag: string): [number, number] => [
      (xml.match(new RegExp(`<${tag}[> /]`, "g")) || []).length,
      (xml.match(new RegExp(`</${tag}>`, "g")) || []).length +
        (xml.match(new RegExp(`<${tag}/>`, "g")) || []).length,
    ];
    for (const tag of ["score-partwise", "part-list", "part", "note"]) {
      const [open, close] = countTag(tag);
      expect(open).toBe(close);
    }
  });

  it("includes external DOCTYPE declaration (current behavior — remove if it causes offline issues)", () => {
    const notes: ParsedNote[] = [makeNote(60, 0.0, 0.5)];
    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    // The DOCTYPE references http://www.musicxml.org which may fail offline.
    // This test documents current behavior — flip assertion if we remove it.
    const hasDoctype = xml.includes("<!DOCTYPE");
    expect(hasDoctype).toBe(true);
  });

  it("Hanon-like input: 8th notes at 60 BPM with typical MIDI articulation produce eighth note types", () => {
    // At 60 BPM, 8th note onset spacing = 0.5s
    // Typical MIDI articulation: note-off at ~70% of spacing = 0.35s duration
    const notes: ParsedNote[] = [];
    const spacing = 0.5; // 8th note at 60 BPM
    const articulation = 0.35; // 70% of spacing (typical piano)

    // 8 notes in treble (C4-G4 ascending pattern)
    const treblePitches = [60, 64, 62, 65, 64, 67, 65, 69];
    // 8 notes in bass (C3-G3 ascending pattern)
    const bassPitches = [48, 52, 50, 53, 52, 55, 53, 57];

    for (let i = 0; i < 8; i++) {
      notes.push(makeNote(treblePitches[i], i * spacing, articulation));
      notes.push(makeNote(bassPitches[i], i * spacing, articulation));
    }

    const xml = convertToMusicXML(notes, 60, TPQ, 4, 4, 0, 0, 1);

    // Count note types — all pitched notes should be eighths, no 16ths
    const sixteenthCount = (xml.match(/<type>16th<\/type>/g) || []).length;
    const eighthCount = (xml.match(/<type>eighth<\/type>/g) || []).length;
    expect(eighthCount).toBeGreaterThanOrEqual(16);
    expect(sixteenthCount).toBe(0);

    // Should have no rests interspersed between notes (no articulation gaps)
    expect(xml).not.toMatch(
      /<type>eighth<\/type>.*<rest\/>.*<type>16th<\/type>/s,
    );
  });

  it("adds a light-heavy barline on the last measure", () => {
    const notes: ParsedNote[] = [makeNote(60, 0.0, 0.5)]; // C4 quarter
    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    expect(xml).toContain(
      '<barline location="right"><bar-style>light-heavy</bar-style></barline>',
    );
  });

  it("has the light-heavy barline exactly once (only on last measure)", () => {
    // Two measures worth of notes
    const notes: ParsedNote[] = [
      makeNote(60, 0.0, 0.5), // measure 1
      makeNote(62, 0.5, 0.5),
      makeNote(64, 1.0, 0.5),
      makeNote(65, 1.5, 0.5),
      makeNote(67, 2.0, 0.5), // measure 2
      makeNote(69, 2.5, 0.5),
      makeNote(71, 3.0, 0.5),
      makeNote(72, 3.5, 0.5),
    ];
    const xml = convertToMusicXML(notes, BPM, TPQ, 4, 4, 0, 0, 1);

    const matches = xml.match(/light-heavy/g) || [];
    expect(matches.length).toBe(1);
  });

  it("handles multi-track (2 tracks) with track-based staff assignment", () => {
    // Track 0 = treble, Track 1 = bass (for 2-track piano)
    const notes: ParsedNote[] = [
      makeNote(60, 0.0, 0.5), // C4 in track 0 (treble)
      makeNote(48, 0.0, 0.5), // C3 in track 1 (bass)
    ];
    const trackIndices = [0, 1];

    const xml = convertToMusicXML(
      notes,
      BPM,
      TPQ,
      4,
      4,
      0,
      0,
      2, // 2 tracks
      undefined,
      undefined,
      trackIndices,
    );

    // Both staves should be present
    expect(xml).toContain("<staff>1</staff>");
    expect(xml).toContain("<staff>2</staff>");

    // C4 in treble (octave 4), C3 in bass (octave 3)
    expect(xml).toContain("<octave>4</octave>");
    expect(xml).toContain("<octave>3</octave>");
  });
});
