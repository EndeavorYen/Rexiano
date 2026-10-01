/**
 * Standard engraving choices for the score panel (#330).
 *
 * VexFlow is loaded lazily, so these helpers take the module as an argument
 * instead of importing it.
 */
import type { Fraction } from "vexflow";

type VexFlow = typeof import("vexflow");

export type StemOptions = { autoStem: true } | { stemDirection: 1 | -1 };

/**
 * Single-voice notes follow the position rule (on or above the middle line →
 * stem down). Only multi-voice staves force voice 1 up and voice 2 down.
 */
export function stemOptionsForGroup(group: {
  stemDirection?: 1 | -1;
}): StemOptions {
  return group.stemDirection === undefined
    ? { autoStem: true }
    : { stemDirection: group.stemDirection };
}

export interface BeamConfig {
  groups?: Fraction[];
  stemDirection?: 1 | -1;
  maintainStemDirections: boolean;
}

/**
 * Beam per beat of the meter (6/8 → 3+3 eighths, 3/4 → per quarter). A
 * single voice lets each beam pick one stem side for its whole group; a
 * fixed voice keeps its direction.
 *
 * Half-note meters beam straight eighths in fours, but a triplet is one
 * quarter long and must keep its own beam, so a voice with tuplets beams per
 * quarter instead.
 */
export function beamConfigForVoice(
  stemDirection: 1 | -1 | undefined,
  timeSignature: string,
  VF?: VexFlow,
  hasTuplets = false,
): BeamConfig {
  const halfNoteBeat = timeSignature.split("/")[1] === "2";
  const groups =
    VF && hasTuplets && halfNoteBeat
      ? [new VF.Fraction(1, 4)]
      : VF?.Beam.getDefaultBeamGroups(timeSignature);
  return stemDirection === undefined
    ? { groups, maintainStemDirections: false }
    : { groups, stemDirection, maintainStemDirections: true };
}
