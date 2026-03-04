const SHARP_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;
const FLAT_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export function spellNoteName(midi: number, keySig = 0): string {
  const pc = midi % 12;
  return keySig < 0 ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

export function spellNote(midi: number, keySig = 0): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${spellNoteName(midi, keySig)}${octave}`;
}

export function midiToVexKey(midi: number, keySig = 0): string {
  const name = spellNoteName(midi, keySig).toLowerCase();
  const octave = Math.floor(midi / 12) - 1;
  return `${name}/${octave}`;
}
