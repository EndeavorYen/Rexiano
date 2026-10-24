import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import { musicXmlToMidi } from "@renderer/engines/score/musicXmlToMidi";
import { convertSongToNotation } from "./MidiToNotation";
import { resolveBuiltinNotationMetadata } from "./builtinNotationMetadata";
import { groupNotesIntoStaffVoices } from "./sheetMusicRenderUtils";
import { shouldRenderBassStaff } from "./sheetMusicUtils";
import type { BuiltinSongMeta } from "@shared/types";
import type { NotationMeasure, NotationNote } from "./types";

interface XmlNoteEvent {
  staff: 1 | 2;
  voice: number;
  startTick: number;
  durationTicks: number;
  isRest: boolean;
  midi: number | null;
  step?: string;
  alter?: number;
  octave?: number;
  vexKey?: string;
  expectedAccidental?: "#" | "b" | "n" | null;
  tieStart: boolean;
  tieStop: boolean;
}

interface XmlMeasure {
  number: number;
  isPickup: boolean;
  divisions: number;
  fifths: number;
  beats: number;
  beatType: number;
  staves: number;
  ticksPerMeasure: number;
  events: XmlNoteEvent[];
}

const STEP_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const SHARP_ORDER = ["f", "c", "g", "d", "a", "e", "b"];
const FLAT_ORDER = ["b", "e", "a", "d", "g", "c", "f"];

function keySignatureMap(fifths: number): Map<string, "" | "#" | "b"> {
  const map = new Map<string, "" | "#" | "b">([
    ["c", ""],
    ["d", ""],
    ["e", ""],
    ["f", ""],
    ["g", ""],
    ["a", ""],
    ["b", ""],
  ]);
  if (fifths > 0) {
    for (let i = 0; i < Math.min(fifths, 7); i++) {
      map.set(SHARP_ORDER[i], "#");
    }
  } else if (fifths < 0) {
    for (let i = 0; i < Math.min(-fifths, 7); i++) {
      map.set(FLAT_ORDER[i], "b");
    }
  }
  return map;
}

function parseGroundTruthMusicXml(
  xml: string,
  ppq = 480,
): { measures: XmlMeasure[]; staves: number; fifths: number } {
  let divisions = 24;
  let fifths = 0;
  let beats = 4;
  let beatType = 4;
  let staves = 1;

  const measureMatches = [
    ...xml.matchAll(/<measure\b([^>]*)>([\s\S]*?)<\/measure>/g),
  ];
  const measures: XmlMeasure[] = [];

  for (const match of measureMatches) {
    const attrs = match[1];
    const body = match[2];
    const numMatch = attrs.match(/number="(\d+)"/);
    const number = numMatch ? Number(numMatch[1]) : measures.length + 1;
    const isPickup = /implicit="yes"/.test(attrs);

    const divMatch = body.match(/<divisions>(\d+)<\/divisions>/);
    if (divMatch) divisions = Number(divMatch[1]);
    const fifthsMatch = body.match(/<fifths>(-?\d+)<\/fifths>/);
    if (fifthsMatch) fifths = Number(fifthsMatch[1]);
    const beatsMatch = body.match(
      /<time>[\s\S]*?<beats>(\d+)<\/beats>[\s\S]*?<beat-type>(\d+)<\/beat-type>[\s\S]*?<\/time>/,
    );
    if (beatsMatch) {
      beats = Number(beatsMatch[1]);
      beatType = Number(beatsMatch[2]);
    }
    const stavesMatch = body.match(/<staves>(\d+)<\/staves>/);
    if (stavesMatch) staves = Number(stavesMatch[1]);

    const divToTicks = (div: number): number =>
      Math.round((div * ppq) / divisions);

    let cursorDiv = 0;
    let lastNoteStartDiv = 0;
    const events: XmlNoteEvent[] = [];

    const tokenRegex = /<(note|backup|forward)\b[^>]*>([\s\S]*?)<\/\1>/g;
    for (const token of body.matchAll(tokenRegex)) {
      const kind = token[1];
      const content = token[2];
      const durMatch = content.match(/<duration>(\d+)<\/duration>/);
      const durDiv = durMatch ? Number(durMatch[1]) : 0;

      if (kind === "backup") {
        cursorDiv -= durDiv;
        continue;
      }
      if (kind === "forward") {
        cursorDiv += durDiv;
        continue;
      }

      const isChord = /<chord\/>/.test(content);
      const isRest = /<rest\/>/.test(content);
      const staffMatch = content.match(/<staff>(\d+)<\/staff>/);
      const staff = (staffMatch ? Number(staffMatch[1]) : 1) as 1 | 2;
      const voiceMatch = content.match(/<voice>(\d+)<\/voice>/);
      const voice = voiceMatch ? Number(voiceMatch[1]) : 1;
      const tieStart = /<tie\s+type="start"\s*\/>/.test(content);
      const tieStop = /<tie\s+type="stop"\s*\/>/.test(content);

      const noteStartDiv = isChord ? lastNoteStartDiv : cursorDiv;
      if (!isChord) {
        lastNoteStartDiv = cursorDiv;
        cursorDiv += durDiv;
      }

      if (isRest) {
        events.push({
          staff,
          voice,
          startTick: divToTicks(noteStartDiv),
          durationTicks: divToTicks(durDiv),
          isRest: true,
          midi: null,
          tieStart: false,
          tieStop: false,
        });
      } else {
        const step = content.match(/<step>([A-G])<\/step>/)?.[1] ?? "C";
        const alter = Number(
          content.match(/<alter>(-?\d+)<\/alter>/)?.[1] ?? 0,
        );
        const octave = Number(
          content.match(/<octave>(\d+)<\/octave>/)?.[1] ?? 4,
        );
        const midi = (octave + 1) * 12 + STEP_SEMITONES[step] + alter;
        const acc = alter === 1 ? "#" : alter === -1 ? "b" : "";
        const vexKey = `${step.toLowerCase()}${acc}/${octave}`;
        events.push({
          staff,
          voice,
          startTick: divToTicks(noteStartDiv),
          durationTicks: divToTicks(durDiv),
          isRest: false,
          midi,
          step,
          alter,
          octave,
          vexKey,
          tieStart,
          tieStop,
        });
      }
    }

    // Compute expected accidentals per staff in chronological order
    for (const staffNum of [1, 2] as const) {
      const defaults = keySignatureMap(fifths);
      const activeByOctaveKey = new Map<string, "" | "#" | "b">();
      const staffEvents = events
        .filter((e) => e.staff === staffNum && !e.isRest)
        .sort(
          (a, b) => a.startTick - b.startTick || (a.midi ?? 0) - (b.midi ?? 0),
        );

      for (const ev of staffEvents) {
        const stepLower = (ev.step ?? "C").toLowerCase();
        const pitchKey = `${stepLower}/${ev.octave}`;
        const noteAcc: "" | "#" | "b" =
          ev.alter === 1 ? "#" : ev.alter === -1 ? "b" : "";
        const currentActive =
          activeByOctaveKey.get(pitchKey) ?? defaults.get(stepLower) ?? "";

        if (ev.tieStop) {
          ev.expectedAccidental = null;
        } else if (noteAcc === currentActive) {
          ev.expectedAccidental = null;
        } else {
          ev.expectedAccidental = noteAcc === "" ? "n" : noteAcc;
          activeByOctaveKey.set(pitchKey, noteAcc);
        }
      }
    }

    const maxEndTick = events.reduce(
      (max, e) => Math.max(max, e.startTick + e.durationTicks),
      0,
    );
    const fullBarTicks = Math.round(ppq * beats * (4 / beatType));
    const ticksPerMeasure =
      isPickup && maxEndTick > 0 ? maxEndTick : fullBarTicks;

    measures.push({
      number,
      isPickup,
      divisions,
      fifths,
      beats,
      beatType,
      staves,
      ticksPerMeasure,
      events,
    });
  }

  return { measures, staves, fifths };
}

describe("Ground truth score audit across all 34 built-in songs", () => {
  const songsJson: BuiltinSongMeta[] = JSON.parse(
    readFileSync(join(process.cwd(), "resources/midi/songs.json"), "utf8"),
  );

  it("audits all 34 songs against their ground-truth MusicXML scores", () => {
    const summary: string[] = [];
    let totalSongsWithErrors = 0;

    for (const meta of songsJson) {
      const xmlPath = join(
        process.cwd(),
        "resources/scores",
        `${meta.id}.musicxml`,
      );
      const xml = readFileSync(xmlPath, "utf8");
      const midi = musicXmlToMidi(xml);
      const parsedSong = parseMidiFile(meta.file, Array.from(midi.toArray()));
      const builtinNotationMeta = resolveBuiltinNotationMetadata(
        meta.file,
        songsJson,
      );

      // 1. Test with builtinNotationMeta (library path)
      const notation = convertSongToNotation(
        parsedSong,
        builtinNotationMeta ?? undefined,
      );
      // 2. Test without builtinNotationMeta (imported MusicXML/MIDI path)
      const notationUnassisted = convertSongToNotation(parsedSong);

      const gt = parseGroundTruthMusicXml(xml, notation.ticksPerQuarter);

      const songErrors: string[] = [];

      // Check measure count
      if (notation.measures.length !== gt.measures.length) {
        songErrors.push(
          `measureCount: got ${notation.measures.length}, expected ${gt.measures.length}`,
        );
      }

      // Check measureIssues
      if ((notation.measureIssues?.length ?? 0) > 0) {
        songErrors.push(
          `measureIssues: ${notation.measureIssues?.length} mismatches (first: m=${notation.measureIssues?.[0]?.measureIndex} ${notation.measureIssues?.[0]?.clef} expected=${notation.measureIssues?.[0]?.expectedTicks} actual=${notation.measureIssues?.[0]?.actualTicks})`,
        );
      }

      // Check warnings
      if ((notation.warnings?.length ?? 0) > 0) {
        songErrors.push(
          `warnings: ${notation.warnings?.length} (${notation.warnings?.[0]?.kind})`,
        );
      }

      // Check unassisted key signature (imported file path)
      if (notationUnassisted.measures[0]?.keySignature !== gt.fifths) {
        songErrors.push(
          `unassisted keySignature: got ${notationUnassisted.measures[0]?.keySignature}, expected ${gt.fifths}`,
        );
      }

      // Check grand staff
      const renderedBass = shouldRenderBassStaff(notation.measures);
      const expectedBass = gt.staves > 1;
      if (renderedBass !== expectedBass) {
        songErrors.push(
          `renderBassStaff: got ${renderedBass}, expected ${expectedBass}`,
        );
      }

      const len = Math.min(notation.measures.length, gt.measures.length);
      for (let m = 0; m < len; m++) {
        const genM: NotationMeasure = notation.measures[m];
        const gtM: XmlMeasure = gt.measures[m];

        if (Boolean(genM.isPickup) !== gtM.isPickup) {
          songErrors.push(
            `m[${m}] isPickup: got ${genM.isPickup}, expected ${gtM.isPickup}`,
          );
        }
        if ((genM.number ?? m + 1) !== gtM.number) {
          songErrors.push(
            `m[${m}] number: got ${genM.number}, expected ${gtM.number}`,
          );
        }
        if (
          genM.timeSignatureTop !== gtM.beats ||
          genM.timeSignatureBottom !== gtM.beatType
        ) {
          songErrors.push(
            `m[${m}] meter: got ${genM.timeSignatureTop}/${genM.timeSignatureBottom}, expected ${gtM.beats}/${gtM.beatType}`,
          );
        }
        if (genM.keySignature !== gtM.fifths) {
          songErrors.push(
            `m[${m}] key: got ${genM.keySignature}, expected ${gtM.fifths}`,
          );
        }

        // Compare staves
        for (const [staffIdx, staffNotes] of [
          [1, genM.trebleNotes],
          [2, genM.bassNotes],
        ] as [1 | 2, NotationNote[]][]) {
          if (staffIdx === 2 && !expectedBass) continue;

          const gtStaffEvents = gtM.events.filter((e) => e.staff === staffIdx);
          const gtVoices = new Set(gtStaffEvents.map((e) => e.voice));
          const genVoices = groupNotesIntoStaffVoices(staffNotes);

          if (genVoices.length !== Math.max(1, gtVoices.size)) {
            songErrors.push(
              `m#${gtM.number} staff=${staffIdx} voiceCount: got ${genVoices.length}, expected ${Math.max(1, gtVoices.size)}`,
            );
          }

          // Check single-voice stemDirection
          if (gtVoices.size <= 1) {
            const forcedStems = staffNotes.filter(
              (n) => !n.isRest && n.stemDirection !== undefined,
            );
            if (forcedStems.length > 0) {
              songErrors.push(
                `m#${gtM.number} staff=${staffIdx} single-voice has forced stemDirection=${forcedStems[0].stemDirection}`,
              );
            }
          }

          // Compare sounding note attacks (non-tied-continuation)
          const gtAttacks = gtStaffEvents
            .filter((e) => !e.isRest && !e.tieStop)
            .sort(
              (a, b) =>
                a.startTick - b.startTick || (a.midi ?? 0) - (b.midi ?? 0),
            );
          const genAttacks = staffNotes
            .filter((n) => !n.isRest && !n.tiedFromPrevious)
            .sort(
              (a, b) =>
                a.startTick - b.startTick || (a.midi ?? 0) - (b.midi ?? 0),
            );

          if (genAttacks.length !== gtAttacks.length) {
            songErrors.push(
              `m#${gtM.number} staff=${staffIdx} attackCount: got ${genAttacks.length}, expected ${gtAttacks.length}`,
            );
          } else {
            for (let i = 0; i < gtAttacks.length; i++) {
              const ga = genAttacks[i];
              const gta = gtAttacks[i];
              if (
                ga.midi !== gta.midi ||
                Math.abs(ga.startTick - gta.startTick) > 2
              ) {
                songErrors.push(
                  `m#${gtM.number} staff=${staffIdx} attack[${i}]: got midi=${ga.midi}@${ga.startTick}, expected midi=${gta.midi}@${gta.startTick}`,
                );
              }
              if (ga.vexKey !== gta.vexKey) {
                songErrors.push(
                  `m#${gtM.number} staff=${staffIdx} vexKey[${i}]: got ${ga.vexKey}, expected ${gta.vexKey}`,
                );
              }
              if (ga.accidental !== gta.expectedAccidental) {
                songErrors.push(
                  `m#${gtM.number} staff=${staffIdx} accidental[${i}] (${ga.vexKey}@${ga.startTick}): got ${JSON.stringify(ga.accidental)}, expected ${JSON.stringify(gta.expectedAccidental)}`,
                );
              }
            }
          }

          // Compare total sounding duration per pitch attack
          // ( summing tied segments in the measure )
          const gtTotalSoundingTicks = gtStaffEvents
            .filter((e) => !e.isRest)
            .reduce((s, e) => s + e.durationTicks, 0);
          const genTotalSoundingTicks = staffNotes
            .filter((n) => !n.isRest)
            .reduce((s, n) => s + n.durationTicks, 0);
          if (Math.abs(genTotalSoundingTicks - gtTotalSoundingTicks) > 5) {
            songErrors.push(
              `m#${gtM.number} staff=${staffIdx} soundingTicks: got ${genTotalSoundingTicks}, expected ${gtTotalSoundingTicks}`,
            );
          }

          // Compare voice-level event durations (notes & rests) against ground truth
          if (genVoices.length === Math.max(1, gtVoices.size)) {
            const gtVoiceNums = [...gtVoices].sort((a, b) => a - b);
            // Match each gt voice to a gen voice by average pitch or index
            const gtVoiceLists = gtVoiceNums.map((vNum) => {
              const raw = gtStaffEvents.filter((e) => e.voice === vNum);
              // Collapse chords into single rhythmic events
              const collapsed: XmlNoteEvent[] = [];
              for (const ev of raw) {
                const prev = collapsed[collapsed.length - 1];
                if (
                  prev &&
                  !prev.isRest &&
                  !ev.isRest &&
                  Math.abs(prev.startTick - ev.startTick) <= 2 &&
                  Math.abs(prev.durationTicks - ev.durationTicks) <= 2
                ) {
                  continue;
                }
                collapsed.push(ev);
              }
              return collapsed;
            });

            // Sort gtVoiceLists by average pitch descending (matching VexFlow voice 0 = upper, voice 1 = lower)
            const sortedGtVoices = [...gtVoiceLists].sort((va, vb) => {
              const notesA = va.filter((e) => !e.isRest && e.midi !== null);
              const notesB = vb.filter((e) => !e.isRest && e.midi !== null);
              const avgA =
                notesA.reduce((s, e) => s + (e.midi ?? 0), 0) /
                Math.max(1, notesA.length);
              const avgB =
                notesB.reduce((s, e) => s + (e.midi ?? 0), 0) /
                Math.max(1, notesB.length);
              return avgB - avgA;
            });

            const allGenSpans: {
              startTick: number;
              durationTicks: number;
              isRest: boolean;
              pieces: string[];
            }[] = [];
            const allGtSpans: {
              startTick: number;
              durationTicks: number;
              isRest: boolean;
            }[] = [];

            for (let v = 0; v < sortedGtVoices.length; v++) {
              const gtV = sortedGtVoices[v];
              const genV = genVoices[v] ?? [];
              // Group raw staffNotes for this voiceIndex by startTick+durationTicks so we have exact ticks
              const voiceIndex = genV[0]?.voiceIndex ?? v;
              const rawVoiceNotes = staffNotes.filter(
                (n) => (n.voiceIndex ?? 0) === voiceIndex,
              );
              const timedGroups: {
                startTick: number;
                durationTicks: number;
                duration: string;
                dots: number;
                isRest: boolean;
                tiedFromPrevious: boolean;
                tiedToNext: boolean;
              }[] = [];
              for (const n of rawVoiceNotes) {
                const prev = timedGroups[timedGroups.length - 1];
                if (
                  prev &&
                  !prev.isRest &&
                  !n.isRest &&
                  prev.startTick === n.startTick &&
                  prev.durationTicks === n.durationTicks
                ) {
                  continue;
                }
                timedGroups.push({
                  startTick: n.startTick,
                  durationTicks: n.durationTicks,
                  duration: n.vexDuration.replace(/d$/, ""),
                  dots: n.dots,
                  isRest: n.isRest,
                  tiedFromPrevious: n.tiedFromPrevious ?? false,
                  tiedToNext: n.tiedToNext ?? false,
                });
              }

              // Collapse intra-measure ties and adjacent rests
              for (const g of timedGroups) {
                const pieceLabel = `${g.duration}${".".repeat(g.dots)}${g.isRest ? "r" : ""}`;
                const prev = allGenSpans[allGenSpans.length - 1];
                const isSameVoicePrev =
                  prev !== undefined &&
                  timedGroups.indexOf(g) > 0 &&
                  prev.startTick + prev.durationTicks === g.startTick;
                const isIntraMeasureTie =
                  isSameVoicePrev &&
                  !g.isRest &&
                  !prev.isRest &&
                  g.tiedFromPrevious &&
                  g.startTick > 0;
                // Check for misaligned dotted notes starting off-beat (e.g. q. starting at 16th-note offset 120)
                if (
                  !g.isRest &&
                  g.dots > 0 &&
                  g.duration === "q" &&
                  g.startTick % notation.ticksPerQuarter !== 0 &&
                  g.startTick % (notation.ticksPerQuarter / 2) !== 0
                ) {
                  songErrors.push(
                    `m#${gtM.number} staff=${staffIdx} v=${v} misaligned dotted quarter at tick=${g.startTick}`,
                  );
                }
                const isAdjacentRest =
                  isSameVoicePrev && g.isRest && prev.isRest;
                if (isIntraMeasureTie || isAdjacentRest) {
                  prev.durationTicks += g.durationTicks;
                  prev.pieces.push(pieceLabel);
                } else {
                  allGenSpans.push({
                    startTick: g.startTick,
                    durationTicks: g.durationTicks,
                    isRest: g.isRest,
                    pieces: [pieceLabel],
                  });
                }
              }

              // Also collapse adjacent rests in gtV
              let firstInVoice = true;
              for (const e of gtV) {
                const prev = allGtSpans[allGtSpans.length - 1];
                if (!firstInVoice && e.isRest && prev && prev.isRest) {
                  prev.durationTicks += e.durationTicks;
                } else {
                  allGtSpans.push({
                    startTick: e.startTick,
                    durationTicks: e.durationTicks,
                    isRest: e.isRest,
                  });
                }
                firstInVoice = false;
              }
            }

            const sortSpans = <
              T extends {
                startTick: number;
                durationTicks: number;
                isRest: boolean;
              },
            >(
              arr: T[],
            ): T[] =>
              [...arr].sort(
                (a, b) =>
                  a.startTick - b.startTick ||
                  Number(a.isRest) - Number(b.isRest) ||
                  a.durationTicks - b.durationTicks,
              );

            const sortedGenSpans = sortSpans(allGenSpans);
            const sortedGtSpans = sortSpans(allGtSpans);

            if (sortedGenSpans.length !== sortedGtSpans.length) {
              songErrors.push(
                `m#${gtM.number} staff=${staffIdx} spanCount: got ${sortedGenSpans.length}, expected ${sortedGtSpans.length}`,
              );
            } else {
              for (let s = 0; s < sortedGtSpans.length; s++) {
                const gs = sortedGenSpans[s];
                const gts = sortedGtSpans[s];
                if (
                  gs.isRest !== gts.isRest ||
                  Math.abs(gs.startTick - gts.startTick) > 2 ||
                  Math.abs(gs.durationTicks - gts.durationTicks) > 2
                ) {
                  songErrors.push(
                    `m#${gtM.number} staff=${staffIdx} span[${s}]: got ${gs.isRest ? "R" : "N"}@${gs.startTick}:${gs.durationTicks}[${gs.pieces.join("+")}], expected ${gts.isRest ? "R" : "N"}@${gts.startTick}:${gts.durationTicks}`,
                  );
                }
              }
            }
          }
        }
      }

      if (songErrors.length > 0) {
        totalSongsWithErrors++;
        summary.push(
          `[${meta.id}] (${songErrors.length} issues):\n  - ${songErrors.slice(0, 15).join("\n  - ")}`,
        );
      }
    }

    expect(songsJson.length).toBe(34);
    expect(summary).toEqual([]);
    expect(totalSongsWithErrors).toBe(0);
  });
});
