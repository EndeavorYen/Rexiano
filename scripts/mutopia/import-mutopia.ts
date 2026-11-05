/**
 * Import public-domain teaching pieces from the Mutopia Project.
 *
 * Run (needs Python + `pip install lilypond`):
 *   pnpm exec jiti scripts/mutopia/import-mutopia.ts --mutopia <clone> [--only id,id]
 *
 * <clone> is a checkout of github.com/MutopiaProject/mutopiaproject.
 * For each piece in manifest.json this renders the LilyPond source to MIDI
 * (ly2midi.py: repeats unfolded, grace notes dropped), fixes the pickup bar,
 * names the hands, sets one tempo, writes public/midi/<id>.mid and upserts
 * the songs.json entry. Afterwards run `pnpm generate:songs`, which writes
 * public/scores/<id>.musicxml — from then on the score is the source of truth.
 */
import { Midi } from "@tonejs/midi";
import { execFileSync } from "child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { builtinScoreFileName } from "../../src/engines/score/builtinScoreSource";
import {
  computeMidiDurationSeconds,
  type Grade,
  type SongMeta,
} from "../generatedSongLibrary";
import { formatSongsJson } from "../generate-songs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const midiDir = join(root, "public", "midi");
const scoresDir = join(root, "public", "scores");

interface Piece {
  id: string;
  source: string;
  score?: number;
  title: string;
  titleZhTW: string;
  composer: string;
  grade: Grade;
  bpm: number;
  tags: string[];
  aliases: string[];
}

interface BarEntry {
  bar: number;
  start: number;
  length: number;
}

function rational(text: string): number {
  const [num, den] = text.split("/");
  return Number(num) / (den === undefined ? 1 : Number(den));
}

/** Bars of one \score, as logged by the engraver in ly2midi.py. */
export function parseBarLog(
  log: string,
  scoreIndex: number,
  whole: number,
): BarEntry[] {
  const scores = log.split("SCORE").slice(1);
  const lines = (scores[scoreIndex] ?? "").trim().split("\n").filter(Boolean);
  const bars: BarEntry[] = [];
  const seen = new Set<number>();
  for (const line of lines) {
    const [bar, now, position, length] = line.trim().split(/\s+/);
    const number = Number(bar);
    if (!Number.isInteger(number) || seen.has(number)) continue;
    seen.add(number);
    bars.push({
      bar: number,
      start: Math.round((rational(now) - rational(position)) * whole),
      length: Math.round(rational(length) * whole),
    });
  }
  return bars.sort((a, b) => a.start - b.start);
}

/** Where "Fine." and "D.C. al Fine" sit in one \score, in ticks. */
export function parseDaCapo(
  log: string,
  scoreIndex: number,
  whole: number,
): { fine: number; daCapo: number } | null {
  const scores = log.split("SCORE").slice(1);
  const marks = (scores[scoreIndex] ?? "")
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([kind]) => kind === "FINE" || kind === "DC")
    .map(([kind, at]) => ({ kind, at: Math.round(rational(at) * whole) }));
  const daCapo = marks.find((mark) => mark.kind === "DC");
  const fine = marks.find((mark) => mark.kind === "FINE");
  return daCapo && fine ? { fine: fine.at, daCapo: daCapo.at } : null;
}

/**
 * Bars whose real length differs from the meter. A short bar followed by its
 * complement (end of a repeat, then the pickup again) fills exactly one bar,
 * so the grid continues and nothing is reported. Any other odd bar comes
 * back with its real length so the converter can give it its own meter.
 */
export function irregularBars(
  bars: readonly BarEntry[],
): { start: number; span: number; next: number; meterLength: number }[] {
  const odd: {
    start: number;
    span: number;
    next: number;
    meterLength: number;
  }[] = [];
  for (let i = 0; i < bars.length - 1; i++) {
    const span = bars[i + 1].start - bars[i].start;
    const length = bars[i].length;
    if (span % length === 0) continue;
    const following =
      i + 2 < bars.length ? bars[i + 2].start - bars[i + 1].start : null;
    if (span < length && following !== null && span + following === length) {
      i++; // complementary pair
      continue;
    }
    odd.push({
      start: bars[i].start,
      span,
      next: bars[i + 1].start,
      meterLength: length,
    });
  }
  return odd;
}

function renderMidi(mutopia: string, piece: Piece, work: string): string {
  const src = join(mutopia, "ftp", piece.source);
  const out = join(work, basename(piece.source, ".ly"));
  if (!existsSync(join(out, "barlog.txt"))) {
    execFileSync("python3", ["-I", join(here, "ly2midi.py"), src, out], {
      stdio: "inherit",
    });
  }
  return out;
}

function convert(
  piece: Piece,
  out: string,
): { midi: Midi; warnings: string[] } {
  const index = piece.score ?? 0;
  const file = join(out, index === 0 ? "out.midi" : `out-${index}.midi`);
  const source = new Midi(readFileSync(file));
  // Everything below is in the new file's ticks (@tonejs/midi writes 480 ppq;
  // LilyPond writes 384).
  const midi = new Midi();
  const ppq = midi.header.ppq;
  const whole = ppq * 4;
  const scale = (ticks: number, exact = true): number => {
    const scaled = (ticks * ppq) / source.header.ppq;
    if (exact && Math.abs(scaled - Math.round(scaled)) > 1e-6) {
      throw new Error(`${piece.id}: tick ${ticks} does not fit ${ppq} ppq`);
    }
    return Math.round(scaled);
  };
  const warnings: string[] = [];

  const log = readFileSync(join(out, "barlog.txt"), "utf8");
  const bars = parseBarLog(log, index, whole);
  // A pickup that ends off the beat (3 eighths in 4/4) would put every later
  // beat off the grid. Open with a short rest so the downbeat lands on a beat.
  const firstMeter = source.header.timeSignatures.find((ts) => ts.ticks === 0);
  const beat = (firstMeter?.timeSignature[1] ?? 4) <= 4 ? ppq : ppq / 2;
  const firstStart = bars[0]?.start ?? 0;
  const pad =
    firstStart > 0 && firstStart % beat !== 0 ? beat - (firstStart % beat) : 0;
  for (const bar of bars) bar.start += pad;
  const at = (ticks: number): number => scale(ticks) + pad;

  const odd = irregularBars(bars);
  if (odd.length > 0) {
    warnings.push(
      `odd bars at beat ${odd.map((o) => o.start / ppq).join(", ")}`,
    );
  }

  const playable = source.tracks.filter((t) => t.notes.length > 0);
  if (playable.length !== 2) {
    throw new Error(`${piece.id}: expected 2 staves, got ${playable.length}`);
  }

  midi.header.setTempo(piece.bpm);
  midi.header.timeSignatures = source.header.timeSignatures.map((ts) => ({
    ticks: ts.ticks === 0 ? 0 : at(ts.ticks),
    timeSignature: [...ts.timeSignature],
  }));
  midi.header.keySignatures = source.header.keySignatures.map((ks) => ({
    ...ks,
    ticks: ks.ticks === 0 ? 0 : at(ks.ticks),
  }));

  // Pickup: LilyPond writes the meter at tick 0 only. Rexiano reads a short
  // first bar as a meter at 0 that lasts exactly until the real one (#333).
  const pickup = bars[0]?.start ?? 0;
  if (pickup > 0) {
    const meter = midi.header.timeSignatures.find((ts) => ts.ticks === 0);
    if (!meter) throw new Error(`${piece.id}: no meter at tick 0`);
    let denominator = meter.timeSignature[1];
    while ((pickup * denominator) % whole !== 0 && denominator < 64) {
      denominator *= 2;
    }
    const numerator = (pickup * denominator) / whole;
    midi.header.timeSignatures = [
      { ticks: 0, timeSignature: [numerator, denominator] },
      { ticks: pickup, timeSignature: [...meter.timeSignature] },
      ...midi.header.timeSignatures.filter((ts) => ts.ticks > 0),
    ];
  }

  // A bar LilyPond made shorter or longer (a repeat that re-plays its pickup)
  // gets its own meter, so every later bar line stays where it belongs.
  for (const bar of odd) {
    const meterAt = (
      ticks: number,
    ): (typeof midi.header.timeSignatures)[number] =>
      [...midi.header.timeSignatures]
        .filter((ts) => ts.ticks <= ticks)
        .sort((a, b) => b.ticks - a.ticks)[0];
    const meter = meterAt(bar.start);
    let denominator = meter.timeSignature[1];
    while ((bar.span * denominator) % whole !== 0 && denominator < 64) {
      denominator *= 2;
    }
    const restore = [...meterAt(bar.next).timeSignature];
    midi.header.timeSignatures = midi.header.timeSignatures.filter(
      (ts) => ts.ticks !== bar.start && ts.ticks !== bar.next,
    );
    midi.header.timeSignatures.push(
      {
        ticks: bar.start,
        timeSignature: [(bar.span * denominator) / whole, denominator],
      },
      { ticks: bar.next, timeSignature: restore },
    );
  }
  midi.header.timeSignatures.sort((a, b) => a.ticks - b.ticks);

  // D.C. al Fine: play again from the top up to the bar that holds "Fine."
  const daCapo = parseDaCapo(log, index, whole);
  let replay: { until: number; offset: number } | null = null;
  if (daCapo) {
    if (pad > 0 || firstStart > 0) {
      throw new Error(`${piece.id}: D.C. with a pickup is not supported`);
    }
    const barEnd = (tick: number): number => {
      const next = bars.find((bar) => bar.start > tick);
      const last = bars[bars.length - 1];
      return next ? next.start : last.start + last.length;
    };
    // The repeat starts after the last written bar (the D.C. sits there).
    const lastNoteEnd = Math.max(
      ...playable.flatMap((track) =>
        track.notes.map((n) => at(n.ticks) + scale(n.durationTicks, false)),
      ),
    );
    replay = { until: barEnd(daCapo.fine), offset: barEnd(lastNoteEnd - 1) };
    const repeatMeters = midi.header.timeSignatures
      .filter((ts) => ts.ticks < replay!.until)
      .map((ts) => ({
        ticks: ts.ticks + replay!.offset,
        timeSignature: [...ts.timeSignature],
      }));
    midi.header.timeSignatures = [
      ...midi.header.timeSignatures.filter((ts) => ts.ticks < replay!.offset),
      ...repeatMeters,
    ];
    warnings.push("D.C. al Fine written out");
  }

  const hands = ["Right Hand", "Left Hand"] as const;
  playable.forEach((sourceTrack, i) => {
    const track = midi.addTrack();
    track.name = hands[i];
    track.channel = i;
    for (const note of sourceTrack.notes) {
      const written = {
        midi: note.midi,
        ticks: at(note.ticks),
        durationTicks: Math.max(1, scale(note.durationTicks, false)),
        velocity: note.velocity,
      };
      track.addNote(written);
      if (replay && written.ticks < replay.until) {
        track.addNote({ ...written, ticks: written.ticks + replay.offset });
      }
    }
  });
  midi.header.update();
  return { midi, warnings };
}

function songMeta(piece: Piece, midi: Midi): SongMeta {
  const difficulty =
    piece.grade >= 7
      ? "advanced"
      : piece.grade >= 4
        ? "intermediate"
        : "beginner";
  return {
    id: piece.id,
    file: `${piece.id}.mid`,
    title: piece.title,
    titleZhTW: piece.titleZhTW,
    searchAliases: piece.aliases,
    composer: piece.composer,
    difficulty,
    category: "study",
    grade: piece.grade,
    origin: "score",
    durationSeconds: computeMidiDurationSeconds(midi),
    tags: [...piece.tags, "two-hands", `level-${piece.grade}`],
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const mutopia = arg("--mutopia");
  if (!mutopia) throw new Error("--mutopia <clone> is required");
  const work = arg("--work") ?? join(root, "node_modules", ".cache", "mutopia");
  const only = arg("--only")?.split(",");

  const manifest = JSON.parse(
    readFileSync(join(here, "manifest.json"), "utf8"),
  ) as {
    pieces: Piece[];
  };
  const songsPath = join(midiDir, "songs.json");
  const songs = JSON.parse(readFileSync(songsPath, "utf8")) as SongMeta[];

  for (const piece of manifest.pieces) {
    if (only && !only.includes(piece.id)) continue;
    const out = renderMidi(mutopia, piece, work);
    const { midi, warnings } = convert(piece, out);
    writeFileSync(
      join(midiDir, `${piece.id}.mid`),
      Buffer.from(midi.toArray()),
    );
    // The score is rebuilt from this MIDI by `pnpm generate:songs`.
    rmSync(join(scoresDir, builtinScoreFileName(piece.id)), { force: true });
    const meta = songMeta(piece, midi);
    const at = songs.findIndex((s) => s.id === piece.id);
    if (at >= 0) songs[at] = meta;
    else songs.push(meta);
    console.log(
      `  ${piece.id.padEnd(30)} ${String(meta.durationSeconds).padStart(4)}s` +
        (warnings.length ? `  ⚠ ${warnings.join("; ")}` : ""),
    );
  }
  // A teaching piece taken out of the manifest leaves the library too.
  const kept = only
    ? songs
    : songs.filter(
        (song) =>
          song.category !== "study" ||
          manifest.pieces.some((piece) => piece.id === song.id),
      );
  writeFileSync(songsPath, formatSongsJson(kept));
}

if (
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])
) {
  main();
}
