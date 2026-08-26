import { Midi } from "@tonejs/midi";

const DIVISIONS = 24;
const STEPS = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"] as const;
const ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0] as const;
const KEY_FIFTHS: Record<string, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
};

export interface MidiToMusicXmlOptions {
  title?: string;
  composer?: string;
}

interface TimedNote {
  midi: number;
  startBeats: number;
  durationBeats: number;
  staff: 1 | 2;
}

/**
 * P3 first slice: MIDI → MusicXML.
 * Does not change MidiToNotation display heuristics.
 */
export function midiToMusicXml(
  midi: Midi,
  options: MidiToMusicXmlOptions = {},
): string {
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const timeSignature = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const [beats, beatType] = timeSignature;
  const keyName = midi.header.keySignatures[0]?.key ?? "C";
  const keyScale =
    midi.header.keySignatures[0]?.scale === "minor" ? "minor" : "major";
  const fifths = KEY_FIFTHS[keyName] ?? 0;
  const secondsPerQuarter = 60 / bpm;
  const measureQuarters = beats * (4 / beatType);

  const notes = collectStaffNotes(midi, secondsPerQuarter);
  const staves: Array<1 | 2> = notes.some((note) => note.staff === 2)
    ? [1, 2]
    : [1];
  const lastBeat = notes.reduce(
    (max, note) => Math.max(max, note.startBeats + note.durationBeats),
    0,
  );
  const measureCount = Math.max(1, Math.ceil(lastBeat / measureQuarters - 1e-9));

  const measures = Array.from({ length: measureCount }, (_, index) => {
    const start = index * measureQuarters;
    const end = start + measureQuarters;
    return renderMeasure({
      number: index + 1,
      start,
      end,
      notes,
      staves,
      includeAttributes: index === 0,
      fifths,
      keyScale,
      beats,
      beatType,
      bpm,
    });
  }).join("\n");

  const title = escapeXml(options.title ?? "Untitled");
  const composer = escapeXml(options.composer ?? "Traditional");

  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <identification>
    <creator type="composer">${composer}</creator>
    <encoding>
      <software>Rexiano</software>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measures}
  </part>
</score-partwise>
`;
}

function collectStaffNotes(midi: Midi, secondsPerQuarter: number): TimedNote[] {
  const playable = midi.tracks.filter((track) => track.notes.length > 0);
  const notes: TimedNote[] = [];
  for (const track of playable) {
    const named = staffFromTrackName(track.name);
    for (const note of track.notes) {
      notes.push({
        midi: note.midi,
        startBeats: note.time / secondsPerQuarter,
        durationBeats: Math.max(note.duration / secondsPerQuarter, 1 / DIVISIONS),
        staff: named ?? (note.midi < 60 ? 2 : 1),
      });
    }
  }
  return notes.sort(
    (a, b) => a.startBeats - b.startBeats || a.staff - b.staff || a.midi - b.midi,
  );
}

function staffFromTrackName(name: string): 1 | 2 | null {
  const lower = name.toLowerCase();
  if (lower.includes("left")) return 2;
  if (lower.includes("right")) return 1;
  return null;
}

function renderMeasure(args: {
  number: number;
  start: number;
  end: number;
  notes: TimedNote[];
  staves: Array<1 | 2>;
  includeAttributes: boolean;
  fifths: number;
  keyScale: string;
  beats: number;
  beatType: number;
  bpm: number;
}): string {
  const staffChunks: string[] = [];
  let previousAdvance = 0;
  for (const staff of args.staves) {
    const { xml, advance } = renderStaffEvents({
      staff,
      start: args.start,
      end: args.end,
      notes: args.notes.filter((note) => note.staff === staff),
    });
    if (previousAdvance > 0) {
      staffChunks.push(
        `      <backup><duration>${Math.round(previousAdvance * DIVISIONS)}</duration></backup>`,
      );
    }
    staffChunks.push(xml);
    previousAdvance = advance;
  }

  const attributes = args.includeAttributes
    ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key>
          <fifths>${args.fifths}</fifths>
          <mode>${args.keyScale}</mode>
        </key>
        <time>
          <beats>${args.beats}</beats>
          <beat-type>${args.beatType}</beat-type>
        </time>
        <staves>${args.staves.length}</staves>
        <clef number="1">
          <sign>G</sign>
          <line>2</line>
        </clef>
${
  args.staves.includes(2)
    ? `        <clef number="2">
          <sign>F</sign>
          <line>4</line>
        </clef>
`
    : ""
}      </attributes>
      <sound tempo="${args.bpm}"/>
`
    : "";

  return `    <measure number="${args.number}">
${attributes}${staffChunks.join("\n")}
    </measure>`;
}

function renderStaffEvents(args: {
  staff: 1 | 2;
  start: number;
  end: number;
  notes: TimedNote[];
}): { xml: string; advance: number } {
  const events: string[] = [];
  let cursor = args.start;
  const inMeasure = args.notes
    .map((note) => ({
      ...note,
      startBeats: Math.max(note.startBeats, args.start),
      durationBeats: Math.min(
        note.startBeats + note.durationBeats,
        args.end,
      ) - Math.max(note.startBeats, args.start),
    }))
    .filter((note) => note.durationBeats > 1e-6)
    .sort((a, b) => a.startBeats - b.startBeats || a.midi - b.midi);

  for (const [index, note] of inMeasure.entries()) {
    const prev = inMeasure[index - 1];
    const isChord = Boolean(
      prev && Math.abs(prev.startBeats - note.startBeats) < 1e-6,
    );
    if (!isChord && note.startBeats > cursor + 1e-6) {
      events.push(restXml(note.startBeats - cursor, args.staff));
      cursor = note.startBeats;
    }
    events.push(noteXml(note, isChord));
    if (!isChord) cursor = note.startBeats + note.durationBeats;
  }

  if (cursor < args.end - 1e-6) {
    events.push(restXml(args.end - cursor, args.staff));
    cursor = args.end;
  }

  return { xml: events.join("\n"), advance: cursor - args.start };
}

function restXml(durationBeats: number, staff: 1 | 2): string {
  const duration = Math.max(1, Math.round(durationBeats * DIVISIONS));
  return `      <note>
        <rest/>
        <duration>${duration}</duration>
        <staff>${staff}</staff>
      </note>`;
}

function noteXml(note: TimedNote, isChord: boolean): string {
  const duration = Math.max(1, Math.round(note.durationBeats * DIVISIONS));
  const { step, alter, octave } = midiToPitch(note.midi);
  const alterXml =
    alter === 0 ? "" : `\n          <alter>${alter}</alter>`;
  const chordXml = isChord ? "\n        <chord/>" : "";
  return `      <note>${chordXml}
        <pitch>
          <step>${step}</step>${alterXml}
          <octave>${octave}</octave>
        </pitch>
        <duration>${duration}</duration>
        <staff>${note.staff}</staff>
      </note>`;
}

function midiToPitch(midi: number): {
  step: string;
  alter: number;
  octave: number;
} {
  const pc = ((midi % 12) + 12) % 12;
  return {
    step: STEPS[pc],
    alter: ALTERS[pc],
    octave: Math.floor(midi / 12) - 1,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
