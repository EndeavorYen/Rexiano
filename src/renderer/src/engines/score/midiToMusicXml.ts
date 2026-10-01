import { Midi } from "@tonejs/midi";
import { findPickup } from "../midi/pickup";

const DIVISIONS = 24;
const STEPS = [
  "C",
  "C",
  "D",
  "D",
  "E",
  "F",
  "F",
  "G",
  "G",
  "A",
  "A",
  "B",
] as const;
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
  /** 1-based voice within the staff */
  voice: number;
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
  const ppq = midi.header.ppq;
  const pickup = findPickup(
    midi.header.timeSignatures.map((ts) => ({
      ticks: ts.ticks,
      numerator: ts.timeSignature[0],
      denominator: ts.timeSignature[1],
    })),
    ppq,
  );
  // A pickup is written under the song's real meter, as measure 0.
  const [beats, beatType]: number[] = pickup
    ? [pickup.numerator, pickup.denominator]
    : (midi.header.timeSignatures[0]?.timeSignature ?? [4, 4]);
  const pickupQuarters = pickup ? pickup.ticks / ppq : 0;
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
  const measureCount = Math.max(
    1,
    Math.ceil((lastBeat - pickupQuarters) / measureQuarters - 1e-9),
  );
  const bounds: { number: number; start: number; end: number }[] = pickup
    ? [{ number: 0, start: 0, end: pickupQuarters }]
    : [];
  for (let index = 0; index < measureCount; index++) {
    const start = pickupQuarters + index * measureQuarters;
    bounds.push({ number: index + 1, start, end: start + measureQuarters });
  }

  const measures = bounds
    .map(({ number, start, end }, index) => {
      return renderMeasure({
        number,
        implicit: pickup !== null && index === 0,
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
    })
    .join("\n");

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
        durationBeats: Math.max(
          note.duration / secondsPerQuarter,
          1 / DIVISIONS,
        ),
        staff: named ?? (note.midi < 60 ? 2 : 1),
        voice: 1,
      });
    }
  }
  notes.sort(
    (a, b) =>
      a.startBeats - b.startBeats || a.staff - b.staff || a.midi - b.midi,
  );
  assignVoices(notes);
  return notes;
}

/**
 * Split each staff into voices so a note held under moving notes in the
 * same hand keeps its timing. A chord (same start, same length) stays in one
 * voice; anything that overlaps a sounding note moves to the next free voice.
 */
function assignVoices(notes: TimedNote[]): void {
  const voicesByStaff = new Map<
    number,
    { end: number; lastStart: number; lastDuration: number }[]
  >();
  for (const note of notes) {
    const voices = voicesByStaff.get(note.staff) ?? [];
    let index = voices.findIndex(
      (voice) =>
        Math.abs(voice.lastStart - note.startBeats) < 1e-6 &&
        Math.abs(voice.lastDuration - note.durationBeats) < 1e-6,
    );
    if (index < 0) {
      index = voices.findIndex((voice) => voice.end <= note.startBeats + 1e-6);
    }
    if (index < 0) {
      voices.push({ end: 0, lastStart: -1, lastDuration: -1 });
      index = voices.length - 1;
    }
    voices[index] = {
      end: Math.max(voices[index].end, note.startBeats + note.durationBeats),
      lastStart: note.startBeats,
      lastDuration: note.durationBeats,
    };
    note.voice = index + 1;
    voicesByStaff.set(note.staff, voices);
  }
}

function staffFromTrackName(name: string): 1 | 2 | null {
  const lower = name.toLowerCase();
  if (lower.includes("left")) return 2;
  if (lower.includes("right")) return 1;
  return null;
}

function renderMeasure(args: {
  number: number;
  implicit: boolean;
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
    const staffNotes = args.notes.filter((note) => note.staff === staff);
    const soundingVoices = new Set(
      staffNotes
        .filter(
          (note) =>
            note.startBeats < args.end - 1e-6 &&
            note.startBeats + note.durationBeats > args.start + 1e-6,
        )
        .map((note) => note.voice),
    );
    // Voice 1 always fills the bar; other voices only where they sound.
    const voices = [...new Set([1, ...soundingVoices])].sort((a, b) => a - b);
    for (const voice of voices) {
      const { xml, advance } = renderStaffEvents({
        staff,
        voice,
        start: args.start,
        end: args.end,
        notes: staffNotes.filter((note) => note.voice === voice),
      });
      if (previousAdvance > 0) {
        staffChunks.push(
          `      <backup><duration>${Math.round(previousAdvance * DIVISIONS)}</duration></backup>`,
        );
      }
      staffChunks.push(xml);
      previousAdvance = advance;
    }
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

  const implicit = args.implicit ? ' implicit="yes"' : "";
  return `    <measure number="${args.number}"${implicit}>
${attributes}${staffChunks.join("\n")}
    </measure>`;
}

function renderStaffEvents(args: {
  staff: 1 | 2;
  voice: number;
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
      durationBeats:
        Math.min(note.startBeats + note.durationBeats, args.end) -
        Math.max(note.startBeats, args.start),
      // A note crossing a barline is split and tied, not struck again.
      tiedFromPrevious: note.startBeats < args.start - 1e-6,
      tiedToNext: note.startBeats + note.durationBeats > args.end + 1e-6,
    }))
    .filter((note) => note.durationBeats > 1e-6)
    .sort((a, b) => a.startBeats - b.startBeats || a.midi - b.midi);

  for (const [index, note] of inMeasure.entries()) {
    const prev = inMeasure[index - 1];
    const isChord = Boolean(
      prev && Math.abs(prev.startBeats - note.startBeats) < 1e-6,
    );
    if (!isChord && note.startBeats > cursor + 1e-6) {
      events.push(restXml(note.startBeats - cursor, args.staff, args.voice));
      cursor = note.startBeats;
    }
    events.push(noteXml(note, isChord));
    if (!isChord) cursor = note.startBeats + note.durationBeats;
  }

  if (cursor < args.end - 1e-6) {
    events.push(restXml(args.end - cursor, args.staff, args.voice));
    cursor = args.end;
  }

  return { xml: events.join("\n"), advance: cursor - args.start };
}

function restXml(durationBeats: number, staff: 1 | 2, voice: number): string {
  const duration = Math.max(1, Math.round(durationBeats * DIVISIONS));
  return `      <note>
        <rest/>
        <duration>${duration}</duration>
        <voice>${voice}</voice>
        <staff>${staff}</staff>
      </note>`;
}

function noteXml(
  note: TimedNote & { tiedFromPrevious?: boolean; tiedToNext?: boolean },
  isChord: boolean,
): string {
  const duration = Math.max(1, Math.round(note.durationBeats * DIVISIONS));
  const { step, alter, octave } = midiToPitch(note.midi);
  const alterXml = alter === 0 ? "" : `\n          <alter>${alter}</alter>`;
  const chordXml = isChord ? "\n        <chord/>" : "";
  const tieTypes = [
    ...(note.tiedFromPrevious ? ["stop"] : []),
    ...(note.tiedToNext ? ["start"] : []),
  ];
  const tieXml = tieTypes
    .map((type) => `\n        <tie type="${type}"/>`)
    .join("");
  const notationsXml =
    tieTypes.length > 0
      ? `\n        <notations>${tieTypes
          .map((type) => `<tied type="${type}"/>`)
          .join("")}</notations>`
      : "";
  return `      <note>${chordXml}
        <pitch>
          <step>${step}</step>${alterXml}
          <octave>${octave}</octave>
        </pitch>
        <duration>${duration}</duration>${tieXml}
        <voice>${note.voice}</voice>
        <staff>${note.staff}</staff>${notationsXml}
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
