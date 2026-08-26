import { Midi } from "@tonejs/midi";

const STEP_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

interface ScoreNote {
  midi: number;
  startBeats: number;
  durationBeats: number;
  staff: number;
}

/**
 * Convert a MusicXML partwise score into a Tone.js MIDI object.
 *
 * Reads every part and staff. Staff 1 becomes Right Hand, staff 2 Left Hand
 * when a part has more than one staff.
 */
export function musicXmlToMidi(xml: string): Midi {
  const root = parseXmlDocument(xml);
  const score =
    findFirst(root, "score-partwise") ??
    (root.name === "score-partwise" ? root : undefined);
  const parts = score
    ? collect(score, "part")
    : collect(root, "part");
  if (parts.length === 0) {
    throw new Error("MusicXML score has no part.");
  }

  const midi = new Midi();
  midi.header.setTempo(120);
  let tempoBpm = 120;
  let timeSignature: [number, number] = [4, 4];
  let keyAccidentals = 0;
  let keyScale: "major" | "minor" = "major";
  const partNames = new Map<string, string>();
  for (const scorePart of collect(
    findFirst(root, "part-list") ?? root,
    "score-part",
  )) {
    partNames.set(scorePart.attrs.id ?? "", childText(scorePart, "part-name"));
  }
  const parsedParts = parts.map((part) => ({
    part,
    parsed: readPart(part),
  }));
  tempoBpm = parsedParts[0]?.parsed.tempoBpm ?? 120;
  timeSignature = parsedParts[0]?.parsed.timeSignature ?? [4, 4];
  keyAccidentals = parsedParts[0]?.parsed.keyAccidentals ?? 0;
  keyScale = parsedParts[0]?.parsed.keyScale ?? "major";
  midi.header.setTempo(tempoBpm);

  for (const { part, parsed } of parsedParts) {
    const partName = partNames.get(part.attrs.id ?? "") || "Piano";
    const staffIds = [...new Set(parsed.notes.map((note) => note.staff))].sort(
      (a, b) => a - b,
    );
    const splitHands = staffIds.length > 1;
    for (const staff of staffIds.length > 0 ? staffIds : [1]) {
      const track = midi.addTrack();
      track.channel = 0;
      track.name = splitHands
        ? staff === 1
          ? "Right Hand"
          : "Left Hand"
        : partName;
      const secondsPerBeat = 60 / parsed.tempoBpm;
      for (const note of parsed.notes.filter((entry) => entry.staff === staff)) {
        if (note.durationBeats <= 0) continue;
        track.addNote({
          midi: note.midi,
          time: note.startBeats * secondsPerBeat,
          duration: note.durationBeats * secondsPerBeat,
          velocity: 0.7,
        });
      }
    }
  }
  midi.header.timeSignatures = [
    { ticks: 0, timeSignature, measures: 0 },
  ];
  midi.header.keySignatures = [
    {
      ticks: 0,
      key: keyNameFromFifths(keyAccidentals),
      scale: keyScale,
    },
  ];
  return midi;
}

function readPart(part: XmlNode): {
  notes: ScoreNote[];
  tempoBpm: number;
  timeSignature: [number, number];
  keyAccidentals: number;
  keyScale: "major" | "minor";
} {
  let divisions = 1;
  let tempoBpm = 120;
  let cursorDivisions = 0;
  let lastNoteStart = 0;
  let timeSignature: [number, number] = [4, 4];
  let keyAccidentals = 0;
  let keyScale: "major" | "minor" = "major";
  const notes: ScoreNote[] = [];

  for (const measure of collect(part, "measure")) {
    for (const child of measure.children) {
      if (child.name === "attributes") {
        const rawDivisions = Number(childText(child, "divisions"));
        if (Number.isFinite(rawDivisions) && rawDivisions > 0) {
          divisions = rawDivisions;
        }
        const fifths = Number(childText(findFirst(child, "key"), "fifths"));
        if (Number.isFinite(fifths)) keyAccidentals = fifths;
        const mode = childText(findFirst(child, "key"), "mode").toLowerCase();
        if (mode === "minor" || mode === "major") keyScale = mode;
        const beats = Number(childText(findFirst(child, "time"), "beats"));
        const beatType = Number(childText(findFirst(child, "time"), "beat-type"));
        if (
          Number.isInteger(beats) &&
          beats > 0 &&
          Number.isInteger(beatType) &&
          beatType > 0
        ) {
          timeSignature = [beats, beatType];
        }
        continue;
      }

      if (child.name === "direction" || child.name === "sound") {
        const tempo = readTempo(child);
        if (tempo !== undefined) tempoBpm = tempo;
        continue;
      }

      if (child.name === "backup") {
        cursorDivisions -= Math.max(
          0,
          Number(childText(child, "duration")) || 0,
        );
        continue;
      }

      if (child.name === "forward") {
        cursorDivisions += Math.max(
          0,
          Number(childText(child, "duration")) || 0,
        );
        continue;
      }

      if (child.name !== "note") continue;

      const durationDivisions = Math.max(
        0,
        Number(childText(child, "duration")) || 0,
      );
      const isChord = child.children.some((node) => node.name === "chord");
      const startDivisions = isChord ? lastNoteStart : cursorDivisions;
      if (!isChord) {
        lastNoteStart = startDivisions;
        cursorDivisions += durationDivisions;
      }

      if (child.children.some((node) => node.name === "rest")) continue;

      const pitch = findFirst(child, "pitch");
      if (!pitch) continue;

      const staffRaw = Number(childText(child, "staff"));
      notes.push({
        midi: pitchToMidi(pitch),
        startBeats: startDivisions / divisions,
        durationBeats: durationDivisions / divisions,
        staff: Number.isInteger(staffRaw) && staffRaw > 0 ? staffRaw : 1,
      });
    }
  }

  return { notes, tempoBpm, timeSignature, keyAccidentals, keyScale };
}

const KEY_NAMES_BY_FIFTHS = [
  "Cb",
  "Gb",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
] as const;

function keyNameFromFifths(fifths: number): string {
  const clamped = Math.max(-7, Math.min(7, Math.round(fifths)));
  return KEY_NAMES_BY_FIFTHS[clamped + 7] ?? "C";
}

function pitchToMidi(pitch: XmlNode): number {
  const step = childText(pitch, "step").toUpperCase();
  const octave = Number(childText(pitch, "octave"));
  const alter = Number(childText(pitch, "alter") || "0");
  const semitone = STEP_SEMITONES[step];
  if (semitone === undefined || !Number.isInteger(octave)) {
    throw new Error(`Unsupported MusicXML pitch: ${step}${octave}`);
  }
  return (octave + 1) * 12 + semitone + (Number.isFinite(alter) ? alter : 0);
}

function readTempo(node: XmlNode): number | undefined {
  const direct = Number(node.attrs.tempo);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const sound = findFirst(node, "sound");
  const soundTempo = Number(sound?.attrs.tempo);
  if (Number.isFinite(soundTempo) && soundTempo > 0) return soundTempo;

  const perMinute = Number(
    childText(findFirst(node, "metronome"), "per-minute"),
  );
  if (Number.isFinite(perMinute) && perMinute > 0) return perMinute;

  return undefined;
}

function parseXmlDocument(xml: string): XmlNode {
  const stripped = xml
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const parsed = parseElement(stripped, 0);
  if (!parsed) {
    throw new Error("MusicXML is empty.");
  }
  return parsed.node;
}

function parseElement(
  input: string,
  start: number,
): { node: XmlNode; next: number } | null {
  let index = skipWhitespace(input, start);
  if (input[index] !== "<" || input[index + 1] === "/") return null;

  const nameStart = index + 1;
  const nameEnd = readNameEnd(input, nameStart);
  const name = input.slice(nameStart, nameEnd);
  const { attrs, next: afterAttrs } = parseAttributes(input, nameEnd);
  index = skipWhitespace(input, afterAttrs);

  if (input.startsWith("/>", index)) {
    return {
      node: { name, attrs, children: [], text: "" },
      next: index + 2,
    };
  }
  if (input[index] !== ">") {
    throw new Error(`Malformed MusicXML tag <${name}>.`);
  }
  index += 1;

  const children: XmlNode[] = [];
  let text = "";
  while (index < input.length) {
    if (input.startsWith("</", index)) {
      const closeEnd = input.indexOf(">", index);
      if (closeEnd < 0) throw new Error(`Unclosed MusicXML tag </${name}>.`);
      return {
        node: { name, attrs, children, text: text.trim() },
        next: closeEnd + 1,
      };
    }

    if (input[index] === "<") {
      const child = parseElement(input, index);
      if (!child) {
        throw new Error(`Malformed MusicXML near <${name}>.`);
      }
      children.push(child.node);
      index = child.next;
      continue;
    }

    const nextTag = input.indexOf("<", index);
    const end = nextTag < 0 ? input.length : nextTag;
    text += input.slice(index, end);
    index = end;
  }

  throw new Error(`Unclosed MusicXML tag <${name}>.`);
}

function parseAttributes(
  input: string,
  start: number,
): { attrs: Record<string, string>; next: number } {
  const attrs: Record<string, string> = {};
  let index = skipWhitespace(input, start);
  while (
    index < input.length &&
    input[index] !== ">" &&
    !input.startsWith("/>", index)
  ) {
    const nameEnd = readNameEnd(input, index);
    const attrName = input.slice(index, nameEnd);
    index = skipWhitespace(input, nameEnd);
    if (input[index] !== "=") {
      throw new Error(`Malformed MusicXML attribute ${attrName}.`);
    }
    index = skipWhitespace(input, index + 1);
    const quote = input[index];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`Malformed MusicXML attribute ${attrName}.`);
    }
    const valueEnd = input.indexOf(quote, index + 1);
    if (valueEnd < 0) {
      throw new Error(`Unclosed MusicXML attribute ${attrName}.`);
    }
    attrs[attrName] = input.slice(index + 1, valueEnd);
    index = skipWhitespace(input, valueEnd + 1);
  }
  return { attrs, next: index };
}

function readNameEnd(input: string, start: number): number {
  let index = start;
  while (index < input.length && /[:A-Za-z0-9_-]/.test(input[index])) {
    index += 1;
  }
  return index;
}

function skipWhitespace(input: string, start: number): number {
  let index = start;
  while (index < input.length && /\s/.test(input[index])) index += 1;
  return index;
}

function findFirst(
  node: XmlNode | undefined,
  name: string,
): XmlNode | undefined {
  if (!node) return undefined;
  if (node.name === name) return node;
  for (const child of node.children) {
    const found = findFirst(child, name);
    if (found) return found;
  }
  return undefined;
}

function collect(node: XmlNode, name: string): XmlNode[] {
  return node.children.filter((child) => child.name === name);
}

function childText(node: XmlNode | undefined, name: string): string {
  if (!node) return "";
  const child = node.children.find((entry) => entry.name === name);
  return child?.text ?? "";
}
