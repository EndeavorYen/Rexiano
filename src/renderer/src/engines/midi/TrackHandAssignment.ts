import type { ParsedTrack } from "./types";

export type TrackHandAssignment = "left" | "right" | "both" | "background";
export type TrackHandAssignmentConfidence = "high" | "medium" | "low";

export interface InferredTrackHandAssignment {
  trackIndex: number;
  hand: TrackHandAssignment;
  active: boolean;
  confidence: TrackHandAssignmentConfidence;
}

const RIGHT_HAND_PATTERN = /(^|[^a-z])(right|r\.?h\.?|treble)([^a-z]|$)/i;
const LEFT_HAND_PATTERN = /(^|[^a-z])(left|l\.?h\.?|bass)([^a-z]|$)/i;
const PERCUSSION_PATTERN = /drum|percussion|kit|cymbal|snare|tom|kick/i;
const PIANO_PATTERN = /piano|keyboard|grand|upright|electric piano|keys/i;

function trackText(track: ParsedTrack): string {
  return `${track.name} ${track.instrument}`.trim();
}

function isPercussionTrack(track: ParsedTrack): boolean {
  return track.channel === 9 || PERCUSSION_PATTERN.test(trackText(track));
}

function isClearlyNonPianoTrack(track: ParsedTrack): boolean {
  const text = trackText(track);
  if (text.length === 0) return false;
  return !PIANO_PATTERN.test(text);
}

function averageMidi(track: ParsedTrack): number | null {
  if (track.notes.length === 0) return null;
  return (
    track.notes.reduce((sum, note) => sum + note.midi, 0) / track.notes.length
  );
}

function inferExplicitHand(
  track: ParsedTrack,
): Pick<InferredTrackHandAssignment, "hand" | "active" | "confidence"> | null {
  const text = trackText(track);
  if (RIGHT_HAND_PATTERN.test(text)) {
    return { hand: "right", active: true, confidence: "high" };
  }
  if (LEFT_HAND_PATTERN.test(text)) {
    return { hand: "left", active: true, confidence: "high" };
  }
  return null;
}

export function inferTrackHandAssignments(
  tracks: ParsedTrack[],
): InferredTrackHandAssignment[] {
  const assignments = tracks.map((track, trackIndex) => {
    if (isPercussionTrack(track)) {
      return {
        trackIndex,
        hand: "background",
        active: false,
        confidence: "high",
      } satisfies InferredTrackHandAssignment;
    }

    const explicitHand = inferExplicitHand(track);
    if (explicitHand) return { trackIndex, ...explicitHand };

    if (isClearlyNonPianoTrack(track)) {
      return {
        trackIndex,
        hand: "background",
        active: false,
        confidence: "medium",
      } satisfies InferredTrackHandAssignment;
    }

    return {
      trackIndex,
      hand: "both",
      active: true,
      confidence: "low",
    } satisfies InferredTrackHandAssignment;
  });

  const pitchCandidates = assignments.filter(
    (assignment) =>
      assignment.hand === "both" &&
      averageMidi(tracks[assignment.trackIndex]) !== null,
  );

  if (pitchCandidates.length === 2) {
    const [a, b] = pitchCandidates;
    const aAvg = averageMidi(tracks[a.trackIndex])!;
    const bAvg = averageMidi(tracks[b.trackIndex])!;
    const diff = Math.abs(aAvg - bAvg);

    if (diff >= 7) {
      const rightIndex = aAvg > bAvg ? a.trackIndex : b.trackIndex;
      const leftIndex = aAvg > bAvg ? b.trackIndex : a.trackIndex;

      return assignments.map((assignment) => {
        if (assignment.trackIndex === rightIndex) {
          return { ...assignment, hand: "right", confidence: "medium" };
        }
        if (assignment.trackIndex === leftIndex) {
          return { ...assignment, hand: "left", confidence: "medium" };
        }
        return assignment;
      });
    }
  }

  return assignments;
}
